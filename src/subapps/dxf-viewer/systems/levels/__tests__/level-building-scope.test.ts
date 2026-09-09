/**
 * ⚓ ΑΓΚΥΡΑ Α-17 (ADR-845 §7.14, Ο-18 + Ο-19) — **η εμβέλεια του επιπέδου**.
 *
 * Ρωτά ό,τι κανείς δεν ρωτούσε: *«συμφωνεί το κτήριο που **δηλώνει** ένα επίπεδο
 * με το κτήριο που **περιέχει** τον όροφό του;»* — και, κυρίως, **εκτελεί τον
 * παραγωγό** που τα έκανε να διαφωνήσουν.
 *
 * ## Γιατί ο παραγωγός εκτελείται αντί να περιγράφεται (το μάθημα του Ο-13)
 *
 * *«Fixture που περιγράφει έγγραφο το οποίο κανείς δεν γράφει είναι ευχή.»* Ένα
 * χειρόγραφο `{ floorId: 'flr_A', buildingId: 'bldg_B' }` θα κοκκίνιζε τον φρουρό
 * χωρίς να αποδεικνύει **τίποτα** για την εφαρμογή. Η Κ2 τρέχει το **αληθινό**
 * `useFloorplanImportComplete` — τον ίδιο κώδικα που τρέχει όταν ο μηχανικός
 * πατάει «Εισαγωγή Κάτοψης» — και μετρά **τι γράφτηκε πραγματικά**.
 *
 * ## Τι πρέπει να μπορεί να κοκκινίσει
 *
 * **Κ1** ο κανόνας · **Κ2** 🔴 ο παραγωγός *(κόκκινο πριν τη ραφή)* ·
 * **Κ3** η αδιαίρετη ανάθεση · **Κ4** το σύρμα, που είναι η **αιτία**.
 *
 * @see subapps/dxf-viewer/systems/levels/level-building-scope
 */

import { renderHook, act } from '@testing-library/react';
import {
  checkLevelBuildingScope,
  isForeignBuildingLevel,
  resolveLevelScopeAssignment,
} from '../level-building-scope';
import type { LevelBuildingScopeInput } from '../level-building-scope';

// ─────────────────────────────────────────────────────────────────────────────
// Οι εξαρτήσεις που ο παραγωγός σέρνει μαζί του και ΔΕΝ αφορούν την ερώτηση.
// (Το `useFloorplanImportComplete` δεν τις καλεί· ζουν στο ίδιο module.)
// ─────────────────────────────────────────────────────────────────────────────
jest.mock('@/components/properties/shared/useFloorsByBuilding', () => ({
  useFloorsByBuilding: () => ({ floors: [], loading: false }),
}));
jest.mock('@/services/file-record.service', () => ({ FileRecordService: { moveToTrash: jest.fn() } }));
jest.mock('../ensure-levels-for-building', () => ({ ensureLevelsForBuilding: jest.fn() }));

import { useFloorplanImportComplete } from '../../../ui/components/level-panel-hooks';
import type { FloorplanImportCompleteDeps } from '../../../ui/components/level-panel-hooks';
import type { WizardCompleteMeta } from '@/features/floorplan-import';
import type { Level } from '../config';

// ─────────────────────────────────────────────────────────────────────────────
// Ο κόσμος: ΔΥΟ κτήρια, ένα σε κάθε έργο — το σχήμα των ζωντανών δεδομένων.
// ⚠️ Ομώνυμα ΕΠΙΤΗΔΕΣ: έξι από τα επτά ζωντανά κτήρια λέγονται «Κτήριο Α», και
// γι' αυτόν ακριβώς τον λόγο το ταίριασμα με ΟΝΟΜΑ αποκλείστηκε (ADR-769).
// ─────────────────────────────────────────────────────────────────────────────
const BLDG_A = 'bldg_aaaaaaaa-0000-0000-0000-000000000001';
const BLDG_B = 'bldg_bbbbbbbb-0000-0000-0000-000000000002';
const FLOOR_A1 = 'flr_aaaaaaaa-0000-0000-0000-0000000000a1';
const FLOOR_B1 = 'flr_bbbbbbbb-0000-0000-0000-0000000000b1';

