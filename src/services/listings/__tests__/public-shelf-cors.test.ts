/**
 * @fileoverview ⚓ **Ο-21** — «μπορεί ένας **browser** να διαβάσει το δημόσιο ράφι, ή μόνο ένα `curl`;»
 * @related ADR-845 §7.10 (Ο-21) · ADR-841 §7 Α12.4 · config/gcs-buckets · public-shelf-provision
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ ΠΟΥ ΤΗ ΓΕΝΝΗΣΕ — ΜΕΤΡΗΜΕΝΟ ΖΩΝΤΑΝΑ (2026-09-09)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το πρώτο μοντέλο έφτασε στη δημόσια αγγελία, ολόκληρη η αλυσίδα πράσινη:
 *
 * ```
 * files/…              classification:'public'  ready  112.980 B      ✅
 * public_listings…     models[0].url = …/<sha256>.glb                 ✅
 * curl <url>           HTTP 200, 32.928 bytes                         ✅
 * ΟΘΟΝΗ ΕΠΙΣΚΕΠΤΗ      «Το μοντέλο δεν φορτώθηκε»                     🔴
 * κονσόλα              TypeError: Failed to fetch  (@google/model-viewer)
 * curl -H "Origin: …"  → 200, ΚΑΜΙΑ `Access-Control-Allow-Origin`
 * ```
 *
 * 🔑 **ΓΙΑΤΙ ΚΑΜΙΑ ΥΠΑΡΧΟΥΣΑ ΠΥΛΗ ΔΕΝ ΜΠΟΡΟΥΣΕ ΝΑ ΤΟ ΠΙΑΣΕΙ**: το CORS το επιβάλλει
 * **μόνο ο browser**. Ο ψήστης, το ράφι, το `inspectPublicShelfBucket`, κάθε `curl` — **όλοι**
 * έβλεπαν 200 και συμπέραναν «δημόσιο». Ο έλεγχος από διακομιστή είναι εδώ **δομικά τυφλός**.
 * Αυτή η άγκυρα δεν μπορεί να δει τον browser· μπορεί όμως να απαιτήσει ότι η **δηλωμένη
 * πολιτική** ικανοποιεί τον κανόνα που ο browser θα επιβάλει — και ότι ο **παραγωγός τη γράφει**.
 *
 * ⚠️ **ΕΚΤΕΛΕΙ ΤΟΝ ΠΑΡΑΓΩΓΟ**: τρέχει τον πραγματικό `ensurePublicShelfBucket()` πάνω σε
 * **καταστατικό** ψεύτικο κάδο. ⛔ Κανένα χειρόγραφο fixture πολιτικής — το μάθημα του Ο-13
 * *(«fixture που περιγράφει έγγραφο το οποίο κανείς δεν γράφει δεν είναι κάλυψη, είναι ευχή»)*.
 * ⛔ Και **καμία δεύτερη διατύπωση του κανόνα**: η άγκυρα καλεί το **ίδιο**
 * `isBrowserReadableCors` που τρέχει η παρατήρηση.
 */

import type { Cors } from '@google-cloud/storage';

import { GCS_PUBLIC_MEDIA_BUCKET_CONFIG } from '@/config/gcs-buckets';

import {
  ensurePublicShelfBucket,
  inspectPublicShelfBucket,
  isBrowserReadableCors,
} from '../public-shelf-provision';

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  }),
}));

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminStorage: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getAdminStorage } = jest.requireMock('@/lib/firebaseAdmin') as {
  getAdminStorage: jest.Mock;
};

/** Ο ρόλος που ήδη χορηγεί ο παραγωγός — αντιγράφεται ώστε το IAM να μη μολύνει τη μέτρηση. */
const PUBLIC_READER_ROLE = 'roles/storage.legacyObjectReader';

interface BucketMetadataShape {
  location: string;
  iamConfiguration: { uniformBucketLevelAccess: { enabled: boolean } };
  cors?: Cors[];
}

/**
 * **Καταστατικός** ψεύτικος κάδος — κρατά ό,τι του γράφουν, όπως ο αληθινός.
 *
 * 🔑 Χωρίς κατάσταση, το τελικό `inspect()` του `ensure()` θα διάβαζε τα **παλιά** metadata
 * και η άγκυρα θα ήταν πράσινη με σπασμένη θεραπεία — ακριβώς το σχήμα που ψάχνουμε.
 */
