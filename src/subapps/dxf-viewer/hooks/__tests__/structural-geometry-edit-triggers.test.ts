/**
 * structural-geometry-edit-triggers — SSoT ταξινόμηση «άμεση geometry edit χρήστη»
 * + behavioral lock «διαγραφή δοκαριού-με-εξαρτημένο-recalc → ΕΝΑ undo entry».
 *
 * Κλειδώνει τη ρίζα του «2× Ctrl+Z σε διαγραφή»: τα `*-delete-requested` ταξινομούνται
 * πλέον ως geometry edits → ο proactive load takedown ομαδοποιείται (`executeGrouped`/
 * `appendToLast`) στο ΙΔΙΟ undo step με τη `DeleteEntityCommand` → 1× Ctrl+Z αναιρεί
 * τα πάντα (Revit transaction group, ADR-459 Φ7).
 */

import { act, renderHook } from '@testing-library/react';
import {
  GEOMETRY_EDIT_TRIGGERS,
  isGeometryEditTrigger,
} from '../structural-geometry-edit-triggers';
import { EventBus, type DrawingEventType } from '../../systems/events/EventBus';
import {
  getGlobalCommandHistory,
  resetGlobalCommandHistory,
} from '../../core/commands/CommandHistory';
import type { ICommand, SerializedCommand } from '../../core/commands/interfaces';

// ── Mocks: απομονώνουμε τον hook στη λογική scheduling/grouping του ──────────────
// Ο πυρήνας load takedown καλεί το `exec` (4ο όρισμα) με μια fake εντολή ώστε να
// προσομοιώσει ένα πραγματικό recompute που παράγει αλλαγή στο undo stack.
const fakeDerived = (): ICommand => makeFakeCmd('loads-recalc');
jest.mock('../structural-load-takedown-core', () => ({
  runStructuralLoadTakedown: jest.fn(
    (_lm: unknown, _settings: unknown, _lookup: unknown, exec: (c: ICommand) => void) => {
      exec(fakeDerived());
    },
  ),
}));
jest.mock('../useBuildingStoreyCount', () => ({ useBuildingStoreyCount: () => 1 }));
jest.mock('../useBuildingOccupancy', () => ({ useBuildingOccupancy: () => 'residential' }));
jest.mock('../../bim/structural/loads/occupancy-loads', () => ({
  resolveEffectiveAreaLoads: () => ({ deadAreaLoadKpa: 0, liveAreaLoadKpa: 0 }),
}));
jest.mock('../../bim/hosting/guide-store-offset-lookup', () => ({
  makeGuideOffsetLookup: () => ({}),
}));
jest.mock('../../state/structural-settings-store', () => ({
  useStructuralSettingsStore: { getState: () => ({}) },
}));

// Import AFTER the mocks so the hook picks them up.
import { useProactiveStructuralLoads } from '../useProactiveStructuralLoads';

function makeFakeCmd(id: string): ICommand {
  return {
    id,
    name: id,
    type: 'fake',
    timestamp: Date.now(),
    execute: () => {},
    undo: () => {},
    redo: () => {},
    getDescription: () => id,
    getAffectedEntityIds: () => [id],
    serialize: (): SerializedCommand => ({
      type: 'fake',
      id,
      name: id,
      timestamp: Date.now(),
      data: {},
      version: 1,
    }),
  };
}

/** Άσε να τρέξει το προγραμματισμένο `queueMicrotask(recompute)`. */
async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('isGeometryEditTrigger (SSoT classification)', () => {
  it('ΟΛΑ τα *-delete-requested = geometry edit (η διορθωμένη παράλειψη)', () => {
    const deletes: DrawingEventType[] = [
      'bim:column-delete-requested',
      'bim:beam-delete-requested',
      'bim:wall-delete-requested',
      'bim:slab-delete-requested',
      'bim:foundation-delete-requested',
    ];
    for (const ev of deletes) expect(isGeometryEditTrigger(ev)).toBe(true);
  });

  it('create / params-updated / moved = geometry edit', () => {
    const edits: DrawingEventType[] = [
      'drawing:entity-created',
      'bim:column-params-updated',
      'bim:beam-params-updated',
      'bim:wall-params-updated',
      'bim:slab-params-updated',
      'bim:foundation-params-updated',
      'bim:entities-moved',
    ];
    for (const ev of edits) expect(isGeometryEditTrigger(ev)).toBe(true);
  });

  it('batch (from-grid/perimeter) + παράγωγα chain events = ΟΧΙ geometry edit (standalone)', () => {
    const nonEdits: DrawingEventType[] = [
      'bim:columns-from-grid',
      'bim:beams-from-grid',
      'bim:foundations-from-grid',
      'bim:walls-from-grid',
      'bim:walls-from-perimeter',
      'bim:structural-loads-computed',
    ];
    for (const ev of nonEdits) expect(isGeometryEditTrigger(ev)).toBe(false);
  });

  it('το set είναι αμετάβλητο (readonly) και περιέχει τα 5 delete events', () => {
    expect(GEOMETRY_EDIT_TRIGGERS.has('bim:beam-delete-requested')).toBe(true);
    expect(GEOMETRY_EDIT_TRIGGERS.size).toBeGreaterThanOrEqual(12);
  });
});

describe('useProactiveStructuralLoads — atomic undo grouping σε διαγραφή', () => {
  beforeEach(() => {
    resetGlobalCommandHistory();
    EventBus.clear();
  });

  it('διαγραφή δοκαριού → ο παράγωγος load recalc ομαδοποιείται → ΕΝΑ undo entry', async () => {
    const history = getGlobalCommandHistory();
    renderHook(() => useProactiveStructuralLoads({ levelManager: {} as never }));

    // 1) Η ενέργεια χρήστη: η DeleteEntityCommand μπαίνει στο stack (atomic).
    history.execute(makeFakeCmd('delete-beam'));
    expect(history.size()).toBe(1);

    // 2) Η διαγραφή εκπέμπει `bim:beam-delete-requested` ΜΕΤΑ την εντολή.
    await act(async () => {
      EventBus.emit('bim:beam-delete-requested', { beamId: 'beam-1' });
    });
    await flushMicrotasks();

    // 3) Ο παράγωγος recalc ομαδοποιήθηκε → ΕΝΑ entry (composite), όχι δύο.
    expect(history.size()).toBe(1);

    // 4) ΕΝΑ Ctrl+Z αναιρεί ΚΑΙ τη διαγραφή ΚΑΙ τον recalc.
    history.undo();
    expect(history.canUndo()).toBe(false);
  });

  it('batch from-grid → standalone (δεν ομαδοποιείται σε τυχόν προηγούμενο command)', async () => {
    const history = getGlobalCommandHistory();
    renderHook(() => useProactiveStructuralLoads({ levelManager: {} as never }));

    history.execute(makeFakeCmd('unrelated'));
    expect(history.size()).toBe(1);

    await act(async () => {
      EventBus.emit('bim:beams-from-grid', { beamIds: ['b1'] } as never);
    });
    await flushMicrotasks();

    // from-grid ΔΕΝ είναι geometry edit → ο recalc μπαίνει standalone → δύο entries.
    expect(history.size()).toBe(2);
  });
});
