/**
 * ADR-911 — ο βοηθός ακολουθεί τη ζωντανή σκηνή (ζωντανή επαλήθευση ADR-929 Φ5.2ε: μετά το Ctrl+Z το πάνελ
 * έδειχνε ακόμα «Υπάρχουν ήδη 47» και «Δημιουργήθηκαν 44 τοίχοι», ενώ οι τοίχοι είχαν φύγει).
 *
 * Πάνω στο ΠΡΑΓΜΑΤΙΚΟ σχέδιο δοκιμής, με την ΠΡΑΓΜΑΤΙΚΗ εγγραφή και το ΠΡΑΓΜΑΤΙΚΟ ιστορικό αναίρεσης:
 *   - αναίρεση / επανάληψη ⇒ η πρόταση ξαναϋπολογίζεται, οι αποφάσεις μένουν, η ειδοποίηση αποσύρεται·
 *   - ίδια σκηνή ⇒ καμία δουλειά (early cutoff), η ειδοποίηση της δικής μας έγκρισης επιζεί·
 *   - αλλαγή χωρίς ιστορικό κρατά την ειδοποίηση· αλλαγή ορόφου την αποσύρει·
 *   - πολλά σήματα στο ίδιο tick ⇒ ΕΝΑΣ επανυπολογισμός.
 */

import { getGlobalCommandHistory } from '../../../core/commands/CommandHistory';
import { countProposalByStatus } from '../../../bim/model-from-drawing/assistant-preview';
import { modelFromDrawingSession } from '../model-from-drawing-session';
import { modelFromDrawingStore } from '../model-from-drawing-store';
import {
  createAssistantSceneSync,
  syncAssistantToScene,
  type AssistantSceneDeps,
} from '../model-from-drawing-scene-sync';
import { confirmAllGroups, harness, sample, type Harness } from './model-from-drawing-harness';

const history = getGlobalCommandHistory();
const state = () => modelFromDrawingStore.get();
const counts = () => countProposalByStatus(state().proposal!);
const sceneDeps = (h: Harness): AssistantSceneDeps => ({ walls: h.deps, openings: h.deps });

/** Δείγμα → όλες οι ομάδες επιβεβαιωμένες → έγκριση: 38 τοίχοι γραμμένοι, σε ΕΝΑ βήμα αναίρεσης. */
function approvedHarness(): Harness {
  const h = harness();
  sample(h);
  confirmAllGroups(h);
  expect(modelFromDrawingSession.approve(h.deps)).toBe(true);
  expect(h.walls()).toHaveLength(38);
  return h;
}

beforeEach(() => {
  history.clear();
  modelFromDrawingStore.reset();
  jest.restoreAllMocks();
});

describe('ADR-911 — ο βοηθός ακολουθεί τη σκηνή', () => {
  it('αναίρεση της έγκρισης ⇒ ξαναϋπολογίζεται, οι αποφάσεις ΜΕΝΟΥΝ, το «γράφτηκαν» αποσύρεται', () => {
    const h = approvedHarness();
    history.undo();
    expect(h.walls()).toHaveLength(0);

    expect(syncAssistantToScene(sceneDeps(h), true)).toBe(true);

    expect(counts()).toEqual({ ready: 38, unconfirmed: 0, 'needs-decision': 2, existing: 0, rejected: 0 });
    expect(state().proposal!.groups.every((g) => g.confirmed)).toBe(true);
    expect(state().notice).toBeNull();
  });

  it('επανάληψη ⇒ οι τοίχοι ξαναγίνονται «υπάρχουν ήδη»', () => {
    const h = approvedHarness();
    history.undo();
    syncAssistantToScene(sceneDeps(h), true);
    history.redo();

    expect(syncAssistantToScene(sceneDeps(h), true)).toBe(true);

    expect(counts()).toEqual({ ready: 0, unconfirmed: 0, 'needs-decision': 2, existing: 38, rejected: 0 });
  });

  it('ίδια σκηνή ⇒ καμία δουλειά: η δική μας έγκριση δεν πληρώνει δεύτερο υπολογισμό, και η ειδοποίησή της επιζεί', () => {
    const h = approvedHarness();
    const before = state();

    // Το ιστορικό κινήθηκε (η έγκριση ΕΙΝΑΙ εντολή) — αλλά η πρόταση υπολογίστηκε ήδη από αυτή τη σκηνή.
    expect(syncAssistantToScene(sceneDeps(h), true)).toBe(false);

    expect(state()).toBe(before);
    expect(state().notice).toMatchObject({ kind: 'written', count: 38 });
  });

  it('αλλαγή σκηνής ΧΩΡΙΣ ιστορικό ξαναϋπολογίζει αλλά κρατά την ειδοποίηση', () => {
    const h = approvedHarness();
    h.setEntities([...h.entities()]);

    expect(syncAssistantToScene(sceneDeps(h), false)).toBe(true);

    expect(state().notice).toMatchObject({ kind: 'written', count: 38 });
  });

  it('αλλαγή ορόφου αποσύρει την ειδοποίηση, και χωρίς ιστορικό', () => {
    const h = approvedHarness();
    const otherFloor: Harness['deps'] = { ...h.deps, accessor: { ...h.deps.accessor, currentLevelId: 'lvl_other' } };

    expect(syncAssistantToScene({ walls: otherFloor, openings: otherFloor }, false)).toBe(true);

    expect(state().notice).toBeNull();
  });

  it('κλειστός βοηθός: τίποτα να ακολουθήσει', () => {
    const h = approvedHarness();
    modelFromDrawingSession.close();
    history.undo();

    expect(syncAssistantToScene(sceneDeps(h), true)).toBe(false);
    expect(state().phase).toBe('closed');
  });

  it('πολλά σήματα στο ίδιο tick ⇒ ΕΝΑΣ επανυπολογισμός, που θυμάται ότι κινήθηκε το ιστορικό', async () => {
    const h = approvedHarness();
    const refresh = jest.spyOn(modelFromDrawingSession, 'refresh');
    const sync = createAssistantSceneSync(() => sceneDeps(h));
    history.undo();

    sync.sceneChanged();
    sync.historyMoved();
    sync.sceneChanged();
    expect(refresh).not.toHaveBeenCalled();
    await Promise.resolve();

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith(h.deps, false);
    expect(state().notice).toBeNull();
  });
});
