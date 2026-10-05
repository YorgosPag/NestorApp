/**
 * ΑΓΚΥΡΑ — **το `PATCH /api/floors`: μία γραμμή του ανθρώπου, και οι αλυσίδες ξέρουν ποια πράξη τις προκάλεσε**
 * (ADR-195, 2026-10-05).
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: η γραμμή γραφόταν μέσα στις «συνέπειες», με χειρόγραφη διαφορά εκτός μητρώου, στο βιβλίο
 * του καλούντος — και καθόλου όταν ο καλών δεν είχε εταιρεία. Οι αλυσίδες έγραφαν τις δικές τους γραμμές με το
 * uid του **ανθρώπου**. Δεν υπήρχε ούτε ένα test της διαδρομής ενημέρωσης.
 *
 * Η διαφορά είναι η **πραγματική** μηχανή με το πραγματικό `FLOOR_TRACKED_FIELDS`· πραγματικές είναι και οι
 * «συνέπειες» (`floor-update-effects.ts`). Αντικαθίστανται μόνο η γραφή στο βιβλίο και οι ίδιες οι αλυσίδες.
 */

/* global describe, it, expect, beforeEach, jest */

import type { AuthContext } from '@/lib/auth';
import { EntityAuditService } from '@/services/entity-audit.service';
import { cascadeFloorRefToHosted } from '../floor-ref-cascade.service';
import { reconcileFloorStackAfterEdit } from '../floor-stack-reconcile.service';
import { handleUpdateFloor } from '../floors.handlers';

jest.mock('server-only', () => ({}));
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {
    static json(body: unknown, init?: { status?: number }) {
      return { status: init?.status ?? 200, body };
    }
  },
}));
jest.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'TS' } }));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => ({}) }));
jest.mock('@/lib/firestore/deletion-guard', () => ({ executeDeletion: jest.fn() }));
jest.mock('@/lib/firestore/entity-creation.service', () => ({ createEntity: jest.fn() }));
jest.mock('@/lib/firestore/version-check', () => ({
  withVersionCheck: async () => ({ newVersion: 2 }),
  ConflictError: class ConflictError extends Error {},
}));
jest.mock('../floor-slot', () => ({ assertFloorSlotFree: async () => undefined }));

// `var`: τα `jest.mock` ανυψώνονται πάνω από τα `const`.
var storedFloor: Record<string, unknown> = {};
jest.mock('../floors.shared', () => ({
  loadFloorInTenant: async () => ({ ref: {}, data: storedFloor }),
  buildFloorsQuery: jest.fn(),
  resolveFloorsListParams: jest.fn(),
  sortFloors: jest.fn(),
}));
jest.mock('../floor-stack-reconcile.service', () => ({
  reconcileFloorStackAfterEdit: jest.fn().mockResolvedValue({ mode: 'none' }),
  reconcileSpecialLevelPlacement: jest.fn().mockResolvedValue(0),
}));
jest.mock('../floor-ref-cascade.service', () => ({
  cascadeFloorRefToHosted: jest.fn().mockResolvedValue({ properties: 0, parking: 0, storage: 0, failed: 0 }),
}));
// Η διαφορά είναι η ΠΡΑΓΜΑΤΙΚΗ μηχανή· μόνο η γραφή στο βιβλίο αντικαθίσταται.
jest.mock('@/services/entity-audit.service', () => {
  const { diffTrackedFields } = jest.requireActual('@/lib/audit/audit-diff');
  return {
    EntityAuditService: {
      diffFieldsWithResolution: async (before: unknown, after: unknown, defs: unknown) =>
        diffTrackedFields(before, after, defs),
      recordChange: jest.fn().mockResolvedValue('eaud_human'),
    },
    resolveUserDisplayName: async () => 'Γιώργος',
  };
});

const recordChange = EntityAuditService.recordChange as jest.MockedFunction<typeof EntityAuditService.recordChange>;
const reconcileStack = reconcileFloorStackAfterEdit as jest.MockedFunction<typeof reconcileFloorStackAfterEdit>;
const cascadeHosted = cascadeFloorRefToHosted as jest.MockedFunction<typeof cascadeFloorRefToHosted>;

const FLOOR = {
  name: '1ος Όροφος',
  number: 1,
  kind: 'standard',
  elevation: 3,
  height: 3,
  buildingId: 'bld_1',
  companyId: 'co_owner',
};

