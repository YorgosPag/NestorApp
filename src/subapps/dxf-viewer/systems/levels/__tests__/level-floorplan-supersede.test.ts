/**
 * ⚓ ADR-845 Ο-16 — «η κάτοψη ανεβαίνει με μήνυμα επιτυχίας και ο καμβάς μένει κενός».
 *
 * ## Τι κλειδώνει
 *
 * Η **αντικατάσταση** κάτοψης τραβάει το προηγούμενο αρχείο στον κάδο ΜΕΣΑ στην ίδια
 * εισαγωγή — και το κάνει **αφού** το `commitImportedScene` έχει ήδη γράψει τη νέα σκηνή
 * (βήμα 2 `setLevelScene` → βήμα 5 `linkSceneFileToLevel`). Ο συνδρομητής του
 * `FILE_TRASHED` διαβάζει ένα **δομικά μπαγιάτικο** αντίγραφο των επιπέδων: το νέο
 * `sceneFileId` ταξιδεύει μέσω server PATCH + `onSnapshot`, ενώ ο κάδος είναι τοπική
 * εγγραφή που εκπέμπει αμέσως. Άρα τη στιγμή του γεγονότος το επίπεδο δείχνει **ακόμα**
 * στο παλιό αρχείο, ταιριάζει, και ο καμβάς που μόλις γέμισε **σβήνεται**.
 *
 * ## Γιατί αυτή η άγκυρα δεν είναι χειρόγραφο δείγμα
 *
 * Εκτελεί τους **ΠΡΑΓΜΑΤΙΚΟΥΣ** παραγωγούς και τον **ΠΡΑΓΜΑΤΙΚΟ** κριτή:
 *   • `commitImportedScene`  — η αληθινή σειρά των βημάτων (ΟΧΙ προσομοίωση)
 *   • `SceneStore`           — ο αληθινός καμβάς
 *   • `supersedeFileRecord` / `moveToTrash` — οι αληθινοί παραγωγοί του `FILE_TRASHED`,
 *                              που φτιάχνουν **οι ίδιοι** το ωφέλιμο φορτίο
 *   • `RealtimeService`      — ο αληθινός δίαυλος (singleton, όχι mock)
 *   • `levelsThatLostTheirFloorplan` — το **ΙΔΙΟ σώμα** που τρέχει ο
 *                              `useLevelFloorplanSync`, όχι αντίγραφό του
 *
 * Το μόνο mock είναι το σύνορο Firestore/Storage. Αν κάποιος ξαναγράψει τον παραγωγό ως
 * σκέτο `moveToTrash`, το Κ1 κοκκινίζει — και το Κ2 **εκτελεί** ακριβώς αυτή τη
 * μετάλλαξη για να αποδείξει ότι η άγκυρα ξεχωρίζει τις δύο περιπτώσεις.
 *
 * @see ../level-floorplan-loss.ts
 * @see docs/centralized-systems/reference/adrs/ADR-845-public-3d-execution.md §7.9
 */

// ── Σύνορο Firestore/Storage: το ΜΟΝΟ mock ────────────────────────────────────
const updateDocMock = jest.fn(async () => undefined);
const docData: Record<string, unknown> = {
  category: 'floorplans',
  displayName: 'Κατόψεις property-floorplan - Διαμέρισμα 80 τ.μ.',
  entityId: 'prop_80',
  entityType: 'property',
};

jest.mock('@/lib/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => ({ id: 'ref' })),
  getDoc: jest.fn(async () => ({ exists: () => true, data: () => docData })),
  updateDoc: (...args: unknown[]) => updateDocMock(...(args as [])),
  serverTimestamp: jest.fn(() => '__serverTimestamp__'),
  where: jest.fn(),
}));
jest.mock('@/services/firestore/firestore-query.service', () => ({
  firestoreQueryService: { getAll: jest.fn(async () => ({ documents: [] })) },
}));
jest.mock('@/services/file-audit.service', () => ({
  FileAuditService: { log: jest.fn(async () => undefined) },
}));

