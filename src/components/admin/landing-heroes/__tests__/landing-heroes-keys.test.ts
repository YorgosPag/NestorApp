/**
 * ⚓ ADR-881 · N.11 — **κάθε κλειδί του εργαλείου ηρώων υπάρχει ΚΑΙ στις δύο γλώσσες**.
 *
 * 🔴 Γιατί χρειάζεται: η πύλη 3.8 βλέπει μόνο literal `t('…')`. Τα κλειδιά που περνούν από πίνακα
 *    (`t(HERO_ISSUE_KEYS[code])`) της είναι **αόρατα** — ένα που λείπει θα έφτανε στην οθόνη ωμό, με
 *    πράσινη πύλη. Εδώ επιλύεται **κάθε** τιμή κάθε πίνακα, σε `el` και `en`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isRecord } from '@/lib/type-guards';

import {
  HERO_ERROR_KEYS,
  HERO_FOCAL_ORIGIN_KEYS,
  HERO_FRAME_KEYS,
  HERO_GUIDE_RULE_KEYS,
  HERO_ISSUE_KEYS,
  HERO_PAGE_KEYS,
  HERO_PROMPT_KEYS,
  HERO_THEME_KEYS,
  HERO_VARIANT_KEYS,
  HERO_VERDICT_KEYS,
  LANDING_HEROES_NS,
} from '../landing-heroes-keys';

const load = (lang: string): unknown =>
  JSON.parse(readFileSync(join(process.cwd(), `src/i18n/locales/${lang}/${LANDING_HEROES_NS}.json`), 'utf8'));

function resolve(tree: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (node, part) => (isRecord(node) ? node[part] : undefined),
    tree,
  );
}

const MAPPED_KEYS = [
  ...Object.values(HERO_PAGE_KEYS),
  ...Object.values(HERO_VARIANT_KEYS),
  ...Object.values(HERO_ISSUE_KEYS),
  ...Object.values(HERO_ERROR_KEYS),
  ...Object.values(HERO_FRAME_KEYS),
  ...Object.values(HERO_THEME_KEYS),
  ...Object.values(HERO_VERDICT_KEYS),
  ...Object.values(HERO_FOCAL_ORIGIN_KEYS),
  ...Object.values(HERO_PROMPT_KEYS),
  ...HERO_GUIDE_RULE_KEYS,
  'guide.prompts.dusk',
];

describe.each(['el', 'en'])('locale %s', (lang) => {
  const tree = load(lang);

  it.each(MAPPED_KEYS)('%s ⇒ μη κενή συμβολοσειρά', (key) => {
    const value = resolve(tree, key);
    expect(typeof value).toBe('string');
    expect(String(value).trim()).not.toBe('');
  });

  it('ICU: καμία `{{…}}` (CHECK 3.9)', () => {
    expect(JSON.stringify(tree)).not.toMatch(/\{\{/);
  });
});

describe('οι εντολές AI είναι ΙΔΙΕΣ και στις δύο γλώσσες (αγγλικές επίτηδες)', () => {
  it.each([...Object.values(HERO_PROMPT_KEYS), 'guide.prompts.dusk'])('%s', (key) => {
    expect(resolve(load('el'), key)).toBe(resolve(load('en'), key));
  });
});