/** Ο καλών ανήκει σε ΑΛΛΗ εταιρεία από τον όροφο (super admin). */
const ctx = { uid: 'u_1', email: 'a@alpha.gr', companyId: 'co_caller', globalRole: 'super_admin' } as unknown as AuthContext;

const patch = async (payload: Record<string, unknown>) => {
  const request = { json: async () => ({ floorId: 'flr_1', _v: 1, ...payload }) };
  return handleUpdateFloor(request as unknown as Parameters<typeof handleUpdateFloor>[0], ctx);
};

beforeEach(() => {
  storedFloor = { ...FLOOR };
  recordChange.mockClear();
  reconcileStack.mockClear();
  cascadeHosted.mockClear();
});

describe('η γραμμή του ανθρώπου', () => {
  it('Ο1 — αλλαγή ύψους ⇒ ΜΙΑ γραμμή, από το μητρώο, στο βιβλίο του ΚΑΤΟΧΟΥ του ορόφου', async () => {
    await patch({ height: 3.2 });

    expect(recordChange).toHaveBeenCalledTimes(1);
    expect(recordChange.mock.calls[0][0]).toEqual({
      entityType: 'floor',
      entityId: 'flr_1',
      entityName: '1ος Όροφος',
      action: 'updated',
      changes: [{ field: 'height', oldValue: 3, newValue: 3.2, label: 'height' }],
      performedBy: 'u_1',
      performedByName: 'a@alpha.gr',
      companyId: 'co_owner',
    });
  });

  it('Ο2 — το είδος της στάθμης παρακολουθείται (το PATCH το γράφει· το μητρώο δεν το είχε)', async () => {
    await patch({ kind: 'roof' });

    expect(recordChange.mock.calls[0][0].changes).toEqual([
      { field: 'kind', oldValue: 'standard', newValue: 'roof', label: 'kind' },
    ]);
  });

  it('Ο3 — αυτόματη αποθήκευση που ξαναστέλνει ΤΑ ΙΔΙΑ ⇒ καμία γραμμή, καμία συνέπεια', async () => {
    await patch({ name: FLOOR.name, number: FLOOR.number, elevation: FLOOR.elevation, height: FLOOR.height });

    expect(recordChange).not.toHaveBeenCalled();
    expect(reconcileStack).not.toHaveBeenCalled();
    expect(cascadeHosted).not.toHaveBeenCalled();
  });
});

describe('οι αλυσίδες — εκτελεστής η μηχανή, αιτία η πράξη του ανθρώπου', () => {
  it('Α1 — η στοίβα παίρνει δράστη με αιτία ΤΗ ΓΡΑΜΜΗ του ανθρώπου, και τρέχει στον ενοικιαστή του ΟΡΟΦΟΥ', async () => {
    await patch({ height: 3.2 });

    expect(reconcileStack).toHaveBeenCalledTimes(1);
    const [, buildingId, floorId, companyId, actor] = reconcileStack.mock.calls[0];
    expect([buildingId, floorId, companyId]).toEqual(['bld_1', 'flr_1', 'co_owner']);
    expect(actor).toEqual({
      updatedBy: 'u_1',
      cause: {
        auditId: 'eaud_human',
        initiatedBy: 'u_1',
        initiatedByName: 'Γιώργος',
        entityType: 'floor',
        entityId: 'flr_1',
        entityName: '1ος Όροφος',
      },
    });
  });

  it('Α2 — μετονομασία ⇒ τα φιλοξενούμενα ακολουθούν, με αιτία που φέρει το ΝΕΟ όνομα', async () => {
    await patch({ name: 'Μεσοπάτωμα' });

    expect(reconcileStack).not.toHaveBeenCalled();
    expect(cascadeHosted).toHaveBeenCalledTimes(1);
    expect(cascadeHosted.mock.calls[0][3].cause.entityName).toBe('Μεσοπάτωμα');
  });

  it('Α3 — οι συνέπειες ΔΕΝ ρωτούν το μητρώο ιστορικού: τρέχουν ακόμη κι αν το βιβλίο δεν έγραψε γραμμή', async () => {
    recordChange.mockResolvedValueOnce(null);

    await patch({ elevation: 3.5 });

    expect(reconcileStack).toHaveBeenCalledTimes(1);
    expect(reconcileStack.mock.calls[0][4].cause.auditId).toBeNull();
  });
});
