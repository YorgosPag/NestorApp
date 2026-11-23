/**
 * =============================================================================
 * Πίνακας με θέσεις — στήλες από επικεφαλίδες, κελιά από γραμμές (ADR-949 Α-2 · Α-3)
 * =============================================================================
 *
 * Ο ΕΝΑΣ κινητήρας ανάγνωσης πινάκων PDF για τους αναγνώστες εγγράφων (Ε9 · πράξη ΕΝΦΙΑ). Ο αναγνώστης δηλώνει
 * **πώς** βρίσκονται οι στήλες της σελίδας (ετικέτες ή αριθμοί στηλών) και **ποιος** κανόνας κρίνει σε ποια στήλη ανήκει
 * ένα κομμάτι· τα υπόλοιπα (κελί σε γραμμή · κελί που σπάει σε γραμμές · ύψος εγγραφής) είναι κοινά.
 *
 * 🔑 **Στήλες από τη ΣΕΛΙΔΑ, ποτέ σταθερές συντεταγμένες**: κάθε σελίδα δίνει τις δικές της άγκυρες (η **αριστερότερη**
 *    εμφάνιση κάθε επικεφαλίδας — «Είδος δικαιώματος» και «Ποσοστό» γράφονται δύο φορές στο Ε9, και η σειρά τους στη ροή
 *    του pdf.js **δεν** είναι σταθερή, μετρημένο).
 * 🔑 **Δύο κανόνες κατανομής, ποτέ «περίπου»**:
 *    - {@link nearestColumnLocator} — η πλησιέστερη άγκυρα **μόνο** αν απέχει λίγο (Ε9: τιμές κεντραρισμένες κάτω από την
 *      επικεφαλίδα, απόκλιση ≤ 2,5 — η γειτονική στήλη απέχει ≥ 5,5)· αλλιώς το κομμάτι μένει αδιάβαστο.
 *    - {@link bandColumnLocator} — η ζώνη ανάμεσα στα μέσα των γειτονικών αγκυρών (ΕΝΦΙΑ: οι αριθμοί είναι
 *      **δεξιά στοιχισμένοι** και απέχουν έως 23 μονάδες από το κέντρο της στήλης, αλλά μένουν πάντα μέσα στη ζώνη της).
 *      Θέλει **όλες** τις στήλες της σελίδας ως άγκυρες — αλλιώς μια ζώνη θα κατάπινε τη γειτονική.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 *
 * @module lib/pdf/pdf-positioned-table
 */

import { centerXOf, type PdfTextItem, type PdfTextLine } from './pdf-page-text';

/** Οι στήλες της σελίδας με τη θέση τους (x) — με τη σειρά της δήλωσης, που κρίνει τις ισοπαλίες. */
export type PdfColumnAnchors<C> = readonly (readonly [C, number])[];

/** Σε ποια στήλη ανήκει ένα κομμάτι — ή σε καμία. */
export type PdfColumnLocator<C> = (item: PdfTextItem) => C | null;

/**
 * Οι άγκυρες της σελίδας: για κάθε στήλη, η **αριστερότερη** θέση κομματιού που ταιριάζει. Στήλη χωρίς επικεφαλίδα στη
 * σελίδα λείπει (ποτέ μαντεμένη θέση).
 */
export function columnAnchorsOf<C>(
  items: readonly PdfTextItem[],
  matchers: readonly (readonly [C, (text: string) => boolean])[],
  positionOf: (item: PdfTextItem) => number,
): PdfColumnAnchors<C> {
  return matchers.flatMap(([column, matches]) => {
    const xs = items.filter((item) => matches(item.s)).map(positionOf);
    return xs.length === 0 ? [] : [[column, Math.min(...xs)] as const];
  });
}

export function hasColumn<C>(anchors: PdfColumnAnchors<C>, column: C): boolean {
  return anchors.some(([candidate]) => candidate === column);
}

/** Η πλησιέστερη άγκυρα στο κέντρο του κομματιού — μόνο αν απέχει ≤ `maxOffset` (βλ. 🔑 πάνω). */
export function nearestColumnLocator<C>(anchors: PdfColumnAnchors<C>, maxOffset: number): PdfColumnLocator<C> {
  return (item) => {
    let best: { readonly column: C; readonly distance: number } | null = null;
    for (const [column, x] of anchors) {
      const distance = Math.abs(centerXOf(item) - x);
      if (best === null || distance < best.distance) best = { column, distance };
    }
    return best !== null && best.distance <= maxOffset ? best.column : null;
  };
}

/**
 * Η στήλη της οποίας η **ζώνη** περιέχει το κέντρο του κομματιού: από το μέσο προς την προηγούμενη άγκυρα ως το μέσο
 * προς την επόμενη. Οι ακριανές στήλες φτάνουν μισό διάστημα έξω — πιο πέρα δεν είναι πίνακας.
 */
export function bandColumnLocator<C>(anchors: PdfColumnAnchors<C>): PdfColumnLocator<C> {
  const sorted = [...anchors].sort((a, b) => a[1] - b[1]);
  const bands = sorted.map(([column, x], i) => {
    const left = i > 0 ? (sorted[i - 1][1] + x) / 2 : x - ((sorted[i + 1]?.[1] ?? x) - x) / 2;
    const right = i < sorted.length - 1 ? (x + sorted[i + 1][1]) / 2 : x + (x - (sorted[i - 1]?.[1] ?? x)) / 2;
    return { column, left, right };
  });
  return (item) => {
    const center = centerXOf(item);
    return bands.find(({ left, right }) => center >= left && center < right)?.column ?? null;
  };
}

/** Το κελί της στήλης σε **μία** οπτική γραμμή — `null` αν η γραμμή δεν έχει κομμάτι εκεί. */
export function cellOf<C>(line: PdfTextLine, column: C, locate: PdfColumnLocator<C>): string | null {
  const item = line.items.find((candidate) => locate(candidate) === column);
  return item === undefined ? null : item.s.trim();
}

/** Μια εγγραφή του πίνακα: τα κομμάτια της σελίδας και το ύψος γύρω από τη γραμμή-άγκυρα. */
export interface PdfTableRecord<C> {
  readonly items: readonly PdfTextItem[];
  readonly anchorY: number;
  readonly halfHeight: number;
  readonly locate: PdfColumnLocator<C>;
}

/**
 * Κελί που **σπάει σε γραμμές** μέσα στην εγγραφή: ό,τι ανήκει στη στήλη, από πάνω προς τα κάτω. Αριθμοί ενώνονται
 * χωρίς κενό (το ποσοστό `100,00000` φτάνει ως `100,` + `0000` + `0` στο ένα Ε9 και ως ένα κομμάτι στο άλλο)· κείμενο
 * (διεύθυνση) με κενό.
 */
export function wrappedCellOf<C>(record: PdfTableRecord<C>, column: C, separator: '' | ' '): string | null {
  const parts = record.items
    .filter((item) => Math.abs(item.y - record.anchorY) <= record.halfHeight && record.locate(item) === column)
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((item) => item.s.trim());
  return parts.length === 0 ? null : parts.join(separator);
}

/** Το μισό ύψος εγγραφής γύρω από κάθε γραμμή-άγκυρα: ως `max`, και ποτέ ως τη μέση της επόμενης εγγραφής. */
export function recordHalfHeightOf(anchors: readonly PdfTextLine[], max: number): number {
  const gaps = anchors.slice(1).map((line, i) => line.y - anchors[i].y);
  return Math.min(max, ...gaps.map((gap) => gap / 2 - 1));
}
