# Project structure

```text
src/
  pages/                  Source HTML pages, published at the site root
  assets/
    css/                  Shared stylesheets
    js/                   Shared frontend logic and validation helpers
scripts/                  Build, local server, and admin utilities
supabase/
  functions/              Supabase Edge Functions
  schema.sql              Database tables, policies, triggers, and functions
  config.toml             Local Supabase Auth and database settings
test/                     Local automated checks
docs/                     Setup, deployment, and architecture notes
dist/                     Generated static site; do not edit or commit
```

The build copies `src/pages/` to the root of `dist/`, and `src/assets/` to `dist/assets/`. This keeps existing deployed URLs such as `/patient.html` and `/reset-password.html` stable. `config.js` is generated into `dist/` from environment variables at build time and is not a source file.

## Where to make changes

- Edit page content and page-specific markup in `src/pages/`.
- Edit shared styling in `src/assets/css/styles.css`.
- Edit authentication, portal behavior, and input validation in `src/assets/js/`.
- Update database behavior in `supabase/schema.sql`; review RLS policies whenever tables or roles change.
- Keep deployment and admin utilities in `scripts/`.
- Put operational guidance in `docs/` and keep the root README as the entry point.
