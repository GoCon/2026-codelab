import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { parse } from "smol-toml";

const basePath = process.env.VITE_BASE_PATH ?? "/";

const tomlData = (): Plugin => ({
  name: "quiz-app2-toml-data",
  transform(source, id) {
    if (!id.endsWith(".toml")) {
      return null;
    }

    const parsed = parse(source);

    return {
      code: `export default ${JSON.stringify(parsed)};`,
      map: null,
    };
  },
});

// https://vite.dev/config/
export default defineConfig({
  base: basePath,
  plugins: [tomlData(), vue(), tailwindcss()],
  test: {
    environment: "jsdom",
  },
});
