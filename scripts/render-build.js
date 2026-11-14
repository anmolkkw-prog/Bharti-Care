const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const publicFiles = [
  'index.html',
  'about.html',
  'patient.html',
  'doctor.html',
  'admin.html',
  'reset-password.html',
  'styles.css',
  'app.js',
  'logic.js',
  'config.js',
];

fs.mkdirSync(output, { recursive: true });
for (const file of publicFiles) {
  const source = path.join(root, file);
  if (!fs.existsSync(source)) throw new Error(`Required site file is missing: ${file}`);
  fs.copyFileSync(source, path.join(output, file));
}

console.log(`Prepared ${publicFiles.length} public files in dist/.`);
