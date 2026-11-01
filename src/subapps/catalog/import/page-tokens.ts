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

import { cellText } from '@/lib/pdf-tables/cell-text';
import { normalizeMixedScriptHomoglyphs } from '@/utils/greek-text';
import { parseEnteredAmount } from '../values/decimal-amount';
import { normalizeUniqueText } from '../values/normalize-unique';
import { unitForm } from '../values/value-text-codec';
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
export function comparableForm(text: string): string {
  const amount = parseEnteredAmount(text.trim());
  return amount ? `#${Number(amount.amount)}` : normalizeUniqueText(text).replace(/\s+/g, '');
}

/**
 * Λέει το κείμενο των κομματιών αυτή την τιμή; Η τιμή μπορεί να είναι τμήμα του («2,5 kW» → κομμάτι «2,5»).
 * Ο αριθμός κρίνεται **ολόκληρος**: το «100» δεν επιβεβαιώνεται από κομμάτι που λέει «1000».
 */
function tokensSay(tokens: readonly PageToken[], value: string): boolean {
  const joined = comparableForm(tokens.map((token) => token.text).join(' '));
  const wanted = comparableForm(value);
  if (joined === wanted) return true;
  const sayNumber = (form: string): boolean => tokens.some((token) => comparableForm(token.text) === form);
  if (wanted.startsWith('#')) return sayNumber(wanted);
  if (joined.includes(wanted)) return true;
  const number = parseEnteredAmount(value.trim().split(/\s+/)[0] ?? '');
  return number !== null && sayNumber(`#${Number(number.amount)}`);
}

const regionOf = ({ x, y, width, height }: PageToken): PageRegion => ({ x, y, width, height });

export const unitText = (text: string): string => unitForm(normalizeMixedScriptHomoglyphs(text));
const LETTER_OR_SLASH = /[\p{L}/]/u;
const LETTER_DIGIT_OR_SLASH = /[\p{L}\p{N}/]/u;

/** Η μονάδα εμφανίζεται ως ολόκληρη λέξη: το «W» δεν είναι μέσα στο «kW», ούτε στο «W/m²». */
export function containsUnit(printed: string, unit: string): boolean {
  for (let at = printed.indexOf(unit); at !== -1; at = printed.indexOf(unit, at + 1)) {
    const before = printed[at - 1] ?? '';
    const after = printed[at + unit.length] ?? '';
    if (!LETTER_OR_SLASH.test(before) && !LETTER_DIGIT_OR_SLASH.test(after)) return true;
  }
  return false;
}

/**
 * Επιβεβαιώνεται η μονάδα από τα κομμάτια που έδειξε το μοντέλο; Χωρίς πεζά-κεφαλαία ελευθερίες: το «mW» δεν είναι «MW». Τα
 * κομμάτια ενώνονται χωρίς κενό, γιατί το PDF σπάει το «m³/h» σε τρία. Σαρωμένη σελίδα ή ανύπαρκτο κομμάτι ⇒ όχι.
 */
export function unitConfirmed(unit: string, citedTokenIds: readonly string[], tokens: ReadonlyMap<string, PageToken>): boolean {
  const cited = citedTokenIds.flatMap((id) => tokens.get(id) ?? []);
  const wanted = unitText(unit);
  if (wanted === '' || cited.length === 0 || cited.length !== citedTokenIds.length) return false;
  return containsUnit(unitText(cited.map((token) => token.text).join('')), wanted);
}

const WHITESPACE = /\s+/u;

/**
 * Πού τυπώνεται η τιμή, ψαγμένη από εμάς (§5.5.1 Ε1). Η τιμή πολλών λέξεων είναι διαδοχικά κομμάτια. Κομμάτια ολόκληρα: το «100» δεν
 * βρίσκεται μέσα στο «1000».
 */
export function tokensPrinting(value: string, tokens: ReadonlyMap<string, PageToken>): readonly PageToken[][] {
  const words = value.trim().split(WHITESPACE).map(comparableForm);
  const ordered = [...tokens.values()];
  const printing: PageToken[][] = [];
  for (let start = 0; start + words.length <= ordered.length; start += 1) {
    const run = ordered.slice(start, start + words.length);
    if (run.every((token, index) => comparableForm(token.text) === words[index])) printing.push(run);
  }
  return printing;
}

const centerOfToken = ({ x, y, width, height }: PageToken) => ({ x: x + width / 2, y: y + height / 2 });

/**
 * Τυπώνει αυτή η ετικέτα τη μονάδα; Κρίνεται **ανά λέξη**: η μορφή μονάδας αφαιρεί τα κενά, και ολόκληρη γραμμή θα γινόταν «THMW2187»,
 * όπου το «W» δεν στέκει πια ως λέξη.
 */
export function labelPrintsUnit(label: string, unit: string): boolean {
  return label.trim().split(WHITESPACE).some((word) => containsUnit(unitText(word), unit));
}

/** Τυπώνεται η μονάδα στη **γραμμή** ή στη **στήλη** της τιμής; Το «W» κάπου αλλού στη σελίδα δεν αποδεικνύει τίποτα. */
function unitBesideValue(unit: string, value: PageToken, tokens: ReadonlyMap<string, PageToken>): boolean {
  const wanted = unitText(unit);
  const { x, y } = centerOfToken(value);
  const others = [...tokens.values()].filter((token) => token !== value);
  const inRow = others.filter((token) => Math.abs(centerOfToken(token).y - y) <= value.height / 2);
  const inColumn = others.filter((token) => Math.abs(centerOfToken(token).x - x) <= ALIGNMENT_TOLERANCE);
  return labelPrintsUnit(cellText(inRow), wanted) || labelPrintsUnit(cellText(inColumn), wanted);
}

/** Η μονάδα επιβεβαιώνεται από το κείμενο δίπλα σε κάποια θέση όπου τυπώνεται η τιμή, χωρίς καμία υπόδειξη από το μοντέλο. */
export function unitPrintedBeside(unit: string, value: string, tokens: ReadonlyMap<string, PageToken>): boolean {
  return tokensPrinting(value, tokens).some((run) => unitBesideValue(unit, run[0], tokens));
}

/**
 * Η άγκυρα μιας τιμής: σελίδα + περιοχές + κρίση διασταύρωσης. Κομμάτια που η AI επινόησε (ανύπαρκτο id) μετρούν ως
 * διάψευση: η απόδειξή της δεν υπάρχει. Όταν δεν έδειξε τίποτα, ψάχνουμε εμείς (§5.5.1 Ε1): η επιβεβαίωση δεν περιμένει το `id`.
 */
export function anchorForCell(
  page: number,
  value: string,
  citedTokenIds: readonly string[],
  tokens: ReadonlyMap<string, PageToken>,
): SourceAnchor {
  if (tokens.size === 0) return { kind: 'page', page, regions: [], verified: null };
  if (citedTokenIds.length === 0) {
    const [found] = tokensPrinting(value, tokens);
    return { kind: 'page', page, regions: found ? found.map(regionOf) : [], verified: found !== undefined };
  }
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
