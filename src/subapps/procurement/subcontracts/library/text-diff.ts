/**
 * @fileoverview **Σύγκριση κειμένου λέξη-προς-λέξη** — για τη σύγκριση εκδόσεων ρήτρας (ADR-928 Φ3γ-0).
 * @module subapps/procurement/subcontracts/library/text-diff
 *
 * 🔑 Τεμαχισμός με `Intl.Segmenter` (granularity `word`): ξέρει τα ελληνικά (τόνοι, διαλυτικά, τελικό σίγμα). Ο
 *    tokenizer του npm `diff` χωρίζει ό,τι δεν είναι λατινικό **ανά χαρακτήρα** ⇒ «κράτηση» → «κ ρ ά τ η σ η».
 * 🔑 Τα κενά και η στίξη είναι κι αυτά τμήματα: η σύνθεση των `same` + `added` δίνει **ακριβώς** το νέο κείμενο, και
 *    των `same` + `removed` το παλιό (ελέγχεται στα tests) — η σύγκριση δεν «χάνει» ποτέ κείμενο.
 * 🔑 LCS O(n·m): μια ρήτρα έχει δεκάδες έως εκατοντάδες λέξεις· το όριο `MAX_CELLS` προστατεύει από παθολογικό
 *    μέγεθος με ολική αντικατάσταση (σωστή, απλώς χωρίς λεπτομέρεια) — ποτέ πάγωμα της οθόνης.
 */

export type TextDiffKind = 'same' | 'added' | 'removed';

export interface TextDiffPart {
  readonly kind: TextDiffKind;
  readonly text: string;
}

/** Πάνω από τόσα κελιά πίνακα (≈ 2.000 × 2.000 τμήματα) η σύγκριση γίνεται ολική αντικατάσταση. */
const MAX_CELLS = 4_000_000;

const segmenter = new Intl.Segmenter('el', { granularity: 'word' });

/** Λέξεις, κενά και στίξη ως χωριστά τμήματα — η συνένωσή τους είναι το αρχικό κείμενο. */
export function textSegments(text: string): string[] {
  return Array.from(segmenter.segment(text), (part) => part.segment);
}

function lcsTable(before: readonly string[], after: readonly string[]): Uint32Array[] {
  const table = Array.from({ length: before.length + 1 }, () => new Uint32Array(after.length + 1));
  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      table[i][j] = before[i] === after[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  return table;
}

/** Συνεχόμενα τμήματα ίδιου είδους γίνονται ένα — η οθόνη χρωματίζει φράσεις, όχι λέξεις μία-μία. */
function pushPart(parts: TextDiffPart[], kind: TextDiffKind, text: string): void {
  const last = parts[parts.length - 1];
  if (last && last.kind === kind) parts[parts.length - 1] = { kind, text: last.text + text };
  else parts.push({ kind, text });
}

function walk(before: readonly string[], after: readonly string[], table: readonly Uint32Array[]): TextDiffPart[] {
  const parts: TextDiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      pushPart(parts, 'same', before[i]);
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      pushPart(parts, 'removed', before[i]);
      i += 1;
    } else {
      pushPart(parts, 'added', after[j]);
      j += 1;
    }
  }
  for (; i < before.length; i += 1) pushPart(parts, 'removed', before[i]);
  for (; j < after.length; j += 1) pushPart(parts, 'added', after[j]);
  return parts;
}

/** Η σύγκριση δύο κειμένων. Ίδια κείμενα ⇒ ένα τμήμα `same` (ή κανένα για κενό). */
export function diffText(before: string, after: string): TextDiffPart[] {
  if (before === after) return before.length === 0 ? [] : [{ kind: 'same', text: before }];
  const a = textSegments(before);
  const b = textSegments(after);
  if ((a.length + 1) * (b.length + 1) > MAX_CELLS) {
    return [
      ...(before.length > 0 ? [{ kind: 'removed' as const, text: before }] : []),
      ...(after.length > 0 ? [{ kind: 'added' as const, text: after }] : []),
    ];
  }
  return walk(a, b, lcsTable(a, b));
}

/** Υπάρχει ουσιαστική αλλαγή; (Για σήμανση «άλλαξε το κείμενο» χωρίς απόδοση.) */
export function hasTextChange(parts: readonly TextDiffPart[]): boolean {
  return parts.some((part) => part.kind !== 'same');
}
