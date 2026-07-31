/**
 * Οι φύλακες ιδιοκτησίας **μέσα στις υπηρεσίες** — ADR-742 Ομάδα 2, παρτίδα β1
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΗ ΣΟΥΙΤΑ ΚΑΙ ΔΕΝ ΑΡΚΟΥΝ ΤΑ TESTS ΤΟΥ SSoT
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `procurement-ownership.test.ts` αποδεικνύει ότι ο φύλακας **δουλεύει**.
 * Δεν αποδεικνύει ότι κάποιος τον **καλεί**. Στην Ομάδα 1 η αφαίρεση ενός
 * ολόκληρου φύλακα άφηνε **12/12 πράσινα** (ADR-742 §7quater) — γιατί καμία
 * σουίτα δεν ρωτούσε την υπηρεσία, μόνο το εργαλείο.
 *
 * Εδώ κάθε ισχυρισμός περνά από την **πραγματική** εξαγόμενη συνάρτηση.
 *
 * ⚠️ Οι ισχυρισμοί ρωτούν τον **τύπο** (`ProcurementCrossTenantError`), όχι το
 * κείμενο. Ένα `.rejects.toThrow('Forbidden')` θα έμενε πράσινο και μετά από
 * επιστροφή στο χειρόγραφο `throw new Error('Forbidden')` — δηλαδή θα
 * τεκμηρίωνε το σφάλμα αντί να το πιάνει (μάθημα #2 της Ομάδας 1).
 *
 * ⚠️ Το mock του `safeFirestoreOperation` είναι **διαφανές** (τα σφάλματα
 * ανεβαίνουν), όπως και στις αδελφές σουίτες. Στην παραγωγή, όταν δοθεί
 * `fallback`, το `safeFirestoreOperation` **καταπίνει** — γι' αυτό οι Δ
 * διαδρομές (`getX`) σιωπούν από **δύο** μηχανισμούς. Οι Γ διαδρομές που
 * ελέγχονται εδώ καλούνται **χωρίς** fallback, άρα ανεβάζουν κανονικά.
 */

import type { AuthContext } from '@/lib/auth';

// ============================================================================
// MOCKS
// ============================================================================

const mockTimestamp = () => ({ seconds: 1700000000, nanoseconds: 0 });

jest.mock('firebase-admin', () => ({
  firestore: Object.assign(jest.fn(() => mockDb), {
    Timestamp: {
      now: jest.fn(() => mockTimestamp()),
      fromDate: jest.fn(() => mockTimestamp()),
    },
    FieldPath: { documentId: jest.fn(() => '__name__') },
  }),
}));

jest.mock('@/utils/firestore-sanitize', () => ({
  sanitizeForFirestore: jest.fn((x: unknown) => x),
}));

jest.mock('@/services/enterprise-id.service', () => ({
  generateMaterialId: jest.fn(() => 'mat_new'),
  generateFrameworkAgreementId: jest.fn(() => 'fa_new'),
  generateRfqLineId: jest.fn(() => 'rfqln_new'),
}));

jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn().mockResolvedValue(null) },
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

const mockLineDocRef = {
  get: jest.fn(),
  update: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
};
const mockLinesCollection = {
  doc: jest.fn(() => mockLineDocRef),
  orderBy: jest.fn().mockReturnThis(),
  get: jest.fn().mockResolvedValue({ docs: [] }),
  count: jest.fn().mockReturnThis(),
};
const mockDocRef = {
  get: jest.fn(),
  set: jest.fn().mockResolvedValue(undefined),
  update: jest.fn().mockResolvedValue(undefined),
  collection: jest.fn(() => mockLinesCollection),
};
const mockDb = {
  collection: jest.fn(() => ({
    doc: jest.fn(() => mockDocRef),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({ docs: [] }),
  })),
  batch: jest.fn(() => ({ set: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) })),
};

/** Η συναλλαγή διαβάζει με `tx.get(ref)` — άλλο μονοπάτι, ίδιος φύλακας. */
const mockTx = {
  get: jest.fn(() => mockDocRef.get()),
  update: jest.fn(),
};

jest.mock('@/lib/firebaseAdmin', () => ({
  safeFirestoreOperation: jest.fn(async (op: (db: typeof mockDb) => Promise<unknown>) =>
    op(mockDb),
  ),
  getAdminFirestore: jest.fn(() => ({
    ...mockDb,
    runTransaction: jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
  })),
  FieldValue: { arrayUnion: jest.fn(), arrayRemove: jest.fn(), increment: jest.fn() },
}));

