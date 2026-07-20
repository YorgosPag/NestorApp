/**
 * Regression anchor — ADR-438 TTL fields must survive `removeUndefinedValues`.
 *
 * ΙΣΤΟΡΙΚΟ ΤΟΥ BUG: `removeUndefinedValues` αναδρομούσε σε ΚΑΘΕ `typeof value === 'object'`.
 * Τα `Date` και τα `FieldValue.serverTimestamp()` sentinels δεν έχουν own enumerable
 * properties (`Object.entries(new Date())` === `[]`) — η αναδρομή τα μετέτρεπε σε `{}`,
 * και ο κλάδος «κενό αντικείμενο ⇒ πέτα το κλειδί» τα εξαφάνιζε εντελώς. Κάθε audit
 * document γραφόταν ΧΩΡΙΣ `expiresAt` και ΧΩΡΙΣ `timestamp` — το TTL policy του ADR-438
 * δεν είχε πεδίο να τηρήσει, retention σιωπηλά άπειρο (2026-06-10 → 2026-07-20).
 *
 * Η διόρθωση: ένα `isPlainObject()` type guard φρουρεί την αναδρομή — μόνο πραγματικά
 * "σκέτα" αντικείμενα σαρώνονται, Date/FieldValue/Timestamp περνούν αυτούσια.
 *
 * Το test εδώ περνάει ΑΠΟΚΛΕΙΣΤΙΚΑ από το PUBLIC API (`logAuditEvent`) — δοκιμάζει
 * το observable contract «το payload που φτάνει στο Firestore `.set()` έχει
 * `expiresAt`/`timestamp`», όχι την ιδιωτική `removeUndefinedValues`. Ένα refactor
 * που ξαναχαλάει τη recursion θα σκάσει εδώ, όχι μόνο σε ένα unit test του helper.
 */

// Chainable Firestore double, ΟΛΑ δηλωμένα ΜΕΣΑ στο factory (SSoT pattern του repo —
// βλ. bim-floor-wipe.service.test.ts) ώστε να μην υπάρχει θέμα jest.mock hoisting.
jest.mock('@/lib/firebaseAdmin', () => {
  const setMock = jest.fn().mockResolvedValue(undefined);
  // NOT a plain object literal: the real `FieldValue.serverTimestamp()` returns a
  // class instance whose prototype is NOT `Object.prototype`, which is exactly what
  // `isPlainObject()` keys off to leave it untouched. A `{ ... }` literal here would
  // itself look "plain" to the guard and get recursed-into like a real bug case would —
  // that would make the identity assertion below pass for the WRONG reason.
  class ServerTimestampSentinel {}
  const SERVER_TIMESTAMP_SENTINEL = new ServerTimestampSentinel();

  const doc2 = { set: setMock };
  const collection2 = { doc: () => doc2 };
  const doc1 = { collection: () => collection2 };
  const collection1 = { doc: () => doc1 };
  const db = { collection: () => collection1 };

  return {
    getAdminFirestore: () => db,
    isFirebaseAdminAvailable: () => true,
    FieldValue: { serverTimestamp: () => SERVER_TIMESTAMP_SENTINEL },
    __setMock: setMock,
    __SERVER_TIMESTAMP_SENTINEL: SERVER_TIMESTAMP_SENTINEL,
  };
});

jest.mock('@/services/company-document.service', () => ({
  validateCompanyExists: jest.fn().mockResolvedValue(true),
  ensureCompanyDocument: jest.fn().mockResolvedValue(undefined),
}));

import { logAuditEvent } from '../audit-core';
import type { AuthContext } from '../types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const firebaseAdminMock = require('@/lib/firebaseAdmin') as {
  __setMock: jest.Mock;
  __SERVER_TIMESTAMP_SENTINEL: object;
};

function ctx(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    uid: 'user_1',
    email: 'user@example.com',
    companyId: 'comp_1',
    globalRole: 'internal_user',
    mfaEnrolled: false,
    isAuthenticated: true,
    ...overrides,
  };
}

