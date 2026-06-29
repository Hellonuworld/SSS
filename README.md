# Still Steel Astro Site

This repository is now structured as an Astro static site.

## Commands

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Structure

- `src/pages/` contains the Astro page routes.
- `src/components/LegacyPage.astro` renders the existing production HTML during the migration phase.
- `public/` contains static assets copied into the final build, including `css`, `images`, `js`, `videos`, `webflow`, `CNAME`, and `.nojekyll`.
- Legacy root HTML files are kept as source material while the site is migrated component by component.

## Migration Notes

The current migration keeps the existing HTML, animation scripts, inquiry form logic, and visual behavior intact by importing each production page as raw HTML. This makes the move to Astro low-risk. Future work can progressively replace legacy raw pages with native Astro layouts and components.