// ============================================================================

import {
  getMaterial,
  updateMaterial,
  softDeleteMaterial,
} from '../material-service';
import {
  getFrameworkAgreement,
  updateFrameworkAgreement,
  softDeleteFrameworkAgreement,
} from '../framework-agreement-service';
import { updateRfqLine, deleteRfqLine, listRfqLines } from '../rfq-line-service';
import {
  getSourcingEvent,
  updateSourcingEvent,
  addRfqToSourcingEvent,
  removeRfqFromSourcingEvent,
  recomputeSourcingEventStatus,
} from '../sourcing-event-service';
import { getRfq, updateRfq } from '../rfq-service';
import { cancelRfq, reopenRfq } from '../rfq-lifecycle-service';
import { ProcurementCrossTenantError, ProcurementNotFoundError } from '../procurement-ownership';
import { EntityAuditService } from '@/services/entity-audit.service';

const ctx: AuthContext = { uid: 'u1', companyId: 'co1' } as AuthContext;

/** Έγγραφο όπως το δίνει το Firestore — το `companyId` είναι υπόσχεση, όχι γεγονός. */
function snapOf(data: Record<string, unknown>, id = 'doc1') {
  return { exists: true, id, data: () => data };
}
const MISSING = { exists: false, id: 'doc1', data: () => undefined };

beforeEach(() => {
  jest.clearAllMocks();
  mockLinesCollection.doc.mockReturnValue(mockLineDocRef);
  mockDocRef.collection.mockReturnValue(mockLinesCollection);
});

// ============================================================================
// Γ — ρητή άρνηση: η υπηρεσία λέει την ΑΛΗΘΕΙΑ, τυποποιημένα
// ============================================================================

describe('Γ — οι μεταβολές αρνούνται με τυποποιημένο σφάλμα', () => {
  const cases: ReadonlyArray<
    readonly [label: string, run: () => Promise<unknown>, resource: string]
  > = [
    ['updateMaterial', () => updateMaterial(ctx, 'mat1', { name: 'x' }), 'Material'],
    ['softDeleteMaterial', () => softDeleteMaterial(ctx, 'mat1'), 'Material'],
    [
      'updateFrameworkAgreement',
      () => updateFrameworkAgreement(ctx, 'fa1', { title: 'x' }),
      'Framework agreement',
    ],
    [
      'softDeleteFrameworkAgreement',
      () => softDeleteFrameworkAgreement(ctx, 'fa1'),
      'Framework agreement',
    ],
  ];

  describe.each(cases)('%s', (_label, run, resource) => {
    it('ρίχνει ProcurementCrossTenantError όταν το έγγραφο ανήκει αλλού', async () => {
      mockDocRef.get.mockResolvedValue(snapOf({ companyId: 'co_other', isDeleted: false }));
      await expect(run()).rejects.toBeInstanceOf(ProcurementCrossTenantError);
    });

    it('η άρνηση κουβαλά τον σωστό πόρο και τους δύο tenants', async () => {
      mockDocRef.get.mockResolvedValue(snapOf({ companyId: 'co_other', isDeleted: false }));
      await expect(run()).rejects.toMatchObject({
        resource,
        expectedCompanyId: 'co1',
        actualCompanyId: 'co_other',
      });
    });

    it('🔴 έγγραφο ΧΩΡΙΣ companyId δεν ανήκει σε κανέναν (η παγίδα του κενού)', async () => {
      mockDocRef.get.mockResolvedValue(snapOf({ isDeleted: false }));
      await expect(run()).rejects.toBeInstanceOf(ProcurementCrossTenantError);
    });

    it('ρίχνει τυποποιημένο ProcurementNotFoundError όταν λείπει', async () => {
      mockDocRef.get.mockResolvedValue(MISSING);
      await expect(run()).rejects.toBeInstanceOf(ProcurementNotFoundError);
    });

    it('δεν ρίχνει όταν το έγγραφο είναι δικό του', async () => {
      mockDocRef.get.mockResolvedValue(snapOf({ companyId: 'co1', isDeleted: false }));
      await expect(run()).resolves.not.toThrow();
    });
  });
});

