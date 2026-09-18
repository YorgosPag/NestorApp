/**
 * ⚓ ADR-845 Ο-16 · ADR-862 Φ0 Β10 — «η κάτοψη ανεβαίνει με μήνυμα επιτυχίας και ο καμβάς μένει κενός».
 *
 * ## Τι κλειδώνει
 *
 * Η **αντικατάσταση** κάτοψης αποσύρει το προηγούμενο αρχείο ΜΕΣΑ στην ίδια εισαγωγή — **αφού**
 * το `commitImportedScene` έχει ήδη γράψει τη νέα σκηνή (βήμα 2 `setLevelScene` → βήμα 5
 * `linkSceneFileToLevel`). Ο συνδρομητής της απώλειας διαβάζει **δομικά μπαγιάτικο** αντίγραφο
 * των επιπέδων: τη στιγμή του γεγονότος το επίπεδο δείχνει **ακόμα** στο παλιό αρχείο.
 *
 * ## Το συμβόλαιο ΑΛΛΑΞΕ στο Β10 — και η άγκυρα μαζί του
 *
 * **Πριν**: `FILE_TRASHED` + σημαία `supersededByFileId`, γραμμένα από τον **browser** (`cdeState`).
 * Ο κανόνας Β4 άρχισε σωστά να απορρίπτει την εγγραφή — **ολόκληρη, σιωπηλά**.
 * **Τώρα**: ο πελάτης **ζητά** από τον ΕΝΑ γραφέα (`POST /cde { act: 'supersede' }`), και **μόνο
 * αφού επιβεβαιώσει** εκπέμπει `FILE_SUPERSEDED` — γεγονός που ο συνδρομητής της απώλειας **δεν
 * ακούει**. Η προστασία είναι **δομική** (δεν υπάρχει δρόμος), όχι σημαία που κάποιος θυμάται.
 *
 * ## Γιατί δεν είναι χειρόγραφο δείγμα
 *
 * Εκτελεί τους **ΠΡΑΓΜΑΤΙΚΟΥΣ**: `commitImportedScene` · `SceneStore` · `supersedeFileRecord` /
 * `moveToTrash` · `RealtimeService` (singleton) · `levelsThatLostTheirFloorplan`. Mock μόνο τα
 * **σύνορα**: Firestore (κάδος) και δίκτυο προς τον γραφέα (αντικατάσταση). Το Κ2 **εκτελεί** τη
 * μετάλλαξη (σκέτος κάδος) για να αποδείξει ότι η άγκυρα ξεχωρίζει τις δύο περιπτώσεις, και το
 * Κ9 διαβάζει τον **πραγματικό** συνδρομητή για να κλειδώσει ότι δεν ακούει την αντικατάσταση.
 *
 * @see ../level-floorplan-loss.ts
 * @see docs/centralized-systems/reference/adrs/ADR-845-public-3d-execution.md §7.9
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Σύνορο Firestore (κάδος) ───────────────────────────────────────────────────
const updateDocMock = jest.fn(async () => undefined);
const docData: Record<string, unknown> = {
  // ADR-866 §2.6.11 — κάθε αρχείο έχει ΑΚΡΙΒΩΣ έναν κάτοχο (μετρημένο 35/35 στο `files`)· ο κάδος τον
  // ρωτά για να διαλέξει βιβλίο δραστηριότητας, και αρνείται αρχείο χωρίς κάτοχο.
  companyId: 'comp_test',
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

// ── Σύνορο δικτύου προς τον ΕΝΑ γραφέα (αντικατάσταση) ─────────────────────────
const postMock = jest.fn(async (): Promise<unknown> => ({ success: true, kind: 'transitioned' }));
jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { post: (...args: unknown[]) => postMock(...(args as [])) },
  apiErrorBodyOf: (cause: unknown) =>
    typeof cause === 'object' && cause !== null && 'errorBody' in cause
      ? (cause as { errorBody: Record<string, unknown> }).errorBody
      : null,
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
import type { FileSupersededPayload, FileTrashedPayload } from '@/services/realtime';
import { moveToTrash, supersedeFileRecord } from '@/services/file-record-lifecycle';
import { createSceneLayer } from '../../../types/scene-types';
import { EMPTY_BOUNDS } from '../../../config/geometry-constants';
import type { Entity, SceneLayer, SceneModel } from '../../../types/entities';

const LEVEL = 'lvl_9f2c7d41';
const FLOOR = 'flr_f29529ba';
const PREV_FILE = 'file_d4520d2e';
const NEXT_FILE = 'file_f879a2a7';
const UID = 'WKBWEg3DSfcdSbLNJfzGEW3vkct1';

/** Το επίπεδο ΟΠΩΣ ΤΟ ΒΛΕΠΕΙ Ο ΣΥΝΔΡΟΜΗΤΗΣ τη στιγμή του γεγονότος: δείχνει ΑΚΟΜΑ στο παλιό. */
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

