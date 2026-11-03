/**
 * @fileoverview **Amount in words — English** (ADR-928 §5.10). The language's speller only; validation and
 *   language choice live in `amount-in-words.ts`.
 * @module lib/money/amount-in-words/english-amount-words
 *
 * Conventions:
 * - Cheque / contract style without the internal British «and» («one hundred twenty»), so that the only
 *   «and» in the phrase is the one joining euros and cents — no ambiguity in «… and twenty cents».
 * - Compound tens are hyphenated («twenty-one»).
 * - Plural «euros» / «cents»: the European Commission English Style Guide prescribes the plural forms in
 *   non-legislative texts (the invariable «euro» is reserved for EU legal acts).
 * - Short scale (million, billion, trillion), as in all current English usage.
 */

const UNITS: readonly string[] = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];

const TENS: readonly string[] = [
  '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
];

/** Index = group of three digits (1 = thousands). */
const SCALES: readonly string[] = ['', 'thousand', 'million', 'billion', 'trillion'];

const ZERO = 'zero';

function belowHundred(n: number): string {
  if (n < 20) return UNITS[n];
  const ones = n % 10;
  return ones === 0 ? TENS[Math.floor(n / 10)] : `${TENS[Math.floor(n / 10)]}-${UNITS[ones]}`;
}

function belowThousand(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h > 0 ? `${UNITS[h]} hundred` : '', rest > 0 ? belowHundred(rest) : ''].filter(Boolean).join(' ');
}

/** Non-negative integer ≤ 999 trillion. */
export function englishIntegerWords(n: number): string {
  if (n === 0) return ZERO;
  const parts: string[] = [];
  for (let index = 0, rest = n; rest > 0; index += 1, rest = Math.floor(rest / 1000)) {
    const group = rest % 1000;
    if (group > 0) parts.unshift([belowThousand(group), SCALES[index]].filter(Boolean).join(' '));
  }
  return parts.join(' ');
}

/** «three euros and twenty cents» · «one thousand euros» · «one cent» · «zero euros». */
export function englishAmountWords(euros: number, cents: number): string {
  if (euros === 0 && cents === 0) return `${ZERO} euros`;
  const centWords = cents === 0 ? '' : `${englishIntegerWords(cents)} ${cents === 1 ? 'cent' : 'cents'}`;
  if (euros === 0) return centWords;
  const euroWords = `${englishIntegerWords(euros)} ${euros === 1 ? 'euro' : 'euros'}`;
  return centWords ? `${euroWords} and ${centWords}` : euroWords;
}
