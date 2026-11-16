# Setup and deployment

## Supabase project

1. The checked-in `supabase/public-config.json` contains this app's public Supabase project URL and publishable key so static builds, including Render, can generate `config.js` without environment variables. To build against a different project, set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env` locally or in the hosting provider's environment variables; environment values override the checked-in defaults. The build rejects database passwords, secret keys, and service-role keys.
2. Run `supabase/schema.sql` in the Supabase SQL Editor for a new project. For an existing project, review and apply schema changes according to your database migration process.
3. In **Authentication → Providers → Email**, enable email sign-ups and **Confirm email**. The checked-in `supabase/config.toml` also sets `enable_confirmations = true` for local Supabase development; it does not change an already hosted project's dashboard settings.
4. Set the project's **Site URL** in **Authentication → URL Configuration** to the deployed site URL. In **Authentication → Email Templates → Confirm signup**, set the subject to `Verify your Bharti Care account` and copy [`supabase/templates/confirmation.html`](../supabase/templates/confirmation.html). Keep the custom `{{ .SiteURL }}/verify-email.html?token_hash={{ .TokenHash }}&amp;type=email` link and the fallback `{{ .Token }}` code. Remove any `{{ .ConfirmationURL }}` link. The custom link opens the site verification page, exchanges the token hash for a session, and signs the patient in; the OTP remains available if they prefer to enter a code.
5. In **Authentication → SMTP Settings**, configure a custom SMTP provider before accepting patient sign-ups. Supabase's built-in sender is for testing: it only sends to addresses belonging to the Supabase organization and is limited to two emails per hour. If a code is missing, first inspect **Authentication → Logs** and the SMTP provider's delivery/suppression logs. Also check spam/junk. See [Supabase's SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp) and [email rate limits](https://supabase.com/docs/guides/auth/rate-limits).
6. In **Authentication → URL Configuration**, set the production site as the Site URL and allow the deployed and local URLs. Include `/reset-password.html` for password recovery redirects. For example, allow `https://YOUR-DOMAIN/reset-password.html` and `http://localhost:4173/reset-password.html`.
7. Deploy `manage-doctor` separately with the Supabase CLI: `supabase login`, `supabase link --project-ref YOUR_PROJECT_REF`, then `supabase functions deploy manage-doctor`.
8. Create the first admin in **Authentication → Users → Add user**, then run the following in the SQL Editor with that email substituted:

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

## Email OTP sign-up

The browser validates email syntax, creates a patient account with `auth.signUp`, displays an OTP entry step, verifies a code using `auth.verifyOtp({ type: 'signup' })`, and offers `auth.resend` with a 60-second cooldown. The email's custom verification link opens `/verify-email.html`, which exchanges `token_hash` using `auth.verifyOtp({ type: 'email' })` and then opens the patient portal in the signed-in session. Syntax validation cannot prove an inbox exists; successful link or OTP verification proves the user can access it. For privacy, public sign-up does not disclose whether an email is already registered. If Supabase returns a session immediately on sign-up, confirmations are disabled; the app signs that session out and explains how to enable confirmation. Existing users continue to sign in with their password.

Changing the frontend does not update the already deployed site or the Supabase dashboard. Redeploy the site after the code change, then enable confirmation, copy the template, and configure custom SMTP in the live Supabase project.

## Secrets and generated files

The browser receives only the Supabase public publishable/anon key. Keep service-role credentials in trusted server-side environments only. `.env`, `dist/`, generated `config.js`, dependencies, and local deployment state are ignored by Git.
