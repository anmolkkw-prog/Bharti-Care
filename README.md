# Bharti Care Connect

A static clinic website and patient, doctor, and administrator portal for Dr. Bharati Pujari’s Clinic in Dharwad. The frontend uses HTML, CSS, and JavaScript. Supabase provides authentication, data storage, row-level security, and a doctor-management Edge Function.

## Quick start

1. Install Node.js 18 or newer.
2. The public Supabase URL and publishable key are included in `supabase/public-config.json` for this clinic. Copy `.env.example` to `.env` only if you want local environment variables to override that project configuration.
3. Run `npm start` and open [http://localhost:4173](http://localhost:4173).

The build generates the public site in `dist/`. Only a Supabase publishable/anon key belongs in the browser. Never put a database password, secret key, or service-role key in `.env` or frontend code.

## Project guide

- [Project structure](docs/STRUCTURE.md)
- [Setup and deployment](docs/DEPLOYMENT.md)
- [License](LICENSE)

## Authentication

Patient sign-up uses a confirmation link. After confirming the email address, patients return to the site and sign in with their email and password. The deployed Supabase project must have **Confirm email** enabled. The branded template in `supabase/templates/confirmation.html` is available when the project plan and SMTP configuration support custom templates. Configure custom SMTP for delivery to patient addresses. See the [deployment guide](docs/DEPLOYMENT.md) for setup and troubleshooting.

## Build commands

- `npm run build` prepares `dist/` for Vercel.
- `npm run build:render` prepares the same output for Render.
- `npm start` builds and serves the site locally.
- `npm test` runs the local checks.

## Clinic roles

New public accounts are patients. Doctor and administrator accounts must be provisioned by an administrator. Patients can manage their own profile, health history, appointments, prescriptions, and feedback; doctors and administrators have role-based access enforced by Supabase policies.