describe('Γ — γραμμές RFQ', () => {
  it('updateRfqLine αρνείται ξένη γραμμή, τυποποιημένα', async () => {
    mockLineDocRef.get.mockResolvedValue(snapOf({ companyId: 'co_other' }, 'ln1'));
    await expect(updateRfqLine(ctx, 'rfq1', 'ln1', {})).rejects.toBeInstanceOf(
      ProcurementCrossTenantError,
    );
  });

  it('🔴 deleteRfqLine αρνείται ξένη γραμμή — δεν είχε ΚΑΝΕΝΑ test πριν', async () => {
    mockLineDocRef.get.mockResolvedValue(snapOf({ companyId: 'co_other' }, 'ln1'));
    await expect(deleteRfqLine(ctx, 'rfq1', 'ln1')).rejects.toBeInstanceOf(
      ProcurementCrossTenantError,
    );
    expect(mockLineDocRef.delete).not.toHaveBeenCalled();
  });

  it('🔴 deleteRfqLine: γραμμή χωρίς companyId δεν διαγράφεται από κανέναν', async () => {
    // Έγραφε `snap.data() as { companyId: string }` — υπόσχεση χωρίς απόδειξη (§7.5).
    mockLineDocRef.get.mockResolvedValue(snapOf({}, 'ln1'));
    await expect(deleteRfqLine(ctx, 'rfq1', 'ln1')).rejects.toBeInstanceOf(
      ProcurementCrossTenantError,
    );
    expect(mockLineDocRef.delete).not.toHaveBeenCalled();
  });

  it('deleteRfqLine διαγράφει τη δική του γραμμή', async () => {
    mockLineDocRef.get.mockResolvedValue(snapOf({ companyId: 'co1' }, 'ln1'));
    await deleteRfqLine(ctx, 'rfq1', 'ln1');
    expect(mockLineDocRef.delete).toHaveBeenCalledTimes(1);
  });

  it('🔴 ο γονέας φυλάει το παιδί: ξένο RFQ κλείνει και την ανάγνωση γραμμών', async () => {
    mockDocRef.get.mockResolvedValue(snapOf({ companyId: 'co_other' }, 'rfq1'));
    await expect(listRfqLines(ctx, 'rfq1')).rejects.toBeInstanceOf(ProcurementCrossTenantError);
  });

  it('🔴 RFQ χωρίς companyId δεν ανοίγει τις γραμμές του', async () => {
    mockDocRef.get.mockResolvedValue(snapOf({}, 'rfq1'));
    await expect(listRfqLines(ctx, 'rfq1')).rejects.toBeInstanceOf(ProcurementCrossTenantError);
  });
});

// ============================================================================
// Η ΔΙΑΔΙΚΑΣΙΑ SOFT-DELETE — τα βήματα 2 και 3 είναι συμβόλαιο
// ============================================================================

describe('soft-delete — ιδεμποτεντικό και πλήρες', () => {
  it('σβήνει: γράφει isDeleted ΚΑΙ updatedAt, και καταγράφει στο ίχνος ελέγχου', async () => {
    mockDocRef.get.mockResolvedValue(snapOf({ companyId: 'co1', code: 'A1', name: 'X' }, 'mat1'));

    await softDeleteMaterial(ctx, 'mat1');

    expect(mockDocRef.update).toHaveBeenCalledTimes(1);
    expect(mockDocRef.update).toHaveBeenCalledWith(
      expect.objectContaining({ isDeleted: true, updatedAt: expect.anything() }),
    );
    expect(EntityAuditService.recordChange).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: 'mat1',
        entityName: 'A1 — X',
        action: 'soft_deleted',
        companyId: 'co1',
      }),
    );
  });

  it('🔴 ήδη σβησμένο: ΚΑΜΙΑ δεύτερη εγγραφή, ΚΑΜΙΑ δεύτερη καταγραφή', async () => {
    mockDocRef.get.mockResolvedValue(snapOf({ companyId: 'co1', isDeleted: true }, 'mat1'));

    await softDeleteMaterial(ctx, 'mat1');

    expect(mockDocRef.update).not.toHaveBeenCalled();
    expect(EntityAuditService.recordChange).not.toHaveBeenCalled();
  });

  it('🔴 ξένο έγγραφο δεν σβήνεται και δεν αφήνει ίχνος', async () => {
    mockDocRef.get.mockResolvedValue(snapOf({ companyId: 'co_other' }, 'mat1'));

    await expect(softDeleteMaterial(ctx, 'mat1')).rejects.toBeInstanceOf(
      ProcurementCrossTenantError,
    );
    expect(mockDocRef.update).not.toHaveBeenCalled();
    expect(EntityAuditService.recordChange).not.toHaveBeenCalled();
  });

  it('η ίδια διαδικασία ισχύει για τα framework agreements', async () => {
    mockDocRef.get.mockResolvedValue(
      snapOf({ companyId: 'co1', agreementNumber: 'FA-1', title: 'T' }, 'fa1'),
    );

    await softDeleteFrameworkAgreement(ctx, 'fa1');

    expect(EntityAuditService.recordChange).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'fa1', entityName: 'FA-1 — T', action: 'soft_deleted' }),
    );
  });
});

