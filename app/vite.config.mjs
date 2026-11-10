import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const host = process.env.TAURI_DEV_HOST;
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

/**
 * 配置目录。
 *
 * 统一用 `--configLoader native` 启动 Vite / Vitest：打包配置的旧路径会在 Windows 上
 * 执行一次 `net use`（判断网络盘），在禁止子进程的受限终端里会抛 `spawn EPERM`，
 * 导致 `tauri dev` 直接退出。native 模式不做这一步，因此也不要求管理员权限。
 *
 * 配置写成 .mjs 而不是 .ts，这样 native 加载不依赖 Node 的 TypeScript 支持，
 * 任何 Node 18+ 都能直接 import。
 */
const importDir = fileURLToPath(new URL(".", import.meta.url));
const rootDir = importDir.includes("node_modules") ? process.cwd() : importDir;

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
    // 仅在浏览器里调试时使用：把接口与 CDN 代理出去，绕开 CORS。
    // Tauri 运行时（开发与打包）统一走后端命令，不依赖这两个代理。
    proxy: {
      "/api": {
        target: "https://monster-siren.hypergryph.com",
        changeOrigin: true,
        secure: false,
      },
      "/hycdn": {
        target: "https://web.hycdn.cn",
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace(/^\/hycdn/, ""),
        headers: { Referer: "https://monster-siren.hypergryph.com", "User-Agent": "Mozilla/5.0" },
      },
    },
  },
  build: {
    target: "chrome110",
    sourcemap: false,
  },
});
