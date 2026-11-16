# Bharti Care Connect

A static clinic website and patient, doctor, and administrator portal for Dr. Bharati Pujari’s Clinic in Dharwad. The frontend uses HTML, CSS, and JavaScript. Supabase provides authentication, data storage, row-level security, and a doctor-management Edge Function.

## Quick start

1. Install Node.js 18 or newer.
2. Copy `.env.example` to `.env` and add the Supabase project URL and public publishable/anon key.
3. Run `npm start` and open [http://localhost:4173](http://localhost:4173).

The build generates the public site in `dist/`. Only a Supabase public key belongs in the browser. Never put a service-role key in `.env` or frontend code.

## Project guide

- [Project structure](docs/STRUCTURE.md)
- [Setup and deployment](docs/DEPLOYMENT.md)
- [License](LICENSE)

## Authentication

Patient sign-up requires a six-digit email verification code. The deployed Supabase project must have **Confirm email** enabled, use the branded **Confirm signup** template with `{{ .Token }}` and no `{{ .ConfirmationURL }}` link, and have custom SMTP configured. Supabase's built-in sender is restricted to project team addresses and a low hourly limit. See the [deployment guide](docs/DEPLOYMENT.md) for setup and troubleshooting.

## Build commands

- `npm run build` prepares `dist/` for Vercel.
- `npm run build:render` prepares the same output for Render.
- `npm start` builds and serves the site locally.
- `npm test` runs the local checks.

## Clinic roles

New public accounts are patients. Doctor and administrator accounts must be provisioned by an administrator. Patients can manage their own profile, health history, appointments, prescriptions, and feedback; doctors and administrators have role-based access enforced by Supabase policies.
