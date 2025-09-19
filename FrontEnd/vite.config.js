import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
    plugins: [vue()],
    server: {
        proxy: {
            "/api": {
                target: "http://backend:3000", // контейнер backend в Docker
                changeOrigin: true,
            },
        },
    },
});