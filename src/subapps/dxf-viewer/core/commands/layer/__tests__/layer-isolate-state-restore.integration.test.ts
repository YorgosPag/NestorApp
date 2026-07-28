/**
 * ADR-358 Phase 15 — Integration: isolate → state snapshot → unisolate → state restore.
 *
 * Full end-to-end flow using real stores (no mocks):
 *   LayerStore + IsolateEffectsStore + LayerStateStore + LayerStatePersistence
 *   + LayerIsolateCommand + LayerUnisolateCommand + RestoreLayerStateCommand
 *
 * Verifies:
 *   1. Isolate captures unisolate snapshot + activates IsolateEffectsStore.
 *   2. LayerState save captures correct live snapshot at that moment.
 *   3. Unisolate restores layer state exactly + clears effects.
 *   4. RestoreLayerStateCommand re-applies a saved state + undo reverts it.
 *   5. Undo of isolate re-freezes; redo of unisolate clears again.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { LayerIsolateCommand } from '../LayerIsolateCommand';
import { LayerUnisolateCommand } from '../LayerUnisolateCommand';
import { RestoreLayerStateCommand } from '../RestoreLayerStateCommand';
import {
  __resetLayerStoreForTesting,

  getLayer,
  getAllLayers,
  getUnisolateSnapshot,
} from '../../../../stores/LayerStore';
import {
  __resetIsolateEffectsForTesting,
  getIsolateEffectsSnapshot,
} from '../../../../systems/isolate/IsolateEffectsStore';
import {
  __resetLayerStateStoreForTesting,
  setProjectId,
  saveCurrentLayerState,
  markCurrentLayerState,
  getLayerStateStoreSnapshot,
} from '../../../../stores/LayerStateStore';
import { __resetLayerStatePersistenceForTesting } from '../../../../services/layer-state-persistence';
import { createSceneLayer } from '../../../../types/entities';
// ADR-719 §8 — ο render-side έλεγχος που ΑΝΤΙΚΑΤΕΣΤΗΣΕ το layer-flag μόλυσμα της απομόνωσης.
import { isEntityLayerSkipped } from '../../../../canvas-v2/dxf-canvas/dxf-entity-layer-skip';
// ADR-719 §9 — οι μόνιμες αλλαγές flag γράφουν πλέον στο ΕΓΓΡΑΦΟ (fail-closed χωρίς αυτό),
// οπότε το setup στήνει έγγραφο + runtime προβολή αντί για μόνο τη δεύτερη. Το `setLayers`
// μόνο του έστηνε ακριβώς τη μισή αρχιτεκτονική που παρήγαγε το bug.
import {
  setupActiveDocument,
  teardownActiveDocument,
} from '../../../../systems/levels/__tests__/active-document-test-harness';

function reset() {
  __resetLayerStoreForTesting();
  __resetIsolateEffectsForTesting();
  __resetLayerStateStoreForTesting();
  __resetLayerStatePersistenceForTesting();
  try { window.localStorage.clear(); } catch { /* SSR */ }
}

beforeEach(reset);

afterEach(() => {
  teardownActiveDocument();
});

function seedLayers() {
  const A = createSceneLayer({ id: 'lyr_a', name: 'A', visible: true });
  const B = createSceneLayer({ id: 'lyr_b', name: 'B', visible: true });
  const C = createSceneLayer({ id: 'lyr_c', name: 'C', visible: true });
  setupActiveDocument([A, B, C]);
  return { A, B, C };
}

/**
 * ADR-719 §8 — «κρύβεται από την απομόνωση;» ρωτημένο εκεί που ΕΚΤΕΛΕΙΤΑΙ η χειρονομία.
 *
 * Η απομόνωση δεν γράφει πλέον `frozen: true` στα μη-απομονωμένα layers (ήταν κατάσταση
 * συνεδρίας σε μόνιμο πεδίο εγγράφου). Άρα ένα `expect(getLayer('lyr_b')?.frozen)` πλέον
 * ελέγχει **νεκρό** σημείο: θα ήταν πράσινο μόνο αν επαναφέραμε το bug. Το ουσιαστικό
 * ερώτημα — και το μόνο που νοιάζει τον χρήστη — είναι αν ο renderer παραλείπει την
 * οντότητα, κι αυτό το απαντά ο ΙΔΙΟΣ κώδικας που τρέχει σε κάθε frame.
 */
