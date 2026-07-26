/**
 * ADR-715 §3.1 — Η ΔΡΟΜΟΛΟΓΗΣΗ ΠΟΥ ΚΡΙΝΕΙ ΤΗΝ ΤΙΜΗ.
 *
 * Ένα swatch, δύο εντελώς διαφορετικά αποτελέσματα:
 *   · υλικό του καταλόγου στεγάνωσης → `params.buriedWaterproofing` = **render ΚΑΙ επιμέτρηση**
 *   · οτιδήποτε άλλο → `faceAppearance['buried:i']` = **μόνο render**
 *
 * Λάθος δρομολόγηση δεν φαίνεται στην οθόνη (και οι δύο δρόμοι βάφουν σωστά): φαίνεται στον
 * προϋπολογισμό. Γι' αυτό ελέγχεται **ποιο command εκτελέστηκε**, όχι πώς φαίνεται.
 *
 * Οι deps είναι mocked ώστε να ελέγχεται ΜΟΝΟ το routing/merge — όχι geometry recompute.
 *
 * @see ../apply-buried-part-waterproofing.ts
 */

import type { ColumnEntity, ColumnParams } from '../../../bim/types/column-types';
import type { LevelsHookReturn } from '../../../systems/levels/useLevels';
import type { FaceAppearance } from '../../../bim/types/face-appearance-types';

const mockExecute = jest.fn();
const mockColumnCommands: Array<{ columnId: string; next: ColumnParams; prev: ColumnParams }> = [];
const mockFaceApplies: Array<{
  faces: readonly { bimId: string; faceKey: string }[];
  value: FaceAppearance | null;
}> = [];
const mockState: { column: ColumnEntity | undefined } = { column: undefined };

jest.mock('../../../core/commands', () => ({
  getGlobalCommandHistory: () => ({ execute: mockExecute }),
}));
jest.mock('../../../core/commands/entity-commands/UpdateColumnParamsCommand', () => ({
  UpdateColumnParamsCommand: class {
    constructor(columnId: string, next: ColumnParams, prev: ColumnParams) {
      mockColumnCommands.push({ columnId, next, prev });
    }
  },
}));
jest.mock('../current-level-adapter', () => ({
  currentLevelAdapter: () => ({ getEntity: () => mockState.column }),
}));
jest.mock('../apply-face-appearance', () => ({
  applyFaceAppearanceToFaces: (
    _levels: unknown,
    faces: readonly { bimId: string; faceKey: string }[],
    value: FaceAppearance | null,
  ) => { mockFaceApplies.push({ faces, value }); },
}));

import {
  applyBuriedWaterproofing,
  applyBuriedPartAppearance,
} from '../apply-buried-part-waterproofing';
import {
  WATERPROOF_MEMBRANE_MATERIAL,
  DEFAULT_BURIED_WATERPROOFING_MATERIAL,
} from '../../../bim/finishes/buried-waterproofing';

const levels = { currentLevelId: 'lvl1' } as unknown as LevelsHookReturn;
/** Η αρίθμηση όψεων του ζωντανού mesh (4-γωνη κολώνα με θαμμένη ζώνη). */
const MESH_KEYS = ['bottom', 'top', 'side:0', 'side:1', 'side:2', 'side:3',
  'buried:0', 'buried:1', 'buried:2', 'buried:3'];

function fakeColumn(params: Partial<ColumnParams>): ColumnEntity {
  return { id: 'col_1', type: 'column', params } as unknown as ColumnEntity;
}

beforeEach(() => {
  mockExecute.mockClear();
  mockColumnCommands.length = 0;
  mockFaceApplies.length = 0;
  mockState.column = fakeColumn({ width: 400, depth: 400 } as Partial<ColumnParams>);
});

