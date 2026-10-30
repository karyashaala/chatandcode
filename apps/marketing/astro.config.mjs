import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://chatcode.ca",
  server: {
    port: Number(process.env.PORT ?? 4173),
  },
});
