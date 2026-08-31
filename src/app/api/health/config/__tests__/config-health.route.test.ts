/**
 * @jest-environment node
 *
 * Άγκυρα — **Η ΕΤΟΙΜΟΤΗΤΑ ΤΗΣ ΡΥΘΜΙΣΗΣ ΑΠΑΝΤΑ, ΚΑΙ ΔΕΝ ΔΙΑΡΡΕΕΙ** (ADR-834 §6.5.στ)
 *
 * ## Γιατί υπάρχει
 *
 * Το `config/environment-contract.ts` **υποσχόταν** ότι *«η ετοιμότητα … παίρνει δικό
 * της τελικό σημείο (`/api/health/config`)»* — και ο φάκελος `src/app/api/health/`
 * είχε **μόνο** `route.ts` (μετρημένο 2026-08-31). Πρόταση που ισχυρίζεται κάτι για τη
 * συμπεριφορά του κώδικα και **δεν εκτελείται**.
 *
 * ## Τι κλειδώνει
 *
 * 1. **Ο κωδικός είναι η απάντηση** — 503 όταν μια δυνατότητα σιωπά. Ένα 200 με
 *    σημαία μέσα είναι το σχήμα «πράσινο που σημαίνει δεν κοίταξα».
 * 2. **Καμία τιμή, ποτέ** — ούτε στη βαθμίδα του συνδεδεμένου.
 * 3. **Ονόματα μόνο με ταυτότητα** (πρότυπο Spring Boot Actuator
 *    `show-details=when-authorized`): ανώνυμα φεύγουν **αριθμοί**, όχι χάρτης.
 *
 * @module app/api/health/config/__tests__/config-health.route
 */

import type { NextRequest } from 'next/server';

import type { EnvironmentRequirement } from '@/config/environment-contract';

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withHighRateLimit: <T>(h: T) => h,
  withStandardRateLimit: <T>(h: T) => h,
  withSensitiveRateLimit: <T>(h: T) => h,
  withHeavyRateLimit: <T>(h: T) => h,
}));

/** `null` = ανώνυμος. Ο ένας διακόπτης όλου του «βλέπω ονόματα;». */
let mockIdentity: { uid: string } | null = null;
jest.mock('@/lib/auth/middleware', () => ({
  getAuthContext: jest.fn(async () => mockIdentity),
}));

/**
 * ⚠️ **Το μητρώο γίνεται mock, ο ΕΛΕΓΚΤΗΣ όχι.** Ο `auditEnvironment` είναι το υπό
 * δοκιμή συμβόλαιο — αν τον έκανα mock, η άγκυρα θα δοκίμαζε τον εαυτό της. Αυτό που
 * ελέγχεται είναι ότι η διαδρομή **ρωτά** τον ελεγκτή και μεταφέρει την ετυμηγορία του.
 */
const SECRET_NAME = 'ΔΟΚΙΜΑΣΤΙΚΟ_ΜΥΣΤΙΚΟ';
const SECRET_VALUE = 'μυστική-τιμή-που-ΔΕΝ-πρέπει-να-φύγει-ΠΟΤΕ';
/** Μυστικό που **υπάρχει** στο περιβάλλον όσο συντίθεται η απάντηση — το δόλωμα. */
const DECOY_NAME = 'ΔΟΚΙΜΑΣΤΙΚΟ_ΔΟΛΩΜΑ';
const DECOY_VALUE = 'τιμή-δολώματος-που-ΔΕΝ-πρέπει-να-φύγει-ΠΟΤΕ';

const REQUIREMENT: EnvironmentRequirement = {
  name: SECRET_NAME,
  severity: 'feature',
  feature: 'Δοκιμαστική δυνατότητα',
  consequence: 'Ο ιδιοκτήτης παίρνει «άκυρος σύνδεσμος» και δεν μπορεί να εγκρίνει.',
  consumer: 'services/mandate/mandate-consent.service.ts',
};

jest.mock('@/config/environment-contract', () => ({
  get ENVIRONMENT_CONTRACT() {
    return mockContract;
  },
}));

let mockContract: readonly EnvironmentRequirement[] = [];

import { GET } from '../route';

function requestStub(): NextRequest {
  return { headers: new Headers() } as unknown as NextRequest;
}

async function call(): Promise<{ status: number; body: Record<string, unknown>; raw: string }> {
  const response = await GET(requestStub());
  const raw = await response.text();
  return { status: response.status, body: JSON.parse(raw) as Record<string, unknown>, raw };
}

beforeEach(() => {
  mockIdentity = null;
  mockContract = [REQUIREMENT];
  delete process.env[SECRET_NAME];
});

afterEach(() => {
  delete process.env[SECRET_NAME];
});

