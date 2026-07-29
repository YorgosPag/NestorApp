/**
 * 🔴 **ΑΝ ΔΕΝ ΖΩΓΡΑΦΙΖΕΤΑΙ, Ο ΚΕΡΣΟΡΑΣ ΔΕΝ ΤΟ ΒΡΙΣΚΕΙ** — layer gating στο hit-test.
 *
 * **Το περιστατικό (Giorgio, 2026-07-29):** *«τώρα εξαφανίστηκαν οι μπλε γραμμές, αλλά όταν
 * κάνω hover τις ανακαλύπτει ο κέρσορας, φωτίζονται και επιλέγονται»*. Δηλαδή μόλις το
 * **πάγωμα** άρχισε να τιμάται στο rendering, αποκαλύφθηκε ότι το **picking** δεν το ρωτούσε
 * ποτέ: το `passesFilters` έλεγχε **μόνο** το `entity.visible`, ούτε μία λέξη για το layer.
 *
 * Δύο υποσυστήματα, δύο διαφορετικά κριτήρια για το ίδιο ερώτημα — η κλασική απόκλιση που
 * περιγράφει το `config/layer-visibility.ts`. Τώρα και τα δύο ρωτούν τον ΙΔΙΟ SSoT
 * (`isLayerRenderable`).
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { passesFilters } from '../hit-tester-utils';
import { createSceneLayer, type Entity, type SceneLayer } from '../../../types/entities';
import { setLayers, __resetLayerStoreForTesting } from '../../../stores/LayerStore';
import { UnifiedEntitySelection } from '../../../systems/selection/utils';
import { CoordinateTransforms } from '../../core/CoordinateTransforms';
import type { Point2D, ViewTransform, Viewport } from '../../types/Types';

function layer(over: Partial<SceneLayer> & { name: string }): SceneLayer {
  return createSceneLayer({ visible: true, frozen: false, locked: false, ...over });
}

/** Οντότητα πάνω στο δοσμένο layer — ό,τι ελάχιστο κοιτά το `passesFilters`. */
const entityOn = (layerId: string): Entity => ({
  id: 'e1', type: 'line', layerId, visible: true,
  start: { x: 0, y: 0 }, end: { x: 10, y: 10 },
} as unknown as Entity);

let visibleLayer: SceneLayer;
let frozenLayer: SceneLayer;
let offLayer: SceneLayer;

beforeEach(() => {
  __resetLayerStoreForTesting();
  visibleLayer = layer({ name: 'OK' });
  frozenLayer = layer({ name: 'PL', frozen: true });      // το `pl` του 47_ergasia
  offLayer = layer({ name: 'OFF', visible: false });
  setLayers([visibleLayer, frozenLayer, offLayer]);
});

afterEach(() => {
  __resetLayerStoreForTesting();
});

