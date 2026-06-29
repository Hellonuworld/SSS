import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://www.still-steel.com",
  build: {
    format: "file"
  },
  trailingSlash: "never"
});
