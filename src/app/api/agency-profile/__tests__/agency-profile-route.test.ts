/**
 * @jest-environment node
 *
 * @fileoverview **Η ΠΟΡΤΑ ΤΗΣ ΒΙΤΡΙΝΑΣ** — ADR-827 §9.10 · §9.13, το #12.
 * @related app/api/agency-profile/route.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ, ΚΑΙ ΓΙΑΤΙ ΤΟ ΨΕΥΔΩΝΥΜΟ ΕΙΝΑΙ ΤΟ ΔΥΣΚΟΛΟ ΣΗΜΕΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `companyId` του εγγράφου έρχεται από την **απόδειξη**, άρα η κλασική
 * πλαστοπροσωπία *(«γράψε στο όνομα άλλου»)* είναι ήδη **δομικά αδύνατη**. Το
 * ψευδώνυμο όμως είναι **πεδίο του σώματος** — υποχρεωτικά, γιατί η αντίστροφη
 * αναζήτηση `companyId → ψευδώνυμο` θα ήταν **σάρωση** (Ε-5 §4 #1).
 *
 * ⇒ Χωρίς επαλήθευση, το γραφείο **Α** δημοσιεύει με ψευδώνυμο του **Β**: η κάρτα του
 * Α στον κατάλογο δείχνει στον χώρο του Β. **Παραπλάνηση που φαίνεται σωστή από κάθε
 * πλευρά** — κανένα άλλο test δεν θα την έπιανε.
 *
 * 🔑 **Ο κριτής της ικανότητας είναι ΠΡΑΓΜΑΤΙΚΟΣ** (`requireBrokerageCapability` δεν
 * είναι mock): δοκιμή που μιμείται τον κριτή επιβεβαιώνει **τον εαυτό της**. Ψεύτικοι
 * είναι μόνο ο **αναγνώστης της βάσης** και το **ευρετήριο ψευδωνύμων**.
 */

jest.mock('next/server', () => {
  class MockNextResponse {
    readonly status: number;
    private readonly body: unknown;
    constructor(body: unknown, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status ?? 200;
    }
    async json(): Promise<unknown> {
      return this.body;
    }
    static json(body: unknown, init?: { status?: number }): MockNextResponse {
      return new MockNextResponse(body, init);
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withStandardRateLimit: <T>(h: T) => h,
}));

const authContext = { uid: 'user_1', companyId: 'comp_alfa', isAuthenticated: true as const };

jest.mock('@/lib/auth/middleware', () => ({
  withAuth:
    (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown) =>
      callback(request, authContext),
}));

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => ({}) }));

const readCapabilities = jest.fn();
jest.mock('@/services/company/company-capabilities.reader', () => ({
  readCompanyCapabilities: (...args: unknown[]) => readCapabilities(...args),
}));

const resolveAliasMock = jest.fn();
jest.mock('@/lib/workspace/alias-registry', () => ({
  resolveAlias: (...args: unknown[]) => resolveAliasMock(...args),
}));

