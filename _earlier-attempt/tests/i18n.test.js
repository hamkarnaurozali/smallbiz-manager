import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '../src/i18n/en.js';

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? files(full) : /\.(jsx?|js)$/.test(name) ? [full] : [];
  });
}

const NAMESPACES = ['app', 'banner', 'chart', 'common', 'dash', 'data', 'err', 'expense', 'expenseCategory', 'nav', 'products', 'range', 'reports', 'sale'];

describe('translations', () => {
  const sources = files('src').filter((f) => !f.includes('i18n'));
  const used = new Set();
  for (const file of sources) {
    const text = readFileSync(file, 'utf8');
    for (const [, key] of text.matchAll(/['"`]([A-Za-z]+\.[A-Za-z0-9]+)['"`]/g)) {
      if (NAMESPACES.includes(key.split('.')[0])) used.add(key);
    }
  }
  it('has every key that the code uses', () => {
    const missing = [...used].filter((k) => !(k in en));
    expect(missing).toEqual([]);
  });
  it('has no unused keys (except those built dynamically)', () => {
    const dynamicPrefixes = ['expenseCategory.', 'nav.', 'range.'];
    const unused = Object.keys(en).filter((k) => !used.has(k) && !dynamicPrefixes.some((p) => k.startsWith(p)));
    expect(unused).toEqual([]);
  });
});
