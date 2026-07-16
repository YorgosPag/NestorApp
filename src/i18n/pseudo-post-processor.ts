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

/**
 * Ήδη τυλιγμένα κομμάτια — φτάνουν όταν ο caller κάνει `t(label)` και περνά το
 * αποτέλεσμα ως interpolation value σε άλλο `t()`. Χωρίς ξετύλιγμα το string
 * τυλίγεται δεύτερη φορά: `[[~~ Επιλέξτε [[~~ Νομική Μορφή ~~]] ~~]]`.
 *
 * Δεν επηρεάζει την ανίχνευση concatenation: το `t('a') + t('b')` ενώνεται σε JS
 * ΜΕΤΑ τα t(), οπότε δεν ξαναπερνά ποτέ από εδώ — τα δύο αδελφά wrappers μένουν
 * ορατά, που είναι ακριβώς το ζητούμενο.
 */
const NESTED_PSEUDO = /\[\[~+ ([\s\S]*?) ~+\]\]/g;

/**
 * Τυλίγει ένα string σε pseudo μορφή: `[[~~ κείμενο ~~]]`.
 * Τα brackets αποκαλύπτουν truncation, τα tildes προσομοιώνουν text expansion.
 */
export function toPseudo(value: string): string {
  if (!value) return value;

  const inner = value;
  if (!inner) return inner;

  const width = inner.replace(/ /g, '').length;
  const tildeCount = Math.min(MAX_TILDES, Math.max(MIN_TILDES, Math.ceil(width / CHARS_PER_TILDE)));
  const tildes = '~'.repeat(tildeCount);

  return `[[${tildes} ${inner} ${tildes}]]`;
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
