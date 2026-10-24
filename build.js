#!/usr/bin/env node
// DuoMind build script — no dependencies, no internet needed.
// Joins src/ into one index.html and embeds the libraries from vendor/ so the app works offline.
// Usage:  node build.js        (or: npm run build)

const fs = require('fs');
const path = require('path');
const root = __dirname;

const parts = ['01-head.html', '02-body.html', '03-core.js', '04-engine.js', '05-ai.js', '06-ui.js', '07-main.js'];
let body = parts.map(f => fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('');

const libs = {
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js': 'three.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js': 'gsap.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js': 'chart.umd.min.js'
};
for (const [url, file] of Object.entries(libs)) {
  const tag = `<script src="${url}"></script>`;
  if (!body.includes(tag)) throw new Error('Library tag not found in src: ' + url);
  const src = fs.readFileSync(path.join(root, 'vendor', file), 'utf8').replace(/<\/(script)/gi, '<\\/$1');
  body = body.split(tag).join(`<script>/* ${url.split('/').pop()} (embedded for offline use) */\n${src}\n</script>`);
}

body = body.replace('<style>', '<script src="config.js"></script>\n<style>');
const headEnd = body.indexOf('</style>') + '</style>'.length;
const html = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
  body.slice(0, headEnd) + '\n</head>\n<body>\n' + body.slice(headEnd) + '\n</body>\n</html>\n';

fs.writeFileSync(path.join(root, 'index.html'), html);
console.log(`Built index.html (${Math.round(html.length / 1024)} KB)`);
