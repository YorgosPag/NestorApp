/**
 * ADR-929 §6.19 — **σημάδια διάστασης που ο ανιχνευτής κειμένου πέρασε για γράμματα**: η απόληξη (βέλος + βοηθητική) στο
 * άκρο μιας διάστασης είναι μικρό αυτόνομο σύμπλεγμα στο μέγεθος χαρακτήρα, και το OCR τη διαβάζει «T» · «I» · «4».
 * Δεν είναι κείμενο: **απορροφάται στη διάσταση** που τη ζωγραφίζει, όπως το `absorbedGraphics` της εισαγωγής PDF (ADR-941
 * Φ2β · Δ19) — ποτέ κάρτα «άλλο κείμενο», ποτέ τιμή διάστασης.
 *
 * 🔑 **Απόδειξη = η γεωμετρία που ήδη κρίθηκε**, όχι νέα ανίχνευση: το πλαίσιο του κειμένου ακουμπά **και** γραμμή
 *   επέκτασης **και** γραμμή διάστασης (Φ5.4) — δηλαδή κάθεται στη συνάντησή τους, εκεί όπου ζωγραφίζεται η απόληξη. Ο
 *   πραγματικός αριθμός κάθεται ανάμεσα στις επεκτάσεις, όχι πάνω τους (Lai & Kasturi 1994: διαχωρισμός
 *   κειμένου/γραφικών από τη σχέση με τις γραμμές).
 * 🔑 **Μόνο σύντομα** (≤ {@link MARK_MAX_CHARS} χαρακτήρες): μια απόληξη διαβάζεται ως ένα-δύο σύμβολα. Μια λέξη που
 *   διασχίζει μια επέκταση μένει κείμενο.
 * 🔑 **Ο άνθρωπος νικά** (Δ9): κείμενο που διορθώθηκε ή επιβεβαιώθηκε δεν απορροφάται ποτέ.
 * 🔑 **Ποτέ σιωπηλά**: η σύντηξη επιστρέφει τα ids με όνομα (`absorbedMarkTextIds`) και η λίστα «Τι διάβασα» τα μετρά.
 *
 * Καθαρό.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/fusion/dimension-marks
 */

import { lineIntersectsRectangle } from '../../../systems/selection/universal-marquee-geometry';
import type { PlanReading, PlanSegmentRole, PlanText, RasterSegment } from '../plan-recognition-types';

/** Μια απόληξη διαβάζεται το πολύ ως τόσα σύμβολα. */
export const MARK_MAX_CHARS = 2;

const glyphCount = (raw: string): number => [...raw.replace(/\s+/g, '')].length;

const isHumanChecked = (t: PlanText): boolean => t.correctedFrom !== undefined || t.confirmed === true;

const inRect = (p: { x: number; y: number }, r: PlanText['rect']): boolean =>
  p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY;

/** Ακουμπά το τμήμα το πλαίσιο του κειμένου (τέμνει πλευρά ή βρίσκεται μέσα του); */
function touches(s: RasterSegment, r: PlanText['rect']): boolean {
  if (inRect(s.start, r) || inRect(s.end, r)) return true;
  return lineIntersectsRectangle(s.start, s.end, { min: { x: r.minX, y: r.minY }, max: { x: r.maxX, y: r.maxY } });
}

/**
 * Τα ids των κειμένων της ανάγνωσης που είναι **σημάδια διάστασης**. `segments` + `roles` = η γεωμετρία και η κρίση της
 * Φ5.4, στα αρχικά px όπως και τα πλαίσια των κειμένων.
 */
export function dimensionMarkTextIds(
  reading: PlanReading,
  segments: readonly RasterSegment[],
  roles: ReadonlyMap<string, PlanSegmentRole>,
): ReadonlySet<string> {
  const extensions = segments.filter((s) => roles.get(s.id) === 'extension-line');
  const dimensionLines = segments.filter((s) => roles.get(s.id) === 'dimension-line');
  if (extensions.length === 0 || dimensionLines.length === 0) return new Set();
  // Και τα δύο: η απόληξη ζει εκεί όπου η επέκταση συναντά τη γραμμή διάστασης.
  const onMark = (t: PlanText): boolean =>
    extensions.some((s) => touches(s, t.rect)) && dimensionLines.some((s) => touches(s, t.rect));
  return new Set(reading.texts
    .filter((t) => glyphCount(t.raw) <= MARK_MAX_CHARS && !isHumanChecked(t) && onMark(t))
    .map((t) => t.id));
}

/**
 * Η ανάγνωση **χωρίς** τα σημάδια: ό,τι ακολουθεί (στόχοι διαστάσεων, κλίμακα, χώροι) δεν τα βλέπει ποτέ. Κανένα άλλο
 * πεδίο δεν αλλάζει· ό,τι έδειχνε σε απορροφημένο κείμενο (διάσταση, κλίμακα) φεύγει μαζί του.
 */
export function withoutDimensionMarks(reading: PlanReading, marks: ReadonlySet<string>): PlanReading {
  if (marks.size === 0) return reading;
  return {
    ...reading,
    texts: reading.texts.filter((t) => !marks.has(t.id)),
    dimensions: reading.dimensions.filter((d) => !marks.has(d.textId)),
    writtenScale: reading.writtenScale !== null && marks.has(reading.writtenScale.textId) ? null : reading.writtenScale,
    rooms: reading.rooms.map((r) => (r.nameTextId !== null && marks.has(r.nameTextId) ? { ...r, nameTextId: null } : r)),
    openings: reading.openings.map((o) => (o.sizeTextId !== null && marks.has(o.sizeTextId) ? { ...o, sizeTextId: null } : o)),
  };
}
