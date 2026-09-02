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
  publishShowcase: (...args: unknown[]) => publishMock(...args),
  withdrawAgencyProfile: (...args: unknown[]) => withdrawMock(...args),
}));

/**
 * 🔑 **Ο αναγνώστης της ταξινομίας είναι ψεύτικος· ο ΚΡΙΤΗΣ όχι.** Εδώ
 * δοκιμάζεται η **διαδρομή**, δηλαδή *«ποιος ρωτιέται, με τι σειρά, και τι
 * φτάνει στον γραφέα»* — η ίδια η ανάγνωση Firestore δεν είναι το ερώτημα.
 */
const classifyMock = jest.fn();
jest.mock('@/services/esco/occupation-classification.reader', () => ({
  readOccupationClassification: (...args: unknown[]) => classifyMock(...args),
}));

const verifyPlaceMock = jest.fn();
const landPositionMock = jest.fn();
jest.mock('@/services/places/public-place-read.service', () => ({
  verifyPlaceRef: (...args: unknown[]) => verifyPlaceMock(...args),
  PLACE_REF_TREATMENT: {
    exists: 'accept',
    'not-a-place-id': 'reject',
    'land-absent': 'reject',
    'building-absent': 'reject',
    unavailable: 'retry',
  },
}));
jest.mock('@/services/places/place-position.reader', () => ({
  readLandPosition: (...args: unknown[]) => landPositionMock(...args),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

import { POST, DELETE } from '../route';
import type { CapabilityStatus } from '@/types/organization-capability';

const ALIAS = 'mesitiko-pagoni';

const BROKER_URI = 'http://data.europa.eu/esco/occupation/8ec8df02-e9dd-43b7-b416-5846ae0414ab';
const PAINTER_URI = 'http://data.europa.eu/esco/occupation/painter-fixture';

/** Ό,τι γράφει η **ταξινομία** — ποτέ ό,τι στέλνει το σύρμα. */
const BROKER_OCCUPATION = {
  escoUri: BROKER_URI,
  label: { el: 'μεσίτης ακίνητης περιουσίας/μεσίτρια ακίνητης περιουσίας', en: 'real estate agent' },
  iscoCode: '3334',
};
const PAINTER_OCCUPATION = {
  escoUri: PAINTER_URI,
  label: { el: 'ελαιοχρωματιστής', en: 'painter' },
  iscoCode: '7131',
};

const BODY = {
  alias: ALIAS,
  displayName: 'ΜΕΣΙΤΙΚΟ ΓΡΑΦΕΙΟ ΠΑΓΩΝΗ Ι.Κ.Ε.',
  credentials: [{ escoUri: BROKER_URI, registrationNumber: '123456789000' }],
};

const PAINTER_BODY = {
  alias: ALIAS,
  displayName: 'ΒΑΨΙΜΑΤΑ ΠΑΓΩΝΗ',
  credentials: [{ escoUri: PAINTER_URI }],
};

/** Η ταξινομία απαντά **κατά URI** — έτσι το μικτό γραφείο δοκιμάζεται αληθινά. */
function taxonomyKnows(...occupations: { escoUri: string }[]): void {
  const byUri = new Map(occupations.map((o) => [o.escoUri, o]));
  classifyMock.mockImplementation(async (_db: unknown, uri: string) =>
    byUri.has(uri)
      ? { outcome: 'classified', occupation: byUri.get(uri) }
      : { outcome: 'absent' },
  );
}

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
  taxonomyKnows(BROKER_OCCUPATION, PAINTER_OCCUPATION);
  verifyPlaceMock.mockResolvedValue('exists');
  landPositionMock.mockResolvedValue({ lat: 40.64, lng: 22.94 });
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

  it('🔑 Β0α — Ο ΕΛΑΙΟΧΡΩΜΑΤΙΣΤΗΣ ΔΗΜΟΣΙΕΥΕΙ ΧΩΡΙΣ ΚΑΜΙΑ ΙΚΑΝΟΤΗΤΑ (Α9.3)', async () => {
    // 🔴 **Η ΑΓΚΥΡΑ ΤΗΣ Φ6-Β3 ΣΤΟ ΣΥΝΟΡΟ.** Η βιτρίνα έπαψε να είναι μεσιτική:
    //    ο φρουρός ρωτά **το επάγγελμα**. Αν κάποιος τον ξαναβάλει «σε όλους»,
    //    αυτό κοκκινίζει — και μαζί του ο μισός κατάλογος.
    allowCapability('unrequested');

    const answer = await post(PAINTER_BODY);

    expect(answer.status).toBe(200);
    expect(publishMock).toHaveBeenCalled();
  });

  it('🔴 Β1α — ΤΟ ΜΙΚΤΟ ΓΡΑΦΕΙΟ ΔΕΝ ΓΛΙΤΩΝΕΙ ΜΕ ΔΕΥΤΕΡΗ, ΕΛΕΥΘΕΡΗ ΕΙΔΙΚΟΤΗΤΑ', async () => {
    allowCapability('revoked');

    const answer = await post({
      ...BODY,
      credentials: [{ escoUri: PAINTER_URI }, { escoUri: BROKER_URI, registrationNumber: '1' }],
    });

    expect(answer.status).toBe(403);
    expect(publishMock).not.toHaveBeenCalled();
  });

  it('🔴 Β2 — Η ΣΕΙΡΑ ΑΛΛΑΞΕ: το σώμα κρίνεται ΠΡΩΤΟ, και ΔΕΝ είναι διαρροή', async () => {
    // ────────────────────────────────────────────────────────────────────────
    // 🔴 ΑΥΤΟ ΤΟ TEST ΑΝΤΙΣΤΡΑΦΗΚΕ ΣΤΗ Φ6-Β3, ΚΑΙ Ο ΛΟΓΟΣ ΕΙΝΑΙ ΔΟΜΙΚΟΣ
    //
    // Απαιτούσε *«403 πριν καν κοιταχτεί το JSON»*, με σκεπτικό ότι δεν λέμε σε
    // κάποιον **που δεν επιτρέπεται καν** αν το σώμα του ήταν έγκυρο. Ο φρουρός
    // όμως εξαρτάται πλέον από **το περιεχόμενο**: δεν γίνεται να κριθεί πριν
    // διαβαστεί αυτό που τον καθορίζει.
    //
    // ⚠️ **Και η προστασία δεν χάθηκε — έπαψε να υπάρχει**: κάθε μέλος
    // οργανισμού επιτρέπεται σε **κάτι** (τη μη ρυθμιζόμενη βιτρίνα), άρα δεν
    // υπάρχει «κάποιος που δεν έπρεπε να φτάσει εδώ». Μπροστά μένουν ο
    // `withAuth` και το όριο ρυθμού.
    // ────────────────────────────────────────────────────────────────────────
    allowCapability('revoked');

    const answer = await post({ garbage: true });

    expect(answer.status).toBe(400);
    expect(answer.body.error).toBe('MALFORMED_BODY');
    // 🔑 Και **τίποτα δεν γράφτηκε**: η αλλαγή σειράς δεν έδωσε πράξη σε κανέναν.
    expect(publishMock).not.toHaveBeenCalled();
  });

  it('🔴 Β3 — Η ΑΠΟΣΥΡΣΗ ΔΕΝ ΕΧΕΙ ΦΡΟΥΡΟ ΙΚΑΝΟΤΗΤΑΣ — ήταν φρουρός που έκανε τη θεραπεία αδύνατη', async () => {
    // ────────────────────────────────────────────────────────────────────────
    // 🔴 ΚΑΙ ΑΥΤΟ ΑΝΤΙΣΤΡΑΦΗΚΕ — ΔΙΟΡΘΩΣΗ ΒΛΑΒΗΣ, ΟΧΙ ΧΑΛΑΡΩΣΗ
    //
    // Ο **ελαιοχρωματιστής δεν είχε ΠΟΤΕ ικανότητα** ⇒ δεν μπορούσε να αποσύρει
    // τη βιτρίνα που μόλις δημοσίευσε. Το ίδιο το παλιό σχόλιο δήλωνε την
    // αμηχανία του *(«γραφείο που ανακλήθηκε δεν χρειάζεται αυτή την πόρτα»)*,
    // και η υπόθεση αυτή έπαψε να ισχύει όταν το Π2 έγινε παραλλαγής-συνειδητό.
    //
    // ⚠️ **Δεν ανοίγει τίποτα**: το κλειδί είναι το `ctx.companyId` από τα
    // claims ⇒ ξένη βιτρίνα παραμένει **μη εκφράσιμη** (δες Ω1).
    // ────────────────────────────────────────────────────────────────────────
    allowCapability('unrequested');

    const answer = await del();

    expect(answer.status).toBe(200);
    expect(withdrawMock).toHaveBeenCalledWith(expect.anything(), authContext.companyId);
  });
});

// ============================================================================
// Τ — Η ΤΑΞΙΝΟΜΙΑ ΔΙΑΒΑΖΕΤΑΙ ΑΠΟ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ (Ε6)
// ============================================================================

describe('Τ — η ετικέτα δεν έρχεται ΠΟΤΕ από το σύρμα', () => {
  it('🔴 Ε6 — ΨΕΥΤΙΚΗ ΕΤΙΚΕΤΑ ΣΤΟ ΣΩΜΑ ΔΕΝ ΦΤΑΝΕΙ ΠΟΥΘΕΝΑ: γράφεται ΤΗΣ ΤΑΞΙΝΟΜΙΑΣ', async () => {
    // Ο πελάτης στέλνει URI **υδραυλικού** με ετικέτα **«Δικηγόρος»**. Αν η
    // ετικέτα περνούσε, το φίλτρο θα δούλευε σωστά *(πάνω στο URI)* και η
    // **κάρτα θα έλεγε ψέματα** — σφάλμα που κανένα φίλτρο δεν πιάνει.
    await post({
      ...PAINTER_BODY,
      credentials: [
        {
          escoUri: PAINTER_URI,
          label: { el: 'Δικηγόρος', en: 'Lawyer' },
          iscoCode: '2611',
        },
      ],
    });

    expect(publishMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        credentials: [expect.objectContaining({ occupation: PAINTER_OCCUPATION })],
      }),
    );
  });

  it('🔴 Τ1 — ΑΓΝΩΣΤΟ URI ⇒ 422 «διόρθωσε», και ΚΑΜΙΑ γραφή', async () => {
    const answer = await post({
      ...BODY,
      credentials: [{ escoUri: 'http://data.europa.eu/esco/occupation/deadbeef' }],
    });

    expect(answer.status).toBe(422);
    expect(answer.body.error).toBe('OCCUPATION_UNKNOWN');
    expect(publishMock).not.toHaveBeenCalled();
  });

  it('🔴 Τ2 — ΑΓΝΩΣΤΟ ≠ ΚΕΝΟ: η βλάβη της ταξινομίας δίνει 503, ΠΟΤΕ 422', async () => {
    // Ένα 422 εδώ θα έστελνε τον άνθρωπο να αλλάξει **σωστή** επιλογή για δική
    // μας βλάβη — και θα το έκανε **σιωπηλά σωστό** στα μάτια του.
    classifyMock.mockResolvedValue({ outcome: 'unavailable' });

    const answer = await post(BODY);

    expect(answer.status).toBe(503);
    expect(answer.body.error).toBe('CLASSIFICATION_UNAVAILABLE');
    expect(publishMock).not.toHaveBeenCalled();
  });

  it('🔑 Τ3 — ΜΙΑ ΑΝΑΓΝΩΣΗ ΑΝΑ CREDENTIAL, στη ΓΡΑΦΗ — όχι ανά προβολή', async () => {
    await post({
      ...BODY,
      credentials: [{ escoUri: BROKER_URI, registrationNumber: '1' }, { escoUri: PAINTER_URI }],
    });

    // ⚠️ Η οικονομία της Α1.6: η βιτρίνα κουβαλά μετά το **αντίγραφο**, και ο
    //    κατάλογος δεν ξαναρωτά την ταξινομία ποτέ.
    expect(classifyMock).toHaveBeenCalledTimes(2);
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

    // 🔴 **ΚΑΙ ΤΑ ΔΥΟ**: `place` (ο δεσμός) και `position` (η γεωμετρία). Ένα
    //    `{lat:0,lng:0}` θα ήταν σημείο στον Ατλαντικό που κάθε χάρτης
    //    ζωγραφίζει **με απόλυτη σιγουριά**.
    expect(publishMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ place: null, position: null }),
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

// ============================================================================
// Χ — Ο ΤΟΠΟΣ: Ο ΔΕΣΜΟΣ ΑΠΟ ΤΟΝ ΑΝΘΡΩΠΟ, Η ΓΕΩΜΕΤΡΙΑ ΑΠΟ ΕΜΑΣ
// ============================================================================

describe('Χ — η θέση παράγεται από τη ΓΗ, ποτέ από το σώμα', () => {
  const PLACE = { landId: 'land_1', buildingId: null };

  it('🔑 Χ0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: δηλωμένος τόπος ⇒ το σημείο της γης φτάνει στον γραφέα', async () => {
    await post({ ...BODY, place: PLACE });

    expect(landPositionMock).toHaveBeenCalledWith(expect.anything(), 'land_1');
    expect(publishMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ place: PLACE, position: { lat: 40.64, lng: 22.94 } }),
    );
  });

  it('🔴 Χ1 — `position` ΣΤΟ ΣΩΜΑ ΑΓΝΟΕΙΤΑΙ: «σωστή κάρτα, ψεύτικο φίλτρο»', async () => {
    // 🔴 **Η ΑΓΚΥΡΑ.** Αν κάποιος «διευκολύνει» τη φόρμα δεχόμενος σημείο από τον
    //    πελάτη, μια βιτρίνα θα μπορούσε να δηλώνει τόπο στη **Θεσσαλονίκη** και
    //    να εμφανίζεται στο φίλτρο της **Αθήνας** — προβολή σε αγορά που ο
    //    επαγγελματίας δεν υπηρετεί, με κάθε έλεγχο πράσινο.
    await post({ ...BODY, place: PLACE, position: { lat: 37.98, lng: 23.72 } });

    expect(publishMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ position: { lat: 40.64, lng: 22.94 } }),
    );
  });

  it('🔴 Χ2 — ΑΝΥΠΑΡΚΤΟΣ ΤΟΠΟΣ ⇒ 422 «άλλαξέ τον», και ΚΑΜΙΑ γραφή', async () => {
    verifyPlaceMock.mockResolvedValue('land-absent');

    const answer = await post({ ...BODY, place: PLACE });

    expect(answer.status).toBe(422);
    expect(answer.body.error).toBe('PLACE_NOT_FOUND');
    expect(publishMock).not.toHaveBeenCalled();
  });

  it('🔴 Χ3 — ΑΓΝΩΣΤΟ ≠ ΚΕΝΟ: η βλάβη επαλήθευσης δίνει 503, ΠΟΤΕ 422', async () => {
    // Ένα 422 εδώ θα έλεγε στον επαγγελματία *«αυτό το κτίριο δεν υπάρχει»* και
    // θα τον έστελνε να φτιάξει **δεύτερη ταυτότητα** για φυσικό πράγμα που έχει
    // ήδη μία — το διπλότυπο που όλο το επίπεδο Α υπάρχει για να αποτρέψει.
    verifyPlaceMock.mockResolvedValue('unavailable');

    const answer = await post({ ...BODY, place: PLACE });

    expect(answer.status).toBe(503);
    expect(answer.body.error).toBe('PLACE_UNVERIFIED');
    expect(publishMock).not.toHaveBeenCalled();
  });

  it('🔑 Χ4 — ΧΩΡΙΣ ΤΟΠΟ ΔΕΝ ΡΩΤΑΜΕ ΚΑΝΕΝΑΝ: «δεν δήλωσε» είναι νόμιμο', async () => {
    await post(BODY);

    expect(verifyPlaceMock).not.toHaveBeenCalled();
    expect(landPositionMock).not.toHaveBeenCalled();
  });
});
