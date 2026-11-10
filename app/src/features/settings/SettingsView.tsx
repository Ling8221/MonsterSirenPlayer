import { save } from "@tauri-apps/plugin-dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Check,
  ChevronDown,
  Database,
  FileText,
  Info,
  Monitor,
  Palette,
  Search,
  Trash2,
} from "lucide-react";
import { invokeTauri, isTauri } from "@/lib/tauri";
import {
  THEME_PRESETS,
  clampLogKb,
  DEFAULT_UI_SCALE,
  fontDisplayName,
  fontStackFor,
  formatBytes,
  normalizeFontFamily,
  parseHexColor,
  toHex,
  type ThemeMode,
} from "@/lib/theme";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { toast } from "@/store/useToastStore";

interface ConfigInfo {
  configDir: string;
  exePath: string;
  logsDir: string;
  logPath: string;
  logSize: number;
  logFiles: number;
  logTotalSize: number;
  logLimitKb: number;
}

interface DataFileInfo {
  name: string;
  label: string;
  path: string;
  size: number;
  exists: boolean;
}

interface BackupInfo {
  name: string;
  size: number;
  createdAt: number;
  files: number;
}

const BUILTIN_FONT = "MiSans VF";

const TABS = [
  { id: "appearance", label: "外观", icon: Palette },
  { id: "data", label: "数据", icon: Database },
  { id: "about", label: "关于", icon: Info },
] as const;

const THEME_MODES: { id: ThemeMode; label: string }[] = [
  { id: "dark", label: "深色" },
  { id: "light", label: "浅色" },
  { id: "system", label: "跟随系统" },
];

const CLEAR_OPTIONS = [
  { id: "settings", label: "设置与偏好", hint: "主题、字体、窗口记忆、缩放、日志上限" },
  { id: "library", label: "歌单与收藏", hint: "收藏的歌曲与自建歌单" },
  { id: "session", label: "播放记录", hint: "上次关闭前的播放队列与位置" },
  { id: "cache", label: "曲库缓存", hint: "删除后下次启动重新拉取" },
  { id: "logs", label: "日志", hint: "logs 目录下的所有日志文件" },
  { id: "backups", label: "备份", hint: "backups 目录下的所有备份文件" },
] as const;

type SettingsTab = (typeof TABS)[number]["id"];

function SectionHeader({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="settings-section-head">
      <span className="settings-section-icon">{icon}</span>
      <div>
        <h2>{title}</h2>
      </div>
    </div>
  );
}

