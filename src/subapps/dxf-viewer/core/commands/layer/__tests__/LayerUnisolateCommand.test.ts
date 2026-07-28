/**
 * LayerUnisolateCommand tests — ADR-358 §5.6.bis Phase 10.
 *
 * Covers: restores LayerStore from snapshot, clears IsolateEffectsStore,
 * undo re-isolates with the conserved snapshot.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { LayerIsolateCommand } from '../LayerIsolateCommand';
import { LayerUnisolateCommand } from '../LayerUnisolateCommand';
import {
  __resetLayerStoreForTesting,

  getLayer,
  getUnisolateSnapshot,
} from '../../../../stores/LayerStore';
import {
  __resetIsolateEffectsForTesting,
  getIsolateEffectsSnapshot,
} from '../../../../systems/isolate/IsolateEffectsStore';
import { createSceneLayer } from '../../../../types/entities';
// ADR-721 §9 — οι εντολές layer γράφουν πλέον στο ΕΓΓΡΑΦΟ (ο writer είναι fail-closed χωρίς
// αυτό), οπότε το setup στήνει έγγραφο + runtime προβολή. Το σκέτο `setLayers` έστηνε ακριβώς
// τη μισή αρχιτεκτονική που παρήγαγε το bug: «η προβολή άλλαξε» χωρίς να ρωτά «και το έγγραφο;».
import {
  setupActiveDocument,
  teardownActiveDocument,
} from '../../../../systems/levels/__tests__/active-document-test-harness';
// ADR-721 §8 — ο render-side έλεγχος που ΑΝΤΙΚΑΤΕΣΤΗΣΕ το layer-flag μόλυσμα.
import { isEntityLayerSkipped } from '../../../../canvas-v2/dxf-canvas/dxf-entity-layer-skip';

/**
 * ADR-721 §8 — «κρύβεται από την απομόνωση;» ρωτημένο εκεί που ΕΚΤΕΛΕΙΤΑΙ η χειρονομία.
 *
 * Η απομόνωση δεν γράφει πλέον `frozen: true` στα μη-απομονωμένα layers: ήταν κατάσταση
 * συνεδρίας σε μόνιμο πεδίο εγγράφου, που το auto-save μπορούσε να κάνει μόνιμη στο αρχείο
 * του χρήστη. Το layer-scope ελέγχεται τώρα στον renderer, από το `IsolateEffectsStore`.
 *
 * Άρα ένα `expect(getLayer('lyr_b')?.frozen)` θα έλεγχε **νεκρό** σημείο — θα ήταν πράσινο
 * μόνο αν επαναφέραμε το bug. Το ουσιαστικό ερώτημα, και το μόνο που βλέπει ο χρήστης,
 * είναι αν ο renderer παραλείπει την οντότητα· κι αυτό το απαντά ο ΙΔΙΟΣ κώδικας που
 * τρέχει σε κάθε frame.
 */
function isHiddenByIsolate(layerId: string): boolean {
  return isEntityLayerSkipped({ id: 'ent_probe', type: 'line', layerId } as never);
}

beforeEach(() => {
  __resetLayerStoreForTesting();
  __resetIsolateEffectsForTesting();
});

afterEach(() => {
  teardownActiveDocument();
});

function isolateFreeze(targetId: string) {
  const A = createSceneLayer({ id: 'lyr_a', name: 'A' });
  const B = createSceneLayer({ id: 'lyr_b', name: 'B' });
  setupActiveDocument([A, B]);
  new LayerIsolateCommand({
    targetLayerIds: [targetId],
    settings: { mode: 'freeze', dimOpacityPercent: 30 },
  }).execute();
}

describe('LayerUnisolateCommand — execute', () => {
  it('restores frozen flag + clears effects + clears snapshot', () => {
    isolateFreeze('lyr_a');
    expect(isHiddenByIsolate('lyr_b')).toBe(true);

    const cmd = new LayerUnisolateCommand();
    cmd.execute();

    expect(isHiddenByIsolate('lyr_b')).toBe(false);
    expect(getIsolateEffectsSnapshot().active).toBe(false);
    expect(getUnisolateSnapshot()).toBeNull();
  });

  it('no-op when no active snapshot', () => {
    const cmd = new LayerUnisolateCommand();
    cmd.execute();
    expect(getIsolateEffectsSnapshot().active).toBe(false);
  });
});

describe('LayerUnisolateCommand — undo + redo', () => {
  it('undo re-isolates via conserved snapshot + re-activates effects', () => {
    isolateFreeze('lyr_a');
    const cmd = new LayerUnisolateCommand();
    cmd.execute();
    expect(isHiddenByIsolate('lyr_b')).toBe(false);

    cmd.undo();
    expect(isHiddenByIsolate('lyr_b')).toBe(true);
    expect(getIsolateEffectsSnapshot().active).toBe(true);
  });

  it('redo clears again (replay-safe)', () => {
    isolateFreeze('lyr_a');
    const cmd = new LayerUnisolateCommand();
    cmd.execute();
    cmd.undo();
    cmd.redo();
    expect(isHiddenByIsolate('lyr_b')).toBe(false);
    expect(getIsolateEffectsSnapshot().active).toBe(false);
  });
});
