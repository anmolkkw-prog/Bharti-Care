# Setup and deployment

## Supabase project

1. The checked-in `supabase/public-config.json` contains this app's public Supabase project URL and publishable key so static builds, including Render, can generate `config.js` without environment variables. To build against a different project, set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env` locally or in the hosting provider's environment variables; environment values override the checked-in defaults. The build rejects database passwords, secret keys, and service-role keys.
2. Run `supabase/schema.sql` in the Supabase SQL Editor for a new project. For an existing project, review and apply schema changes according to your database migration process.
3. In **Authentication → Providers → Email**, enable email sign-ups and **Confirm email**. The checked-in `supabase/config.toml` also sets `enable_confirmations = true` for local Supabase development; it does not change an already hosted project's dashboard settings.
4. Set the project's **Site URL** in **Authentication → URL Configuration** to the deployed site URL and add the deployed and local app URLs to the redirect allowlist. The signup flow directs Supabase to `/verify-email.html`; that page confirms the callback, clears the temporary session, and returns the patient to email/password sign-in. Supabase’s default confirmation template uses a link and works without a custom template. If you want to apply [`supabase/templates/confirmation.html`](../supabase/templates/confirmation.html), configure custom SMTP or use a plan that supports custom email templates, then select it under **Authentication → Email Templates → Confirm signup**.
5. In **Authentication → SMTP Settings**, configure a custom SMTP provider before accepting patient sign-ups. Supabase's built-in sender is for testing: it only sends to addresses belonging to the Supabase organization and is limited to two emails per hour. If a confirmation email is missing, inspect **Authentication → Logs**, the SMTP provider's delivery/suppression logs, and spam/junk. See [Supabase's SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp) and [email rate limits](https://supabase.com/docs/guides/auth/rate-limits).
6. Add `/reset-password.html` to the redirect allowlist for password recovery. For the production site, allow `https://YOUR-DOMAIN/**`; locally allow `http://localhost:4173/**`.
7. Deploy `manage-doctor` separately with the Supabase CLI: `supabase login`, `supabase link --project-ref YOUR_PROJECT_REF`, then `supabase functions deploy manage-doctor`.
8. Create the first admin account through the patient sign-up form, complete the required patient fields, confirm the email, and then run the following in the SQL Editor with that email substituted:

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

## Email confirmation and sign-in

The browser validates the signup fields and creates patient accounts with `auth.signUp`. Supabase sends the configured confirmation email. The user follows its link to `/verify-email.html`, where the app confirms the address, clears the temporary confirmation session, and redirects to the sign-in form. The patient then signs in with the email address and password created during sign-up. If a patient tries to sign in before confirming, the page offers to resend the confirmation link. Public sign-up does not disclose whether an address is already registered. Email syntax checks cannot prove that an inbox exists; the confirmation link proves inbox access.

The Supabase dashboard is separate from repository configuration. In the live project, enable **Authentication → Providers → Email → Confirm email**, set the production site URL and allowed redirect URLs, and configure custom SMTP for reliable delivery to patient addresses. Supabase’s free tier with its default sender may not permit custom email templates; in that case, its default confirmation email remains in place. Local template changes do not alter the hosted template.

## Secrets and generated files

The browser receives only the Supabase public publishable/anon key. Keep service-role credentials in trusted server-side environments only. `.env`, `dist/`, generated `config.js`, dependencies, and local deployment state are ignored by Git.
