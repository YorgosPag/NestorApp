/**
 * Pseudo-locale runtime transform (ADR-666)
 *
 * Το pseudo ΔΕΝ έχει δικά του resource αρχεία. Το `el` είναι η μοναδική πηγή:
 * το fallback της lazy-config παραδίδει το ελληνικό string και αυτός ο
 * postProcessor το τυλίγει τη στιγμή του t().
 *
 * Τρέχει ΜΕΤΑ το ICU + interpolation, άρα τα placeholders έχουν ήδη επιλυθεί.
 */

import type { PostProcessorModule } from 'i18next';

export const PSEUDO_LANGUAGE = 'pseudo';

/** Το wrapper προσθέτει ~40% πλάτος — το heuristic text-expansion της Microsoft. */
const MIN_TILDES = 2;
const MAX_TILDES = 12;
const CHARS_PER_TILDE = 5;

const ALREADY_PSEUDO = /^\[\[~+ [\s\S]* ~+\]\]$/;

/**
 * Τυλίγει ένα string σε pseudo μορφή: `[[~~ κείμενο ~~]]`.
 * Τα brackets αποκαλύπτουν truncation, τα tildes προσομοιώνουν text expansion.
 */
export function toPseudo(value: string): string {
  if (!value) return value;
  if (ALREADY_PSEUDO.test(value)) return value;

  const width = value.replace(/ /g, '').length;
  const tildeCount = Math.min(MAX_TILDES, Math.max(MIN_TILDES, Math.ceil(width / CHARS_PER_TILDE)));
  const tildes = '~'.repeat(tildeCount);

  return `[[${tildes} ${value} ${tildes}]]`;
}

interface PseudoTranslator {
  readonly language?: string;
}

interface PseudoOptions {
  readonly lng?: string;
}

/**
 * i18next postProcessor — ενεργό μόνο όταν η τρέχουσα γλώσσα είναι `pseudo`.
 */
export const pseudoPostProcessor: PostProcessorModule = {
  type: 'postProcessor',
  name: PSEUDO_LANGUAGE,

  process(value: string, _key: string | string[], options: PseudoOptions, translator: PseudoTranslator): string {
    if (typeof value !== 'string') return value;

    const language = options?.lng ?? translator?.language;
    if (language !== PSEUDO_LANGUAGE) return value;

    return toPseudo(value);
  },
};