/** Ο συνδρομητής της απώλειας — **ίδιο σώμα** με τον `useLevelFloorplanSync`. */
function subscribeLossListener(levels: FloorplanBearingLevel[], onEvent?: () => void): () => void {
  return RealtimeService.subscribe('FILE_TRASHED', (payload: FileTrashedPayload) => {
    onEvent?.();
    for (const lvl of levelsThatLostTheirFloorplan(levels, payload)) {
      SceneStore.clearLevelScene(lvl.id);
    }
  });
}

/**
 * Μία ολόκληρη εισαγωγή μέσα από την πραγματική πόρτα, με τον συνδρομητή ζωντανό.
 *
 * @param declareSuccessor `true` → αντικατάσταση (Β10). `false` → **η μετάλλαξη**: σκέτος κάδος.
 */
async function runImport(declareSuccessor: boolean): Promise<{
  sceneAfter: SceneModel | null;
  entitiesWhenEventFired: number | null;
  trashed: FileTrashedPayload[];
  superseded: FileSupersededPayload[];
}> {
  SceneStore._resetForTests();
  const trashed: FileTrashedPayload[] = [];
  const superseded: FileSupersededPayload[] = [];
  let entitiesWhenEventFired: number | null = null;
  const snapshotCanvas = (): void => {
    entitiesWhenEventFired = SceneStore.getLevelScene(LEVEL)?.entities.length ?? 0;
  };

  const unsubLoss = subscribeLossListener(staleLevels(), snapshotCanvas);
  const unsubTrashLog = RealtimeService.subscribe('FILE_TRASHED', (p) => { trashed.push(p); });
  const unsubSuper = RealtimeService.subscribe('FILE_SUPERSEDED', (p) => {
    superseded.push(p);
    snapshotCanvas();
  });

  const pending: Promise<unknown>[] = [];
  commitImportedScene(importedFloorplan(), {
    targetLevelId: LEVEL,
    scope: { levelId: LEVEL, floorId: FLOOR, floorplanId: NEXT_FILE },
    getLevelScene: (id) => SceneStore.getLevelScene(id),
    setLevelScene: (id, s) => SceneStore.setLevelScene(id, s),
    linkSceneFileToLevel: () => {
      pending.push(declareSuccessor ? supersedeFileRecord(PREV_FILE, NEXT_FILE, 'company') : moveToTrash(PREV_FILE, 'company', UID));
    },
  });

  await Promise.all(pending);
  unsubLoss();
  unsubTrashLog();
  unsubSuper();
  return { sceneAfter: SceneStore.getLevelScene(LEVEL), entitiesWhenEventFired, trashed, superseded };
}