const publishMock = jest.fn();
const withdrawMock = jest.fn();
jest.mock('@/services/mandate/agency-profile.service', () => ({
  publishAgencyProfile: (...args: unknown[]) => publishMock(...args),
  withdrawAgencyProfile: (...args: unknown[]) => withdrawMock(...args),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

import { POST, DELETE } from '../route';
import type { CapabilityStatus } from '@/types/organization-capability';

const ALIAS = 'mesitiko-pagoni';

const BODY = {
  alias: ALIAS,
  displayName: 'ΜΕΣΙΤΙΚΟ ΓΡΑΦΕΙΟ ΠΑΓΩΝΗ Ι.Κ.Ε.',
  gemiNumber: '123456789000',
};

interface Answer {
  readonly status: number;
  readonly body: Record<string, unknown>;
}

function request(body: unknown): unknown {
  return { json: async () => body };
}

async function post(body: unknown): Promise<Answer> {
  const response = (await (POST as unknown as (r: unknown) => Promise<unknown>)(
    request(body),
  )) as { status: number; json: () => Promise<Record<string, unknown>> };
  return { status: response.status, body: await response.json() };
}

async function del(): Promise<Answer> {
  const response = (await (DELETE as unknown as (r: unknown) => Promise<unknown>)(
    request(null),
  )) as { status: number; json: () => Promise<Record<string, unknown>> };
  return { status: response.status, body: await response.json() };
}

function allowCapability(status: CapabilityStatus = 'active'): void {
  readCapabilities.mockResolvedValue({ brokerage_listings: { status } });
}

function aliasOwnedBy(companyId: string): void {
  resolveAliasMock.mockResolvedValue({
    outcome: 'found',
    companyId,
    form: 'alias',
    current: true,
    canonicalAlias: null,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  allowCapability();
  aliasOwnedBy(authContext.companyId);
  publishMock.mockResolvedValue({ kind: 'published', profile: { companyId: 'comp_alfa' } });
  withdrawMock.mockResolvedValue({ kind: 'withdrawn' });
});

// ============================================================================
// Β — Ο ΦΡΟΥΡΟΣ ΤΗΣ ΡΥΘΜΙΖΟΜΕΝΗΣ ΠΡΑΞΗΣ
// ============================================================================

describe('Β — η βιτρίνα απαιτεί ΕΝΕΡΓΗ μεσιτική ικανότητα', () => {
  it('🔑 Β0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: ενεργό γραφείο ΔΗΜΟΣΙΕΥΕΙ', async () => {
    const answer = await post(BODY);

    expect(answer.status).toBe(200);
    expect(answer.body).toHaveProperty('profile');
  });

  it.each(['unrequested', 'pending', 'revoked'] as const)(
    '🔴 Β1 — «%s» παίρνει 403 ΚΑΙ ΜΑΘΑΙΝΕΙ ΠΟΙΑ κατάσταση τον εμποδίζει',
    async (status) => {
      allowCapability(status);

      const answer = await post(BODY);

      expect(answer.status).toBe(403);
      expect(answer.body.error).toBe('BROKERAGE_NOT_ALLOWED');
      // *«δεν δήλωσες ποτέ»* ≠ *«εκκρεμεί»* ≠ *«σου ανακλήθηκε»* — τρεις θεραπείες.
      expect(answer.body.capabilityStatus).toBe(status);
      expect(publishMock).not.toHaveBeenCalled();
    },
  );

  it('🔴 Β2 — Ο ΦΡΟΥΡΟΣ ΤΡΕΧΕΙ ΠΡΙΝ ΤΟ ΣΩΜΑ: η άρνηση ΔΕΝ περιγράφει το JSON', async () => {
    allowCapability('revoked');

    // Σκουπίδια αντί για σχήμα. Αν το σώμα κρινόταν πρώτο, η απάντηση θα ονόμαζε
    // πεδία — δηλαδή κανάλι πληροφορίας προς κάποιον που δεν έπρεπε να φτάσει εδώ.
    const answer = await post({ garbage: true });

    expect(answer.status).toBe(403);
    expect(answer.body).not.toHaveProperty('malformed');
  });

  it('🔴 Β3 — η ΑΠΟΣΥΡΣΗ έχει ΤΟΝ ΙΔΙΟ φρουρό με τη δημοσίευση', async () => {
    allowCapability('pending');

    const answer = await del();

    expect(answer.status).toBe(403);
    expect(withdrawMock).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Ψ — Η ΕΠΑΛΗΘΕΥΣΗ ΤΟΥ ΨΕΥΔΩΝΥΜΟΥ (το εύρημα του §9.13)
// ============================================================================

describe('Ψ — το ψευδώνυμο έρχεται από τον πελάτη, άρα ΕΠΑΛΗΘΕΥΕΤΑΙ', () => {
  it('🔴 Ψ1 — ΞΕΝΟ ΨΕΥΔΩΝΥΜΟ ΑΠΟΡΡΙΠΤΕΤΑΙ: η κάρτα δεν δείχνει σε ξένο χώρο', async () => {
    aliasOwnedBy('comp_beta');

    const answer = await post(BODY);

    expect(answer.status).toBe(422);
    expect(answer.body.error).toBe('ALIAS_NOT_OWNED');
    // 🔴 Και **τίποτα δεν γράφτηκε**: μια βιτρίνα με ξένο σύνδεσμο θα φαινόταν
    //    απολύτως σωστή από κάθε πλευρά — κανένα άλλο test δεν την πιάνει.
    expect(publishMock).not.toHaveBeenCalled();
  });

  it('🔴 Ψ2 — ΑΝΥΠΑΡΚΤΟ ψευδώνυμο απαντά ΤΑΥΤΟΣΗΜΑ με ξένο', async () => {
    resolveAliasMock.mockResolvedValue({ outcome: 'not-found' });

    const answer = await post(BODY);

    expect(answer.status).toBe(422);
    expect(answer.body.error).toBe('ALIAS_NOT_OWNED');
  });

  it('🔑 Ψ3 — ΑΓΝΩΣΤΟ ≠ ΚΕΝΟ: η βλάβη του ευρετηρίου δίνει 503, ΠΟΤΕ 422', async () => {
    resolveAliasMock.mockResolvedValue({ outcome: 'unknown' });

    const answer = await post(BODY);

    // Ένα 422 εδώ θα έλεγε στο γραφείο ότι **η διεύθυνσή του δεν του ανήκει** —
    // και θα το έστελνε να αλλάξει κάτι που είναι σωστό.
    expect(answer.status).toBe(503);
    expect(answer.body.error).toBe('ALIAS_UNVERIFIED');
    expect(publishMock).not.toHaveBeenCalled();
  });

  it('🔴 Ψ4 — Η ΣΥΓΚΡΙΣΗ ΓΙΝΕΤΑΙ ΜΕ ΤΟ `companyId` ΤΗΣ ΑΠΟΔΕΙΞΗΣ, όχι με το σώμα', async () => {
    // Το σώμα προσπαθεί να δηλώσει ταυτότητα. Δεν υπάρχει πεδίο να την πάρει, και το
    // ψευδώνυμο κρίνεται πάντα απέναντι στον **κριθέντα** οργανισμό.
    aliasOwnedBy('comp_beta');

    const answer = await post({ ...BODY, companyId: 'comp_beta' });

    expect(answer.status).toBe(422);
    expect(answer.body.error).toBe('ALIAS_NOT_OWNED');
  });

  it('🔑 Ψ5 — η επαλήθευση είναι ΣΗΜΕΙΑΚΗ ΑΝΑΓΝΩΣΗ ΚΑΤΑ ΚΛΕΙΔΙ, μία φορά', async () => {
    await post(BODY);

    // Καμία σάρωση, και **ένα** ταξίδι: αν κάποιος «βελτιώσει» τον έλεγχο σε
    // αναζήτηση, αυτό δείχνει άλλο αριθμό ή άλλο όρισμα.
    expect(resolveAliasMock).toHaveBeenCalledTimes(1);
    expect(resolveAliasMock).toHaveBeenCalledWith(ALIAS);
  });
});

// ============================================================================
// Α — ΟΙ ΑΡΝΗΣΕΙΣ ΤΟΥ ΓΡΑΦΕΑ ΦΤΑΝΟΥΝ ΣΤΟΝ ΑΝΘΡΩΠΟ ΟΝΟΜΑΣΤΙΚΑ
// ============================================================================

describe('Α — «λείπει πεδίο» το απαντά ο ΓΡΑΦΕΑΣ, ονομαστικά', () => {
  it('🔴 Α1 — ΚΕΝΗ ΕΠΩΝΥΜΙΑ ΦΤΑΝΕΙ ΣΤΟΝ ΓΡΑΦΕΑ, δεν κόβεται ως «κακό σώμα»', async () => {
    publishMock.mockResolvedValue({ kind: 'rejected', reason: 'agency-profile-name-missing' });

    const answer = await post({ ...BODY, displayName: '   ' });

    // 🔴 Η ΑΓΚΥΡΑ ΤΟΥ «ΕΝΑΣ ΚΡΙΤΗΣ»: ένα `min(1)` στο zod θα έδινε 400
    //    `MALFORMED_BODY` και θα έκανε τους ονομαστικούς λόγους **ανεκτέλεστους** —
    //    κάλυψη σε νεκρό κλάδο δεν είναι κάλυψη.
    expect(answer.status).toBe(422);
    expect(answer.body.error).toBe('INVALID_PROFILE');
    expect(answer.body.reason).toBe('agency-profile-name-missing');
    expect(publishMock).toHaveBeenCalled();
  });

  it('Α2 — σώμα που δεν είναι ΚΑΝ σχήμα παίρνει 400 και ΟΝΟΜΑΖΕΙ τα πεδία', async () => {
    const answer = await post({ alias: 42, displayName: null });

    expect(answer.status).toBe(400);
    expect(answer.body.error).toBe('MALFORMED_BODY');
    expect(answer.body.malformed).toEqual(expect.arrayContaining(['alias']));
  });

  it('Α3 — η αστοχία γραφής είναι 500: ο άνθρωπος δεν έχει τι να διορθώσει', async () => {
    publishMock.mockResolvedValue({ kind: 'failed' });

    const answer = await post(BODY);

    expect(answer.status).toBe(500);
    expect(answer.body.error).toBe('WRITE_FAILED');
  });

  it('Α4 — ο τόπος είναι ΠΡΟΑΙΡΕΤΙΚΟΣ, και η απουσία του γίνεται ρητό `null`', async () => {
    await post(BODY);

    expect(publishMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ place: null }),
    );
  });
});

// ============================================================================
// Ω — Η ΑΠΟΣΥΡΣΗ
// ============================================================================

describe('Ω — η απόσυρση σβήνει, και σβήνει ΤΟΝ ΕΑΥΤΟ ΤΗΣ', () => {
  it('🔑 Ω0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η απόσυρση πετυχαίνει', async () => {
    const answer = await del();

    expect(answer.status).toBe(200);
    expect(answer.body.withdrawn).toBe(true);
  });

  it('🔴 Ω1 — ΣΒΗΝΕΙ ΤΟ `companyId` ΤΗΣ ΑΠΟΔΕΙΞΗΣ — δεν υπάρχει πεδίο να ζητηθεί άλλο', async () => {
    await del();

    expect(withdrawMock).toHaveBeenCalledWith(expect.anything(), authContext.companyId);
  });
});
