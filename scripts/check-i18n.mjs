// Lists the data-i18n keys used in public/*.html that have no French string,
// and the French strings no page uses any more.
//   npm run check:i18n
import { readFileSync, readdirSync } from 'node:fs';
import { FR } from '../functions/_lib/strings-fr.js';

const used = new Set();
for (const file of readdirSync('public').filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(`public/${file}`, 'utf8');
  for (const [, key] of html.matchAll(/data-i18n="([^"]+)"/g)) used.add(key);
  for (const [, pairs] of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
    for (const pair of pairs.split(';')) used.add(pair.split(':')[1].trim());
  }
}
const missing = [...used].filter((k) => !(k in FR));
const unused = Object.keys(FR).filter((k) => !used.has(k));
if (missing.length) console.log('Missing French strings:\n  ' + missing.join('\n  '));
if (unused.length) console.log('Unused French strings:\n  ' + unused.join('\n  '));
if (!missing.length && !unused.length) console.log(`✓ ${used.size} keys, all translated`);
process.exit(missing.length ? 1 : 0);