/** Η ιεραρχία — ό,τι θα απαντούσε το `floors/{id}.buildingId`. */
const FLOOR_OWNER: Record<string, string> = { [FLOOR_A1]: BLDG_A, [FLOOR_B1]: BLDG_B };

describe('Κ1 — ο κανόνας: το κτήριο του επιπέδου απέναντι στο κτήριο του ορόφου του', () => {
  it('🔴 καταγγέλλει επίπεδο που δηλώνει κτήριο ΞΕΝΟ προς τον όροφό του', () => {
    const verdict = checkLevelBuildingScope({ floorId: FLOOR_A1, buildingId: BLDG_B }, FLOOR_OWNER[FLOOR_A1]);
    expect(verdict).toEqual({
      status: 'foreign-building',
      declaredBuildingId: BLDG_B,
      actualBuildingId: BLDG_A,
    });
    expect(isForeignBuildingLevel({ floorId: FLOOR_A1, buildingId: BLDG_B }, BLDG_A)).toBe(true);
  });

  it('δέχεται επίπεδο του οποίου το κτήριο ΠΕΡΙΕΧΕΙ τον όροφό του', () => {
    expect(checkLevelBuildingScope({ floorId: FLOOR_A1, buildingId: BLDG_A }, BLDG_A)).toEqual({
      status: 'agrees',
      buildingId: BLDG_A,
    });
  });

  it('σιωπά — με ονομασμένο λόγο — όπου δεν υπάρχει αντιπαράθεση να κριθεί', () => {
    // Γενική κάτοψη έργου/κτηρίου: δεν είναι όροφος.
    expect(checkLevelBuildingScope({ floorId: null, buildingId: BLDG_A }, BLDG_A).status).toBe('not-applicable');
    expect(checkLevelBuildingScope({ buildingId: BLDG_A }, BLDG_A)).toEqual({
      status: 'not-applicable',
      reason: 'level-has-no-floor',
    });
    // Legacy επίπεδο χωρίς δηλωμένο κτήριο.
    expect(checkLevelBuildingScope({ floorId: FLOOR_A1 }, BLDG_A)).toEqual({
      status: 'not-applicable',
      reason: 'level-has-no-building',
    });
    // ⚠️ Κρεμάμενος όροφος — ΔΕΝ κατηγορούμε χωρίς στοιχεία.
    expect(checkLevelBuildingScope({ floorId: FLOOR_A1, buildingId: BLDG_B }, null)).toEqual({
      status: 'not-applicable',
      reason: 'floor-building-unknown',
    });
    expect(isForeignBuildingLevel({ floorId: FLOOR_A1, buildingId: BLDG_B }, undefined)).toBe(false);
  });

  it('αντέχει το κενό και το απόν χωρίς να το εκλάβει ως ταυτότητα', () => {
    expect(checkLevelBuildingScope(null, BLDG_A).status).toBe('not-applicable');
    expect(checkLevelBuildingScope({ floorId: '', buildingId: BLDG_B }, BLDG_A).status).toBe('not-applicable');
    expect(checkLevelBuildingScope({ floorId: FLOOR_A1, buildingId: '' }, BLDG_A).status).toBe('not-applicable');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Κ2 — Ο ΠΑΡΑΓΩΓΟΣ, ΕΚΤΕΛΕΣΜΕΝΟΣ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ό,τι **επιβιώνει του σύρματος**: το `JSON.stringify` του `apiClient` **πετάει**
 * κάθε `undefined`. Δεν περιγράφεται εδώ ο διακομιστής — **εκτελείται** η ίδια
 * σειριοποίηση, ώστε το test να μη μπορεί να διαφωνήσει με την πραγματικότητα.
 */
function overTheWire<T extends object>(payload: T): Partial<T> {
  return JSON.parse(JSON.stringify(payload)) as Partial<T>;
}

/** Το επίπεδο ΟΠΩΣ ΘΑ ΕΙΝΑΙ μετά το PATCH: ο διακομιστής γράφει μόνο ό,τι έφτασε. */
function levelAfterPatch(before: LevelBuildingScopeInput, patch: object): LevelBuildingScopeInput {
  return { ...before, ...overTheWire(patch) };
}

/** Το ενεργό επίπεδο τη στιγμή της εισαγωγής: δεμένο σε όροφο του κτηρίου Α. */
function activeLevelOfBuildingA(): Level {
  return {
    id: 'lvl_active-0000-0000-0000-000000000001',
    name: 'Ισόγειο',
    order: 0,
    isDefault: true,
    visible: true,
    floorId: FLOOR_A1,
    buildingId: BLDG_A,
  } as Level;
}

interface CapturedContext {
  readonly levelId: string;
  readonly context: Record<string, unknown>;
}

/**
 * Τρέχει τον ΑΛΗΘΙΝΟ εισαγωγέα και επιστρέφει ό,τι έγραψε.
 *
 * `meta` = η επιλογή του ανθρώπου στον οδηγό: εταιρεία → έργο → **κτήριο Β** →
 * **όροφος B1** → μονάδα. Η μονάδα κάνει το `entityType` να είναι `'property'`,
 * και **εκεί χάνεται ο όροφος**.
 */
async function runImportComplete(meta: WizardCompleteMeta): Promise<{
  active: Level;
  captured: CapturedContext[];
  targetLevelId: string | null;
}> {
  const active = activeLevelOfBuildingA();
  const captured: CapturedContext[] = [];
  let targetLevelId: string | null = null;

  const deps: FloorplanImportCompleteDeps = {
    resolver: {
      levels: [active],
      addLevel: jest.fn(async () => 'lvl_new-0000-0000-0000-000000000002'),
      linkLevelToFloor: jest.fn(async () => undefined),
    },
    currentLevelId: active.id,
    setCurrentLevel: (levelId: string) => {
      targetLevelId = levelId;
    },
    updateLevelContext: (levelId, context) => {
      captured.push({ levelId, context: context as unknown as Record<string, unknown> });
    },
    entityTypeToFloorplanType: () => 'unit',
    triggerAllFloorsBackfill: jest.fn(),
    onSceneImported: jest.fn(),
  };

  const { result } = renderHook(() => useFloorplanImportComplete(deps));
  await act(async () => {
    await result.current(new File(['0'], 'katopsi.dxf'), meta);
  });
  return { active, captured, targetLevelId };
}

/** Η επιλογή «μονάδα του ορόφου B1, στο κτήριο Β» — όπως τη στέλνει ο οδηγός. */
const UNIT_SELECTION_IN_BUILDING_B: WizardCompleteMeta = {
  companyId: 'comp_test-0000-0000-0000-000000000001',
  projectId: 'proj_bbbbbbbb-0000-0000-0000-000000000002',
  entityType: 'property',
  entityId: 'prop_test-0000-0000-0000-000000000001',
  buildingId: BLDG_B,
  floorId: FLOOR_B1,
  purpose: 'property-floorplan',
  entityLabel: 'Διαμέρισμα 80 τ.μ.',
  format: 'dxf',
};

describe('Κ2 — 🔴 ο ΠΑΡΑΓΩΓΟΣ: τι γράφει ο εισαγωγέας όταν ο άνθρωπος διαλέγει μονάδα', () => {
  it('ΔΕΝ αφήνει το επίπεδο να δηλώνει κτήριο ξένο προς τον όροφό του', async () => {
    const { active, captured } = await runImportComplete(UNIT_SELECTION_IN_BUILDING_B);

    expect(captured).toHaveLength(1);
    const after = levelAfterPatch(active, captured[0].context);

    // Ο όροφος του επιπέδου μετά την εισαγωγή — και το κτήριο που τον περιέχει.
    const owner = after.floorId ? FLOOR_OWNER[after.floorId] : null;
    const verdict = checkLevelBuildingScope(after, owner);

    expect(verdict.status).not.toBe('foreign-building');
  });

  it('ο όροφος που διάλεξε ο άνθρωπος ΦΤΑΝΕΙ στο επίπεδο — δεν πετιέται στον δρόμο', async () => {
    const { active, captured } = await runImportComplete(UNIT_SELECTION_IN_BUILDING_B);
    const after = levelAfterPatch(active, captured[0].context);

    // 🔑 Ο ΣΩΣΤΟΣ όροφος γράφεται ήδη στο ΑΡΧΕΙΟ (`linkedTo`) από το `uploadConfig`.
    // Αν δεν φτάσει και εδώ, το επίπεδο κρατά τον όροφο του ΠΡΟΗΓΟΥΜΕΝΟΥ κτηρίου —
    // και κάθε BIM οντότητα που θα σχεδιαστεί πάνω του (ADR-420: `floorId` = το
    // κλειδί εμβέλειας) γράφεται σε **ξένο κτήριο**.
    expect(after.floorId).toBe(FLOOR_B1);
    expect(after.buildingId).toBe(BLDG_B);
  });

  it('η γενική κάτοψη ΚΤΗΡΙΟΥ δεν κληρονομεί σιωπηλά τον όροφο του προηγούμενου', async () => {
    const { active, captured } = await runImportComplete({
      ...UNIT_SELECTION_IN_BUILDING_B,
      entityType: 'building',
      entityId: BLDG_B,
      floorId: undefined,
      purpose: 'building-floorplan',
    });
    const after = levelAfterPatch(active, captured[0]?.context ?? {});
    const owner = after.floorId ? FLOOR_OWNER[after.floorId] : null;

    expect(checkLevelBuildingScope(after, owner).status).not.toBe('foreign-building');
  });
});

describe('Κ3 — η αδιαίρετη ανάθεση: όροφος και κτήριο ταξιδεύουν μαζί ή καθόλου', () => {
  it('όροφος ⇒ σκέλος «storey», με το κτήριο δίπλα του', () => {
    expect(resolveLevelScopeAssignment({ floorId: FLOOR_B1, buildingId: BLDG_B })).toEqual({
      kind: 'storey',
      floorId: FLOOR_B1,
      buildingId: BLDG_B,
    });
  });

  it('κτήριο χωρίς όροφο ⇒ «building», και ο όροφος σβήνεται ΡΗΤΑ (null, όχι σιωπή)', () => {
    const assignment = resolveLevelScopeAssignment({ buildingId: BLDG_B });
    expect(assignment).toEqual({ kind: 'building', floorId: null, buildingId: BLDG_B });
    // 🔑 Η ΑΙΤΙΑ ΣΕ ΜΙΑ ΓΡΑΜΜΗ: το `null` επιβιώνει του σύρματος, το `undefined` όχι.
    expect(overTheWire(assignment)).toHaveProperty('floorId', null);
    expect(overTheWire({ floorId: undefined, buildingId: BLDG_B })).not.toHaveProperty('floorId');
  });

  it('καμία ταυτότητα ⇒ «project»', () => {
    expect(resolveLevelScopeAssignment({})).toEqual({ kind: 'project' });
    expect(resolveLevelScopeAssignment(null)).toEqual({ kind: 'project' });
  });
});

describe('Κ4 — το σύρμα: γιατί μια σιωπή γίνεται ασυνέπεια', () => {
  it('«μην αγγίξεις» και «καθάρισε» δεν είναι το ίδιο, και μόνο το δεύτερο ταξιδεύει', () => {
    const before: LevelBuildingScopeInput = { floorId: FLOOR_A1, buildingId: BLDG_A };

    // Η ΠΑΛΙΑ γραφή: κτήριο Β, όροφος «σιωπή» ⇒ ο όροφος του Α επιβιώνει.
    const silent = levelAfterPatch(before, { floorId: undefined, buildingId: BLDG_B });
    expect(silent).toEqual({ floorId: FLOOR_A1, buildingId: BLDG_B });
    expect(isForeignBuildingLevel(silent, FLOOR_OWNER[FLOOR_A1])).toBe(true);

    // Η ΑΔΙΑΙΡΕΤΗ ανάθεση: ό,τι κι αν είναι το σκέλος, ασυνέπεια δεν προκύπτει.
    const scoped = levelAfterPatch(before, resolveLevelScopeAssignment({ buildingId: BLDG_B }));
    expect(scoped.floorId).toBeNull();
    expect(isForeignBuildingLevel(scoped, null)).toBe(false);
  });
});
