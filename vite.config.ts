import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Populate process.env so server-side functions and Nitro have access
  for (const [k, v] of Object.entries(env)) {
    if (!process.env[k]) {
      process.env[k] = v;
    }
  }

  return {
    plugins: [
      tanstackStart(),
      nitro(),
      viteReact(),
      tailwindcss(),
      tsConfigPaths(),
    ],
  };
});
