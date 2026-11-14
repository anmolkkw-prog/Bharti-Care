import { stdin, stdout } from 'node:process';

const projectUrl = 'https://jslxszphayjyszkahnqr.supabase.co';
const adminEmail = 'admin@gmail.com';

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
