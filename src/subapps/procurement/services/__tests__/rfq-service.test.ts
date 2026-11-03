import type { AuthContext } from '@/lib/auth';
import type { RFQ } from '../../types/rfq';

// ============================================================================
// MOCKS
// ============================================================================

const mockTimestamp = () => ({ seconds: 1700000000, nanoseconds: 0 });

/**
 * ⚠️ Το `firebase-admin` εκθέτει το `firestore` **και ως συνάρτηση και ως
 * χώρο ονομάτων**: `admin.firestore()` δίνει το instance, `admin.firestore.Timestamp`
 * τους τύπους. Το mock όριζε **μόνο** τον χώρο ονομάτων, οπότε το
 * `admin.firestore()` του fan-out έσκαγε με `is not a function` και **ολόκληρη
 * η σουίτα δεν φόρτωνε** ("Test suite failed to run" — όχι αποτυχία ισχυρισμού,
 * γι' αυτό δεν φαινόταν ως σπασμένος ισχυρισμός πουθενά).
 *
 * Το `mockDb` δηλώνεται πιο κάτω· η αναφορά είναι **τεμπέλικη** (μέσα στο σώμα
 * της `jest.fn`), άρα αποτιμάται στην κλήση, όχι στο hoisting.
 */
jest.mock('firebase-admin', () => ({
  firestore: Object.assign(jest.fn(() => mockDb), {
    Timestamp: {
      now: jest.fn(() => mockTimestamp()),
      fromDate: jest.fn((d: Date) => mockTimestamp()),
      fromMillis: jest.fn(() => mockTimestamp()),
    },
    FieldPath: { documentId: jest.fn(() => '__name__') },
  }),
}));

jest.mock('@/utils/firestore-sanitize', () => ({
  sanitizeForFirestore: jest.fn((x: unknown) => x),
}));

jest.mock('@/services/enterprise-id.service', () => ({
  generateRfqId: jest.fn(() => 'rfq_test123'),
  generateVendorInviteId: (() => {
    let n = 0;
    return jest.fn(() => `vinv_${++n}`);
  })(),
}));

/**
 * ADR-876 §5 — ο **πραγματικός** κατασκευαστής (`vendor-invite-issue`) τρέχει· mock μόνο η
 * έκδοση του διαπιστευτηρίου (τυχαιότητα + μυστικό) και οι απόλυτοι σύνδεσμοι (origin).
 */
jest.mock('@/services/vendor-portal/vendor-invite-credential', () => ({
  vendorLinkExpiryMs: jest.fn((nowMs: number) => nowMs + 7 * 24 * 60 * 60 * 1000),
  mintVendorInviteCredential: jest.fn(async (input: { inviteId: string; rfqId: string; companyId: string }) => ({
    credential: { id: `vic_${input.inviteId}`, inviteId: input.inviteId, rfqId: input.rfqId, companyId: input.companyId, nonceHash: 'hash', expiresAt: '2026-12-31T00:00:00.000Z' },
    token: `tok_${input.inviteId}`,
  })),
}));

