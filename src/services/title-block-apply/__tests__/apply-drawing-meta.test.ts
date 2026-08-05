/**
 * @fileoverview Η εγγραφή μεταδεδομένων σχεδίου — **ένα πεδίο ανά έγκριση** (ADR-759 Φ3).
 */

/* global describe, it, expect, jest, beforeEach */
import { applyDrawingMetaTarget } from '../apply-drawing-meta';
import type { ApplyTargetContext } from '../apply-types';
import type { BindingTarget } from '@/types/title-block-binding';

jest.mock('@/services/dxf-level-mutation-gateway', () => ({
  updateDxfLevelWithPolicy: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const gateway = require('@/services/dxf-level-mutation-gateway') as {
  updateDxfLevelWithPolicy: jest.Mock;
};

const CTX: ApplyTargetContext = {
  userId: 'user_1',
  companyId: 'comp_1',
  snapshotValue: '1:200',
};

const target = (
  field: 'scale' | 'studyDate' | 'drawingType' | 'drawingNumber',
  value: string,
): Extract<BindingTarget, { kind: 'drawing-meta' }> => ({
  kind: 'drawing-meta',
  levelId: 'lvl_1',
  projectId: 'proj_1',
  field,
  value,
});

beforeEach(() => {
  gateway.updateDxfLevelWithPolicy.mockReset();
});

describe('applyDrawingMetaTarget', () => {
  it('γράφει ΜΟΝΟ το πεδίο της πρότασης, μαζί με το `levelId`', async () => {
    gateway.updateDxfLevelWithPolicy.mockResolvedValue({ success: true });

    await applyDrawingMetaTarget(target('scale', '1:200'), CTX);

    // 🔴 Η έγκριση είναι **ανά πρόταση**: ο μηχανικός δέχεται την κλίμακα και απορρίπτει την
    // ημερομηνία. Ένα συγκεντρωτικό PATCH θα έγραφε πράγματα που κανείς δεν ενέκρινε.
    expect(gateway.updateDxfLevelWithPolicy).toHaveBeenCalledWith({
      payload: { levelId: 'lvl_1', scale: '1:200' },
    });
    const [{ payload }] = gateway.updateDxfLevelWithPolicy.mock.calls[0];
    expect(Object.keys(payload as object).sort()).toEqual(['levelId', 'scale']);
  });

  it.each([
    ['studyDate', 'ΙΟΥΛΙΟΣ 2026'],
    ['drawingType', 'ΤΟΠΟΓΡΑΦΙΚΟ ΔΙΑΓΡΑΜΜΑ'],
    ['drawingNumber', 'Τ1'],
  ] as const)('το «%s» φτάνει στο ωφέλιμο φορτίο αυτούσιο', async (field, value) => {
    gateway.updateDxfLevelWithPolicy.mockResolvedValue({ success: true });
    await applyDrawingMetaTarget(target(field, value), CTX);
    expect(gateway.updateDxfLevelWithPolicy).toHaveBeenCalledWith({
      payload: { levelId: 'lvl_1', [field]: value },
    });
  });

  it('🔴 αποτυχία του gateway ΕΠΙΣΤΡΕΦΕΤΑΙ — ποτέ σιωπηλή επιτυχία (κανόνας Γ9)', async () => {
    gateway.updateDxfLevelWithPolicy.mockResolvedValue({ success: false, error: 'nope' });

    const result = await applyDrawingMetaTarget(target('scale', '1:200'), CTX);

    // Αν ο καλών δεν μπορεί να μάθει ότι ο στόχος ΔΕΝ γράφτηκε, θα γράψει provenance για εγγραφή
    // που δεν έγινε — φάντασμα με το όνομα ενός ανθρώπου πάνω του.
    expect(result).toEqual({ success: false, error: 'nope', errorCode: 'LEVEL_UPDATE_FAILED' });
  });

  it('🔴 ΕΞΑΙΡΕΣΗ (π.χ. 400 «No fields to update») γίνεται αποτυχία με κωδικό, όχι crash', async () => {
    // Ακριβώς αυτό απαντά ο handler αν το πεδίο λείπει από τη δική του allowlist — δες
    // `dxf-levels/__tests__/update-allowlist-parity.test.ts`.
    gateway.updateDxfLevelWithPolicy.mockRejectedValue(new Error('400 No fields to update'));

    const result = await applyDrawingMetaTarget(target('scale', '1:200'), CTX);

    expect(result.success).toBe(false);
    expect(result).toMatchObject({ errorCode: 'LEVEL_UPDATE_FAILED' });
  });
});
