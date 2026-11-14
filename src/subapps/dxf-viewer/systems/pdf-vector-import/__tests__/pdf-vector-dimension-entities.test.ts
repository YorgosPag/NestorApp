/**
 * ADR-941 Φ2α · Φ2β — `pdfDimensionEntities`: δεμένη τιμή → `aligned` διάσταση συσχετισμένη ανά άκρο με την κορυφή που το
 * κρατά (Δ13), ζωντανή τιμή όταν συμφωνεί με τη γεωμετρία, γραμμένο κείμενο όταν διαφωνεί (Δ14), οι απολήξεις του σχεδίου
 * ως `dimblk1/2` (Δ20).
 */

import type { RasterPlacement } from '../../../floorplan-background/geometry/raster-scene-mapping';
import type { PxPoint } from '../../../pdf-background/services/pdf-vector-content';
import type { PdfDimensionBinding } from '../pdf-vector-dimension-binding';
import { pdfDimensionEntities } from '../pdf-vector-dimension-entities';
import { isPdfVectorImportOf } from '../pdf-vector-entities';

/** Εικόνα 3000 px ύψους, ταυτοτική: cad-y-up ⇒ σκηνή (x, 3000 − y)· 1 px = 1 mm σε σκηνή mm. */
const PLACEMENT: RasterPlacement = {
  transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  naturalBounds: { width: 5000, height: 3000 },
};

/** Ορθογώνιο 2050 × 2900 px (πολυγραμμή 0). */
const RECT: readonly PxPoint[] = [[0, 0], [2050, 0], [2050, 2900], [0, 2900]];

/** Τα δύο άκρα μιας ακμής του ορθογωνίου, με τις κορυφές τους (όπως τα δίνει η Φ2α). */
const edgeOf = (from: number, to: number): PdfDimensionBinding['measured'] => [
  { point: RECT[from], vertex: { polylineIndex: 0, index: from } },
  { point: RECT[to], vertex: { polylineIndex: 0, index: to } },
];

const binding = (patch: Partial<PdfDimensionBinding>): PdfDimensionBinding => ({
  textIndex: 0, raw: '2.05', valueMm: 2050, precisionMm: 10,
  measured: edgeOf(0, 1), linePoint: [1025, -200], arrowheads: null, ...patch,
});

let seq = 0;
const entitiesOf = (bindings: readonly PdfDimensionBinding[], geometryIds: readonly (string | null)[] = ['ent_rect']) => pdfDimensionEntities({
  bindings, geometryIds, placement: PLACEMENT, sceneUnits: 'mm',
  styleId: 'style_1', layerId: 'lyr_dim', sourceKey: 'bg_1', newId: () => `dim_${++seq}`,
});

describe('pdfDimensionEntities', () => {
  it('aligned στα μετρούμενα σημεία, γραμμή διάστασης από το σημείο της γραμμής, layer/στυλ του καλούντα', () => {
    const { dimensions: [dim] } = entitiesOf([binding({})]);
    expect(dim).toMatchObject({
      type: 'dimension', dimensionType: 'aligned', layerId: 'lyr_dim', styleId: 'style_1',
      defPoints: [{ x: 0, y: 3000 }, { x: 2050, y: 3000 }, { x: 1025, y: 3200 }],
    });
  });

  it('συσχετισμένη με τις ΚΟΡΥΦΕΣ της ακμής (και η κλείνουσα ακμή 3 → 0) ⇒ ακολουθεί την επεξεργασία', () => {
    const { dimensions: [dim] } = entitiesOf([binding({ measured: edgeOf(3, 0), valueMm: 2900, raw: '2.90' })]);
    expect(dim.associations).toEqual([
      { defPointIndex: 0, geometryId: 'ent_rect', associationType: 'endpoint', subIndex: 3 },
      { defPointIndex: 1, geometryId: 'ent_rect', associationType: 'endpoint', subIndex: 0 },
    ]);
  });

  it('Δ14: συμφωνεί με τη γεωμετρία ⇒ χωρίς userText (η μετρούμενη, όπως η χειροκίνητη)· διαφωνεί ⇒ το γραμμένο, μετρημένο', () => {
    const { dimensions, overridden } = entitiesOf([binding({}), binding({ raw: '3.00', valueMm: 3000 })]);
    expect(dimensions[0].userText).toBeUndefined();
    expect(dimensions[1].userText).toBe('3.00');
    expect(overridden).toBe(1);
  });

  it('η ταυτότητα της πηγής ⇒ η επόμενη εισαγωγή την αντικαθιστά (Δ16)', () => {
    const { dimensions: [dim] } = entitiesOf([binding({})]);
    expect(isPdfVectorImportOf(dim, 'bg_1')).toBe(true);
  });

  it('Φ2β: τα δύο άκρα σε ΔΙΑΦΟΡΕΤΙΚΕΣ γραμμές ⇒ μία συσχέτιση ανά άκρο, στη δική του γραμμή', () => {
    const measured: PdfDimensionBinding['measured'] = [
      { point: [0, 0], vertex: { polylineIndex: 0, index: 0 } },
      { point: [2050, 0], vertex: { polylineIndex: 1, index: 1 } },
    ];
    const { dimensions: [dim] } = entitiesOf([binding({ measured })], ['ent_a', 'ent_b']);
    expect(dim.associations).toEqual([
      { defPointIndex: 0, geometryId: 'ent_a', associationType: 'endpoint', subIndex: 0 },
      { defPointIndex: 1, geometryId: 'ent_b', associationType: 'endpoint', subIndex: 1 },
    ]);
  });

  it('άκρο χωρίς κορυφή, ή σε γραμμή που απορροφήθηκε (`null`) ⇒ χωρίς συσχέτιση ΕΚΕΙ — η διάσταση μένει', () => {
    const measured: PdfDimensionBinding['measured'] = [
      { point: [0, 0], vertex: null },
      { point: [2050, 0], vertex: { polylineIndex: 1, index: 1 } },
    ];
    const { dimensions: [dim] } = entitiesOf([binding({ measured })], ['ent_a', null]);
    expect(dim.defPoints.slice(0, 2)).toEqual([{ x: 0, y: 3000 }, { x: 2050, y: 3000 }]);
    expect(dim.associations).toBeUndefined();
  });

  it('Δ20: οι απολήξεις του σχεδίου ⇒ ΚΑΙ ΤΑ ΔΥΟ `dimblk1/2` ρητά· Φ2α (χωρίς γραφικά) ⇒ κανένα override', () => {
    const { dimensions } = entitiesOf([binding({ arrowheads: ['tektonArrow2', 'closedFilled'] }), binding({})]);
    expect(dimensions[0].overrides).toEqual({ dimblk1: 'tektonArrow2', dimblk2: 'closedFilled' });
    expect(dimensions[1].overrides).toBeUndefined();
  });

  it('δέσιμο μηδενικού μήκους ⇒ παραλείπεται, ποτέ throw', () => {
    const measured: PdfDimensionBinding['measured'] = [{ point: [5, 5], vertex: null }, { point: [5, 5], vertex: null }];
    expect(entitiesOf([binding({ measured })]).dimensions).toEqual([]);
  });
});
