const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('each portal page loads shared Supabase configuration and clinic logic', () => {
  for (const file of ['index.html', 'patient.html', 'doctor.html', 'admin.html']) {
    const html = fs.readFileSync(path.join(root, 'src', 'pages', file), 'utf8');
    assert.match(html, /\/config\.js/); assert.match(html, /\/logic\.js/); assert.match(html, /\/app\.js/);
  }
});

test('security and booking capacity are implemented in the database schema', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase/schema.sql'), 'utf8');
  assert.match(sql, /enable row level security/); assert.match(sql, /create or replace function public\.book_appointment/);
  assert.match(sql, /pg_advisory_xact_lock/); assert.match(sql, /taken >= 10/); assert.match(sql, /raw_app_meta_data/);
  assert.match(sql, /Asia\/Kolkata/);
});

test('service role key is not included in browser assets', () => {
  for (const file of ['index.html', 'patient.html', 'doctor.html', 'admin.html']) {
    const source = fs.readFileSync(path.join(root, 'src', 'pages', file), 'utf8'); assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
  }
  for (const file of ['app.js', 'logic.js']) {
    const source = fs.readFileSync(path.join(root, 'src', 'assets', 'js', file), 'utf8'); assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
  }
});

test('patient email confirmation is link-based and returns to password sign-in', () => {
  const page = fs.readFileSync(path.join(root, 'src', 'pages', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'src', 'assets', 'js', 'app.js'), 'utf8');
  const supabaseConfig = fs.readFileSync(path.join(root, 'supabase', 'config.toml'), 'utf8');
  const emailTemplate = fs.readFileSync(path.join(root, 'supabase', 'templates', 'confirmation.html'), 'utf8');
  const callback = fs.readFileSync(path.join(root, 'src', 'pages', 'verify-email.html'), 'utf8');
  assert.doesNotMatch(page, /signup-otp|resend-otp|verification-fields/);
  assert.match(page, /id="auth-submit"[\s\S]*?<\/button><\/div><\/form>/);
  assert.doesNotMatch(app, /auth\.resend|startResendCooldown|signup-otp|verification-fields/);
  assert.match(app, /auth\.signUp\(\{[\s\S]*?emailRedirectTo/);
  assert.match(app, /auth\.verifyOtp\(\{ token_hash: tokenHash, type: 'email' \}\)/);
  assert.match(app, /detectSessionInUrl: true/);
  assert.match(app, /already have consumed a PKCE callback during client initialization/);
  assert.match(app, /client\.auth\.signOut\(\)/);
  assert.match(app, /email-verified=1#portal/);
  assert.match(app, /sign in here with your email and password/);
  assert.match(supabaseConfig, /enable_confirmations = true/);
  assert.match(supabaseConfig, /confirmation\.html/);
  assert.match(emailTemplate, /verify-email\.html\?token_hash=\{\{ \.TokenHash \}\}&amp;type=email/);
  assert.doesNotMatch(emailTemplate, /\{\{ \.Token \}\}|ConfirmationURL|6-digit code|one.time password/i);
  assert.match(callback, /data-page="email-verification"/);
  assert.match(app, /patient_id: patientId/);
  assert.match(app, /bindPatient\(auth\.session\.user\.id\)/);
  assert.match(app, /email address not authorized/i);
});

test('Render publishes the generated site and receives Supabase configuration at build time', () => {
  const blueprint = fs.readFileSync(path.join(root, 'render.yaml'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'src', 'assets', 'js', 'app.js'), 'utf8');
  const configWriter = fs.readFileSync(path.join(root, 'scripts', 'write-config.js'), 'utf8');
  assert.match(blueprint, /staticPublishPath:\s*\.\/dist/);
  assert.match(configWriter, /supabase', 'public-config\.json/);
  assert.match(configWriter, /process\.env\.SUPABASE_URL \|\| publicConfig\.url/);
  assert.match(app, /SUPABASE_URL and SUPABASE_ANON_KEY in the hosting environment/);
});
