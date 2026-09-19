/**
 * @jest-environment node
 *
 * ⚠️ **`node`, ΟΧΙ jsdom**: το `next/server` χρειάζεται τα καθολικά `Request`/`Response`
 * κατά την εισαγωγή (ίδιο μάθημα με `workspace-denial-boundary.test.ts`).
 */

/**
 * ⚓ ADR-868 — **το σύνορο της triage του AI Inbox κρίνει ΜΟΝΟ του**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΦΥΛΑΕΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * Μέχρι 2026-09-19 η έγκριση/απόρριψη ήταν server actions που δέχονταν
 * `adminUid` + `companyId` από τον πελάτη. Εδώ ασκείται η **πραγματική** αλυσίδα
 * `defineRoute → withAuth → υπηρεσία` — προσομοιωμένα είναι μόνο: η **πηγή** της
 * ταυτότητας (`buildRequestContext`), η βάση (μνήμης), το rate limit και το audit.
 *
 * 🔑 Κάθε άγκυρα απαντά «**ποιος αποφασίζει;**»: ο καλών δεν μπορεί να ορίσει
 * ούτε ταυτότητα, ούτε εταιρεία, ούτε ανάθεση — και ο διαχειριστής χωρίς MFA δεν
 * περνά από το API εκεί όπου η σελίδα τον σταματά.
 *
 * @module api/admin/ai-inbox/communications/[communicationId]/triage/__tests__
 */

jest.mock('@/lib/auth/auth-context', () => ({
  buildRequestContext: jest.fn(),
}));

jest.mock('@/lib/middleware/with-rate-limit', () => {
  const pass = <T>(handler: T) => handler;
  return {
    withAssetRateLimit: pass, withHighRateLimit: pass, withStandardRateLimit: pass,
    withSensitiveRateLimit: pass, withHeavyRateLimit: pass, withWebhookRateLimit: pass,
    withTelegramRateLimit: pass,
  };
});

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: jest.fn(),
  getAdminAuth: jest.fn(),
}));

jest.mock('@/lib/auth/audit', () => ({
  logCommunicationApproved: jest.fn(async () => undefined),
  logCommunicationRejected: jest.fn(async () => undefined),
}));

