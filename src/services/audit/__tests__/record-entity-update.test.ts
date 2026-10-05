/**
 * ΑΓΚΥΡΑ — **ο ΕΝΑΣ γραφέας ανθρώπινης ενημέρωσης** (ADR-195, 2026-10-05).
 *
 * Γεννήθηκε ως `recordBuildingUpdate`· γενικεύτηκε όταν το `PATCH /api/floors` βρέθηκε να έχει δική του εκδοχή
 * της ίδιας πράξης. Εδώ κρίνεται ό,τι είναι **δικό του**: ποιο μητρώο διαλέγει, σε ποιο βιβλίο γράφει, τι επιστρέφει.
 */

/* global describe, it, expect, beforeEach, jest */

import type { AuthContext } from '@/lib/auth';
import { EntityAuditService } from '@/services/entity-audit.service';
import { recordEntityUpdate } from '../record-entity-update';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/services/entity-audit.service', () => {
  const { diffTrackedFields } = jest.requireActual('@/lib/audit/audit-diff');
  return {
    EntityAuditService: {
      diffFieldsWithResolution: async (before: unknown, after: unknown, defs: unknown) =>
        diffTrackedFields(before, after, defs),
      recordChange: jest.fn().mockResolvedValue('eaud_1'),
    },
  };
});

const recordChange = EntityAuditService.recordChange as jest.MockedFunction<typeof EntityAuditService.recordChange>;
const ctx = { uid: 'u_1', email: 'a@alpha.gr', companyId: 'co_caller' } as unknown as AuthContext;

beforeEach(() => recordChange.mockClear());

describe('recordEntityUpdate', () => {
  it('Γ1 — το μητρώο το διαλέγει ο ΤΥΠΟΣ: το ίδιο πεδίο κρίνεται μόνο εκεί που παρακολουθείται', async () => {
    const before = { name: 'Α', height: 3, companyId: 'co_owner' };
    const written = { height: 3.2 };

    const floor = await recordEntityUpdate({ entityType: 'floor', entityId: 'flr_1', before, written, ctx });
    const building = await recordEntityUpdate({ entityType: 'building', entityId: 'bld_1', before, written, ctx });

    expect(floor.changes.map((change) => change.field)).toEqual(['height']);
    expect(building).toEqual({ auditId: null, changes: [] });
    expect(recordChange).toHaveBeenCalledTimes(1);
  });

  it('Γ2 — επιστρέφει το auditId της γραμμής: η αιτία για ό,τι παράγωγο ακολουθήσει', async () => {
    const result = await recordEntityUpdate({
      entityType: 'floor', entityId: 'flr_1', before: { number: 1, companyId: 'co_owner' }, written: { number: 2 }, ctx,
    });

    expect(result.auditId).toBe('eaud_1');
    expect(recordChange.mock.calls[0][0]).toMatchObject({ companyId: 'co_owner', performedBy: 'u_1' });
  });

  it('Γ3 — έγγραφο χωρίς κάτοχο ⇒ το βιβλίο του καλούντος (ποτέ γραμμή χωρίς βιβλίο)', async () => {
    await recordEntityUpdate({ entityType: 'floor', entityId: 'flr_1', before: { number: 1 }, written: { number: 2 }, ctx });

    expect(recordChange.mock.calls[0][0]).toMatchObject({ companyId: 'co_caller' });
  });

  it('Γ4 — οντότητα χωρίς μητρώο ⇒ καμία γραμμή, και όχι εξαίρεση (δεν ρίχνει την αποθήκευση)', async () => {
    const result = await recordEntityUpdate({
      entityType: 'quote', entityId: 'q_1', before: { name: 'Α' }, written: { name: 'Β' }, ctx,
    });

    expect(result).toEqual({ auditId: null, changes: [] });
    expect(recordChange).not.toHaveBeenCalled();
  });

  it('Γ5 — ο δεσμός placeRef του κτιρίου γράφεται ως ΤΑΥΤΟΤΗΤΑ, ποτέ ωμό JSON· η άρση του είναι αλλαγή', async () => {
    const before = { name: 'Κτίριο Α', companyId: 'co_owner', placeRef: { landId: 'land_1', buildingId: null } };

    const moved = await recordEntityUpdate({
      entityType: 'building', entityId: 'bld_1', before, written: { placeRef: { landId: 'land_1', buildingId: 'pb_7' } }, ctx,
    });
    const lifted = await recordEntityUpdate({
      entityType: 'building', entityId: 'bld_1', before, written: { placeRef: null }, ctx,
    });
    const untouched = await recordEntityUpdate({
      entityType: 'building', entityId: 'bld_1', before, written: { placeRef: { buildingId: null, landId: 'land_1' } }, ctx,
    });

    expect(moved.changes).toEqual([{ field: 'placeRef', oldValue: 'land_1', newValue: 'land_1/pb_7', label: 'placeRef' }]);
    expect(lifted.changes).toEqual([{ field: 'placeRef', oldValue: 'land_1', newValue: null, label: 'placeRef' }]);
    expect(untouched.changes).toEqual([]);
  });
});