jest.mock('../vendor-portal-links', () => ({
  vendorPortalUrl: jest.fn((token: string) => `https://app.test/vendor/quote#t=${token}`),
  vendorDeclineUrl: jest.fn((token: string) => `https://app.test/vendor/quote#t=${token}&intent=decline`),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('@/lib/date-local', () => ({
  normalizeToDate: jest.fn((v: unknown) => (v ? new Date('2026-12-31') : null)),
}));

jest.mock('../../data/trades', () => ({
  getTradeCodeForAtoeCategory: jest.fn(() => null),
}));

// Sub-service mocks
const mockRecomputeStatus = jest.fn().mockResolvedValue('partial');

// ADR-923 §5.13 Τ4 — η δημιουργία RFQ ζει πλέον στο σχέδιο + τη συναλλαγή (`rfq-create.test.ts`, πάνω στο ψεύτικο
// Firestore). Εδώ οι εξαρτήσεις τους είναι κενά stubs, ώστε η σουίτα να φορτώνει χωρίς τον κατάλογο.
jest.mock('@/server/supply-relationships/supply-quote-sku.server', () => ({ resolveQuoteSku: jest.fn() }));
jest.mock('@/services/public-catalog/public-catalog.reader', () => ({ readPublicSupplier: jest.fn() }));
jest.mock('@/server/catalog/public/public-model-snapshot.server', () => ({ supplierAcceptsQuotesInTx: jest.fn() }));
jest.mock('@/services/contact/platform-company-contact-resolver', () => ({ resolvePlatformCompanyContact: jest.fn() }));
jest.mock('@/services/contact/account-contact-resolver', () => ({ recordAccountContactBirth: jest.fn() }));
jest.mock('@/server/lib/performer-stamp', () => ({ resolvePerformer: jest.fn() }));
jest.mock('@/services/enterprise-id-convenience-catalog', () => ({ generateDeterministicPlatformCompanyContactId: jest.fn() }));

jest.mock('../sourcing-event-service', () => ({
  recomputeSourcingEventStatus: (...args: unknown[]) => mockRecomputeStatus(...args),
}));

// Firestore mocks
const mockBatch = {
  set: jest.fn(),
  update: jest.fn(),
  commit: jest.fn().mockResolvedValue(undefined),
};
const mockDocRef = {
  set: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  update: jest.fn().mockResolvedValue(undefined),
};
const mockQuery = {
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  get: jest.fn().mockResolvedValue({ docs: [] }),
};
const mockCollection = jest.fn(() => ({ ...mockQuery, doc: jest.fn(() => mockDocRef) }));
const mockDb = {
  collection: mockCollection,
  batch: jest.fn(() => mockBatch),
};

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => mockDb,
  // Transparent mock — errors propagate; !rfq guard in createRfq handles undefined
  safeFirestoreOperation: jest.fn(async (op: (db: typeof mockDb) => Promise<unknown>) => {
    try { return await op(mockDb); } catch { return undefined; }
  }),
  FieldValue: {
    arrayUnion: jest.fn((...args: unknown[]) => ({ _arrayUnion: args })),
    increment: jest.fn((n: number) => ({ _increment: n })),
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

const ctx: AuthContext = { uid: 'u1', companyId: 'co1' } as AuthContext;

function makeRfqSnap(overrides: Partial<RFQ> = {}) {
  const rfq: Partial<RFQ> = {
    id: 'rfq_test123',
    companyId: 'co1',
    projectId: 'proj1',
    status: 'draft',
    invitedVendorIds: [],
    lines: [],
    auditTrail: [],
    sourcingEventId: null,
    ...overrides,
  };
  return { exists: true, id: rfq.id, data: () => rfq };
}

// ============================================================================
// TESTS
// ============================================================================

import { createRfqFromBoqItems, updateRfq } from '../rfq-service';

beforeEach(() => jest.clearAllMocks());

describe('updateRfq — Q31 status propagation', () => {
  it('calls recomputeSourcingEventStatus when RFQ closes with parent event', async () => {
    mockDocRef.get.mockResolvedValueOnce(
      makeRfqSnap({ status: 'active', sourcingEventId: 'sevent_parent' }),
    );

    await updateRfq(ctx, 'rfq_test123', { status: 'closed' });

    expect(mockRecomputeStatus).toHaveBeenCalledWith(ctx, 'sevent_parent');
  });

  it('does not call recomputeStatus when no sourcingEventId', async () => {
    mockDocRef.get.mockResolvedValueOnce(
      makeRfqSnap({ status: 'active', sourcingEventId: null }),
    );

    await updateRfq(ctx, 'rfq_test123', { status: 'closed' });

    expect(mockRecomputeStatus).not.toHaveBeenCalled();
  });

  it('does not call recomputeStatus when status unchanged', async () => {
    mockDocRef.get.mockResolvedValueOnce(
      makeRfqSnap({ status: 'closed', sourcingEventId: 'sevent_parent' }),
    );

    await updateRfq(ctx, 'rfq_test123', { status: 'closed' });

    expect(mockRecomputeStatus).not.toHaveBeenCalled();
  });
});

describe('responseLock — ADR-327 §8.5 Β', () => {
  it('αλλαγή ⇒ γραμμή ιστορικού· ίδια τιμή ⇒ καμία (ιδεμποτικό)', async () => {
    mockDocRef.get.mockResolvedValueOnce(makeRfqSnap({ status: 'active' }));
    const changed = await updateRfq(ctx, 'rfq_test123', { responseLock: { quantity: true, unit: false } });
    expect(changed.responseLock).toEqual({ quantity: true, unit: false });
    expect(changed.auditTrail.at(-1)).toMatchObject({
      action: 'response_lock_change', detail: 'quantity:off,unit:off → quantity:on,unit:off',
    });

    mockDocRef.get.mockResolvedValueOnce(makeRfqSnap({ status: 'active', responseLock: { quantity: true, unit: false } }));
    const same = await updateRfq(ctx, 'rfq_test123', { responseLock: { quantity: true, unit: false } });
    expect(same.auditTrail.some((e) => e.action === 'response_lock_change')).toBe(false);
  });

  it('μετά την ανάθεση οι όροι δεν αλλάζουν', async () => {
    mockDocRef.get.mockResolvedValueOnce(makeRfqSnap({ status: 'active', winnerQuoteId: 'qt_1' }));
    // (το mock του `safeFirestoreOperation` καταπίνει το σφάλμα — ο πραγματικός το ξαναρίχνει· εδώ: καμία εγγραφή)
    mockDocRef.update.mockClear();
    await updateRfq(ctx, 'rfq_test123', { responseLock: { quantity: true, unit: true } });
    expect(mockDocRef.update).not.toHaveBeenCalled();
  });
});

describe('createRfqFromBoqItems — ADR-327 P5-BOQ keeps the BOQ link (ADR-330 §5.1 S3.2)', () => {
  it('every pre-filled line carries the boqItemId it came from — else the builder sends it ad-hoc', async () => {
    const boqDoc = (id: string) => ({
      id,
      data: () => ({ companyId: 'co1', projectId: 'proj1', buildingId: null, categoryCode: 'OIK-2', title: `Εργασία ${id}`, estimatedQuantity: 3, unit: 'm2' }),
    });
    mockQuery.get.mockResolvedValueOnce({ docs: [boqDoc('boq_a'), boqDoc('boq_b')] });
    const draft = await createRfqFromBoqItems(ctx, ['boq_a', 'boq_b']);
    expect(draft.lines.map((l) => l.boqItemId)).toEqual(['boq_a', 'boq_b']);
  });

  it('a BOQ item of another tenant never becomes a line', async () => {
    mockQuery.get.mockResolvedValueOnce({ docs: [{ id: 'boq_x', data: () => ({ companyId: 'other', projectId: 'p', title: 'x' }) }] });
    const draft = await createRfqFromBoqItems(ctx, ['boq_x']);
    expect(draft.lines).toEqual([]);
  });
});