function isHiddenByIsolate(layerId: string): boolean {
  return isEntityLayerSkipped({ id: 'ent_probe', type: 'line', layerId } as never);
}

// ─── Part 1: Isolate → unisolate full flow ───────────────────────────────────

describe('Integration: LayerIsolateCommand → LayerUnisolateCommand full flow', () => {
  it('isolate (freeze mode) → unisolate restores all layers exactly', () => {
    seedLayers();

    // 1. Isolate layer A (freeze mode) — B and C get frozen
    const isolate = new LayerIsolateCommand({
      targetLayerIds: ['lyr_a'],
      settings: { mode: 'freeze', dimOpacityPercent: 30 },
    });
    isolate.execute();

    // Η απομόνωση κρύβει μέσω του IsolateEffectsStore, ΧΩΡΙΣ να αγγίζει το έγγραφο (§8).
    expect(isHiddenByIsolate('lyr_b')).toBe(true);
    expect(isHiddenByIsolate('lyr_c')).toBe(true);
    expect(isHiddenByIsolate('lyr_a')).toBe(false);
    // …και το μόνιμο flag μένει ΚΑΘΑΡΟ — αυτό είναι το κέρδος: τίποτα δεν περνά στο αρχείο.
    expect(getLayer('lyr_b')?.frozen ?? false).toBe(false);
    expect(getLayer('lyr_c')?.frozen ?? false).toBe(false);
    expect(getIsolateEffectsSnapshot().active).toBe(true);
    expect(getUnisolateSnapshot()).not.toBeNull();
    expect(getUnisolateSnapshot()!.length).toBe(3);

    // 2. Unisolate — restores B + C to unfrozen
    const unisolate = new LayerUnisolateCommand();
    unisolate.execute();

    expect(isHiddenByIsolate('lyr_b')).toBe(false);
    expect(isHiddenByIsolate('lyr_c')).toBe(false);
    expect(getIsolateEffectsSnapshot().active).toBe(false);
    expect(getUnisolateSnapshot()).toBeNull();
  });

  it('isolate → unisolate → undo unisolate → re-isolates (undo chain)', () => {
    seedLayers();
    const isolate = new LayerIsolateCommand({
      targetLayerIds: ['lyr_a'],
      settings: { mode: 'freeze', dimOpacityPercent: 30 },
    });
    isolate.execute();

    const unisolate = new LayerUnisolateCommand();
    unisolate.execute();
    expect(isHiddenByIsolate('lyr_b')).toBe(false);

    // Undo unisolate → B/C κρύβονται ξανά (μέσω effects, όχι flags)
    unisolate.undo();
    expect(isHiddenByIsolate('lyr_b')).toBe(true);
    expect(getIsolateEffectsSnapshot().active).toBe(true);

    // Redo unisolate → clears again
    unisolate.redo();
    expect(isHiddenByIsolate('lyr_b')).toBe(false);
    expect(getIsolateEffectsSnapshot().active).toBe(false);
  });

  it('dim mode: isolate does NOT mutate frozen; unisolate still clears effects', () => {
    seedLayers();
    const isolate = new LayerIsolateCommand({
      targetLayerIds: ['lyr_a'],
      settings: { mode: 'dim', dimOpacityPercent: 40 },
    });
    isolate.execute();

    expect(getLayer('lyr_b')?.frozen).toBeFalsy();
    expect(getIsolateEffectsSnapshot().mode).toBe('dim');

    new LayerUnisolateCommand().execute();
    expect(getIsolateEffectsSnapshot().active).toBe(false);
  });
});

// ─── Part 2: Save state → mutate → restore ──────────────────────────────────