export function SettingsView() {
  const themeColor = useSettingsStore((state) => state.themeColor);
  const themeMode = useSettingsStore((state) => state.themeMode);
  const uiScale = useSettingsStore((state) => state.uiScale);
  const rememberWindowSize = useSettingsStore((state) => state.rememberWindowSize);
  const closeBehavior = useSettingsStore((state) => state.closeBehavior);
  const fontFamily = useSettingsStore((state) => state.fontFamily);
  const logMaxKb = useSettingsStore((state) => state.logMaxKb);
  const setThemeColor = useSettingsStore((state) => state.setThemeColor);
  const setThemeMode = useSettingsStore((state) => state.setThemeMode);
  const setUiScale = useSettingsStore((state) => state.setUiScale);
  const setRememberWindowSize = useSettingsStore((state) => state.setRememberWindowSize);
  const setCloseBehavior = useSettingsStore((state) => state.setCloseBehavior);
  const setFontFamily = useSettingsStore((state) => state.setFontFamily);
  const setLogMaxKb = useSettingsStore((state) => state.setLogMaxKb);

  const songs = useLibraryStore((state) => state.songs.length);
  const albums = useLibraryStore((state) => state.albums.length);

  const [tab, setTab] = useState<SettingsTab>("appearance");
  const [appVersion, setAppVersion] = useState(__APP_VERSION__);
  const [info, setInfo] = useState<ConfigInfo | null>(null);
  const [logDraft, setLogDraft] = useState(String(logMaxKb));
  const [hexDraft, setHexDraft] = useState(themeColor);
  const [hexInvalid, setHexInvalid] = useState(false);

  const [dataFiles, setDataFiles] = useState<DataFileInfo[]>([]);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [backingUp, setBackingUp] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const [clearTargets, setClearTargets] = useState<string[]>([]);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  const [fonts, setFonts] = useState<string[]>([]);
  const [fontPickerOpen, setFontPickerOpen] = useState(false);
  const [fontQuery, setFontQuery] = useState("");
  const [fontDraft, setFontDraft] = useState(normalizeFontFamily(fontFamily));
  const fontPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLogDraft(String(logMaxKb));
  }, [logMaxKb]);

  useEffect(() => {
    setHexDraft(themeColor);
    setHexInvalid(false);
  }, [themeColor]);

  useEffect(() => {
    setFontDraft(normalizeFontFamily(fontFamily));
  }, [fontFamily]);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    void invokeTauri<string>("app_version")
      .then((value) => {
        if (!cancelled && value) setAppVersion(value);
      })
      .catch((error) => console.warn("[settings] 读取版本号失败", error));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    void invokeTauri<ConfigInfo>("config_info")
      .then((value) => {
        if (!cancelled) setInfo(value);
      })
      .catch((error) => console.warn("[settings] 读取目录信息失败", error));
    return () => {
      cancelled = true;
    };
  }, [logMaxKb]);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    void invokeTauri<string[]>("list_system_fonts")
      .then((list) => {
        // 系统字体原样保留；内置 MiSans VF 由 fontOptions 合并，避免重复。
        if (!cancelled) {
          setFonts(list.filter((name) => name.toLowerCase() !== BUILTIN_FONT.toLowerCase()));
        }
      })
      .catch((error) => console.warn("[settings] 读取系统字体失败", error));
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshConfigData = async (): Promise<void> => {
    if (!isTauri()) return;
    try {
      const [files, list, config] = await Promise.all([
        invokeTauri<DataFileInfo[]>("data_files"),
        invokeTauri<BackupInfo[]>("backup_list"),
        invokeTauri<ConfigInfo>("config_info"),
      ]);
      setDataFiles(files);
      setBackups(list);
      setInfo(config);
    } catch (error) {
      console.warn("[settings] 读取数据信息失败", error);
    }
  };

  useEffect(() => {
    if (tab === "data") void refreshConfigData();
  }, [tab]);

  useEffect(() => {
    if (!fontPickerOpen) return;
    const handlePointerDown = (event: PointerEvent): void => {
      if (fontPickerRef.current?.contains(event.target as Node)) return;
      setFontPickerOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setFontPickerOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [fontPickerOpen]);

  const normalizedQuery = fontQuery.trim().toLowerCase();

  // 内置 MiSans VF 不置顶，和系统字体一起排序；系统里同名只保留一个。
  const fontOptions = useMemo(() => {
    const byName = new Map<string, string>();
    for (const name of fonts) {
      byName.set(name.toLowerCase(), name);
    }
    byName.set(BUILTIN_FONT.toLowerCase(), BUILTIN_FONT);
    return [...byName.values()].sort((left, right) =>
      left.localeCompare(right, "zh-Hans-CN", { sensitivity: "base" }),
    );
  }, [fonts]);

  const matchedFonts = useMemo(() => {
    if (!normalizedQuery) return fontOptions;
    return fontOptions.filter((name) => name.toLowerCase().includes(normalizedQuery));
  }, [fontOptions, normalizedQuery]);

  const fontDirty = normalizeFontFamily(fontDraft) !== normalizeFontFamily(fontFamily);

  const applyFontDraft = (): void => {
    setFontFamily(fontDraft);
    toast(`字体已应用：${fontDisplayName(fontDraft)}`, "success");
  };

  const discardFontDraft = (): void => {
    setFontDraft(normalizeFontFamily(fontFamily));
  };

  const commitLogDraft = (): void => {
    const parsed = Number(logDraft);
    if (!Number.isFinite(parsed)) {
      setLogDraft(String(logMaxKb));
      return;
    }
    const clamped = clampLogKb(parsed);
    setLogDraft(String(clamped));
    setLogMaxKb(clamped);
    toast(`日志上限已设为 ${clamped} KB`, "success");
  };

  const handleHexChange = (value: string): void => {
    setHexDraft(value);
    const parsed = parseHexColor(value);
    if (parsed) {
      setHexInvalid(false);
      setThemeColor(toHex(parsed));
    } else {
      setHexInvalid(value.trim() !== "" && value.trim() !== "#");
    }
  };

  const handleBackup = async (): Promise<void> => {
    if (!isTauri() || backingUp) return;
    setBackingUp(true);
    try {
      const created = await invokeTauri<BackupInfo>("backup_create");
      toast(`备份已创建：${created.name}`, "success");
      await refreshConfigData();
    } catch (error) {
      toast(`备份失败：${error instanceof Error ? error.message : String(error)}`, "error");
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestore = async (): Promise<void> => {
    if (!restoreTarget || restoring) return;
    setRestoring(true);
    try {
      await invokeTauri("backup_restore", { name: restoreTarget });
      toast("已恢复配置，正在重新加载…", "success");
      window.setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      toast(`恢复失败：${error instanceof Error ? error.message : String(error)}`, "error");
      setRestoring(false);
      setRestoreTarget(null);
    }
  };

  const handleDeleteBackup = async (): Promise<void> => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await invokeTauri("backup_delete", { name: deleteTarget });
      toast("备份已删除", "success");
      setDeleteTarget(null);
      await refreshConfigData();
    } catch (error) {
      toast(`删除失败：${error instanceof Error ? error.message : String(error)}`, "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleExportBackup = async (name: string): Promise<void> => {
    if (!isTauri() || exporting) return;
    setExporting(name);
    try {
      const destination = await save({
        defaultPath: name,
        filters: [{ name: "JSON 备份", extensions: ["json"] }],
      });
      if (!destination) return;
      await invokeTauri("backup_export", { name, dest: destination });
      toast("备份已导出", "success");
    } catch (error) {
      toast(`导出失败：${error instanceof Error ? error.message : String(error)}`, "error");
    } finally {
      setExporting(null);
    }
  };

  const allSelected = clearTargets.length === CLEAR_OPTIONS.length;

  const toggleClearTarget = (id: string): void => {
    setClearConfirm(false);
    setClearTargets((current) =>
      current.includes(id) ? current.filter((target) => target !== id) : [...current, id],
    );
  };

  const handleClearSelected = async (): Promise<void> => {
    if (!isTauri() || clearTargets.length === 0 || clearing) return;
    setClearing(true);
    try {
      await invokeTauri("clear_data", { targets: clearTargets });
      toast("已清除所选数据", "success");
      const needsReload = clearTargets.some(
        (target) => target === "settings" || target === "library" || target === "session",
      );
      setClearConfirm(false);
      if (needsReload) {
        window.setTimeout(() => window.location.reload(), 700);
        return;
      }
      setClearTargets([]);
      await refreshConfigData();
      setClearing(false);
    } catch (error) {
      toast(`清除失败：${error instanceof Error ? error.message : String(error)}`, "error");
      setClearing(false);
    }
  };

  return (
    <div className="view view-fill settings-view">
      <section className="settings-panel" aria-label="设置">
        <header className="settings-panel-head">
          <h1>设置</h1>
        </header>

        <nav className="settings-tabs" role="tablist" aria-label="设置分类">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`settings-tab${active ? " active" : ""}`}
                onClick={() => setTab(item.id)}
              >
                <Icon size={15} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="settings-panel-body">
          {tab === "appearance" ? (
            <>
              <section className="settings-section">
                <SectionHeader
                  icon={<Palette size={18} />}
                  title="外观"
                />

                <div className="setting-row">
                  <div className="setting-label">
                    <span>主题模式</span>
                    <small>深色、浅色，或跟随系统外观自动切换</small>
                  </div>
                  <div className="segmented" role="group" aria-label="主题模式">
                    {THEME_MODES.map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        className={`segmented-item${themeMode === mode.id ? " active" : ""}`}
                        aria-pressed={themeMode === mode.id}
                        onClick={() => setThemeMode(mode.id)}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="setting-row">
                <div className="setting-label">
                  <span>主题色</span>
                  <small>点选预设、输入色码（如 #18d1ff），或使用取色器</small>
                </div>
                <div className="theme-controls">
                  <div className="theme-swatches">
                    {THEME_PRESETS.map((preset) => {
                      const active = preset.value.toLowerCase() === themeColor.toLowerCase();
                      return (
                        <button
                          key={preset.value}
                          type="button"
                          className={`theme-swatch${active ? " active" : ""}`}
                          style={{ background: preset.value }}
                          title={preset.name}
                          aria-label={preset.name}
                          aria-pressed={active}
                          onClick={() => setThemeColor(preset.value)}
                        >
                          {active ? <Check size={13} strokeWidth={3} /> : null}
                        </button>
                      );
                    })}
                    <label className="theme-custom" title="自定义主题色">
                      <input
                        type="color"
                        value={themeColor}
                        onChange={(event) => setThemeColor(event.target.value)}
                      />
                      <span style={{ background: themeColor }} />
                    </label>
                  </div>
                  <label className={`theme-hex${hexInvalid ? " invalid" : ""}`}>
                    <span
                      className="theme-hex-preview"
                      style={{ background: hexInvalid ? "transparent" : themeColor }}
                    />
                    <input
                      value={hexDraft}
                      spellCheck={false}
                      maxLength={7}
                      placeholder="#18d1ff"
                      aria-label="主题色色码"
                      onChange={(event) => handleHexChange(event.target.value)}
                      onBlur={() => {
                        if (hexInvalid) {
                          setHexDraft(themeColor);
                          setHexInvalid(false);
                        } else {
                          const parsed = parseHexColor(hexDraft);
                          if (parsed) setHexDraft(toHex(parsed));
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="setting-row">
                <div className="setting-label">
                  <span>字体</span>
                  <small>默认使用内置 MiSans VF；选择后先预览，点「应用」才会生效</small>
                </div>
                <div className="font-picker" ref={fontPickerRef}>
                  <button
                    type="button"
                    className="settings-select font-picker-trigger"
                    aria-haspopup="listbox"
                    aria-expanded={fontPickerOpen}
                    onClick={() => {
                      setFontPickerOpen((value) => !value);
                      setFontQuery("");
                    }}
                  >
                    <span style={{ fontFamily: fontStackFor(fontDraft) }}>
                      {fontDisplayName(fontDraft)}
                    </span>
                    <ChevronDown size={15} />
                  </button>

                  {fontPickerOpen ? (
                    <div className="font-picker-popover">
                      <label className="font-search">
                        <Search size={14} />
                        <input
                          autoFocus
                          value={fontQuery}
                          spellCheck={false}
                          placeholder={`搜索字体（共 ${fontOptions.length} 个）`}
                          onChange={(event) => setFontQuery(event.target.value)}
                        />
                      </label>

                      <div className="font-list" role="listbox">
                        {matchedFonts.map((name) => {
                          const selected =
                            normalizeFontFamily(fontDraft) === normalizeFontFamily(name);
                          return (
                            <button
                              key={name}
                              type="button"
                              role="option"
                              aria-selected={selected}
                              className={`font-option${selected ? " active" : ""}`}
                              style={{ fontFamily: fontStackFor(name) }}
                              onClick={() => {
                                setFontDraft(name);
                                setFontPickerOpen(false);
                              }}
                            >
                              <span>{name}</span>
                              {selected ? <Check size={14} /> : null}
                            </button>
                          );
                        })}

                        {matchedFonts.length === 0 ? (
                          <p className="font-empty">没有匹配「{fontQuery.trim()}」的字体</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="settings-preview" style={{ fontFamily: fontStackFor(fontDraft) }}>
                <span>重铸未来 方舟启航</span>
                <span className="settings-preview-en">Reforging the Future, Ark Sets Sail</span>
              </div>

              {fontDirty ? (
                <div className="font-confirm">
                  <button type="button" className="btn" onClick={discardFontDraft}>
                    放弃
                  </button>
                  <button type="button" className="btn btn-primary" onClick={applyFontDraft}>
                    应用
                  </button>
                </div>
              ) : null}
            </section>

            <section className="settings-section">
              <SectionHeader
                icon={<Monitor size={18} />}
                title="窗口与界面"
              />

              <div className="setting-row">
                <div className="setting-label">
                  <span>记住窗口大小</span>
                  <small>下次启动时恢复上次的窗口尺寸、位置与最大化状态</small>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={rememberWindowSize}
                  aria-label="记住窗口大小"
                  className={`switch${rememberWindowSize ? " active" : ""}`}
                  onClick={() => setRememberWindowSize(!rememberWindowSize)}
                >
                  <span className="switch-knob" />
                </button>
              </div>

              <div className="setting-row">
                <div className="setting-label">
                  <span>关闭窗口时</span>
                  <small>最小化到托盘继续播放，或直接退出程序</small>
                </div>
                <div className="segmented" role="group" aria-label="关闭窗口时">
                  <button
                    type="button"
                    className={`segmented-item${closeBehavior === "tray" ? " active" : ""}`}
                    aria-pressed={closeBehavior === "tray"}
                    onClick={() => setCloseBehavior("tray")}
                  >
                    最小化到托盘
                  </button>
                  <button
                    type="button"
                    className={`segmented-item${closeBehavior === "exit" ? " active" : ""}`}
                    aria-pressed={closeBehavior === "exit"}
                    onClick={() => setCloseBehavior("exit")}
                  >
                    退出程序
                  </button>
                </div>
              </div>

              <div className="setting-row">
                <div className="setting-label">
                  <span>界面缩放</span>
                  <small>75%–150%，调整整个界面的显示比例</small>
                </div>
                <div className="settings-inline">
                  <input
                    className="settings-range"
                    type="range"
                    min={75}
                    max={150}
                    step={5}
                    value={Math.round(uiScale * 100)}
                    aria-label="界面缩放"
                    onChange={(event) => setUiScale(Number(event.target.value) / 100)}
                  />
                  <span className="settings-unit">{Math.round(uiScale * 100)}%</span>
                  <button
                    type="button"
                    className="btn settings-reset"
                    disabled={Math.abs(uiScale - DEFAULT_UI_SCALE) < 0.001}
                    onClick={() => setUiScale(DEFAULT_UI_SCALE)}
                  >
                    重置
                  </button>
                </div>
              </div>
            </section>
          </>
          ) : null}

          {tab === "data" ? (
            <>
              <section className="settings-section">
                <SectionHeader
                  icon={<FileText size={18} />}
                  title="日志"
                />

                <div className="setting-row">
                  <div className="setting-label">
                    <span>日志总大小上限</span>
                    <small>范围 64–10240 KB，默认 512 KB</small>
                  </div>
                  <div className="settings-inline">
                    <input
                      className="settings-number"
                      type="number"
                      min={64}
                      max={10240}
                      step={64}
                      value={logDraft}
                      onChange={(event) => setLogDraft(event.target.value)}
                      onBlur={commitLogDraft}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") commitLogDraft();
                      }}
                    />
                    <span className="settings-unit">KB</span>
                  </div>
                </div>

                <div className="settings-meta">
                  <span>
                    当前文件：
                    <strong>{info ? info.logPath.split(/[\\/]/).pop() : "—"}</strong>
                  </span>
                  <span>
                    当前大小：<strong>{info ? formatBytes(info.logSize) : "—"}</strong>
                  </span>
                  <span>
                    目录：<strong>{info?.logFiles ?? 0}</strong> 个文件 /{" "}
                    {info ? formatBytes(info.logTotalSize) : "—"}
                  </span>
                </div>
                <div className="settings-meta">
                  <span className="settings-path">{info?.logsDir ?? "—"}</span>
                </div>
              </section>

              <section className="settings-section">
                <SectionHeader
                  icon={<Database size={18} />}
                  title="配置文件"
                />

                <div className="data-file-list">
                  {!isTauri() ? (
                    <p className="settings-meta">浏览器预览中不可用</p>
                  ) : dataFiles.length === 0 ? (
                    <p className="settings-meta">读取中…</p>
                  ) : (
                    dataFiles.map((file) => (
                      <div key={file.name} className="data-file-row">
                        <div className="data-file-meta">
                          <span className="data-file-label">{file.label}</span>
                          <span className="settings-path">{file.name}</span>
                        </div>
                        <span className="data-file-size">
                          {file.exists ? formatBytes(file.size) : "未创建"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="settings-section">
                <SectionHeader
                  icon={<Archive size={18} />}
                  title="备份与恢复"
                />

                <div className="data-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={backingUp || !isTauri()}
                    onClick={() => void handleBackup()}
                  >
                    {backingUp ? "正在备份…" : "立即备份"}
                  </button>
                  <span className="settings-meta">共 {backups.length} 个备份</span>
                </div>

                {backups.length === 0 ? (
                  <p className="settings-meta">暂无备份</p>
                ) : (
                  <div className="backup-list">
                    {backups.map((backup) => (
                      <div key={backup.name} className="backup-row">
                        <div className="backup-meta">
                          <span className="backup-name">{backup.name}</span>
                          <span className="backup-time">
                            {new Date(backup.createdAt).toLocaleString("zh-CN")} ·{" "}
                            {formatBytes(backup.size)}
                          </span>
                        </div>
                        {restoreTarget === backup.name ? (
                          <div className="backup-confirm">
                            <button
                              type="button"
                              className="btn"
                              disabled={restoring}
                              onClick={() => setRestoreTarget(null)}
                            >
                              取消
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger"
                              disabled={restoring}
                              onClick={() => void handleRestore()}
                            >
                              {restoring ? "恢复中…" : "确认恢复"}
                            </button>
                          </div>
                        ) : deleteTarget === backup.name ? (
                          <div className="backup-confirm">
                            <button
                              type="button"
                              className="btn"
                              disabled={deleting}
                              onClick={() => setDeleteTarget(null)}
                            >
                              取消
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger"
                              disabled={deleting}
                              onClick={() => void handleDeleteBackup()}
                            >
                              {deleting ? "删除中…" : "确认删除"}
                            </button>
                          </div>
                        ) : (
                          <div className="backup-actions">
                            <button
                              type="button"
                              className="btn"
                              disabled={restoring || deleting || exporting !== null}
                              onClick={() => void handleExportBackup(backup.name)}
                            >
                              {exporting === backup.name ? "导出中…" : "导出"}
                            </button>
                            <button
                              type="button"
                              className="btn"
                              disabled={restoring || deleting || exporting !== null}
                              onClick={() => {
                                setRestoreTarget(backup.name);
                                setDeleteTarget(null);
                              }}
                            >
                              恢复
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger-ghost"
                              disabled={restoring || deleting || exporting !== null}
                              onClick={() => {
                                setDeleteTarget(backup.name);
                                setRestoreTarget(null);
                              }}
                            >
                              删除
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="settings-section">
                <SectionHeader icon={<Trash2 size={18} />} title="清除数据" />

                <div className="clear-options">
                  {CLEAR_OPTIONS.map((option) => (
                    <label key={option.id} className="clear-option">
                      <input
                        type="checkbox"
                        checked={clearTargets.includes(option.id)}
                        onChange={() => toggleClearTarget(option.id)}
                      />
                      <span className="clear-option-text">
                        <span>{option.label}</span>
                        <small>{option.hint}</small>
                      </span>
                    </label>
                  ))}
                </div>

                <div className="clear-actions">
                  {clearConfirm ? (
                    <>
                      <span className="clear-warning">选中的数据将被永久删除。</span>
                      <button
                        type="button"
                        className="btn"
                        disabled={clearing}
                        onClick={() => setClearConfirm(false)}
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={clearing}
                        onClick={() => void handleClearSelected()}
                      >
                        {clearing ? "清除中…" : "确认清除"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setClearConfirm(false);
                          setClearTargets(
                            allSelected ? [] : CLEAR_OPTIONS.map((option) => option.id),
                          );
                        }}
                      >
                        {allSelected ? "取消全选" : "全选"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={clearTargets.length === 0 || !isTauri()}
                        onClick={() => setClearConfirm(true)}
                      >
                        清除所选
                      </button>
                      <span className="settings-meta">已选 {clearTargets.length} 项</span>
                    </>
                  )}
                </div>
              </section>
            </>
          ) : null}

          {tab === "about" ? (
            <section className="settings-section">
              <SectionHeader
                icon={<Info size={18} />}
                title="关于"
              />

              <dl className="about-grid">
                <div>
                  <dt>版本</dt>
                  <dd>v{appVersion.replace(/\.0$/, "")}</dd>
                </div>
                <div>
                  <dt>技术栈</dt>
                  <dd>Tauri 2 · React 19 · TypeScript · Vite · Zustand</dd>
                </div>
                <div>
                  <dt>曲库</dt>
                  <dd>
                    {songs} 首歌曲 · {albums} 张专辑
                  </dd>
                </div>
                <div className="about-note">
                  <dt>说明</dt>
                  <dd>
                    曲库、封面与歌词版权归塞壬唱片 MSR / Hypergryph 所有，本程序仅供个人学习与本地播放使用。
                  </dd>
                </div>
              </dl>
            </section>
          ) : null}
        </div>
      </section>
    </div>
  );
}
