/**
 * Το **κείμενο της σελίδας ως απόδειξη** (ADR-923 §5.5 · §21.3) — η AI δεν αυτοελέγχεται, άρα την ελέγχουμε εμείς.
 *
 * Η AI δεν δίνει συντεταγμένες (τις μαντεύει)· δίνει **ποια κομμάτια κειμένου** διάβασε, από αριθμημένη λίστα που φτιάξαμε
 * εμείς από τη στρώση κειμένου του PDF. Έτσι κάθε τιμή διασταυρώνεται ντετερμινιστικά:
 *   - το κομμάτι λέει όντως αυτή την τιμή ⇒ `verified: true`, και η περιοχή είναι **μετρημένη**, όχι δηλωμένη·
 *   - λέει κάτι άλλο ⇒ `verified: false`: η βεβαιότητα του μοντέλου παύει να μετρά·
 *   - η σελίδα δεν έχει στρώση κειμένου ⇒ `verified: null`, άγκυρα μόνο σελίδας.
 *
 * Κι επειδή ο πίνακας έχει γεωμετρία, πιάνεται η **σιωπηλή μετατόπιση στήλης** (το επικίνδυνο λάθος, 7/7 παραλλαγές στο
 * MFP) ακόμη κι όπου δεν σηκώνει σημαία κανόνας συνέπειας: οι τιμές μιας παραλλαγής πρέπει να στοιχίζονται.
 *
 * Καθαρό αρχείο: τα κομμάτια έρχονται έτοιμα από τον διακομιστή.
 * @module subapps/catalog/import/page-tokens
 */

import { parseEnteredAmount } from '../values/decimal-amount';
import { normalizeUniqueText } from '../values/normalize-unique';
import type { PageRegion, SourceAnchor } from '../types/catalog-import';

/** Ένα κομμάτι κειμένου σε κλάσματα σελίδας (αρχή πάνω-αριστερά). */
export interface PageTextItem extends PageRegion {
  readonly text: string;
}

export interface PageToken extends PageRegion {
  readonly id: string;
  readonly text: string;
}

const WORD = /\S+/gu;

/** Ένα κομμάτι → λέξεις, με πλάτος αναλογικό των χαρακτήρων: η ίδια γραμμή του PDF μπορεί να κρατά δέκα κελιά. */
function wordsOf(item: PageTextItem): Array<Omit<PageToken, 'id'>> {
  const length = item.text.length;
  if (length === 0) return [];
  return [...item.text.matchAll(WORD)].map((match) => ({
    text: match[0],
    x: item.x + item.width * (match.index / length),
    y: item.y,
    width: item.width * (match[0].length / length),
    height: item.height,
  }));
}

/** Αριθμημένα κομμάτια, με τη σειρά ανάγνωσης της στρώσης κειμένου. Το `id` είναι ό,τι βλέπει η AI. */
export function tokenizePage(items: readonly PageTextItem[]): PageToken[] {
  return items.flatMap(wordsOf).map((word, index) => ({ ...word, id: `t${index + 1}` }));
}

/** Μία μορφή σύγκρισης: «016–15–001» ≡ «016-15-001», «2,50» ≡ «2.5». */
function comparableForm(text: string): string {
  const amount = parseEnteredAmount(text.trim());
  return amount ? `#${Number(amount.amount)}` : normalizeUniqueText(text).replace(/\s+/g, '');
}

/** Λέει το κείμενο των κομματιών αυτή την τιμή; Η τιμή μπορεί να είναι τμήμα του («2,5 kW» → κομμάτι «2,5»). */
function tokensSay(tokens: readonly PageToken[], value: string): boolean {
  const joined = comparableForm(tokens.map((token) => token.text).join(' '));
  const wanted = comparableForm(value);
  if (joined === wanted || joined.includes(wanted)) return true;
  const number = parseEnteredAmount(value.trim().split(/\s+/)[0] ?? '');
  return number !== null && tokens.some((token) => comparableForm(token.text) === `#${Number(number.amount)}`);
}

const regionOf = ({ x, y, width, height }: PageToken): PageRegion => ({ x, y, width, height });

/**
 * Η άγκυρα μιας τιμής: σελίδα + περιοχές + κρίση διασταύρωσης. Κομμάτια που η AI επινόησε (ανύπαρκτο id) μετρούν ως
 * διάψευση: η απόδειξή της δεν υπάρχει.
 */
export function anchorForCell(
  page: number,
  value: string,
  citedTokenIds: readonly string[],
  tokens: ReadonlyMap<string, PageToken>,
): SourceAnchor {
  if (tokens.size === 0) return { kind: 'page', page, regions: [], verified: null };
  const cited = citedTokenIds.flatMap((id) => tokens.get(id) ?? []);
  const honest = cited.length === citedTokenIds.length && cited.length > 0;
  return { kind: 'page', page, regions: cited.map(regionOf), verified: honest && tokensSay(cited, value) };
}

// ── Στοίχιση πίνακα ──────────────────────────────────────────────────────────

/** Μία παραλλαγή: το κέντρο κάθε τιμής της, ανά ιδιότητα. */
export interface AlignedRow {
  readonly rowKey: string;
  readonly centers: ReadonlyMap<string, { readonly x: number; readonly y: number }>;
}

const ALIGNMENT_TOLERANCE = 0.012;

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

type Axis = 'x' | 'y';

/** Πόσο απλώνονται οι τιμές **μιας** παραλλαγής στον άξονα: ο πίνακας έχει τις παραλλαγές στον άξονα με τη μικρότερη διασπορά. */
function spreadAlong(rows: readonly AlignedRow[], axis: Axis): number {
  const spreads = rows.map((row) => {
    const values = [...row.centers.values()].map((center) => center[axis]);
    return values.length < 2 ? 0 : Math.max(...values) - Math.min(...values);
  });
  return median(spreads);
}

/**
 * Οι τιμές που **ξεφεύγουν** από τη στήλη (ή τη γραμμή) της παραλλαγής τους: `rowKey → ιδιότητες`. Χρειάζονται ≥ 3
 * τιμές για να υπάρχει διάμεσος με νόημα· λιγότερες ⇒ δεν κρίνεται, δεν καταγγέλλεται.
 */
export function misalignedCells(rows: readonly AlignedRow[]): ReadonlyMap<string, readonly string[]> {
  const axis: Axis = spreadAlong(rows, 'x') <= spreadAlong(rows, 'y') ? 'x' : 'y';
  const found = new Map<string, string[]>();
  for (const row of rows) {
    if (row.centers.size < 3) continue;
    const center = median([...row.centers.values()].map((point) => point[axis]));
    const strays = [...row.centers].filter(([, point]) => Math.abs(point[axis] - center) > ALIGNMENT_TOLERANCE).map(([attributeId]) => attributeId);
    if (strays.length > 0) found.set(row.rowKey, strays);
  }
  return found;
}