describe('Integration: saveCurrentLayerState → mutate → RestoreLayerStateCommand', () => {
  it('saved layer state restores exact visible/frozen flags on execute', () => {
    setProjectId('proj_test_1');
    seedLayers();

    // Save baseline (all visible, all unfrozen)
    const baseline = saveCurrentLayerState({ name: 'Baseline' })!;
    expect(baseline).not.toBeNull();

    // Mutate: hide B, freeze C
    setupActiveDocument([
      createSceneLayer({ id: 'lyr_a', name: 'A', visible: true }),
      createSceneLayer({ id: 'lyr_b', name: 'B', visible: false }),
      createSceneLayer({ id: 'lyr_c', name: 'C', visible: true, frozen: true }),
    ]);
    expect(getLayer('lyr_b')?.visible).toBe(false);
    expect(getLayer('lyr_c')?.frozen).toBe(true);

    // Restore baseline
    const cmd = new RestoreLayerStateCommand({ stateId: baseline.id });
    cmd.execute();

    expect(getLayer('lyr_b')?.visible).toBe(true);
    expect(getLayer('lyr_c')?.frozen).toBe(false);
    expect(getLayerStateStoreSnapshot().currentStateId).toBe(baseline.id);
  });

  it('RestoreLayerStateCommand undo reverts to pre-restore state', () => {
    setProjectId('proj_test_2');
    const A = createSceneLayer({ id: 'lyr_a', name: 'A', visible: true });
    const B = createSceneLayer({ id: 'lyr_b', name: 'B', visible: true });
    setupActiveDocument([A, B]);

    const stateOn = saveCurrentLayerState({ name: 'All On' })!;
    markCurrentLayerState(stateOn.id);

    // Hide B, save as stateOff
    setupActiveDocument([
      { ...A, visible: true },
      { ...B, visible: false },
    ]);
    const stateOff = saveCurrentLayerState({ name: 'B Off' })!;

    // Current is still stateOn — now restore stateOff via command
    const cmd = new RestoreLayerStateCommand({ stateId: stateOff.id });
    cmd.execute();
    expect(getLayer('lyr_b')?.visible).toBe(false);
    expect(getLayerStateStoreSnapshot().currentStateId).toBe(stateOff.id);

    // Undo → currentStateId reverts to stateOn (was current at execute time)
    cmd.undo();
    expect(getLayerStateStoreSnapshot().currentStateId).toBe(stateOn.id);
  });
});

// ─── Part 3: Isolate + save state + unisolate + restore state ───────────────

