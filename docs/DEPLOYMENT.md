# Setup and deployment

## Supabase project

1. The checked-in `supabase/public-config.json` contains this app's public Supabase project URL and publishable key so static builds, including Render, can generate `config.js` without environment variables. To build against a different project, set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env` locally or in the hosting provider's environment variables; environment values override the checked-in defaults. The build rejects database passwords, secret keys, and service-role keys.
2. Run `supabase/schema.sql` in the Supabase SQL Editor for a new project. For existing projects, run the appointment migrations in order: `20261116000000_hourly_appointment_capacity.sql`, then `20261116000001_appointment_payment_preference.sql`. This adds the five-booking hourly capacity and saves the patient's selected payment preference; the demo UPI option does not process a payment.
3. In **Authentication → Providers → Email**, enable email sign-ups and turn **Confirm email** off. The checked-in `supabase/config.toml` also sets `enable_confirmations = false` for local Supabase development; changing this file does not alter an already hosted project's dashboard settings.
4. Existing unconfirmed users must be confirmed by an administrator in Supabase Auth or deleted and recreated after disabling confirmation. New patient sign-ups return an active session and go directly to the patient portal.
6. Add `/reset-password.html` to the redirect allowlist for password recovery. For the production site, allow `https://YOUR-DOMAIN/**`; locally allow `http://localhost:4173/**`.
7. Deploy `manage-doctor` separately with the Supabase CLI: `supabase login`, `supabase link --project-ref YOUR_PROJECT_REF`, then `supabase functions deploy manage-doctor`.
8. Create the first admin account through the patient sign-up form, complete the required patient fields, and then run the following in the SQL Editor with that email substituted:

   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
   where email = 'admin@example.com';

   update public.profiles set role = 'admin'
   where email = 'admin@example.com';
   ```

   Doctor accounts are created later from the admin portal. Never assign privileged roles from public sign-up metadata.

## Vercel

Import this repository, set `SUPABASE_URL` and `SUPABASE_ANON_KEY`, and deploy. `vercel.json` runs `npm run build` and publishes `dist/`. Vercel serves the same root paths as the previous deployment.

## Render

Use the included `render.yaml` Blueprint. The static build uses `supabase/public-config.json`, so Render does not require Supabase environment variables for the clinic's configured project. If you override the project in Render's Environment settings, set both `SUPABASE_URL` and `SUPABASE_ANON_KEY` to the project URL and public publishable/anon key. The build publishes only `dist/`, and the security headers are applied by the Blueprint. Redeploy after changing environment variables.

## Local development

Run `npm start` to build and serve the generated site at `http://localhost:4173`. To run Supabase locally, use the Supabase CLI and apply the checked-in `supabase/config.toml` and schema.

## Email/password sign-in

Patient registration uses Supabase email/password sign-up without an email confirmation link, verification page, or OTP screen. The sign-up response must contain an active session; the app then opens the patient portal. In the hosted Supabase project's dashboard, turn **Authentication → Providers → Email → Confirm email** off. Supabase project dashboard settings are separate from repository configuration, so setting `enable_confirmations = false` in `supabase/config.toml` only applies when configuring the local Supabase stack. Accounts created while confirmation was enabled remain unconfirmed and must be confirmed administratively or recreated.

## Secrets and generated files

The browser receives only the Supabase public publishable/anon key. Keep service-role credentials in trusted server-side environments only. `.env`, `dist/`, generated `config.js`, dependencies, and local deployment state are ignored by Git.