// ── Παρενέργειες του `commitImportedScene` που δεν αφορούν αυτή την ερώτηση ────
jest.mock('../emit-imported-entity-create-events', () => ({
  emitImportedEntityCreateEvents: jest.fn(),
}));
jest.mock('../../../bim/block-library/capture-session-blocks', () => ({
  captureSessionBlocksFromScene: jest.fn(),
}));
jest.mock('../../zoom/viewport-fit-intent', () => ({
  markFreshImportFit: jest.fn(),
}));

import { commitImportedScene } from '../commit-imported-scene';
import { levelsThatLostTheirFloorplan, type FloorplanBearingLevel } from '../level-floorplan-loss';
import { SceneStore } from '../../scene/SceneStore';
import { RealtimeService } from '@/services/realtime';
import type { FileTrashedPayload } from '@/services/realtime';
import { moveToTrash, supersedeFileRecord } from '@/services/file-record-lifecycle';
import { createSceneLayer } from '../../../types/scene-types';
import { EMPTY_BOUNDS } from '../../../config/geometry-constants';
import type { Entity, SceneLayer, SceneModel } from '../../../types/entities';

const LEVEL = 'lvl_9f2c7d41';
const FLOOR = 'flr_f29529ba';
const PREV_FILE = 'file_d4520d2e';
const NEXT_FILE = 'file_f879a2a7';
const UID = 'WKBWEg3DSfcdSbLNJfzGEW3vkct1';

/** Το επίπεδο ΟΠΩΣ ΤΟ ΒΛΕΠΕΙ Ο ΣΥΝΔΡΟΜΗΤΗΣ τη στιγμή του γεγονότος: δείχνει ΑΚΟΜΑ στο
 *  παλιό αρχείο, γιατί το PATCH του νέου δεν έχει γυρίσει από τον server. Αυτή η
 *  «μπαγιατοσύνη» ΔΕΝ είναι σκηνοθεσία — είναι το μόνο δυνατό στιγμιότυπο. */
function staleLevels(): FloorplanBearingLevel[] {
  return [{ id: LEVEL, sceneFileId: PREV_FILE, floorId: FLOOR }];
}

function line(id: string, layerId: string): Entity {
  return {
    id, type: 'line', layerId, visible: true,
    start: { x: 0, y: 0 }, end: { x: 1000, y: 0 },
  } as unknown as Entity;
}

function scene(layers: SceneLayer[], entities: Entity[]): SceneModel {
  const layersById: Record<string, SceneLayer> = {};
  for (const l of layers) layersById[l.id] = l;
  return { entities, layersById, bounds: { ...EMPTY_BOUNDS }, units: 'mm' };
}

/** Η εισαγόμενη κάτοψη — τρεις γραμμές σε ένα layer (η μορφή του πραγματικού blob). */
function importedFloorplan(): SceneModel {
  const layer = createSceneLayer({ id: 'lyr_import', name: 'COLOR_52' });
  return scene([layer], [line('line_0', layer.id), line('line_1', layer.id), line('line_2', layer.id)]);
}

/**
 * Τρέχει ΜΙΑ ολόκληρη εισαγωγή μέσα από την πραγματική πόρτα, με τον συνδρομητή ζωντανό.
 *
 * @param declareSuccessor `true` → ο παραγωγός δηλώνει τον διάδοχο (ISO 19650 supersede).
 *                         `false` → **η μετάλλαξη**: σκέτος κάδος, όπως πριν το Ο-16.
 */