beforeEach(() => {
  firebaseAdminMock.__setMock.mockClear();
});

describe('logAuditEvent — persisted payload keeps TTL/timestamp sentinels', () => {
  it('the payload handed to Firestore .set() carries an own expiresAt Date (not {})', async () => {
    await logAuditEvent(ctx(), 'data_updated', 'target_1', 'project', {});

    expect(firebaseAdminMock.__setMock).toHaveBeenCalledTimes(1);
    const written = firebaseAdminMock.__setMock.mock.calls[0][0] as Record<string, unknown>;

    expect(Object.prototype.hasOwnProperty.call(written, 'expiresAt')).toBe(true);
    expect(written.expiresAt).toBeInstanceOf(Date);
  });

  it('the payload keeps an own timestamp property equal to the serverTimestamp() sentinel (not {})', async () => {
    await logAuditEvent(ctx(), 'data_updated', 'target_2', 'project', {});

    const written = firebaseAdminMock.__setMock.mock.calls[0][0] as Record<string, unknown>;

    expect(Object.prototype.hasOwnProperty.call(written, 'timestamp')).toBe(true);
    // Identity check: it must be the EXACT sentinel object our FieldValue mock returned,
    // not a plain {} that a broken recursion would have collapsed it into.
    expect(written.timestamp).toBe(firebaseAdminMock.__SERVER_TIMESTAMP_SENTINEL);
  });

  it('nested plain-object metadata cleaning still works: undefined fields dropped, defined fields survive', async () => {
    await logAuditEvent(ctx(), 'data_updated', 'target_3', 'project', {
      metadata: {
        ipAddress: '1.2.3.4',
        userAgent: undefined,
        path: '/api/projects/target_3',
        reason: undefined,
      },
    });

    const written = firebaseAdminMock.__setMock.mock.calls[0][0] as Record<string, unknown>;
    const metadata = written.metadata as Record<string, unknown>;

    expect(metadata.ipAddress).toBe('1.2.3.4');
    expect(metadata.path).toBe('/api/projects/target_3');
    expect(Object.prototype.hasOwnProperty.call(metadata, 'userAgent')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(metadata, 'reason')).toBe(false);
  });

  it('a blocking-tier action (data_updated, compliance) awaits the write — set() has been called by the time the await resolves', async () => {
    await logAuditEvent(ctx({ uid: 'user_blocking' }), 'data_updated', 'target_4', 'project', {});

    expect(firebaseAdminMock.__setMock).toHaveBeenCalledTimes(1);
  });

  it('expiresAt reflects the tier: access (1mo) < compliance (12mo) < security (24mo)', async () => {
    const before = Date.now();

    // data_updated: compliance tier, blocking — awaited directly.
    await logAuditEvent(
      ctx({ uid: 'actor_compliance', companyId: 'comp_compliance' }),
      'data_updated',
      'target_compliance',
      'project',
      {}
    );
    const complianceEntry = firebaseAdminMock.__setMock.mock.calls[
      firebaseAdminMock.__setMock.mock.calls.length - 1
    ][0] as Record<string, unknown>;

    // access_denied: security tier, blocking — awaited directly.
    await logAuditEvent(
      ctx({ uid: 'actor_security', companyId: 'comp_security' }),
      'access_denied',
      'target_security',
      'project',
      {}
    );
    const securityEntry = firebaseAdminMock.__setMock.mock.calls[
      firebaseAdminMock.__setMock.mock.calls.length - 1
    ][0] as Record<string, unknown>;

    // data_accessed: access tier, ASYNC fire-and-forget. Χωρίς `dedupable` ⇒ καμία
    // καταστολή (ADR-438 v3: dedup opt-in) — γράφεται πάντα.
    await logAuditEvent(
      ctx({ uid: 'actor_access_unique', companyId: 'comp_access_unique' }),
      'data_accessed',
      'target_access_unique',
      'project',
      {}
    );
    // Flush the microtask + macrotask queue so the fire-and-forget persistAuditEntry()
    // (which itself awaits validateCompanyExists before calling .set()) has run.
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const accessEntry = firebaseAdminMock.__setMock.mock.calls[
      firebaseAdminMock.__setMock.mock.calls.length - 1
    ][0] as Record<string, unknown>;

    const complianceExpiry = (complianceEntry.expiresAt as Date).getTime();
    const securityExpiry = (securityEntry.expiresAt as Date).getTime();
    const accessExpiry = (accessEntry.expiresAt as Date).getTime();

    expect(complianceExpiry).toBeGreaterThan(before);
    expect(securityExpiry).toBeGreaterThan(before);
    expect(accessExpiry).toBeGreaterThan(before);

    // Relative ordering across tiers, not exact wall-clock dates.
    expect(accessExpiry).toBeLessThan(complianceExpiry);
    expect(complianceExpiry).toBeLessThan(securityExpiry);

    // Materially nearer, not just "less than" by a millisecond: access (1mo) must be
    // well under half of compliance (12mo), and compliance well under security (24mo).
    expect(accessExpiry - before).toBeLessThan((complianceExpiry - before) / 2);
    expect(complianceExpiry - before).toBeLessThan((securityExpiry - before) / 2 + 1000);
  });
});

