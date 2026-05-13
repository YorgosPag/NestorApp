/**
 * ADR-344 Phase 8 — Lazy Hunspell dictionary loader (worker-side).
 *
 * Loads + caches one nspell instance per language. Both el_GR (MPL-1.1
 * LibreOffice) and en_US (MIT/BSD, extracted from dictionary-en@4) are
 * served as static data assets under `/static/dxf/dictionaries/`.
 * The worker fetches them at runtime so the ~550 KB dictionary buffers
 * never appear in the initial JS bundle (see ADR-344 Phase 8).
 *
 * Why no `import('dictionary-en')` here:
 *   dictionary-en@4 reads its .aff/.dic via `node:fs/promises` at runtime.
 *   That Node.js built-in cannot be bundled for browser/worker contexts by
 *   Turbopack (dev) or webpack (prod). The en_US files are therefore shipped
 *   as static fetch-able assets (same pattern as el_GR) — see next.config.js
 *   CopyPlugin and public/static/dxf/dictionaries/en_US/.
 *
 * @module text-engine/spell/dictionary-loader
 */

import type { NSpell } from 'nspell';
import type { SpellLanguage } from './spell.types';

const cache: Partial<Record<SpellLanguage, Promise<NSpell>>> = {};

/**
 * Base URL for all Hunspell dictionary static assets. Next.js + CopyPlugin
 * (production) and public/ directory (development) both serve them here.
 * Adjust if the deployment puts static assets behind a CDN prefix.
 */
const ASSET_BASE = '/static/dxf/dictionaries' as const;

const DICT_URLS: Record<SpellLanguage, { aff: string; dic: string }> = {
  el: {
    aff: `${ASSET_BASE}/el_GR/el_GR.aff`,
    dic: `${ASSET_BASE}/el_GR/el_GR.dic`,
  },
  en: {
    aff: `${ASSET_BASE}/en_US/en_US.aff`,
    dic: `${ASSET_BASE}/en_US/en_US.dic`,
  },
};

async function fetchAsBuffer(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load dictionary asset ${url}: HTTP ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

async function loadDictionary(language: SpellLanguage): Promise<{ aff: Uint8Array; dic: Uint8Array }> {
  const urls = DICT_URLS[language];
  const [aff, dic] = await Promise.all([fetchAsBuffer(urls.aff), fetchAsBuffer(urls.dic)]);
  return { aff, dic };
}

/**
 * Returns a memoised nspell instance for `language`. Concurrent calls share
 * the same promise so the dictionary is fetched and parsed exactly once.
 */
export function loadHunspell(language: SpellLanguage): Promise<NSpell> {
  const existing = cache[language];
  if (existing) return existing;

  const promise = (async () => {
    const { default: nspell } = await import('nspell');
    const { aff, dic } = await loadDictionary(language);
    return nspell(aff as unknown as Buffer, dic as unknown as Buffer);
  })();

  cache[language] = promise;
  return promise;
}