describe('ADR-845 Ο-16 · ADR-862 Φ0 Β10 — αντικατάσταση κάτοψης δεν είναι απώλεια κάτοψης', () => {
  beforeEach(() => {
    updateDocMock.mockClear();
    postMock.mockClear();
    postMock.mockImplementation(async () => ({ success: true, kind: 'transitioned' }));
    SceneStore._resetForTests();
  });

  // ⭐ Κ1 — ΤΟ ΔΙΑΚΡΙΝΟΝ: η σκηνή ΕΠΙΒΙΩΝΕΙ της ίδιας της εισαγωγής που τη γέννησε.
  it('Κ1 — με αντικατάσταση, η νεοεισαχθείσα σκηνή ΕΠΙΒΙΩΝΕΙ', async () => {
    const { sceneAfter, entitiesWhenEventFired } = await runImport(true);

    // Η κούρσα είναι πραγματική: το γεγονός έφτασε ΜΕ τη σκηνή ήδη γραμμένη.
    expect(entitiesWhenEventFired).toBe(3);
    expect(sceneAfter?.entities).toHaveLength(3);
  });

  // ⭐ Κ2 — Η ΜΕΤΑΛΛΑΞΗ, ΕΚΤΕΛΕΣΜΕΝΗ: σκέτος κάδος ⇒ το ελάττωμα επανεμφανίζεται.
  it('Κ2 — σκέτος κάδος (η παλιά συμπεριφορά) ο καμβάς ΑΔΕΙΑΖΕΙ', async () => {
    const { sceneAfter, entitiesWhenEventFired } = await runImport(false);

    expect(entitiesWhenEventFired).toBe(3);
    expect(sceneAfter).toBeNull();
  });

  // Η αντικατάσταση είναι ΔΙΚΟ ΤΗΣ γεγονός — ποτέ `FILE_TRASHED`.
  it('Κ3 — εκπέμπεται FILE_SUPERSEDED με τον διάδοχο, και ΚΑΝΕΝΑ FILE_TRASHED', async () => {
    const { trashed, superseded } = await runImport(true);

    expect(trashed).toHaveLength(0);
    expect(superseded).toHaveLength(1);
    expect(superseded[0]).toMatchObject({ fileId: PREV_FILE, supersededByFileId: NEXT_FILE });
  });

  // 🔴 Β10 — ο browser ΔΕΝ γράφει τίποτα· ζητά από τον ΕΝΑ γραφέα.
  it('Κ4 — καμία εγγραφή πελάτη· αίτημα `supersede` προς τη διαδρομή του δοχείου', async () => {
    await runImport(true);

    expect(updateDocMock).not.toHaveBeenCalled();
    // 🗂️ ADR-866 2β.3β — **το διαμέρισμα ταξιδεύει ως παράμετρος**, ποτέ ο κάτοχος: ο
    //    διακομιστής βάζει τον κάτοχο από τη δική του ταυτότητα. Οι στάθμες DXF είναι εταιρικές.
    expect(postMock).toHaveBeenCalledWith(
      `/api/files/${PREV_FILE}/cde`,
      { act: 'supersede', supersededByFileId: NEXT_FILE },
      { params: { custody: 'company' } },
    );
  });

  // Η ΠΡΑΓΜΑΤΙΚΗ δουλειά του συνδρομητή δεν χάνεται: εξωτερική διαγραφή ΚΑΘΑΡΙΖΕΙ.
  it('Κ5 — σκέτη διαγραφή εξακολουθεί να καθαρίζει τον καμβά', async () => {
    SceneStore.setLevelScene(LEVEL, importedFloorplan());
    const unsub = subscribeLossListener(staleLevels());
    await moveToTrash(PREV_FILE, 'company', UID);
    unsub();

    expect(SceneStore.getLevelScene(LEVEL)).toBeNull();
  });

  // Το σκέλος «όροφος» (ADR-237) μένει άθικτο.
  it('Κ6 — εξωτερική διαγραφή κάτοψης ΟΡΟΦΟΥ καθαρίζει και αδεμένο επίπεδο', () => {
    const unlinked: FloorplanBearingLevel = { id: LEVEL, sceneFileId: null, floorId: FLOOR };
    const lost = levelsThatLostTheirFloorplan([unlinked], {
      fileId: 'file_other', entityType: 'floor', entityId: FLOOR,
    });
    expect(lost.map((l) => l.id)).toEqual([LEVEL]);
  });

  // Άρνηση του διακομιστή ⇒ ΚΑΝΕΝΑ γεγονός (θα έκρυβε από τη λίστα αρχείο που είναι ακόμη ενεργό)
  // και ονομασμένη έκβαση (ποτέ σιωπή).
  it('Κ7 — άρνηση ⇒ ονομασμένη έκβαση, κανένα FILE_SUPERSEDED', async () => {
    postMock.mockImplementation(async () => {
      throw { errorBody: { success: false, act: 'supersede', refused: 'identity-mismatch' } };
    });
    const seen: FileSupersededPayload[] = [];
    const unsub = RealtimeService.subscribe('FILE_SUPERSEDED', (p) => { seen.push(p); });
    const outcome = await supersedeFileRecord(PREV_FILE, NEXT_FILE, 'company');
    unsub();

    expect(outcome).toEqual({ kind: 'refused', why: 'identity-mismatch' });
    expect(seen).toHaveLength(0);
  });

  // Ταυτότητα: ένα αρχείο δεν διαδέχεται τον εαυτό του — ούτε δίκτυο, ούτε γεγονός.
  it('Κ8 — supersede με τον ίδιο id είναι no-op', async () => {
    const seen: FileSupersededPayload[] = [];
    const unsub = RealtimeService.subscribe('FILE_SUPERSEDED', (p) => { seen.push(p); });
    const outcome = await supersedeFileRecord(PREV_FILE, PREV_FILE, 'company');
    unsub();

    expect(outcome).toEqual({ kind: 'noop' });
    expect(postMock).not.toHaveBeenCalled();
    expect(seen).toHaveLength(0);
  });

  // 🔑 Κ9 — Η ΔΟΜΙΚΗ ΠΡΟΣΤΑΣΙΑ, ΣΤΟΝ ΠΡΑΓΜΑΤΙΚΟ ΣΥΝΔΡΟΜΗΤΗ: αν κάποιος τον κάνει να ακούει και
  //         την αντικατάσταση, το Κ1 θα έμενε πράσινο (το harness δεν τον εκτελεί) — αυτό όχι.
  it('Κ9 — ο useLevelFloorplanSync ακούει ΜΟΝΟ FILE_TRASHED', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'hooks', 'useLevelFloorplanSync.ts'), 'utf8');
    const subscribed = [...source.matchAll(/RealtimeService\.subscribe\(\s*'([A-Z_]+)'/g)].map((m) => m[1]);

    expect(subscribed).toEqual(['FILE_TRASHED']);
  });
});
