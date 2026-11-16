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
  for (const [, name, table] of sql.matchAll(/create policy ([a-z_]+) on public\.([a-z_]+)/gi)) {
    assert.ok(sql.includes(`drop policy if exists ${name} on public.${table};`), `${name} must be safely replaceable`);
  }
});

test('service role key is not included in browser assets', () => {
  for (const file of ['index.html', 'patient.html', 'doctor.html', 'admin.html']) {
    const source = fs.readFileSync(path.join(root, 'src', 'pages', file), 'utf8'); assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
  }
  for (const file of ['app.js', 'logic.js']) {
    const source = fs.readFileSync(path.join(root, 'src', 'assets', 'js', file), 'utf8'); assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
  }
});

test('patient detail fields are required in the forms and Supabase policies', () => {
  const signup = fs.readFileSync(path.join(root, 'src', 'pages', 'index.html'), 'utf8');
  const patient = fs.readFileSync(path.join(root, 'src', 'pages', 'patient.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'src', 'assets', 'js', 'app.js'), 'utf8');
  const logic = fs.readFileSync(path.join(root, 'src', 'assets', 'js', 'logic.js'), 'utf8');
  const sql = fs.readFileSync(path.join(root, 'supabase', 'schema.sql'), 'utf8');
  assert.doesNotMatch(signup + patient, /\(optional\)|placeholder=\"Optional\"/i);
  assert.doesNotMatch(signup, /id=\"auth-form\"[^>]*novalidate/);
  assert.match(app, /patientDetailInputs\.forEach\(input => \{ input\.disabled = mode !== 'signup'; input\.required = mode === 'signup'; \}\)/);
  assert.match(app, /height === '' \|\| !logic\.isValidHeight\(height\)/);
  assert.match(app, /weight === '' \|\| !logic\.isValidWeight\(weight\)/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'src', 'pages', 'doctor.html'), 'utf8'), /\(optional\)/i);
  for (const id of ['full-name', 'phone', 'signup-height', 'signup-weight']) {
    assert.match(signup, new RegExp(`id=\"${id}\"[^>]*required`));
  }
  for (const field of ['contact_phone', 'comment', 'height_cm', 'weight_kg', 'medical_history', 'message']) {
    const fieldPattern = new RegExp(`name=\"${field}\"[^>]*required`);
    assert.match(patient, fieldPattern, `${field} must be required`);
  }
  assert.match(app, /if \(!note\) throw new Error/);
  assert.match(app, /if \(!medicalHistory\)/);
  assert.match(app, /if \(!feedbackMessage\)/);
  assert.match(logic, /isValidPhone: phone => typeof phone === 'string' &&/);
  assert.match(sql, /Patient name and phone are required/);
  assert.match(sql, /Patient height is required/);
  assert.match(sql, /Patient weight is required/);
  assert.match(sql, /nullif\(btrim\(medical_history\), ''\) is not null/);
  assert.match(sql, /message is not null and nullif\(btrim\(message\), ''\) is not null/);
  assert.match(sql, /p_comment is null or nullif\(trim\(p_comment\), ''\) is null/);
});

test('patient email confirmation is link-based and returns to password sign-in', () => {
  const page = fs.readFileSync(path.join(root, 'src', 'pages', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'src', 'assets', 'js', 'app.js'), 'utf8');
  const supabaseConfig = fs.readFileSync(path.join(root, 'supabase', 'config.toml'), 'utf8');
  const emailTemplate = fs.readFileSync(path.join(root, 'supabase', 'templates', 'confirmation.html'), 'utf8');
  const callback = fs.readFileSync(path.join(root, 'src', 'pages', 'verify-email.html'), 'utf8');
  assert.doesNotMatch(page, /signup-otp|resend-otp|verification-fields/);
  assert.match(page, /id="auth-submit"[\s\S]*?<\/button><\/div><\/form>/);
  assert.doesNotMatch(app, /startResendCooldown|signup-otp|verification-fields/);
  assert.match(app, /auth\.resend\(\{[\s\S]*?type: 'signup'[\s\S]*?emailRedirectTo/);
  assert.match(app, /email_not_confirmed|email\[\\s_-\]\*not/);
  assert.match(page, /id="resend-confirmation"[^>]*>Resend confirmation link/);
  assert.match(app, /auth\.signUp\(\{[\s\S]*?emailRedirectTo/);
  assert.match(app, /auth\.verifyOtp\(\{ token_hash: tokenHash, type: verificationType \}\)/);
  assert.match(app, /\['signup', 'email'\]\.includes\(verificationType\)/);
  assert.match(app, /detectSessionInUrl: true/);
  assert.match(app, /already have consumed a PKCE callback during client initialization/);
  assert.match(app, /client\.auth\.signOut\(\)/);
  assert.match(app, /email-verified=1#portal/);
  assert.match(app, /sign in here with your email and password/);
  assert.match(supabaseConfig, /enable_confirmations = true/);
  assert.match(supabaseConfig, /confirmation\.html/);
  assert.match(emailTemplate, /verify-email\.html\?token_hash=\{\{ \.TokenHash \}\}&amp;type=signup/);
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
