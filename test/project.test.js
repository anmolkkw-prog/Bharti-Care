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
