/**
 * ADR-650 §M10g.4.1 — ΤΟ ΟΡΙΟ ΩΣ ΣΥΜΒΟΛΑΙΟ ΜΕ ΔΟΝΤΙΑ.
 *
 * Ο Revit *προειδοποιεί* όταν η γεωμετρία απομακρυνθεί από το Internal Origin — εκ των υστέρων,
 * και ο χρήστης το ανακαλύπτει όταν το μοντέλο έχει ήδη χαλάσει. Εδώ η ραφή του ψησίματος
 * **αρνείται να γράψει** (dev / DCHECK semantics): μια ψημένη οντότητα σε ωμές ΕΓΣΑ είναι
 * αόρατη (ADR-635 culling), άπιαστη και σιωπηλή.
 *
 * Ο έλεγχος δεν είναι κατώφλι μεγέθους — είναι διάγνωση **κλάσης**: με ενεργό πλαίσιο, η
 * προβεβλημένη γεωμετρία κάθεται κοντά στο 0 ενώ η αξήμωτη κοντά στο `origin`. Γι' αυτό ένα
 * νόμιμο **μεγάλο** οικόπεδο (2 χλμ.) περνά, ενώ ένας ξεχασμένος projector σκάει.
 */

import { commitBakedTopoEntities } from '../topo-bake-commit';
import { resetBakedFramesForTest, getBakedFrame } from '../topo-baked-frame-store';
import { setGeoReference } from '../../geo-referencing/geo-reference-store';
import { TOPO_GRID_LAYER_NAME } from '../topo-grid-config';
import { createSceneLayer } from '../../../types/scene-types';
import type { Entity } from '../../../types/entities';
import type { SceneModel } from '../../../types/scene';

// Η ραφή δοκιμάζεται ως προς ΤΗ ΔΙΚΗ ΤΗΣ ευθύνη (έλεγχος + σφραγίδα)· η εγγραφή σκηνής είναι
// ήδη καλυμμένη από τα τεστ του `completeEntity` (ADR-057).
jest.mock('../../../hooks/drawing/completeEntity', () => ({
  completeEntities: jest.fn(() => []),
}));

const ORIGIN_WORLD = { x: 407_565_290, y: 4_502_055_670 };
const layer = createSceneLayer({ name: TOPO_GRID_LAYER_NAME, color: '#5B6B7B', visible: true, locked: false });

const scene = {
  entities: [],
  layersById: { [layer.id]: layer } as unknown as SceneModel['layersById'],
  bounds: { min: { x: 0, y: 0 }, max: { x: 1000, y: 1000 } },
  units: 'mm',
} as SceneModel;

const lineAt = (x: number, y: number): Entity =>
  ({ id: 'g1', type: 'line', layerId: layer.id, start: { x, y }, end: { x: x + 100, y } }) as unknown as Entity;

const commit = (entity: Entity): void => commitBakedTopoEntities({
  entities: [entity],
  group: 'grid',
  tool: 'topo-grid',
  levelId: 'flr_a',
  getScene: () => scene,
  setScene: () => undefined,
});

describe('ADR-650 §M10g — η ραφή αρνείται να ψήσει εκτός display frame', () => {
  beforeEach(() => { resetBakedFramesForTest(); setGeoReference(null); });
  afterEach(() => { resetBakedFramesForTest(); setGeoReference(null); });

  it('προβεβλημένη γεωμετρία (κοντά στο 0) περνά ΚΑΙ σφραγίζεται', () => {
    setGeoReference({ originWorld: ORIGIN_WORLD, rotationDeg: 0 });
    expect(() => commit(lineAt(1200, 3400))).not.toThrow();
    expect(getBakedFrame('flr_a', 'grid')).toEqual({
      originWorldXMm: ORIGIN_WORLD.x, originWorldYMm: ORIGIN_WORLD.y, rotationDeg: 0,
    });
  });

  it('ωμές ΕΓΣΑ συντεταγμένες ⇒ ΣΚΑΕΙ, και ΚΑΜΙΑ σφραγίδα δεν μένει πίσω', () => {
    setGeoReference({ originWorld: ORIGIN_WORLD, rotationDeg: 0 });
    expect(() => commit(lineAt(ORIGIN_WORLD.x, ORIGIN_WORLD.y)))
      .toThrow(/TOPO_BAKE_OUTSIDE_DISPLAY_FRAME/);
    expect(getBakedFrame('flr_a', 'grid')).toBeNull();
  });

  it('νόμιμο ΜΕΓΑΛΟ οικόπεδο (2 χλμ. από την αρχή) ΔΕΝ είναι ψευδώς θετικό', () => {
    setGeoReference({ originWorld: ORIGIN_WORLD, rotationDeg: 0 });
    expect(() => commit(lineAt(2_000_000, 1_500_000))).not.toThrow();
  });

  it('μη-γεωαναφερμένο έργο: κανένας έλεγχος — δεν υπάρχει γέφυρα να ξεχαστεί', () => {
    setGeoReference(null);
    expect(() => commit(lineAt(50_000_000, 50_000_000))).not.toThrow();
    expect(getBakedFrame('flr_a', 'grid'))
      .toEqual({ originWorldXMm: 0, originWorldYMm: 0, rotationDeg: 0 });
  });
});
