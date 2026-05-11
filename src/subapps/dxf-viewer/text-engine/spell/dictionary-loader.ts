/**
 * ADR-344 Phase 8 — Lazy Hunspell dictionary loader (worker-side).
 *
 * Loads + caches one nspell instance per language. Greek uses the
 * MPL-1.1-licensed LibreOffice el_GR Hunspell dictionary, bundled as static
 * data assets under `./dictionaries/el_GR/` (see NOTICE-DICTIONARIES.md for
 * attribution). English uses the `dictionary-en` npm package (MIT/BSD).
 *
 * The whole loader, including the dynamic `nspell` import, is executed
 * inside `spell.worker.ts` — never on the main thread — so the ~1 MB
 * dictionary buffers never appear in the initial bundle.
 *
 * @module text-engine/spell/dictionary-loader
 */

import type { NSpell } from 'nspell';
import type { SpellLanguage } from './spell.types';

const cache: Partial<Record<SpellLanguage, Promise<NSpell>>> = {};

/**
 * URL-relative paths to the bundled Greek dictionary assets. The worker
 * fetches them from the served dist tree — Next.js + webpack copy the
 * `dictionaries/` folder verbatim because the .aff/.dic suffixes are listed
 * in `next.config.js` asset module rules.
 *
 * Adjust `ASSET_BASE` if the deployment hosts static assets behind a CDN.
 */
const ASSET_BASE =
  '/_next/static/dxf/dictionaries' as const;

const EL_AFF_URL = `${ASSET_BASE}/el_GR/el_GR.aff` as const;
const EL_DIC_URL = `${ASSET_BASE}/el_GR/el_GR.dic` as const;

async function fetchAsBuffer(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load dictionary asset ${url}: HTTP ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * `dictionary-en` exposes `(callback) => callback(err, { aff, dic })`. We
 * wrap it in a Promise so `loadHunspell('en')` returns the same shape as
 * the Greek branch.
 */
async function loadEnglish(): Promise<{ aff: Buffer; dic: Buffer }> {
  const mod = await import('dictionary-en');
  const dictFactory = (mod as unknown as {
    default?: (cb: (err: unknown, data: { aff: Buffer; dic: Buffer }) => void) => void;
  }).default ?? (mod as unknown as (cb: (err: unknown, data: { aff: Buffer; dic: Buffer }) => void) => void);

  return new Promise((resolve, reject) => {
    dictFactory((err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

async function loadGreek(): Promise<{ aff: Uint8Array; dic: Uint8Array }> {
  const [aff, dic] = await Promise.all([
    fetchAsBuffer(EL_AFF_URL),
    fetchAsBuffer(EL_DIC_URL),
  ]);
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
    if (language === 'en') {
      const { aff, dic } = await loadEnglish();
      return nspell(aff, dic);
    }
    const { aff, dic } = await loadGreek();
    return nspell(aff as unknown as Buffer, dic as unknown as Buffer);
  })();

  cache[language] = promise;
  return promise;
}
