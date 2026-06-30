import { defineConfig } from "astro/config";

import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  site: "https://www.still-steel.com",

  build: {
    format: "file"
  },

  trailingSlash: "never",
  adapter: cloudflare()
});