function fakeBucket(initialCors?: Cors[]) {
  const metadata: BucketMetadataShape = {
    location: 'EUROPE-WEST1',
    iamConfiguration: { uniformBucketLevelAccess: { enabled: true } },
    ...(initialCors ? { cors: initialCors } : {}),
  };
  const setCorsConfiguration = jest.fn(async (cors: Cors[]) => {
    metadata.cors = cors;
  });
  const setPolicy = jest.fn(async () => undefined);

  return {
    setCorsConfiguration,
    setPolicy,
    readMetadata: () => metadata,
    handle: {
      exists: async () => [true],
      create: jest.fn(async () => undefined),
      getMetadata: async () => [metadata],
      setCorsConfiguration,
      iam: {
        getPolicy: async () => [
          { bindings: [{ role: PUBLIC_READER_ROLE, members: ['allUsers'] }] },
        ],
        setPolicy,
      },
    },
  };
}

function install(bucket: ReturnType<typeof fakeBucket>): void {
  // Ο ψεύτικος κάδος υλοποιεί μόνο ό,τι αγγίζει ο παραγωγός· η μία μετατροπή είναι
  // δηλωμένη εδώ και **πουθενά αλλού**, ώστε να μη διαχυθεί στα σκέλη.
  getAdminStorage.mockReturnValue({ bucket: () => bucket.handle as never });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Κ1 — ΤΟ ΜΕΤΡΗΜΕΝΟ ΖΕΥΓΟΣ: «δημόσιο» ΚΑΙ «αόρατο» ταυτόχρονα', () => {
  it('🔴 κάδος με σωστό IAM και ΧΩΡΙΣ cors: publiclyReadable=true, browserReadable=FALSE', async () => {
    // Αυτή ΗΤΑΝ η ζωντανή κατάσταση στις 2026-09-09, και ένα ενιαίο πεδίο «δημόσιο» θα
    // εξακολουθούσε να λέει «ναι» ενώ κανένας επισκέπτης δεν έβλεπε τίποτα.
    install(fakeBucket());

    const state = await inspectPublicShelfBucket();

    expect(state.publiclyReadable).toBe(true);
    expect(state.browserReadable).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Κ2 — Ο ΠΑΡΑΓΩΓΟΣ ΓΡΑΦΕΙ ΤΗ ΘΕΡΑΠΕΙΑ (εκτελείται, δεν περιγράφεται)', () => {
  it('το `ensurePublicShelfBucket` γράφει cors που ΙΚΑΝΟΠΟΙΕΙ τον κριτή', async () => {
    const bucket = fakeBucket();
    install(bucket);

    const state = await ensurePublicShelfBucket();

    expect(bucket.setCorsConfiguration).toHaveBeenCalledTimes(1);
    const written = bucket.setCorsConfiguration.mock.calls[0]![0];
    expect(isBrowserReadableCors(written)).toBe(true);
    // Και η **παρατήρηση μετά την πράξη** το βλέπει — αλλιώς η θεραπεία δεν «κόλλησε».
    expect(state.browserReadable).toBe(true);
  });

  it('🔴 ΧΩΡΙΣ τη συμφιλίωση CORS ο κάδος μένει αόρατος — η μετάλλαξη που φυλάει το Κ2', async () => {
    // Η δήλωση της μετάλλαξης: αν κάποιος αφαιρέσει το `reconcileCors` από το `ensure`,
    // η κατάσταση μένει αυτή του Κ1. Το ελέγχουμε ρητά ώστε το πράσινο του Κ2 να σημαίνει κάτι.
    const bucket = fakeBucket();
    install(bucket);

    const before = await inspectPublicShelfBucket();
    expect(before.browserReadable).toBe(false);
    expect(bucket.setCorsConfiguration).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Κ3 — Ο ΚΡΙΤΗΣ ΜΠΟΡΕΙ ΝΑ ΚΟΚΚΙΝΙΣΕΙ (μεταλλάξεις της πολιτικής)', () => {
  const FULL: Cors = {
    origin: ['*'],
    method: ['GET', 'HEAD'],
    responseHeader: ['Content-Type', 'Range'],
    maxAgeSeconds: 3600,
  };

  it('η πλήρης πολιτική περνά', () => {
    expect(isBrowserReadableCors([FULL])).toBe(true);
  });

  it('🔴 χωρίς `*` στο origin → όχι', () => {
    expect(isBrowserReadableCors([{ ...FULL, origin: ['https://nestorconstruct.gr'] }])).toBe(false);
  });

  it('🔴 χωρίς GET στο method → όχι', () => {
    expect(isBrowserReadableCors([{ ...FULL, method: ['PUT'] }])).toBe(false);
  });

  it('🔴 χωρίς `Range` στα responseHeader → όχι (η μισή θεραπεία φαίνεται πράσινη)', () => {
    expect(isBrowserReadableCors([{ ...FULL, responseHeader: ['Content-Type'] }])).toBe(false);
  });

  it('🔴 κενό / απόν cors → όχι', () => {
    expect(isBrowserReadableCors([])).toBe(false);
    expect(isBrowserReadableCors(undefined)).toBe(false);
  });

  it('🔴 Η ΕΝΩΣΗ ΔΥΟ ΕΓΓΡΑΦΩΝ ΔΕΝ ΜΕΤΡΑ — ο browser ταιριάζει ΜΙΑ', () => {
    // Η πιο ύπουλη μορφή: κάθε εγγραφή «μοιάζει» να συνεισφέρει, και το άθροισμα
    // φαίνεται πλήρες. Ο browser όμως δεν αθροίζει — διαλέγει μία και την επιβάλλει.
    expect(
      isBrowserReadableCors([
        { origin: ['*'], method: ['GET'], responseHeader: ['Content-Type'] },
        { origin: ['*'], method: ['HEAD'], responseHeader: ['Range'] },
      ]),
    ).toBe(false);
  });

  it('η σύγκριση κεφαλίδων/μεθόδων ΔΕΝ είναι ευαίσθητη σε πεζά-κεφαλαία', () => {
    // Οι κεφαλίδες HTTP είναι case-insensitive· ένα `range` γραμμένο από άνθρωπο στην
    // κονσόλα δεν επιτρέπεται να διαβαστεί ως απουσία και να προκαλέσει άσκοπη εγγραφή.
    expect(
      isBrowserReadableCors([{ origin: ['*'], method: ['get'], responseHeader: ['content-type', 'range'] }]),
    ).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Κ4 — ΙΔΕΜΠΟΤΕΝΤΙΚΟ: δεν ακυρώνει το preflight cache χωρίς λόγο', () => {
  it('κάδος ΗΔΗ στη δηλωμένη πολιτική → καμία εγγραφή', async () => {
    const declared: Cors[] = GCS_PUBLIC_MEDIA_BUCKET_CONFIG.cors.map((entry) => ({
      origin: [...entry.origin],
      method: [...entry.method],
      responseHeader: [...entry.responseHeader],
      maxAgeSeconds: entry.maxAgeSeconds,
    }));
    const bucket = fakeBucket(declared);
    install(bucket);

    const state = await ensurePublicShelfBucket();

    expect(bucket.setCorsConfiguration).not.toHaveBeenCalled();
    expect(state.browserReadable).toBe(true);
  });

  it('κάδος με ΞΕΝΗ πολιτική → συμφιλιώνεται (δεν προστίθεται δίπλα)', async () => {
    const bucket = fakeBucket([{ origin: ['https://example.com'], method: ['GET'] }]);
    install(bucket);

    await ensurePublicShelfBucket();

    expect(bucket.setCorsConfiguration).toHaveBeenCalledTimes(1);
    expect(bucket.readMetadata().cors).toHaveLength(1);
    expect(bucket.readMetadata().cors?.[0]?.origin).toEqual(['*']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Κ5 — Η ΙΔΙΑ Η ΔΗΛΩΣΗ ΙΚΑΝΟΠΟΙΕΙ ΤΟΝ ΚΑΝΟΝΑ', () => {
  it('🔴 το `GCS_PUBLIC_MEDIA_BUCKET_CONFIG.cors` περνά τον κριτή', () => {
    // Χωρίς αυτό, ο παραγωγός θα έγραφε ευσυνείδητα μια πολιτική που **δεν λύνει τίποτα**,
    // και το `reconcileCors` θα ξανάγραφε σε **κάθε** εκτέλεση χωρίς ποτέ να ικανοποιηθεί.
    expect(isBrowserReadableCors([...GCS_PUBLIC_MEDIA_BUCKET_CONFIG.cors])).toBe(true);
  });
});
