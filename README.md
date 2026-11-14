# Dr. Bharati Pujari’s Clinic

A responsive, static website for Dr. Bharati Pujari’s Clinic in Dharwad with separate patient, doctor, and administrator portals. The frontend is plain HTML, CSS, and JavaScript; Supabase provides authentication, database access, row-level security, and a small Edge Function for doctor account management. It deploys as a static site to Vercel.

## Included

- Patient registration and sign-in, unique Supabase user IDs, profile and health history, appointment history, prescriptions, and post-visit feedback. Patients can send a preferred appointment date and time request in the portal; the clinic confirms by phone. Patients can also book by phone.
- Doctor sign-in, appointment confirmation, patient details and medical history, visit summaries, and prescriptions.
- Admin sign-in, clinic-wide appointment and patient views, doctor creation, deactivation, and reactivation.
- Admins can reset an existing doctor password from Care team without using that doctor's email inbox; the reset uses a 12-character minimum.
- The patient portal supports appointment requests, appointment history, and phone booking. Online requests remain pending until the clinic confirms them.
- Sign-in includes an email password recovery flow with a dedicated reset page. Add the deployed and local `/reset-password.html` URLs to Supabase Auth's allowed redirect URLs.
- The landing page reflects the clinic’s Google listing. The clinic profile includes the details supplied for this project. Patients can request a visit online from the patient portal or call the clinic; all web requests require confirmation by the clinic.
- Supabase row-level security, input validation in the UI and database, and a `.gitignore` for environment files and build/dependency artifacts.

## 1. Set up Supabase

1. Create a Supabase project. In **Project Settings → API**, copy the project URL and the **anon/public** key.
2. Open **SQL Editor**, paste all of [`supabase/schema.sql`](supabase/schema.sql), and run it. Re-run this updated schema on an existing project to apply the appointment request hours. This creates the profile trigger, data tables, role policies, and the protected booking functions.
3. Create your first administrator from **Authentication → Users → Add user**. Confirm the email. Then run these two statements in SQL Editor, substituting the email you just created:

   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
   where email = 'admin@example.com';

   update public.profiles set role = 'admin'
   where email = 'admin@example.com';
   ```

   Admin and doctor accounts cannot be created through public registration. The admin creates doctor accounts from the Care team portal.
4. In **Authentication → URL Configuration**, set your local and deployed site URLs (for example `http://localhost:4173` and your Vercel URL) in the allowed redirect URLs. Also add the password reset pages, such as `http://localhost:4173/reset-password.html` and `https://YOUR-VERCEL-DOMAIN/reset-password.html`.
5. Deploy the doctor-management Edge Function from this project root with the Supabase CLI:

   ```sh
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy manage-doctor
   ```

   Supabase supplies the project URL and service-role secret to deployed functions. The service-role key is never placed in browser code.

## 2. Configure and run locally

Copy `.env.example` to `.env`, then set the project URL and anon/public key:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

Run:

```sh
npm start
```

Open `http://localhost:4173`. `npm start` writes the browser configuration and starts the included static server. The `.env` file is ignored by Git. The only key used by the website is Supabase's public anon key; database policies enforce access.

Run the automated local checks with:

```sh
npm test
```

These cover name, phone, health-measurement, and appointment-slot validation, plus static project/security invariants. Live authentication, RLS, Edge Function, and booking concurrency checks require the Supabase project to be configured and are not simulated by these local tests.

## 3. Deploy to Vercel

Import the project in Vercel and add `SUPABASE_URL` and `SUPABASE_ANON_KEY` as project environment variables. The build command is `npm run build`; Vercel serves the static files. Add the Vercel domain to Supabase's allowed redirect URLs. For a custom domain, update the same Supabase URL configuration.

The generated `config.js` contains only the public anon key. Never put a Supabase service-role key in `.env` for the browser build or in any `VITE_`, `NEXT_PUBLIC_`, or client-side variable.

## Roles and data access

- A new user created through the site is always a patient. Their Supabase Auth UUID is their unique patient ID.
- Doctor and admin roles are assigned only through Supabase's trusted app metadata and the initial admin setup above.
- Patients can read their own appointments, profile, prescriptions, and health history. Doctors can read their assigned appointments and patient health details. Admins can read clinic data and manage doctor accounts.
- Patients can request a preferred date and time from the authenticated portal; requests are pending until staff confirm them. Phone booking remains available.
- New appointment requests appear in the doctor's portal through Supabase Realtime.
- Deactivating a doctor blocks sign-in and protected database access; it preserves their records for the clinic's appointment history.

## Project layout

```text
index.html                  Clinic landing page and patient/staff sign-in
patient.html                Patient dashboard
reset-password.html         Password recovery page
doctor.html                 Doctor dashboard
admin.html                  Administrator dashboard
app.js / logic.js           Shared behavior and tested validation helpers
styles.css                  Responsive visual system
config.js                   Generated public Supabase browser config
scripts/write-config.js     Reads .env or deployment environment variables
scripts/serve.js            Small local static server
supabase/schema.sql         Tables, triggers, RLS, and booking functions
supabase/functions/         Protected doctor-management Edge Function
test/                       Local validation and project checks
```