/**
 * ADR-438 v3 — dedup opt-in ανά call site, μέσα από το PUBLIC API.
 *
 * ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΜΟΝΟ ΣΤΟ audit-policy.test: εκεί δοκιμάζεται η καθαρή συνάρτηση
 * απόφασης. Εδώ αποδεικνύεται το observable αποτέλεσμα — **πόσα documents φτάνουν
 * πράγματι στο Firestore**. Μια regression που καλεί σωστά το `resolveDedupWindowMs`
 * αλλά αγνοεί το αποτέλεσμα θα περνούσε εκεί και θα σκάσει εδώ.
 */
describe('logAuditEvent — dedup opt-in (observable write count)', () => {
  /** Το access tier είναι fire-and-forget· ξεπλένουμε micro+macro task queue. */
  async function flushAsyncWrites(): Promise<void> {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it('ΧΩΡΙΣ dedupable: δύο ταυτόσημες κλήσεις -> ΔΥΟ writes (καμία απώλεια τηλεμετρίας)', async () => {
    // Αυτό είναι το σενάριο `/api/search`: ίδιος actor, ίδιο target, ίδιο path —
    // δηλαδή ΤΑΥΤΟΣΗΜΟ dedup key — αλλά διαφορετικά γεγονότα.
    const searchCtx = ctx({ uid: 'actor_search', companyId: 'comp_search' });
    const opts = { metadata: { path: '/api/search' } };

    await logAuditEvent(searchCtx, 'data_accessed', 'global_search', 'api', opts);
    await logAuditEvent(searchCtx, 'data_accessed', 'global_search', 'api', opts);
    await flushAsyncWrites();

    expect(firebaseAdminMock.__setMock).toHaveBeenCalledTimes(2);
  });

  it('ΜΕ dedupable: δύο ταυτόσημες κλήσεις -> ΕΝΑ write (καταστολή idempotent polling)', async () => {
    const pollCtx = ctx({ uid: 'actor_poll', companyId: 'comp_poll' });
    const opts = { dedupable: true, metadata: { path: '/api/financial-intelligence/portfolio' } };

    await logAuditEvent(pollCtx, 'data_accessed', 'portfolio', 'api', opts);
    await logAuditEvent(pollCtx, 'data_accessed', 'portfolio', 'api', opts);
    await flushAsyncWrites();

    expect(firebaseAdminMock.__setMock).toHaveBeenCalledTimes(1);
  });

  it('ΜΕ dedupable: διαφορετικό targetId -> ΔΥΟ writes (το key δεν συγχέει στόχους)', async () => {
    const projCtx = ctx({ uid: 'actor_proj', companyId: 'comp_proj' });
    const opts = { dedupable: true, metadata: { path: '/api/projects/customers' } };

    await logAuditEvent(projCtx, 'data_accessed', 'project_A', 'project', opts);
    await logAuditEvent(projCtx, 'data_accessed', 'project_B', 'project', opts);
    await flushAsyncWrites();

    expect(firebaseAdminMock.__setMock).toHaveBeenCalledTimes(2);
  });

  it('ΚΡΙΣΙΜΟ: αποτυχημένο write ΛΥΝΕΙ τη σφραγίδα — η επόμενη πρόσβαση δεν χάνεται', async () => {
    // ΑΥΤΟ ΕΙΝΑΙ ΤΟ #4 ΤΟΥ HANDOFF. Το κλειδί σφραγίζεται ΠΡΙΝ το write (σκόπιμα, ως
    // guard έναντι ταυτόχρονων requests). Αν το write χαθεί και η σφραγίδα μείνει,
    // μία χαμένη γραμμή γίνεται ΠΕΝΤΕ ΛΕΠΤΑ τυφλότητας για εκείνο το κλειδί.
    const failCtx = ctx({ uid: 'actor_fail', companyId: 'comp_fail' });
    const opts = { dedupable: true, metadata: { path: '/api/flaky' } };

    firebaseAdminMock.__setMock.mockRejectedValueOnce(new Error('Firestore unavailable'));

    await logAuditEvent(failCtx, 'data_accessed', 'target_flaky', 'api', opts);
    await flushAsyncWrites();
    expect(firebaseAdminMock.__setMock).toHaveBeenCalledTimes(1); // επιχειρήθηκε, απέτυχε

    // Δεύτερη, ΠΡΑΓΜΑΤΙΚΗ πρόσβαση μέσα στο ίδιο 5λεπτο παράθυρο: πρέπει να γραφτεί,
    // γιατί στη βάση δεν υπάρχει τίποτα από την πρώτη.
    await logAuditEvent(failCtx, 'data_accessed', 'target_flaky', 'api', opts);
    await flushAsyncWrites();
    expect(firebaseAdminMock.__setMock).toHaveBeenCalledTimes(2);
  });

  it('ΕΠΙΤΥΧΗΜΕΝΟ write ΚΡΑΤΑΕΙ τη σφραγίδα — δεν λύνεται κατά λάθος πάντα', async () => {
    // Ο έλεγχος-καθρέφτης του προηγούμενου: αν το release γινόταν ανεξαιρέτως, το dedup
    // θα ήταν νεκρό και το test αυτό θα έδειχνε 2 writes αντί για 1.
    const okCtx = ctx({ uid: 'actor_ok_seal', companyId: 'comp_ok_seal' });
    const opts = { dedupable: true, metadata: { path: '/api/stable' } };

    await logAuditEvent(okCtx, 'data_accessed', 'target_stable', 'api', opts);
    await flushAsyncWrites();
    await logAuditEvent(okCtx, 'data_accessed', 'target_stable', 'api', opts);
    await flushAsyncWrites();

    expect(firebaseAdminMock.__setMock).toHaveBeenCalledTimes(1);
  });

  it('ΚΡΙΣΙΜΟ: dedupable: true σε security action ΔΕΝ καταστέλλει — δύο writes', async () => {
    // Λάθος σε call site δεν επιτρέπεται να καταπιεί γραμμή forensics.
    const secCtx = ctx({ uid: 'actor_sec_dedup', companyId: 'comp_sec_dedup' });
    const opts = { dedupable: true, metadata: { path: '/api/secure' } };

    await logAuditEvent(secCtx, 'access_denied', 'target_sec', 'project', opts);
    await logAuditEvent(secCtx, 'access_denied', 'target_sec', 'project', opts);

    expect(firebaseAdminMock.__setMock).toHaveBeenCalledTimes(2);
  });
});
