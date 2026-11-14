/**
 * ADR-941 Φ1 · Φ2α · Φ2β — `pdfVectorGeometry` / `pdfVectorTexts`: ΕΝΑΣ δρόμος συντεταγμένων (`rasterPixelToScene`), γωνία/ύψος κειμένου από
 * απεικονισμένα σημεία, ταυτότητα πηγής σε κάθε οντότητα.
 */

import type { RasterPlacement } from '../../../floorplan-background/geometry/raster-scene-mapping';
import type { PdfVectorContent } from '../../../pdf-background/services/pdf-vector-content';
import type { LineEntity, PolylineEntity, TextEntity } from '../../../types/entities';
import { isPdfVectorImportOf, PDF_EM_TO_CAP_HEIGHT, pdfVectorGeometry, pdfVectorTexts } from '../pdf-vector-entities';

const LAYERS = { geometry: 'lyr_geo', text: 'lyr_txt' };
/** Εικόνα 100 px ύψους, χωρίς μετατόπιση/κλίμακα: cad-y-up ⇒ σκηνή (x, 100 − y). */
const PLACEMENT: RasterPlacement = {
  transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  naturalBounds: { width: 200, height: 100 },
};

const content = (patch: Partial<PdfVectorContent>): PdfVectorContent => ({ polylines: [], texts: [], skippedFills: 0, fills: [], ...patch });
const inputOf = (c: PdfVectorContent, placement: RasterPlacement = PLACEMENT) => ({ content: c, placement, layers: LAYERS, sourceKey: 'bg_1' });
/** Πρώτα η γεωμετρία, μετά τα κείμενα (κανένα δεν έγινε διάσταση). */
const entitiesOf = (c: PdfVectorContent, placement: RasterPlacement = PLACEMENT) =>
  [...pdfVectorGeometry(inputOf(c, placement)).entities, ...pdfVectorTexts(inputOf(c, placement), new Set())];

describe('pdfVectorGeometry · pdfVectorTexts', () => {
  it('ανοιχτή δύο σημείων ⇒ line· αλλιώς polyline (με το closed)· layer γεωμετρίας', () => {
    const [line, poly] = entitiesOf(content({
      polylines: [
        { points: [[10, 10], [60, 10]], closed: false },
        { points: [[0, 0], [10, 0], [10, 20]], closed: true },
      ],
    })) as [LineEntity, PolylineEntity];
    expect(line).toMatchObject({ type: 'line', start: { x: 10, y: 90 }, end: { x: 60, y: 90 }, layerId: 'lyr_geo' });
    expect(poly).toMatchObject({ type: 'polyline', closed: true, vertices: [{ x: 0, y: 100 }, { x: 10, y: 100 }, { x: 10, y: 80 }] });
  });

  it('κείμενο: θέση = αρχή γραμμής βάσης, ύψος κεφαλαίου = em × λόγος, γωνία 0 για οριζόντιο', () => {
    const [text] = entitiesOf(content({ texts: [{ text: '4.12', origin: [50, 60], along: [60, 60], up: [50, 50], end: [80, 60] }] })) as [TextEntity];
    expect(text).toMatchObject({ type: 'text', text: '4.12', position: { x: 50, y: 40 }, layerId: 'lyr_txt' });
    expect(text.height).toBeCloseTo(10 * PDF_EM_TO_CAP_HEIGHT, 10);
    expect(text.rotation).toBeCloseTo(0, 10);
    expect(text.textNode).toMatchObject({ attachment: 'BL', baselineAnchored: true });
  });

  it('κάθετο κείμενο του PDF (διαβάζεται από κάτω προς τα πάνω) ⇒ +90° στη σκηνή — από τον πίνακα, όχι από πρόσημο', () => {
    // Στα px (Y κάτω) «κατά μήκος» = προς τα πάνω της σελίδας.
    const [text] = entitiesOf(content({ texts: [{ text: '2.05', origin: [50, 60], along: [50, 50], up: [40, 60], end: [50, 30] }] })) as [TextEntity];
    expect(text.rotation).toBeCloseTo(90, 10);
  });

  it('περιστραμμένο υπόβαθρο: η γωνία ακολουθεί την περιστροφή του', () => {
    const rotated: RasterPlacement = { ...PLACEMENT, transform: { ...PLACEMENT.transform, rotation: 30 } };
    const [text] = entitiesOf(content({ texts: [{ text: 'A', origin: [0, 0], along: [10, 0], up: [0, -10], end: [10, 0] }] }), rotated) as [TextEntity];
    expect(text.rotation).toBeCloseTo(30, 10);
  });

  it('κάθε οντότητα φέρει την ταυτότητα της πηγής· άλλη πηγή δεν ταιριάζει', () => {
    const [line] = entitiesOf(content({ polylines: [{ points: [[0, 0], [1, 0]], closed: false }] }));
    expect(isPdfVectorImportOf(line, 'bg_1')).toBe(true);
    expect(isPdfVectorImportOf(line, 'bg_2')).toBe(false);
  });

  it('γεωμετρία: μία οντότητα ανά πολυγραμμή, με τη σειρά τους (τα ids δένουν τις διαστάσεις)', () => {
    const c = content({ polylines: [{ points: [[0, 0], [1, 0]], closed: false }, { points: [[0, 0], [1, 0], [1, 1]], closed: true }] });
    const geometry = pdfVectorGeometry(inputOf(c));
    expect(geometry.entities.map((e) => e.type)).toEqual(['line', 'polyline']);
    expect(geometry.ids).toEqual(geometry.entities.map((e) => e.id));
  });

  it('Φ2β (Δ19): οι απορροφημένες πολυγραμμές δεν γράφονται· το id τους είναι `null` και οι δείκτες των άλλων μένουν', () => {
    const c = content({ polylines: [
      { points: [[0, 0], [1, 0]], closed: false },
      { points: [[5, 5], [6, 5]], closed: false },
      { points: [[0, 0], [1, 0], [1, 1]], closed: true },
    ] });
    const geometry = pdfVectorGeometry(inputOf(c), new Set([1]));
    expect(geometry.entities.map((e) => e.type)).toEqual(['line', 'polyline']);
    expect(geometry.ids).toEqual([geometry.entities[0].id, null, geometry.entities[1].id]);
  });

  it('Δ16: κείμενο που έγινε διάσταση δεν γράφεται και ως κείμενο', () => {
    const c = content({ texts: [
      { text: '2.05', origin: [0, 0], along: [10, 0], up: [0, -10], end: [20, 0] },
      { text: 'ΚΟΥΖΙΝΑ', origin: [0, 50], along: [10, 50], up: [0, 40], end: [40, 50] },
    ] });
    expect(pdfVectorTexts(inputOf(c), new Set([0])).map((t) => t.text)).toEqual(['ΚΟΥΖΙΝΑ']);
  });
});