// ============================================================================
// Γ — παρτίδα β2: κύκλος ζωής RFQ + γεγονότα προμήθειας
// ============================================================================

describe('Γ — β2: οι μεταβολές αρνούνται τυποποιημένα', () => {
  const cases: ReadonlyArray<readonly [string, () => Promise<unknown>, string]> = [
    ['updateRfq', () => updateRfq(ctx, 'rfq1', { title: 'x' }), 'RFQ'],
    ['cancelRfq', () => cancelRfq(ctx, 'rfq1', {}), 'RFQ'],
    ['reopenRfq', () => reopenRfq(ctx, 'rfq1'), 'RFQ'],
    [
      'updateSourcingEvent',
      () => updateSourcingEvent(ctx, 'ev1', { title: 'x' }),
      'SourcingEvent',
    ],
  ];

  describe.each(cases)('%s', (_label, run, resource) => {
    it('ξένο έγγραφο → ProcurementCrossTenantError με τον σωστό πόρο', async () => {
      mockDocRef.get.mockResolvedValue(snapOf({ companyId: 'co_other', status: 'closed' }));
      await expect(run()).rejects.toBeInstanceOf(ProcurementCrossTenantError);
      await expect(run()).rejects.toMatchObject({ resource, expectedCompanyId: 'co1' });
    });

    it('🔴 έγγραφο χωρίς companyId δεν ανήκει σε κανέναν', async () => {
      mockDocRef.get.mockResolvedValue(snapOf({ status: 'closed' }));
      await expect(run()).rejects.toBeInstanceOf(ProcurementCrossTenantError);
    });

    it('ανύπαρκτο → ProcurementNotFoundError', async () => {
      mockDocRef.get.mockResolvedValue(MISSING);
      await expect(run()).rejects.toBeInstanceOf(ProcurementNotFoundError);
    });
  });
});

// ============================================================================
// 🔴 ΟΙ ΣΥΝΑΛΛΑΓΕΣ — `tx.get()`, ΙΔΙΟΣ ΦΥΛΑΚΑΣ
// ============================================================================