describe('ADR-715 — applyBuriedWaterproofing (ο Part-level writer)', () => {
  it('γράφει `params.buriedWaterproofing` διατηρώντας τα υπόλοιπα params', () => {
    applyBuriedWaterproofing(levels, 'col_1', { materialId: WATERPROOF_MEMBRANE_MATERIAL });
    expect(mockExecute).toHaveBeenCalledTimes(1); // ΕΝΑ undo
    const { next } = mockColumnCommands[0]!;
    expect(next.buriedWaterproofing).toEqual({ materialId: WATERPROOF_MEMBRANE_MATERIAL });
    expect(next.width).toBe(400); // δεν χάθηκε
  });

  it('merge: αλλαγή διακόπτη δεν σβήνει το υλικό', () => {
    mockState.column = fakeColumn({ buriedWaterproofing: { materialId: WATERPROOF_MEMBRANE_MATERIAL } });
    applyBuriedWaterproofing(levels, 'col_1', { enabled: false });
    expect(mockColumnCommands[0]!.next.buriedWaterproofing)
      .toEqual({ enabled: false, materialId: WATERPROOF_MEMBRANE_MATERIAL });
  });

  it('fail-closed: entity που ΔΕΝ είναι κολώνα → κανένα command (όχι σιωπηλό no-op σε λάθος τύπο)', () => {
    mockState.column = { id: 'w1', type: 'wall', params: {} } as unknown as ColumnEntity;
    applyBuriedWaterproofing(levels, 'w1', { enabled: true });
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('απόν entity → κανένα command (fail-safe)', () => {
    mockState.column = undefined;
    applyBuriedWaterproofing(levels, 'col_1', { enabled: true });
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

describe('ADR-715 §3.1 — applyBuriedPartAppearance: ΤΟ ΚΡΙΣΙΜΟ ROUTING', () => {
  it('υλικό στεγάνωσης → Part-level SSoT (render + ΕΠΙΜΕΤΡΗΣΗ), ΚΑΜΙΑ per-face γραφή', () => {
    applyBuriedPartAppearance(levels, 'col_1', MESH_KEYS, { materialId: WATERPROOF_MEMBRANE_MATERIAL });
    expect(mockColumnCommands).toHaveLength(1);
    expect(mockColumnCommands[0]!.next.buriedWaterproofing)
      .toEqual({ enabled: true, materialId: WATERPROOF_MEMBRANE_MATERIAL });
    expect(mockFaceApplies).toHaveLength(0);
  });

  it('το default υλικό δρομολογείται ΚΑΙ ΑΥΤΟ Part-level (είναι μέλος του καταλόγου)', () => {
    applyBuriedPartAppearance(levels, 'col_1', MESH_KEYS, { materialId: DEFAULT_BURIED_WATERPROOFING_MATERIAL });
    expect(mockColumnCommands).toHaveLength(1);
    expect(mockFaceApplies).toHaveLength(0);
  });

  it('υλικό ΕΚΤΟΣ καταλόγου → cosmetic per-face σε ΟΛΕΣ τις θαμμένες όψεις, ΚΑΜΙΑ γραφή params', () => {
    applyBuriedPartAppearance(levels, 'col_1', MESH_KEYS, { materialId: 'mat-brick' });
    expect(mockColumnCommands).toHaveLength(0);
    expect(mockFaceApplies).toHaveLength(1);
    expect(mockFaceApplies[0]!.faces.map((f) => f.faceKey))
      .toEqual(['buried:0', 'buried:1', 'buried:2', 'buried:3']);
    expect(mockFaceApplies[0]!.faces.every((f) => f.bimId === 'col_1')).toBe(true);
  });

  it('σκέτο χρώμα (χωρίς materialId) → cosmetic', () => {
    applyBuriedPartAppearance(levels, 'col_1', MESH_KEYS, { colorHex: '#123456' });
    expect(mockColumnCommands).toHaveLength(0);
    expect(mockFaceApplies[0]!.value).toEqual({ colorHex: '#123456' });
  });

  it('«καθάρισε» (null) → cosmetic clear· ΠΟΤΕ δεν καταργεί τη στεγάνωση', () => {
    // Το «καθάρισε εμφάνιση» δεν είναι «κατάργησε εργασία»: η κατάργηση αφαιρεί γραμμή
    // επιμέτρησης και είναι ρητή απόφαση με δικό της διακόπτη στο Properties.
    applyBuriedPartAppearance(levels, 'col_1', MESH_KEYS, null);
    expect(mockColumnCommands).toHaveLength(0);
    expect(mockFaceApplies[0]!.value).toBeNull();
  });

  it('ΔΕΝ αγγίζει τις ΕΚΤΕΘΕΙΜΕΝΕΣ όψεις (`side:i`) — η ανωδομή μένει ανέπαφη', () => {
    applyBuriedPartAppearance(levels, 'col_1', MESH_KEYS, { materialId: 'mat-brick' });
    const touched = mockFaceApplies[0]!.faces.map((f) => f.faceKey);
    expect(touched.some((k) => k.startsWith('side:'))).toBe(false);
    expect(touched).not.toContain('top');
    expect(touched).not.toContain('bottom');
  });

  it('mesh χωρίς θαμμένες όψεις → κανένα apply (καμία κενή batch/undo εγγραφή)', () => {
    applyBuriedPartAppearance(levels, 'col_1', ['bottom', 'top', 'side:0'], { materialId: 'mat-brick' });
    expect(mockColumnCommands).toHaveLength(0);
    expect(mockFaceApplies[0]!.faces).toEqual([]);
  });
});
