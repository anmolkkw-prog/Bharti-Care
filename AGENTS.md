# Repository guidance

- Keep editable website source in `src/pages/` and `src/assets/`; do not add new application source files at the repository root.
- Preserve the public root URLs when changing the build. Vercel and Render both publish the generated `dist/` directory.
- Keep generated output, secrets, and dependency folders out of source control. Never expose Supabase service-role credentials in browser assets.
- Treat `supabase/schema.sql` RLS policies and the role assignment model as security boundaries. Public sign-up must only create patient accounts.
- Update `docs/STRUCTURE.md` or `docs/DEPLOYMENT.md` when the build layout, hosting, or authentication setup changes.
- Do not run tests or other verification commands unless the user asks for verification.
