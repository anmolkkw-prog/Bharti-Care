# Setup and deployment

## Supabase project

1. Create or open the clinic's Supabase project. Set `SUPABASE_URL` and the public publishable/anon key in the hosting provider's environment variables. For local development, copy `.env.example` to `.env`.
2. Run `supabase/schema.sql` in the Supabase SQL Editor for a new project. For an existing project, review and apply schema changes according to your database migration process.
3. In **Authentication → Providers → Email**, enable email sign-ups and **Confirm email**. The checked-in `supabase/config.toml` also sets `enable_confirmations = true` for local Supabase development; it does not change an already hosted project's dashboard settings.
4. In **Authentication → Email Templates → Confirm signup**, make the message display the six-digit code with `{{ .Token }}`. Set the OTP length to six digits. Configure a production SMTP provider in Supabase for reliable delivery.
5. In **Authentication → URL Configuration**, set the production site as the Site URL and allow the deployed and local URLs. Include `/reset-password.html` for password recovery redirects. For example, allow `https://YOUR-DOMAIN/reset-password.html` and `http://localhost:4173/reset-password.html`.
6. Deploy `manage-doctor` separately with the Supabase CLI: `supabase login`, `supabase link --project-ref YOUR_PROJECT_REF`, then `supabase functions deploy manage-doctor`.
7. Create the first admin in **Authentication → Users → Add user**, then run the following in the SQL Editor with that email substituted:

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

Use the included `render.yaml` Blueprint. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` as Render environment variables. The build publishes only `dist/`.

## Local development

Run `npm start` to build and serve the generated site at `http://localhost:4173`. To run Supabase locally, use the Supabase CLI and apply the checked-in `supabase/config.toml` and schema.

## Email OTP sign-up

The browser creates a patient account with `auth.signUp`, displays an OTP entry step, verifies the code using `auth.verifyOtp({ type: 'signup' })`, and offers `auth.resend` for a replacement code. If Supabase returns a session immediately on sign-up, confirmations are disabled; the app signs that session out and explains how to enable confirmation. Existing users continue to sign in with their password.

Changing the frontend does not update the already deployed site or the Supabase dashboard. Redeploy the site after the code change, then enable confirmation and set the email template in the live Supabase project.

## Secrets and generated files

The browser receives only the Supabase public publishable/anon key. Keep service-role credentials in trusted server-side environments only. `.env`, `dist/`, generated `config.js`, dependencies, and local deployment state are ignored by Git.
