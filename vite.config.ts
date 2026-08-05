import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const atlasTarget = "http://127.0.0.1:4174";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    proxy: {
      "/api": atlasTarget,
      "/snapshot.json": atlasTarget,
    },
  },
});
