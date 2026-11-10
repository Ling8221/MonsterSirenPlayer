// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import App from "@/App";
import { useSettingsStore } from "@/store/useSettingsStore";

const library = JSON.parse(
  readFileSync(resolve(__dirname, "../public/mock/library.json"), "utf8"),
) as { details: Record<string, { songs?: { name: string }[] }> };
const lyrics = readFileSync(resolve(__dirname, "../public/mock/lyrics/demo.lrc"), "utf8");

function respond(body: string, contentType = "application/json"): Response {
  return new Response(body, { status: 200, headers: { "content-type": contentType } });
}

async function flush(times = 8): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await act(async () => {
      await new Promise((resolveTick) => setTimeout(resolveTick, 0));
    });
  }
}

describe("应用冒烟测试", () => {
  let root: Root | null = null;
  let container: HTMLDivElement;
  let playedSongName = "";

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.history.replaceState({}, "", "/?mock=1");

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/mock/library.json")) return respond(JSON.stringify(library));
      if (url.includes("/mock/lyrics/demo.lrc")) return respond(lyrics, "text/plain");
      if (url.includes("/mock/silence.wav")) return respond("", "audio/wav");
      return new Response("not found", { status: 404 });
    }) as typeof fetch;
  });

  afterAll(async () => {
    if (root) {
      await act(async () => root!.unmount());
      root = null;
    }
  });

  it("首页渲染品牌与最新专辑", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(<App />);
    });
    await flush();

    expect(container.textContent).toContain("塞壬唱片 MSR");
    expect(container.textContent).not.toContain("Monster Siren Records");
    expect(container.textContent).not.toContain("NEW RELEASE");
    expect(container.querySelector(".featured-album")).not.toBeNull();
    expect(container.querySelector(".featured-name")?.textContent?.length).toBeGreaterThan(0);
    expect(container.querySelector(".featured-intro")?.textContent?.trim().length).toBeGreaterThan(0);
    expect(container.querySelector(".player-bar")).not.toBeNull();

    // 右上角窗口控制常驻（浏览器预览下为禁用态）
    const traffic = container.querySelectorAll(".titlebar .window-btn");
    expect(traffic.length).toBe(3);
    expect((traffic[0] as HTMLButtonElement).disabled).toBe(true);

    const pinned = container.querySelector(".sidebar-playlists .sidebar-playlist");
    expect(pinned?.classList.contains("pinned")).toBe(true);
    expect(pinned?.textContent).toContain("我的收藏");
  });

  it("我的收藏固定在歌单顶部并可打开", async () => {
    const pinned = container.querySelector(".sidebar-playlists .sidebar-playlist") as HTMLButtonElement;
    expect(pinned.classList.contains("pinned")).toBe(true);

    await act(async () => {
      pinned.click();
    });
    await flush();

    expect(container.textContent).toContain("还没有收藏的歌曲");
  });

  it("侧边栏可以切到歌曲页并播放歌曲", async () => {
    const navButtons = [...container.querySelectorAll(".sidebar-link")];
    const songsButton = navButtons.find((button) => button.textContent?.includes("歌曲"));
    expect(songsButton).toBeTruthy();

    await act(async () => {
      (songsButton as HTMLButtonElement).click();
    });
    await flush();

    const rows = container.querySelectorAll(".song-row");
    expect(rows.length).toBeGreaterThan(0);

    const firstRow = rows[0] as HTMLElement;
    const songName = firstRow.querySelector(".song-name")?.textContent ?? "";
    expect(songName.length).toBeGreaterThan(0);

    await act(async () => {
      firstRow.click();
    });
    await flush();

    const playerTitle = container.querySelector(".player-title");
    expect(playerTitle?.textContent).toBe(songName);
    playedSongName = songName;
  });

  it("拖动音量条时实时显示百分比", async () => {
    const volume = container.querySelector(".volume-range") as HTMLInputElement;
    expect(volume).toBeTruthy();

    await act(async () => {
      volume.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });

    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setter?.call(volume, "0.5");
      volume.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector(".volume-tooltip")?.textContent).toBe("50%");

    await act(async () => {
      window.dispatchEvent(new Event("pointerup"));
    });
    await flush();
    expect(container.querySelector(".volume-tooltip")).toBeNull();
  });

  it("沉浸式播放页显示歌词与队列抽屉", async () => {
    const coverButton = container.querySelector(".player-cover-btn") as HTMLButtonElement;
    expect(coverButton).toBeTruthy();

    await act(async () => {
      coverButton.click();
    });
    await flush();

    const nowPlaying = container.querySelector(".now-playing");
    expect(nowPlaying).not.toBeNull();
    expect(container.querySelector(".np-title")?.textContent).toBe(playedSongName);

    // 沉浸式页顶部只保留窗口控制
    expect(container.querySelectorAll(".np-topbar .window-btn").length).toBe(3);
    expect(container.querySelector(".np-topbar .icon-btn")).toBeNull();

    // 歌词来自 /mock/lyrics/demo.lrc
    expect(container.querySelectorAll(".lyric-line").length).toBeGreaterThan(0);

    const queueButton = [...container.querySelectorAll(".np-extra .icon-btn")].find(
      (button) => button.getAttribute("aria-label") === "播放队列",
    );
    expect(queueButton).toBeTruthy();

    await act(async () => {
      (queueButton as HTMLButtonElement).click();
    });
    await flush();

    expect(container.querySelector(".np-queue-drawer")).not.toBeNull();
    expect(container.querySelectorAll(".np-queue-drawer .queue-item").length).toBeGreaterThan(0);

    // 关闭沉浸式页，避免影响后续用例（收起按钮在左下角）
    const closeButton = container.querySelector(".np-collapse") as HTMLButtonElement;
    expect(closeButton).toBeTruthy();
    await act(async () => {
      closeButton.click();
    });
    await flush();
    expect(container.querySelector(".now-playing")).toBeNull();
  });

  it("设置页可以渲染并切换主题色", async () => {
    await act(async () => {
      useSettingsStore.getState().setFontFamily("Microsoft YaHei");
    });

    const navButtons = [...container.querySelectorAll(".sidebar-link")];
    const settingsButton = navButtons.find((button) => button.textContent?.includes("设置"));
    expect(settingsButton).toBeTruthy();

    await act(async () => {
      (settingsButton as HTMLButtonElement).click();
    });
    await flush();

    // 设置是内容区里的卡片页，侧边栏保留，不铺满窗口
    expect(container.querySelector(".settings-panel")).not.toBeNull();
    expect(container.querySelector(".sidebar")).not.toBeNull();
    expect(container.querySelector(".content .settings-view")).not.toBeNull();
    expect(container.querySelectorAll(".settings-tab").length).toBe(3);
    expect(container.querySelector(".settings-tab.active")?.textContent).toContain("外观");
    expect(container.querySelector(".settings-panel")?.textContent).not.toContain("MONSTER SIREN");

    expect(container.textContent).toContain("主题色");
    expect(container.textContent).not.toContain("主题色会应用到按钮");
    expect(container.textContent).not.toContain("控制窗口尺寸记忆");
    expect(container.querySelectorAll(".theme-swatch").length).toBeGreaterThan(0);

    // 预览区只保留中英文两段，不再有小字说明
    const preview = container.querySelector(".settings-preview");
    expect(preview?.textContent).toContain("重铸未来 方舟启航");
    expect(preview?.textContent).toContain("Reforging the Future, Ark Sets Sail");
    expect(container.querySelector(".settings-preview-sub")).toBeNull();

    const violet = [...container.querySelectorAll(".theme-swatch")].find(
      (button) => button.getAttribute("aria-label") === "紫罗兰",
    );
    expect(violet).toBeTruthy();

    await act(async () => {
      (violet as HTMLButtonElement).click();
    });
    await flush();

    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#a78bfa");

    // 色码输入：合法值立即生效，非法值只标红不应用
    const hexInput = container.querySelector(".theme-hex input") as HTMLInputElement;
    const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      inputSetter?.call(hexInput, "#34d399");
      hexInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await flush();
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#34d399");

    await act(async () => {
      inputSetter?.call(hexInput, "#zzzzzz");
      hexInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await flush();
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#34d399");
    expect(container.querySelector(".theme-hex.invalid")).not.toBeNull();

    // 字体：选择只改预览，点「应用」才生效
    const fontTrigger = container.querySelector(".font-picker-trigger") as HTMLButtonElement;
    expect(fontTrigger.textContent).toContain("Microsoft YaHei");
    await act(async () => {
      fontTrigger.click();
    });
    await flush();
    expect(container.querySelector(".font-search input")).not.toBeNull();
    expect(container.textContent).not.toContain("（默认）");

    const miSansOption = [...container.querySelectorAll(".font-option")].find((option) =>
      option.textContent?.includes("MiSans VF"),
    );
    expect(miSansOption).toBeTruthy();

    await act(async () => {
      (miSansOption as HTMLButtonElement).click();
    });
    await flush();

    // 未应用：全局字体仍是 Microsoft YaHei，确认栏出现
    expect(document.documentElement.style.getPropertyValue("--font-sans")).toContain("Microsoft YaHei");
    expect(container.querySelector(".font-confirm")).not.toBeNull();
    expect(preview?.textContent).toContain("Reforging the Future, Ark Sets Sail");

    const applyButton = [...container.querySelectorAll(".font-confirm .btn")].find((button) =>
      button.textContent?.includes("应用"),
    );
    await act(async () => {
      (applyButton as HTMLButtonElement).click();
    });
    await flush();

    expect(document.documentElement.style.getPropertyValue("--font-sans")).toContain("MiSans VF");
    expect(useSettingsStore.getState().fontFamily).toBe("");
    expect(container.querySelector(".font-confirm")).toBeNull();

    // 「放弃」回退预览，不改变已应用的字体
    await act(async () => {
      useSettingsStore.getState().setFontFamily("Microsoft YaHei");
    });
    await flush();
    const triggerAgain = container.querySelector(".font-picker-trigger") as HTMLButtonElement;
    await act(async () => {
      triggerAgain.click();
    });
    await flush();
    const miSansAgain = [...container.querySelectorAll(".font-option")].find((option) =>
      option.textContent?.includes("MiSans VF"),
    );
    await act(async () => {
      (miSansAgain as HTMLButtonElement).click();
    });
    await flush();

    const discardButton = [...container.querySelectorAll(".font-confirm .btn")].find((button) =>
      button.textContent?.includes("放弃"),
    );
    await act(async () => {
      (discardButton as HTMLButtonElement).click();
    });
    await flush();

    expect(container.querySelector(".font-picker-trigger")?.textContent).toContain("Microsoft YaHei");
    expect(document.documentElement.style.getPropertyValue("--font-sans")).toContain("Microsoft YaHei");
    expect(useSettingsStore.getState().fontFamily).toBe("Microsoft YaHei");

    await act(async () => {
      useSettingsStore.getState().setFontFamily("");
    });

    // 主题模式：深色 / 浅色 / 跟随系统
    const lightMode = [...container.querySelectorAll(".segmented-item")].find((button) =>
      button.textContent?.includes("浅色"),
    );
    await act(async () => {
      (lightMode as HTMLButtonElement).click();
    });
    await flush();
    expect(document.documentElement.dataset.theme).toBe("light");

    const darkMode = [...container.querySelectorAll(".segmented-item")].find((button) =>
      button.textContent?.includes("深色"),
    );
    await act(async () => {
      (darkMode as HTMLButtonElement).click();
    });
    await flush();
    expect(document.documentElement.dataset.theme).toBe("dark");

    await act(async () => {
      useSettingsStore.getState().setThemeMode("system");
    });

    // 界面缩放
    const scaleInput = container.querySelector(".settings-range") as HTMLInputElement;
    await act(async () => {
      inputSetter?.call(scaleInput, "125");
      scaleInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await flush();
    expect(useSettingsStore.getState().uiScale).toBe(1.25);
    expect(document.documentElement.style.getPropertyValue("zoom")).toBe("1.25");

    // 重置按钮恢复 100%
    const resetScale = container.querySelector(".settings-reset") as HTMLButtonElement;
    expect(resetScale).toBeTruthy();
    await act(async () => {
      resetScale.click();
    });
    await flush();
    expect(useSettingsStore.getState().uiScale).toBe(1);
    expect(document.documentElement.style.getPropertyValue("zoom")).toBe("1");

    // 关闭行为
    expect(container.textContent).toContain("关闭窗口时");
    const exitBehavior = [...container.querySelectorAll(".segmented-item")].find(
      (button) => button.textContent?.trim() === "退出程序",
    ) as HTMLButtonElement;
    await act(async () => {
      exitBehavior.click();
    });
    await flush();
    expect(useSettingsStore.getState().closeBehavior).toBe("exit");

    // 记住窗口大小开关
    const rememberSwitch = container.querySelector('[role="switch"]') as HTMLButtonElement;
    expect(rememberSwitch).toBeTruthy();
    await act(async () => {
      rememberSwitch.click();
    });
    await flush();
    expect(useSettingsStore.getState().rememberWindowSize).toBe(false);
    await act(async () => {
      rememberSwitch.click();
    });

    // 顶部标签切换：数据 / 关于
    const clickTab = async (label: string): Promise<void> => {
      const button = [...container.querySelectorAll(".settings-tab")].find((item) =>
        item.textContent?.includes(label),
      );
      expect(button).toBeTruthy();
      await act(async () => {
        (button as HTMLButtonElement).click();
      });
      await flush();
    };

    await clickTab("数据");
    expect(container.textContent).toContain("日志总大小上限");
    expect(container.textContent).toContain("配置文件");
    expect(container.textContent).toContain("备份与恢复");
    expect(container.textContent).not.toContain("所有配置只保留三个文件");
    expect(container.textContent).not.toContain("打开 logs 目录");
    expect(container.textContent).not.toContain("复制日志路径");

    // 清除数据：可多选，未选择时按钮禁用
    expect(container.textContent).toContain("清除数据");
    const clearInputs = container.querySelectorAll(".clear-option input");
    expect(clearInputs.length).toBe(6);
    const clearButton = [...container.querySelectorAll(".clear-actions .btn")].find((button) =>
      button.textContent?.includes("清除所选"),
    ) as HTMLButtonElement;
    expect(clearButton.disabled).toBe(true);
    await act(async () => {
      (clearInputs[0] as HTMLInputElement).click();
    });
    await flush();
    expect((clearInputs[0] as HTMLInputElement).checked).toBe(true);
    expect(container.textContent).toContain("已选 1 项");

    // 日志上限：输入越界值后失焦，应被夹到 10240
    const numberInput = container.querySelector(".settings-number") as HTMLInputElement;
    await act(async () => {
      inputSetter?.call(numberInput, "999999");
      numberInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      numberInput.dispatchEvent(new Event("focusout", { bubbles: true }));
    });
    await flush();
    expect(useSettingsStore.getState().logMaxKb).toBe(10240);

    await clickTab("关于");
    expect(container.textContent).toContain("版本");
    expect(container.textContent).toContain("技术栈");
    expect(container.textContent).not.toContain("数据目录");
    expect(container.textContent).not.toContain("打开 config 目录");
    expect(container.textContent).not.toContain("设置保存在");
  });

  it("搜索页可以按关键字过滤", async () => {
    const navButtons = [...container.querySelectorAll(".sidebar-link")];
    const searchButton = navButtons.find((button) => button.textContent?.includes("搜索"));
    await act(async () => {
      (searchButton as HTMLButtonElement).click();
    });
    await flush();

    const input = container.querySelector(".search-field input") as HTMLInputElement;
    expect(input).toBeTruthy();

    const keyword = "花街";
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, keyword);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain("花街迎春");
    expect(container.querySelectorAll(".search-album-row .album-card").length).toBeGreaterThan(0);

    // 默认展开，可分别折叠专辑和歌曲
    const albumToggle = container.querySelector(
      ".search-albums .search-section-toggle",
    ) as HTMLButtonElement;
    const songsToggle = container.querySelector(
      ".search-songs-head .search-section-toggle",
    ) as HTMLButtonElement;
    expect(albumToggle.getAttribute("aria-expanded")).toBe("true");
    expect(songsToggle.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelectorAll(".search-songs .song-row").length).toBeGreaterThan(0);

    await act(async () => {
      albumToggle.click();
    });
    await flush();
    expect(container.querySelector(".search-album-row")).toBeNull();
    expect(albumToggle.getAttribute("aria-expanded")).toBe("false");

    await act(async () => {
      albumToggle.click();
    });
    await flush();
    expect(container.querySelectorAll(".search-album-row .album-card").length).toBeGreaterThan(0);

    await act(async () => {
      songsToggle.click();
    });
    await flush();
    expect(container.querySelectorAll(".search-songs .song-row").length).toBe(0);
    expect(songsToggle.getAttribute("aria-expanded")).toBe("false");

    await act(async () => {
      songsToggle.click();
    });
    await flush();
    expect(container.querySelectorAll(".search-songs .song-row").length).toBeGreaterThan(0);
  });
});