describe('Γ — β2: οι τρεις συναλλαγές του sourcing-event', () => {
  // Το τρίτο στοιχείο είναι τα `rfqIds` που κάνουν τη **δική** του πράξη να
  // γράψει: η αποσύνδεση είναι ιδεμποτεντική και δεν γράφει αν το RFQ λείπει.
  const txCases: ReadonlyArray<readonly [string, () => Promise<unknown>, string[]]> = [
    ['addRfqToSourcingEvent', () => addRfqToSourcingEvent(ctx, 'ev1', 'rfq1'), []],
    ['removeRfqFromSourcingEvent', () => removeRfqFromSourcingEvent(ctx, 'ev1', 'rfq1'), ['rfq1']],
    ['recomputeSourcingEventStatus', () => recomputeSourcingEventStatus(ctx, 'ev1'), []],
  ];

  describe.each(txCases)('%s', (_label, run, ownedRfqIds) => {
    it('ξένο γεγονός → άρνηση, και ΚΑΜΙΑ εγγραφή μέσα στη συναλλαγή', async () => {
      mockDocRef.get.mockResolvedValue(
        snapOf({ companyId: 'co_other', rfqIds: [], rfqCount: 0, closedRfqCount: 0, status: 'draft' }),
      );
      await expect(run()).rejects.toBeInstanceOf(ProcurementCrossTenantError);
      expect(mockTx.update).not.toHaveBeenCalled();
    });

    it('🔴 γεγονός χωρίς companyId δεν τροποποιείται από κανέναν', async () => {
      mockDocRef.get.mockResolvedValue(
        snapOf({ rfqIds: [], rfqCount: 0, closedRfqCount: 0, status: 'draft' }),
      );
      await expect(run()).rejects.toBeInstanceOf(ProcurementCrossTenantError);
      expect(mockTx.update).not.toHaveBeenCalled();
    });

    it('ανύπαρκτο → ProcurementNotFoundError', async () => {
      mockDocRef.get.mockResolvedValue(MISSING);
      await expect(run()).rejects.toBeInstanceOf(ProcurementNotFoundError);
    });

    it('δικό του γεγονός περνά και γράφει', async () => {
      mockDocRef.get.mockResolvedValue(
        snapOf({
          companyId: 'co1',
          rfqIds: ownedRfqIds,
          rfqCount: ownedRfqIds.length,
          closedRfqCount: 0,
          status: 'draft',
        }),
      );
      await run();
      expect(mockTx.update).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// Δ — σιωπή: ξένο ≡ ανύπαρκτο
// ============================================================================

describe('Δ — οι αναγνώσεις σιωπούν', () => {
  it('getMaterial: ξένο έγγραφο δίνει null, ακριβώς όπως το ανύπαρκτο', async () => {
    mockDocRef.get.mockResolvedValue(snapOf({ companyId: 'co_other' }, 'mat1'));
    const foreign = await getMaterial(ctx, 'mat1');

    mockDocRef.get.mockResolvedValue(MISSING);
    const missing = await getMaterial(ctx, 'mat1');

    expect(foreign).toBeNull();
    expect(foreign).toEqual(missing);
  });

  it('getFrameworkAgreement: ίδια σιωπή', async () => {
    mockDocRef.get.mockResolvedValue(snapOf({ companyId: 'co_other' }, 'fa1'));
    expect(await getFrameworkAgreement(ctx, 'fa1')).toBeNull();
  });

  it('🔴 έγγραφο χωρίς companyId δεν επιστρέφεται σιωπηλά σε κανέναν', async () => {
    mockDocRef.get.mockResolvedValue(snapOf({}, 'mat1'));
    expect(await getMaterial(ctx, 'mat1')).toBeNull();
  });

  it('το δικό του έγγραφο επιστρέφεται κανονικά', async () => {
    mockDocRef.get.mockResolvedValue(snapOf({ companyId: 'co1', code: 'A1' }, 'mat1'));
    expect(await getMaterial(ctx, 'mat1')).toMatchObject({ id: 'mat1', companyId: 'co1' });
  });

  it('getSourcingEvent: ξένο ≡ ανύπαρκτο', async () => {
    mockDocRef.get.mockResolvedValue(snapOf({ companyId: 'co_other' }, 'ev1'));
    const foreign = await getSourcingEvent(ctx, 'ev1');
    mockDocRef.get.mockResolvedValue(MISSING);
    expect(foreign).toEqual(await getSourcingEvent(ctx, 'ev1'));
    expect(foreign).toBeNull();
  });

  /**
   * 🔴 Το `getRfq` δέχεται **σκέτο `companyId`**, όχι `ctx` — γιατί το καλεί
   * **και** το δημόσιο vendor portal με `invite.companyId` (HMAC token, μηδέν
   * ρόλος). Εκεί δεν υπάρχει ρόλος να ρωτηθεί, άρα η σιωπή είναι η **μόνη**
   * σωστή απάντηση: ένα ειλικρινές «ανήκει αλλού» θα μαρτυρούσε ύπαρξη RFQ σε
   * κάποιον που απέδειξε μόνο ότι κρατά ένα token (ADR-742 §7ter.5).
   */
  it('🔴 getRfq: σιωπά και στα ΔΥΟ μονοπάτια — ταυτοποιημένο και δημόσιο', async () => {
    mockDocRef.get.mockResolvedValue(snapOf({ companyId: 'co_other' }, 'rfq1'));

    const authenticated = await getRfq(ctx.companyId, 'rfq1');
    const publicPortal = await getRfq('co_from_invite', 'rfq1');

    expect(authenticated).toBeNull();
    expect(publicPortal).toBeNull();
  });

  it('🔴 getRfq: RFQ χωρίς companyId δεν ανοίγει σε καλούντα με χαλασμένο token', async () => {
    mockDocRef.get.mockResolvedValue(snapOf({}, 'rfq1'));
    expect(await getRfq('', 'rfq1')).toBeNull();
  });
});
