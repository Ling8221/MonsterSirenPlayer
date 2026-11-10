//! 枚举系统已安装的字体家族，供设置页的字体选择器使用。
//!
//! Windows 走 DirectWrite，能拿到本地化的家族名（优先中文，其次英文）；
//! 其他平台返回空列表，前端只保留内置 MiSans VF。

#[cfg(windows)]
mod windows_impl {
    use windows::core::{BOOL, PCWSTR};
    use windows::Win32::Graphics::DirectWrite::{
        DWriteCreateFactory, IDWriteFactory, IDWriteFontCollection, IDWriteLocalizedStrings,
        DWRITE_FACTORY_TYPE_SHARED,
    };

    unsafe fn read_string(strings: &IDWriteLocalizedStrings, index: u32) -> Option<String> {
        let length = strings.GetStringLength(index).ok()? as usize;
        let mut buffer = vec![0u16; length + 1];
        strings.GetString(index, &mut buffer).ok()?;
        String::from_utf16(&buffer[..length]).ok()
    }

    unsafe fn preferred_index(strings: &IDWriteLocalizedStrings) -> u32 {
        for locale in ["zh-cn", "en-us"] {
            let wide: Vec<u16> = locale.encode_utf16().chain(std::iter::once(0)).collect();
            let mut index = 0u32;
            let mut exists = BOOL(0);
            if strings
                .FindLocaleName(PCWSTR(wide.as_ptr()), &mut index, &mut exists)
                .is_ok()
                && exists.as_bool()
            {
                return index;
            }
        }

        let count = strings.GetCount();
        for index in 0..count {
            let Ok(length) = strings.GetLocaleNameLength(index) else {
                continue;
            };
            let mut buffer = vec![0u16; length as usize + 1];
            if strings.GetLocaleName(index, &mut buffer).is_ok() {
                let locale = String::from_utf16_lossy(&buffer[..length as usize]).to_lowercase();
                if locale.starts_with("en") {
                    return index;
                }
            }
        }
        0
    }

    pub fn list() -> Vec<String> {
        unsafe {
            let Ok(factory) = DWriteCreateFactory::<IDWriteFactory>(DWRITE_FACTORY_TYPE_SHARED) else {
                return Vec::new();
            };

            let mut collection: Option<IDWriteFontCollection> = None;
            if factory
                .GetSystemFontCollection(&mut collection, false)
                .is_err()
            {
                return Vec::new();
            }
            let Some(collection) = collection else {
                return Vec::new();
            };

            let count = collection.GetFontFamilyCount();
            let mut names = Vec::with_capacity(count as usize);
            for index in 0..count {
                let Ok(family) = collection.GetFontFamily(index) else {
                    continue;
                };
                let Ok(localized) = family.GetFamilyNames() else {
                    continue;
                };
                if let Some(name) = read_string(&localized, preferred_index(&localized)) {
                    let name = name.trim().to_string();
                    // DirectWrite 会把竖排变体以 @ 开头列出，界面上不需要。
                    if !name.is_empty() && !name.starts_with('@') {
                        names.push(name);
                    }
                }
            }

            names.sort_by_key(|name| name.to_lowercase());
            names.dedup_by(|left, right| left.eq_ignore_ascii_case(right));
            names
        }
    }
}

#[cfg(windows)]
pub fn list_system_fonts() -> Vec<String> {
    windows_impl::list()
}

#[cfg(not(windows))]
pub fn list_system_fonts() -> Vec<String> {
    Vec::new()
}
