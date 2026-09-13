import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const appBasePath = process.env.VITE_APP_BASE_PATH ?? "/apps/xuetuzhiban";

export default defineConfig({
  plugins: [react()],
  base: `${appBasePath}/`,
  server: {
    proxy: {
      "/api/xuetuzhiban": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/xuetuzhiban/, "/api"),
      },
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