describe('Integration: full isolate → save state → unisolate → restore state', () => {
  /**
   * ADR-719 §8 — **ΑΛΛΑΓΗ ΣΥΜΠΕΡΙΦΟΡΑΣ, σκόπιμη.**
   *
   * Παλιά: η απομόνωση έγραφε `frozen: true` στα μη-απομονωμένα layers, άρα μια
   * «Κατάσταση Επιπέδων» που αποθηκευόταν ΚΑΤΑ ΤΗ ΔΙΑΡΚΕΙΑ απομόνωσης απαθανάτιζε το
   * πάγωμα — και η επαναφορά της το ξανάφερνε. Αυτό είναι η σημασιολογία του AutoCAD
   * `LAYISO` (μεταλλάσσει τα πραγματικά layer states· γι' αυτό υπάρχει το `LAYUNISO`).
   *
   * Τώρα ακολουθούμε το μοντέλο **Revit / Cinema 4D**: η απομόνωση είναι *προσωρινή* και
   * δεν αφήνει αποτύπωμα. Συνέπεια: μια αποθηκευμένη Κατάσταση Επιπέδων καταγράφει τα
   * **μόνιμα** flags — καθαρά — άρα η επαναφορά της ΔΕΝ ξαναπαγώνει τα B/C.
   *
   * Αυτό είναι το σωστό: μια αποθηκευμένη κατάσταση πρέπει να περιγράφει πώς είναι
   * στημένο το σχέδιο, όχι τι κοίταζε στιγμιαία ο χρήστης. Η προηγούμενη συμπεριφορά
   * σήμαινε ότι κάθε αποθηκευμένη κατάσταση μπορούσε σιωπηλά να «ψήσει» μια στιγμιαία
   * απομόνωση και να την επαναφέρει μέρες αργότερα.
   */
  it('κατάσταση αποθηκευμένη ΚΑΤΑ την απομόνωση δεν απαθανατίζει το προσωρινό πάγωμα', () => {
    setProjectId('proj_test_3');
    seedLayers();

    // Step 1: Isolate — τα B + C κρύβονται, ΧΩΡΙΣ να αλλάξει το έγγραφο
    new LayerIsolateCommand({
      targetLayerIds: ['lyr_a'],
      settings: { mode: 'freeze', dimOpacityPercent: 30 },
    }).execute();
    expect(isHiddenByIsolate('lyr_b')).toBe(true);
    expect(getLayer('lyr_b')?.frozen ?? false).toBe(false);

    // Step 2: Save this "mid-isolate" state — καταγράφει τα ΜΟΝΙΜΑ flags (καθαρά)
    const midIsolateState = saveCurrentLayerState({ name: 'Mid-Isolate' })!;

    // Step 3: Unisolate → τίποτα δεν κρύβεται πια
    new LayerUnisolateCommand().execute();
    expect(isHiddenByIsolate('lyr_b')).toBe(false);

    // Step 4: Restore → επαναφέρει την ΚΑΘΑΡΗ κατάσταση, δεν ανασταίνει την απομόνωση
    new RestoreLayerStateCommand({ stateId: midIsolateState.id }).execute();
    expect(getLayer('lyr_b')?.frozen ?? false).toBe(false);
    expect(getLayer('lyr_c')?.frozen ?? false).toBe(false);
    expect(getLayer('lyr_a')?.frozen).toBeFalsy();
    expect(isHiddenByIsolate('lyr_b')).toBe(false);
  });

  it('undo of isolate after unisolate is a no-op (snapshot already consumed)', () => {
    seedLayers();
    const isolate = new LayerIsolateCommand({
      targetLayerIds: ['lyr_a'],
      settings: { mode: 'freeze', dimOpacityPercent: 30 },
    });
    isolate.execute();

    new LayerUnisolateCommand().execute();
    // At this point snapshot is consumed (null)
    expect(getUnisolateSnapshot()).toBeNull();

    // Undo isolate resets layers to pre-isolate state (uses the command's internal snapshot)
    isolate.undo();
    expect(getLayer('lyr_b')?.frozen).toBe(false);
    expect(getIsolateEffectsSnapshot().active).toBe(false);
  });
});

// ─── Part 4: Snapshot count + exact entry verification ──────────────────────

describe('Integration: unisolate snapshot exact content', () => {
  it('unisolate snapshot contains exact layer states before isolate', () => {
    const A = createSceneLayer({ id: 'lyr_a', name: 'A', visible: true,  frozen: false });
    const B = createSceneLayer({ id: 'lyr_b', name: 'B', visible: false, frozen: false });
    const C = createSceneLayer({ id: 'lyr_c', name: 'C', visible: true,  frozen: true  });
    setupActiveDocument([A, B, C]);

    new LayerIsolateCommand({
      targetLayerIds: ['lyr_a'],
      settings: { mode: 'freeze', dimOpacityPercent: 30 },
    }).execute();

    const snap = getUnisolateSnapshot()!;
    expect(snap).toHaveLength(3);

    const snapA = snap.find((e) => e.layerId === 'lyr_a')!;
    const snapB = snap.find((e) => e.layerId === 'lyr_b')!;
    const snapC = snap.find((e) => e.layerId === 'lyr_c')!;

    // Snapshot captures PRE-isolate state
    expect(snapA.visible).toBe(true);
    expect(snapA.frozen).toBe(false);
    expect(snapB.visible).toBe(false);
    expect(snapB.frozen).toBe(false);
    expect(snapC.visible).toBe(true);
    expect(snapC.frozen).toBe(true); // was already frozen pre-isolate

    // After unisolate, layer C should still be frozen (snapshot-exact restore)
    new LayerUnisolateCommand().execute();
    expect(getAllLayers().find((l) => l.id === 'lyr_c')?.frozen).toBe(true);
    expect(getAllLayers().find((l) => l.id === 'lyr_b')?.visible).toBe(false);
  });
});
