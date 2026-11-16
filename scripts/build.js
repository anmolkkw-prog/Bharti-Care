const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'src');
const output = path.join(root, 'dist');
const pages = path.join(source, 'pages');
const assets = path.join(source, 'assets');

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
fs.cpSync(pages, output, { recursive: true });
fs.cpSync(assets, path.join(output, 'assets'), { recursive: true });

console.log('Prepared static pages and assets in dist/.');
