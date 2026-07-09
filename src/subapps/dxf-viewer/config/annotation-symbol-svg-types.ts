/**
 * ADR-608 Φ-import-svg — τύποι για **SVG-based** annotation symbol glyphs.
 *
 * Τα line/polyline/circle/arc primitives (`annotation-symbol-catalog.ts`) δεν χωρούν
 * Bézier καμπύλες. Για πλούσια, **δικά μας πρωτότυπα** σχέδια (π.χ. οικογένεια/άνθρωποι/
 * αυτοκίνητα) που ταιριάζουν οπτικά με τα σύμβολα του Τέκτονα, ένα σύμβολο μπορεί να είναι
 * ένα SVG: λίστα από `<path>`/`<circle>`/`<line>` σε **SVG-space** (viewBox coords, Y-down).
 * Ο renderer τα ζωγραφίζει με native `Path2D` κάτω από ένα affine (viewBox → glyph unit
 * space → world → screen), κρατώντας πλήρη vector πιστότητα σε κάθε zoom.
 *
 * **IP:** ΜΟΝΟ πρωτότυπα σχέδια του χρήστη (δικές του γραμμές· καμία αντιγραφή από τη
 * βιβλιοθήκη του Fespa/LH). Το SVG είναι το authoring format — ο χρήστης σχεδιάζει, εμείς
 * ενσωματώνουμε το `d`/element data.
 *
 * @see config/annotation-symbol-catalog.ts — ο κατάλογος (το `svg` μπαίνει στο primitive union)
 * @see rendering/entities/AnnotationSymbolRenderer.ts — ο Path2D renderer
 */

/** Ένα SVG element σε viewBox-space (Y-down, όπως το authored SVG). */
export type AnnotationSvgElement =
  | { readonly el: 'path'; readonly d: string; readonly fill: boolean }
  | { readonly el: 'circle'; readonly cx: number; readonly cy: number; readonly r: number; readonly fill: boolean }
  | { readonly el: 'line'; readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number };

/**
 * Ένα SVG glyph: το authored viewBox + τα elements του. Ο renderer το κεντράρει στο σημείο
 * εισαγωγής και το κλιμακώνει ώστε το **ύψος** του viewBox να γίνει το nominal paper height
 * (`sizeMm`) — annotative, όπως τα primitive glyphs.
 */
export interface AnnotationSymbolSvg {
  readonly kind: 'svg';
  /** `[minX, minY, width, height]` του authored SVG. */
  readonly viewBox: readonly [number, number, number, number];
  /** Τα SVG elements (paths/circles/lines) σε viewBox coords. */
  readonly elements: readonly AnnotationSvgElement[];
}