jest.mock('@/services/assignment/AssignmentPolicyRepository', () => ({
  getCompanyWidePolicyAdmin: jest.fn(async () => null),
  getProjectPolicyAdmin: jest.fn(async () => null),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

import { NextRequest } from 'next/server';
import { buildRequestContext } from '@/lib/auth/auth-context';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { logCommunicationApproved } from '@/lib/auth/audit';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createMockFirestore, type MockFirestoreKit } from '@/test-utils/mock-firestore';
import type { AuthContext, GlobalRole } from '@/lib/auth/types';
import { POST } from '../route';

const COMM_ID = 'msg_triage_001';
const OWNER = 'comp_OWNER';
const INTRUDER = 'comp_INTRUDER';

let kit: MockFirestoreKit;

function caller(overrides: Partial<AuthContext> & { globalRole?: GlobalRole } = {}): AuthContext {
  return {
    uid: 'admin_owner', email: 'admin@owner.test', companyId: OWNER,
    globalRole: 'company_admin', mfaEnrolled: true, isAuthenticated: true,
    ...overrides,
  };
}

function signIn(ctx: AuthContext | { isAuthenticated: false; reason: string }): void {
  (buildRequestContext as jest.Mock).mockResolvedValue(ctx);
}

async function post(body: unknown, communicationId = COMM_ID) {
  const request = new NextRequest(
    `https://nestorconstruct.gr/api/admin/ai-inbox/communications/${communicationId}/triage`,
    { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } },
  );
  const response = await POST(request, { params: Promise.resolve({ communicationId }) });
  return { status: response.status, body: await response.json() };
}

function tasksWritten() {
  return kit.writes().filter((w) => w.collection === COLLECTIONS.TASKS);
}

beforeEach(() => {
  jest.clearAllMocks();
  kit = createMockFirestore();
  (getAdminFirestore as jest.Mock).mockReturnValue(kit.instance);
  kit.seedCollection(COLLECTIONS.MESSAGES, {
    [COMM_ID]: { id: COMM_ID, companyId: OWNER, triageStatus: 'pending', from: 'x@y.gr', content: 'hi' },
  });
  kit.clearWrites();
});

// =============================================================================
// Α. Η ΤΑΥΤΟΤΗΤΑ ΚΡΙΝΕΤΑΙ ΣΤΟ ΣΥΝΟΡΟ — ΠΡΙΝ ΑΓΓΙΧΤΕΙ Η ΒΑΣΗ
// =============================================================================

describe('Α. Ποιος ρωτά — το σύνορο, ποτέ ο πελάτης', () => {
  it('Α1 — χωρίς συνεδρία ⇒ 401 και ΜΗΔΕΝ εγγραφές (η παλιά action έτρεχε)', async () => {
    signIn({ isAuthenticated: false, reason: 'missing_token' });

    const res = await post({ decision: 'approve' });

    expect(res.status).toBe(401);
    expect(kit.writes()).toEqual([]);
  });

  it('Α2 — ρόλος εκτός κονσόλας (`internal_user`) ⇒ 403 ROLE_REQUIRED', async () => {
    signIn(caller({ globalRole: 'internal_user' }));

    const res = await post({ decision: 'approve' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ROLE_REQUIRED');
    expect(kit.writes()).toEqual([]);
  });

  it('Α3 — διαχειριστής ΧΩΡΙΣ MFA ⇒ 403 MFA_REQUIRED (ίδια πόρτα με τη σελίδα)', async () => {
    signIn(caller({ mfaEnrolled: false }));

    const res = await post({ decision: 'approve' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('MFA_REQUIRED');
    expect(kit.writes()).toEqual([]);
  });

  it('Α4 — σώμα με `adminUid`/`companyId` ⇒ 400: δεν «αγνοείται», απορρίπτεται', async () => {
    signIn(caller());

    const res = await post({ decision: 'approve', adminUid: 'someone_else', companyId: INTRUDER });

    expect(res.status).toBe(400);
    expect(kit.writes()).toEqual([]);
  });
});

// =============================================================================
// Β. ΞΕΝΟ ΜΗΝΥΜΑ — Ο ΕΛΕΓΧΟΣ ΙΔΙΟΚΤΗΣΙΑΣ ΚΡΙΝΕΙ ΠΑΝΩ ΣΤΗΝ ΕΤΑΙΡΕΙΑ ΤΟΥ TOKEN
// =============================================================================

describe('Β. Ξένο μήνυμα', () => {
  it('Β1 — διαχειριστής άλλης εταιρείας ⇒ 404 ΤΑΥΤΟΣΗΜΟ με το «δεν υπάρχει» (κανένα μαντείο)', async () => {
    signIn(caller({ uid: 'admin_intruder', companyId: INTRUDER }));
    const foreign = await post({ decision: 'approve' });
    const missing = await post({ decision: 'approve' }, 'msg_does_not_exist');

    expect(foreign.status).toBe(404);
    expect(foreign.status).toBe(missing.status);
    // Ό,τι μπορεί να γίνει μαντείο (μήνυμα, κωδικός) είναι ΙΔΙΟ· διαφέρουν μόνο τα πεδία
    // ανά αίτημα (`requestId`, `timestamp`), που τα προσθέτει ο `apiErrorHandler` σε κάθε απάντηση.
    const oracle = ({ requestId: _r, timestamp: _t, ...rest }: Record<string, unknown>) => rest;
    expect(oracle(foreign.body)).toEqual(oracle(missing.body));
    expect(kit.writes()).toEqual([]);
  });

  it('Β2 — ο bypass ρόλος (ήδη καθολική ορατότητα) παίρνει την ειλικρινή άρνηση 403 — χωρίς εγγραφή', async () => {
    signIn(caller({ uid: 'super_1', companyId: INTRUDER, globalRole: 'super_admin' }));

    const res = await post({ decision: 'reject' });

    expect(res.status).toBe(403);
    expect(kit.writes()).toEqual([]);
  });
});

// =============================================================================
// Γ. Η ΕΠΙΤΥΧΙΑ ΓΡΑΦΕΙ ΤΗΝ ΤΑΥΤΟΤΗΤΑ ΤΟΥ TOKEN — ΟΧΙ ΤΟΥ ΣΩΜΑΤΟΣ
// =============================================================================

describe('Γ. Νόμιμη απόφαση', () => {
  it('Γ1 — approve: η εργασία ανατίθεται στον ΕΠΑΛΗΘΕΥΜΕΝΟ καλούντα, στην εταιρεία ΤΟΥ', async () => {
    signIn(caller());

    const res = await post({ decision: 'approve' });

    expect(res.status).toBe(200);
    expect(res.body.data.taskId).toEqual(expect.any(String));
    const [task] = tasksWritten();
    expect(task.data).toMatchObject({ assignedTo: 'admin_owner', companyId: OWNER });
    expect(kit.writes()).toContainEqual(expect.objectContaining({
      kind: 'update', collection: COLLECTIONS.MESSAGES, docId: COMM_ID,
      data: expect.objectContaining({ triageStatus: 'approved' }),
    }));
  });

  it('Γ2 — το ίχνος ελέγχου γράφει τον ΠΡΑΓΜΑΤΙΚΟ ρόλο (όχι κατασκευασμένο `company_admin`)', async () => {
    signIn(caller({ uid: 'super_home', globalRole: 'super_admin' }));

    await post({ decision: 'approve' });

    const [actor] = (logCommunicationApproved as jest.Mock).mock.calls[0];
    expect(actor).toMatchObject({ uid: 'super_home', globalRole: 'super_admin', email: 'admin@owner.test' });
  });

  it('Γ3 — reject: 200, κατάσταση `rejected`, καμία εργασία', async () => {
    signIn(caller());

    const res = await post({ decision: 'reject' });

    expect(res.status).toBe(200);
    expect(tasksWritten()).toEqual([]);
    expect(kit.writes()).toContainEqual(expect.objectContaining({
      kind: 'update', docId: COMM_ID, data: expect.objectContaining({ triageStatus: 'rejected' }),
    }));
  });
});