describe('hit-test — το layer gate που έλειπε', () => {
  it('🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ — οντότητα σε ΠΑΓΩΜΕΝΟ layer δεν είναι πλέον επιλέξιμη', () => {
    expect(passesFilters(entityOn(frozenLayer.id), {})).toBe(false);
  });

  it('οντότητα σε ΣΒΗΣΤΟ layer δεν είναι επιλέξιμη', () => {
    expect(passesFilters(entityOn(offLayer.id), {})).toBe(false);
  });

  it('οντότητα σε κανονικό layer παραμένει επιλέξιμη (μηδέν παρενέργεια)', () => {
    expect(passesFilters(entityOn(visibleLayer.id), {})).toBe(true);
  });

  it('`includeInvisible` παρακάμπτει το gate — οι καταναλωτές που θέλουν τα πάντα τα παίρνουν', () => {
    expect(passesFilters(entityOn(frozenLayer.id), { includeInvisible: true })).toBe(true);
    expect(passesFilters(entityOn(offLayer.id), { includeInvisible: true })).toBe(true);
  });

  it('FAIL-OPEN — άγνωστο `layerId` δεν εξαφανίζει σιωπηλά τη δυνατότητα επιλογής', () => {
    // Ίδια στάση με τον renderer: σπασμένη αναφορά layer ⇒ καμία δέσμευση, όχι «κρύψ' το».
    expect(passesFilters(entityOn('lyr_ΑΝΥΠΑΡΚΤΟ'), {})).toBe(true);
  });

  it('οντότητα ΧΩΡΙΣ layerId περνά (δεν σπάει BIM/preview entities εκτός layers)', () => {
    const noLayer = { id: 'e2', type: 'line', visible: true } as unknown as Entity;
    expect(passesFilters(noLayer, {})).toBe(true);
  });

  it('ΚΑΙ ΤΑ ΤΡΙΑ ΜΟΝΟΠΑΤΙΑ ΕΠΙΛΟΓΗΣ — click / marquee / lasso ρωτούν το ΙΔΙΟ κατηγόρημα', () => {
    // Το hover πέρναγε από το hit-test· η επιλογή όμως έχει ΤΡΙΑ ακόμη μονοπάτια, καθένα με
    // δικό του (ή κανένα) φίλτρο layer: `findEntityAtPoint` έλεγχε `!layer.visible`,
    // `findEntitiesInMarquee` **τίποτα**, `findEntitiesInLasso` **τίποτα**. Ένα κουτί πάνω από
    // παγωμένο layer «διάλεγε» οντότητες που ο χρήστης δεν βλέπει.
    const transform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
    const viewport: Viewport = { width: 1000, height: 1000 };
    const canvasRect = { width: 1000, height: 1000, left: 0, top: 0 } as DOMRect;
    const toScreen = (w: Point2D) => CoordinateTransforms.worldToScreen(w, transform, viewport);

    const onFrozen = { ...entityOn(frozenLayer.id), id: 'FROZEN' } as Entity;
    const onVisible = { ...entityOn(visibleLayer.id), id: 'VISIBLE' } as Entity;
    const both = [onFrozen, onVisible];

    // marquee (crossing, R→L) που καλύπτει και τα δύο
    const a = toScreen({ x: -5, y: -5 });
    const b = toScreen({ x: 20, y: 20 });
    const [right, left] = a.x >= b.x ? [a, b] : [b, a];
    const ids = UnifiedEntitySelection.findEntitiesInMarquee(right, left, both, transform, canvasRect);
    expect(ids).toContain('VISIBLE');
    expect(ids).not.toContain('FROZEN');

    // lasso (crossing) γύρω από τα ίδια
    const lasso = [{ x: -5, y: -5 }, { x: 20, y: -5 }, { x: 20, y: 20 }, { x: -5, y: 20 }].map(toScreen);
    const lassoIds = UnifiedEntitySelection.findEntitiesInLasso(lasso, both, transform, canvasRect, 'crossing');
    expect(lassoIds).toContain('VISIBLE');
    expect(lassoIds).not.toContain('FROZEN');

    // click ακριβώς πάνω στην παγωμένη → βρίσκει την από κάτω ορατή, όχι την παγωμένη
    const click = UnifiedEntitySelection.findEntityAtPoint(
      toScreen({ x: 5, y: 5 }), both, {}, transform, canvasRect,
    );
    expect(click?.entityId).toBe('VISIBLE');
  });

  it('ΖΩΝΤΑΝΗ ΑΝΑΓΝΩΣΗ — ξεπάγωμα του layer ξανακάνει την οντότητα επιλέξιμη χωρίς rebuild', () => {
    // Το gate διαβάζει το store **τη στιγμή του query**. Αν το φιλτράραμε όταν χτίζεται ο
    // spatial index, ένα toggle στο panel δεν θα φαινόταν μέχρι να αλλάξει η σκηνή.
    const e = entityOn(frozenLayer.id);
    expect(passesFilters(e, {})).toBe(false);
    setLayers([visibleLayer, { ...frozenLayer, frozen: false }, offLayer]);
    expect(passesFilters(e, {})).toBe(true);
  });
});
