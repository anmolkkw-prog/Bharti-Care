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

test('patient sign-up collects and verifies a six-digit email OTP', () => {
  const page = fs.readFileSync(path.join(root, 'src', 'pages', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'src', 'assets', 'js', 'app.js'), 'utf8');
  const supabaseConfig = fs.readFileSync(path.join(root, 'supabase', 'config.toml'), 'utf8');
  const emailTemplate = fs.readFileSync(path.join(root, 'supabase', 'templates', 'confirmation.html'), 'utf8');
  assert.match(page, /id="signup-otp"[^>]*inputmode="numeric"[^>]*maxlength="6"/);
  assert.match(page, /id="resend-otp"/);
  assert.match(app, /auth\.verifyOtp\(\{ email: verificationEmail, token, type: 'signup' \}\)/);
  assert.match(app, /auth\.resend\(\{ type: 'signup', email: verificationEmail \}\)/);
  assert.match(supabaseConfig, /\[auth\.email\][\s\S]*?enable_confirmations = true/);
  assert.match(supabaseConfig, /\[auth\.email\.template\.confirmation\][\s\S]*?confirmation\.html/);
  assert.match(emailTemplate, /\{\{ \.Token \}\}/);
  assert.doesNotMatch(emailTemplate, /ConfirmationURL/);
  assert.match(app, /startResendCooldown/);
  assert.match(app, /email address not authorized/i);
});

test('Render publishes the generated site and receives Supabase configuration at build time', () => {
  const blueprint = fs.readFileSync(path.join(root, 'render.yaml'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'src', 'assets', 'js', 'app.js'), 'utf8');
  assert.match(blueprint, /staticPublishPath:\s*\.\/dist/);
  assert.match(blueprint, /key:\s*SUPABASE_URL[\s\S]*?sync:\s*false/);
  assert.match(blueprint, /key:\s*SUPABASE_ANON_KEY[\s\S]*?sync:\s*false/);
  assert.match(app, /add SUPABASE_URL and SUPABASE_ANON_KEY under the service Environment settings/);
});
