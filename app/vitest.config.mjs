import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const importDir = fileURLToPath(new URL(".", import.meta.url));
const rootDir = importDir.includes("node_modules") ? process.cwd() : importDir;

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify("0.0.0-test"),
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
    // 线程池不依赖子进程，能在受限环境（禁止创建管道）下运行。
    pool: "threads",
  },
});