async function runImport(declareSuccessor: boolean): Promise<{
  sceneAfter: SceneModel | null;
  entitiesWhenTrashFired: number | null;
  payloads: FileTrashedPayload[];
}> {
  SceneStore._resetForTests();
  const levels = staleLevels();
  const payloads: FileTrashedPayload[] = [];
  let entitiesWhenTrashFired: number | null = null;

  const unsub = RealtimeService.subscribe('FILE_TRASHED', (payload: FileTrashedPayload) => {
    payloads.push(payload);
    // Καταγράφουμε ΤΙ ΥΠΑΡΧΕΙ στον καμβά τη στιγμή που φτάνει το γεγονός — έτσι το test
    // αποδεικνύει ότι η σκηνή είχε ΗΔΗ γραφτεί, δηλαδή ότι η κούρσα είναι πραγματική.
    entitiesWhenTrashFired = SceneStore.getLevelScene(LEVEL)?.entities.length ?? 0;
    for (const lvl of levelsThatLostTheirFloorplan(levels, payload)) {
      SceneStore.clearLevelScene(lvl.id);
    }
  });

  const pending: Promise<unknown>[] = [];
  commitImportedScene(importedFloorplan(), {
    targetLevelId: LEVEL,
    scope: { levelId: LEVEL, floorId: FLOOR, floorplanId: NEXT_FILE },
    getLevelScene: (id) => SceneStore.getLevelScene(id),
    setLevelScene: (id, s) => SceneStore.setLevelScene(id, s),
    // Ακριβώς ό,τι κάνει το `useSceneState.linkSceneFileToLevel`: αποσύρει το προηγούμενο
    // αρχείο. Η ΜΟΝΗ διαφορά ανάμεσα στα δύο σενάρια είναι αν δηλώνεται ο διάδοχος.
    linkSceneFileToLevel: () => {
      pending.push(
        declareSuccessor
          ? supersedeFileRecord(PREV_FILE, NEXT_FILE, UID)
          : moveToTrash(PREV_FILE, UID),
      );
    },
  });

  await Promise.all(pending);
  unsub();
  return { sceneAfter: SceneStore.getLevelScene(LEVEL), entitiesWhenTrashFired, payloads };
}