// ===========================================================================
describe('/api/health/config — ο κωδικός ΕΙΝΑΙ η απάντηση', () => {
  it('ΠΑΡΟΝΟΜΑΣΤΗΣ — ρυθμισμένο περιβάλλον ⇒ 200 και `ready: true`', async () => {
    process.env[SECRET_NAME] = SECRET_VALUE;

    const { status, body } = await call();

    expect(status).toBe(200);
    expect(body).toMatchObject({ ready: true, declared: 1, configured: 1, degraded: 0 });
  });

  it('ρύθμιση που λείπει ⇒ **503**, όχι 200-με-σημαία', async () => {
    const { status, body } = await call();

    expect(status).toBe(503);
    expect(body).toMatchObject({ ready: false, declared: 1, configured: 0, degraded: 1 });
  });

  it('η λογιστική κλείνει — ο ΠΑΡΟΝΟΜΑΣΤΗΣ ταξιδεύει κι αυτός στο σύρμα', async () => {
    // Χωρίς το `declared`, ένα `degraded: 0` σημαίνει «όλα καλά» Ή «άδειο μητρώο».
    mockContract = [];

    const { status, body } = await call();

    expect(status).toBe(200);
    expect(body).toMatchObject({ declared: 0, configured: 0, degraded: 0 });
  });

  it('“μόνο κενά” μετράει ως ΑΠΟΥΣΑ — μια ρύθμιση που φαίνεται συμπληρωμένη', async () => {
    process.env[SECRET_NAME] = '   ';

    const { status, body } = await call();

    expect(status).toBe(503);
    expect(body).toMatchObject({ ready: false, degraded: 1 });
  });
});

// ===========================================================================
describe('/api/health/config — τι επιτρέπεται να φύγει σε ποιον', () => {
  it('ΑΝΩΝΥΜΑ — αριθμοί, ΚΑΝΕΝΑ όνομα ρύθμισης', async () => {
    const { raw, body } = await call();

    expect(body.features).toBeUndefined();
    expect(raw).not.toContain(SECRET_NAME);
  });

  it('ΜΕ ΤΑΥΤΟΤΗΤΑ — ονόματα και **συνέπεια**, ώστε να διορθώνεται χωρίς grep', async () => {
    mockIdentity = { uid: 'WKBWEg3D' };

    const { body } = await call();

    expect(body.features).toEqual([
      {
        name: SECRET_NAME,
        feature: REQUIREMENT.feature,
        consequence: REQUIREMENT.consequence,
      },
    ]);
  });

  /**
   * 🔴 **Η ΠΡΩΤΗ ΓΡΑΦΗ ΑΥΤΟΥ ΤΟΥ ΕΛΕΓΧΟΥ ΗΤΑΝ ΔΟΜΙΚΑ ΑΔΥΝΑΤΟ ΝΑ ΚΟΚΚΙΝΙΣΕΙ** —
   * μετρημένο με μετάλλαξη, 2026-08-31. Έβαζε τη ρύθμιση **ρυθμισμένη** και μετά
   * ζητούσε να μη διαρρεύσει η τιμή της· αλλά στο `features` μπαίνουν **μόνο όσες
   * λείπουν**, άρα εκείνη η τιμή δεν είχε καν διαδρομή προς το σώμα. Πράσινο επειδή
   * κανείς δεν κοίταξε — το ίδιο σχήμα που αυτή η δουλειά κυνηγά.
   *
   * ✅ Η θεραπεία: **δόλωμα**. Η ρύθμιση του μητρώου **λείπει** (άρα ταξιδεύει), και
   * στο περιβάλλον υπάρχει **άλλη** μεταβλητή με αναγνωρίσιμη τιμή. Έτσι υπάρχει
   * πραγματικό μυστικό στο περιβάλλον τη στιγμή που η διαδρομή συνθέτει την απάντηση.
   */
  it('🔴 ΚΑΜΙΑ τιμή περιβάλλοντος στο σώμα — ούτε του δολώματος', async () => {
    process.env[DECOY_NAME] = DECOY_VALUE;
    mockIdentity = { uid: 'WKBWEg3D' };
    try {
      const { raw, body } = await call();

      expect(raw).not.toContain(DECOY_VALUE);
      // Και η ρύθμιση που ΟΝΤΩΣ ταξιδεύει φέρει **κλειστό** σύνολο πεδίων: ένα
      // μελλοντικό `value` δεν μπορεί να προστεθεί σιωπηλά.
      const features = body.features as readonly Record<string, unknown>[];
      expect(features).toHaveLength(1);
      expect(Object.keys(features[0] ?? {}).sort()).toEqual(
        ['consequence', 'feature', 'name'],
      );
    } finally {
      delete process.env[DECOY_NAME];
    }
  });
});
