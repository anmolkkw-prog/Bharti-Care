import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function readEnvFile() {
  const file = path.join(projectRoot, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
  }
}
readEnvFile();
const publicConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, 'supabase', 'public-config.json'), 'utf8'));
const projectUrl = process.env.SUPABASE_URL || publicConfig.url;
if (!projectUrl) throw new Error('Set SUPABASE_URL or configure supabase/public-config.json first.');
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(projectUrl)) throw new Error('The configured Supabase project URL is invalid.');

function readHidden(label) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error('Run this script from an interactive PowerShell or Terminal window.');
  }
  return new Promise((resolve, reject) => {
    stdout.write(label);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const finish = (error) => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdout.write('\n');
      if (error) reject(error); else resolve(value);
    };
    const onData = chunk => {
      for (const char of chunk) {
        if (char === '\u0003') return finish(new Error('Cancelled.'));
        if (char === '\r' || char === '\n') return finish();
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (char >= ' ') value += char;
      }
    };
    stdin.on('data', onData);
  });
}

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });
  const adminEmail = (process.env.ADMIN_EMAIL || await rl.question('Admin account email: ')).trim().toLowerCase();
  rl.close();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) throw new Error('Enter a valid admin account email.');
  let serviceKey = await readHidden('Supabase service-role/secret key (input hidden): ');
  let password = await readHidden('New admin password (input hidden, 16+ characters): ');
  const confirmation = await readHidden('Confirm new password (input hidden): ');
  if (password.length < 16) throw new Error('Use a unique password with at least 16 characters.');
  if (password !== confirmation) throw new Error('The passwords do not match.');

  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const query = new URLSearchParams({ select: 'id,email', role: 'eq.admin', email: `eq.${adminEmail}`, limit: '2' });
  const lookup = await fetch(`${projectUrl}/rest/v1/profiles?${query}`, { headers });
  if (!lookup.ok) throw new Error(`Could not look up the admin account (HTTP ${lookup.status}). Check the key and try again.`);
  const users = await lookup.json();
  if (users.length !== 1) throw new Error(`Expected one admin account for ${adminEmail}; found ${users.length}. No password was changed.`);

  const update = await fetch(`${projectUrl}/auth/v1/admin/users/${encodeURIComponent(users[0].id)}`, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  password = '';
  serviceKey = '';
  if (!update.ok) throw new Error(`Supabase did not update the password (HTTP ${update.status}). No password was changed.`);
  stdout.write(`Password updated for ${adminEmail}. Sign in with this email and the new password.\n`);
}

main().catch(error => {
  stdout.write(`${error.message}\n`);
  process.exitCode = 1;
});