describe('ADR-845 Ο-16 — αντικατάσταση κάτοψης δεν είναι απώλεια κάτοψης', () => {
  beforeEach(() => {
    updateDocMock.mockClear();
    SceneStore._resetForTests();
  });

  // ⭐ Κ1 — ΤΟ ΔΙΑΚΡΙΝΟΝ: η σκηνή ΕΠΙΒΙΩΝΕΙ της ίδιας της εισαγωγής που τη γέννησε.
  it('Κ1 — με δηλωμένο διάδοχο, η νεοεισαχθείσα σκηνή ΕΠΙΒΙΩΝΕΙ του κάδου', async () => {
    const { sceneAfter, entitiesWhenTrashFired } = await runImport(true);

    // Η κούρσα είναι πραγματική: το γεγονός έφτασε ΜΕ τη σκηνή ήδη γραμμένη.
    expect(entitiesWhenTrashFired).toBe(3);
    expect(sceneAfter).not.toBeNull();
    expect(sceneAfter?.entities).toHaveLength(3);
  });

  // ⭐ Κ2 — Η ΜΕΤΑΛΛΑΞΗ, ΕΚΤΕΛΕΣΜΕΝΗ: χωρίς δηλωμένο διάδοχο το ελάττωμα επανεμφανίζεται.
  //         Αν αυτό ΔΕΝ σβήσει, η άγκυρα δεν ξεχωρίζει τίποτα και το Κ1 είναι κενό.
  it('Κ2 — χωρίς δηλωμένο διάδοχο (η παλιά συμπεριφορά) ο καμβάς ΑΔΕΙΑΖΕΙ', async () => {
    const { sceneAfter, entitiesWhenTrashFired } = await runImport(false);

    expect(entitiesWhenTrashFired).toBe(3);
    expect(sceneAfter).toBeNull();
  });

  // Το γεγονός πρέπει να ΚΟΥΒΑΛΑ τον διάδοχο — όχι να τον αφήνει στο έγγραφο μόνο.
  it('Κ3 — ο παραγωγός βάζει τον διάδοχο ΜΕΣΑ στο FILE_TRASHED', async () => {
    const { payloads } = await runImport(true);

    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toMatchObject({ fileId: PREV_FILE, supersededByFileId: NEXT_FILE });
  });

  // …και ΤΑΥΤΟΧΡΟΝΑ στο έγγραφο (ISO 19650: το superseded έγγραφο δείχνει στον διάδοχο).
  it('Κ4 — ο παραγωγός γράφει καταγωγή + cdeState SUPERSEDED στο έγγραφο', async () => {
    await runImport(true);

    expect(updateDocMock).toHaveBeenCalledTimes(1);
    const written = updateDocMock.mock.calls[0][1] as Record<string, unknown>;
    expect(written.supersededByFileId).toBe(NEXT_FILE);
    expect(written.cdeState).toBe('SUPERSEDED');
    expect(written.lifecycleState).toBe('trashed');
  });

  // Η ΠΡΑΓΜΑΤΙΚΗ δουλειά του συνδρομητή δεν χάνεται: εξωτερική διαγραφή ΚΑΘΑΡΙΖΕΙ.
  it('Κ5 — σκέτη διαγραφή (χωρίς διάδοχο) εξακολουθεί να καθαρίζει τον καμβά', async () => {
    SceneStore.setLevelScene(LEVEL, importedFloorplan());
    const levels = staleLevels();

    const unsub = RealtimeService.subscribe('FILE_TRASHED', (payload: FileTrashedPayload) => {
      for (const lvl of levelsThatLostTheirFloorplan(levels, payload)) {
        SceneStore.clearLevelScene(lvl.id);
      }
    });
    await moveToTrash(PREV_FILE, UID);
    unsub();

    expect(SceneStore.getLevelScene(LEVEL)).toBeNull();
  });

  // Το σκέλος «όροφος» (ADR-237) μένει άθικτο: κάτοψη ΟΡΟΦΟΥ που σβήνεται εξωτερικά
  // αδειάζει τον όροφο ακόμη κι όταν το επίπεδο δεν είχε προλάβει να τη δέσει.
  it('Κ6 — εξωτερική διαγραφή κάτοψης ΟΡΟΦΟΥ καθαρίζει και αδεμένο επίπεδο', () => {
    const unlinked: FloorplanBearingLevel = { id: LEVEL, sceneFileId: null, floorId: FLOOR };
    const lost = levelsThatLostTheirFloorplan([unlinked], {
      fileId: 'file_other', entityType: 'floor', entityId: FLOOR,
    });
    expect(lost.map((l) => l.id)).toEqual([LEVEL]);
  });

  // Ίδιο σκέλος, με δηλωμένο διάδοχο: αντικατάσταση κάτοψης ΟΡΟΦΟΥ δεν αδειάζει τίποτα.
  it('Κ7 — αντικατάσταση κάτοψης ΟΡΟΦΟΥ δεν μετράει ως απώλεια', () => {
    const linked: FloorplanBearingLevel = { id: LEVEL, sceneFileId: null, floorId: FLOOR };
    const lost = levelsThatLostTheirFloorplan([linked], {
      fileId: 'file_other', entityType: 'floor', entityId: FLOOR, supersededByFileId: 'file_new',
    });
    expect(lost).toEqual([]);
  });

  // Ταυτότητα: ένα αρχείο δεν διαδέχεται τον εαυτό του — καμία εγγραφή, κανένα γεγονός.
  it('Κ8 — supersede με τον ίδιο id είναι no-op', async () => {
    const seen: FileTrashedPayload[] = [];
    const unsub = RealtimeService.subscribe('FILE_TRASHED', (p: FileTrashedPayload) => { seen.push(p); });
    await supersedeFileRecord(PREV_FILE, PREV_FILE, UID);
    unsub();

    expect(updateDocMock).not.toHaveBeenCalled();
    expect(seen).toHaveLength(0);
  });
});
