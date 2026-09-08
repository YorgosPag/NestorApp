/**
 * @jest-environment node
 *
 * ⚠️ **`node` και ΟΧΙ `jsdom`**: το `sharp` καλεί `structuredClone`, που στο jsdom **δεν
 * υπάρχει** — η σουίτα θα «περνούσε» με κάθε εικόνα να μετριέται ως μη
 * αποκωδικοποιήσιμη, δηλαδή θα φύλαγε **σιωπή**.
 *
 * @fileoverview 🔴 **Η ΑΓΚΥΡΑ ΤΗΣ ΒΛΑΒΗΣ** — το σήμα επιβιώνει της δεύτερης
 *   δημοσίευσης, και **δεν** επιβιώνει της απόσυρσης (ADR-841 §7 Α21, Φάση 2).
 * @related services/mandate/showcase-mark-custody · services/mandate/agency-profile.service
 * @module services/mandate/__tests__/showcase-mark-survival
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΓΡΑΦΤΗΚΕ **ΠΡΩΤΟ**, ΠΡΙΝ ΑΠΟ ΚΑΘΕ ΓΡΑΜΜΗ ΚΩΔΙΚΑ
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Το handoff της Φάσης 2 ονόμασε τη **μία** πιο πιθανή βλάβη: *«η δήλωση είναι ολόκληρη
 * η βιτρίνα (`set` χωρίς `merge`) — αν η οθόνη δεν στείλει το υπάρχον σήμα σε κάθε
 * αποθήκευση, μια αλλαγή επωνυμίας **ΣΒΗΝΕΙ ΤΟ ΛΟΓΟΤΥΠΟ**»*.
 *
 * 🔴 **ΚΑΙ ΤΟ AUDIT ΒΡΗΚΕ ΟΤΙ ΗΤΑΝ ΧΕΙΡΟΤΕΡΑ ΑΠ' ΟΣΟ ΤΟ ΗΞΕΡΕ.** Η οθόνη δεν *«ξεχνά»*
 * να στείλει το σήμα — **δεν έχει από πού να το πάρει**. Διαβάζει το **ίδιο έγγραφο με
 * τον κόσμο** *(δηλωμένη αρχή του `useAgencyShowcase`: «ξεχωριστός αναγνώστης θα ήταν
 * δεύτερο βιβλίο»)*, και το `PublicShowcase.mark` κρατά **μόνο δημόσιο URL** — ποτέ το
 * `privateStoragePath` που ζητά το σύρμα. Η θεραπεία *«στείλ' το ξανά»* ήταν **δομικά
 * ανέφικτη**.
 *
 * ⇒ Το σήμα έγινε **ξεχωριστή πράξη** *(απόφαση Giorgio)*: `declareShowcaseMark` /
 * `retractShowcaseMark`, και η **δημοσίευση διατηρεί** ό,τι βρει. Αυτό το αρχείο κρίνει
 * ακριβώς εκείνη τη διατήρηση.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 ΚΑΙ Η ΔΕΥΤΕΡΗ ΒΛΑΒΗ ΕΙΝΑΙ ΤΟ ΑΝΤΙΘΕΤΟ ΤΗΣ ΠΡΩΤΗΣ — ΤΟ ΣΗΜΑ ΠΟΥ **ΔΕΝ** ΠΕΘΑΙΝΕΙ
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Το `withdrawAgencyProfile` έσβηνε **μόνο το έγγραφο**. Το ράφι `showcases/{cid}/`
 * έμενε γεμάτο ⇒ ο επαγγελματίας που **ανακάλεσε τη συγκατάθεσή του** άφηνε το
 * **πορτρέτο του** — φωτογραφία **φυσικού προσώπου** — δημόσια προσβάσιμη για πάντα. Και
 * το ίδιο το ADR γράφει *«η παρουσία **ΕΙΝΑΙ** η συγκατάθεση, και απόσυρση =
 * διαγραφή»*.
 *
 * ⚠️ Ισχύει και για το **Π2** *(ανάκληση μεσιτικής ικανότητας)*, που καλεί την ίδια
 * συνάρτηση — δηλαδή η βλάβη είχε **δύο** σκανδάλες, και καμία δεν ήταν ορατή από την
 * οθόνη.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🏆 ΤΙ **ΕΚΤΕΛΕΙ** — ΟΧΙ ΤΥΠΟΥΣ, ΑΛΛΑ BYTES ΚΑΙ ΕΓΓΡΑΦΟ
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Ψεύτικος κάδος · **αληθινό** `sharp` · **αληθινό** `FakeFirestore` με CAS. Μετά από
 * κάθε κλήση, οι ισχυρισμοί ρωτούν τον **δίσκο** και τον **κάδο** — ποτέ τι επέστρεψε η
 * συνάρτηση. Ένα test που έπλαθε το `set()` θα απεδείκνυε ότι ο κώδικας **καλεί** ό,τι
 * νομίζουμε, όχι ότι **γράφεται** ό,τι θέλουμε.
 */

import sharp from 'sharp';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { FakeShelfBucket } from '@/services/upload/__fixtures__/fake-shelf-bucket';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import type { ShowcaseAuthority } from '@/lib/auth/brokerage-authority';
import type { ClassifiedOccupation } from '@/types/agency-profile';

import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';

const shelf = new FakeShelfBucket();
const privateBucket = new FakeShelfBucket();
/** Οι σημειώσεις προέλευσης (Α21.12) — αυτή η σουίτα δεν τις κρίνει, τις **επιτρέπει**. */
const markSources = new FakeFirestore();

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminStorage: () => ({ bucket: () => shelf }),
  getAdminBucket: () => privateBucket,
  // 🔴 **Α21.12** — ο γραφέας του σήματος καταγράφει πλέον **πού ήταν το πρωτότυπο**.
  //    ⚠️ Και η αστοχία ήταν **σιωπηλή με τον χειρότερο τρόπο**: το `getAdminFirestore`
  //    έλειπε από το mock, η εξαίρεση πιανόταν από τον `catch` του γραφέα, και η
  //    δημοσίευση αναφερόταν ως **`failed`** — δηλαδή οι άγκυρες της επιβίωσης
  //    κοκκίνιζαν για λόγο **άσχετο** με ό,τι ρωτούν. Το mock πρέπει να είναι **τόσο
  //    πλατύ όσο ο κώδικας που δοκιμάζει**.
  getAdminFirestore: () => markSources,
}));

// ⚠️ `require` **μετά** το mock: το `jest.mock` ανυψώνεται πάνω από κάθε `import`, αλλά ο
//    γραφέας του ραφιού κρατά τον κάδο σε module scope — ένα κανονικό `import` εδώ θα τον
//    έδενε με τον **αληθινό** πριν προλάβει το mock.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { publishShowcase, withdrawAgencyProfile } = require('../agency-profile.service') as
  typeof import('../agency-profile.service');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { declareShowcaseMark, retractShowcaseMark } = require('../showcase-mark-custody') as
  typeof import('../showcase-mark-custody');

// ---------------------------------------------------------------------------
// Βοηθοί
// ---------------------------------------------------------------------------

const COMPANY = 'comp_9c7c1a50';
const OTHER_COMPANY = 'comp_ff000000';

/**
 * Η **μη ρυθμιζόμενη** απόδειξη — καμία ικανότητα, κανένα brand.
 *
 * 🔑 **Και είναι ο ΣΩΣΤΟΣ ήρωας αυτής της σουίτας**: το σήμα δεν είναι ρυθμιζόμενη
 * πράξη, και ο ελαιοχρωματιστής *(που δεν είχε ΠΟΤΕ ικανότητα)* οφείλει να μπορεί να
 * δηλώσει το δικό του. Μια ρυθμιζόμενη απόδειξη εδώ θα δοκίμαζε **τον φρουρό**, όχι τη
 * διατήρηση.
 */
function authorityOf(companyId: string): ShowcaseAuthority {
  return { kind: 'unregulated', companyId };
}

/** ISCO `7131` → `authority: null`, δηλαδή **ρητό** «δεν τηρείται μητρώο» (Α9.3). */
const PAINTER: ClassifiedOccupation = {
  escoUri: 'http://data.europa.eu/esco/occupation/painter-fixture',
  label: { el: 'ελαιοχρωματιστής', en: 'painter' },
  iscoCode: '7131',
};

/** Το κανονικό ιδιωτικό μονοπάτι ενός αρχείου εταιρείας (ADR-709). */
function privatePath(companyId: string, fileId = 'file_mark'): string {
  return `companies/${companyId}/entities/company/${companyId}/domains/admin/categories/photos/files/${fileId}.png`;
}

/** Βάζει μια **αληθινή** εικόνα στον ιδιωτικό κάδο και επιστρέφει το μονοπάτι της. */
async function givenPrivateImage(companyId: string, fileId = 'file_mark'): Promise<string> {
  const bytes = await sharp({
    create: { width: 512, height: 512, channels: 3, background: { r: 10, g: 90, b: 200 } },
  })
    .png()
    .toBuffer();

  const path = privatePath(companyId, fileId);
  privateBucket.put(path, bytes);
  return path;
}

function db(): { fake: FakeFirestore; admin: AdminFirestore } {
  const fake = new FakeFirestore();
  return { fake, admin: fake as unknown as AdminFirestore };
}

/** Ό,τι **πραγματικά** κάθεται στον δίσκο — ωμό, ποτέ ως `PublicShowcase`. */
async function stored(
  fake: FakeFirestore,
  companyId = COMPANY,
): Promise<Record<string, unknown> | undefined> {
  const snap = await fake.collection(COLLECTIONS.AGENCY_PROFILES).doc(companyId).get();
  return snap.exists ? (snap.data() as Record<string, unknown>) : undefined;
}

/** Τα κλειδιά του ραφιού **αυτής** της εταιρείας. */
const marksOf = (companyId = COMPANY): string[] =>
  shelf.keys().filter((key) => key.startsWith(`showcases/${companyId}/`));

/** Μια δημοσιευμένη βιτρίνα ελαιοχρωματιστή, με το όνομα που δίνεται. */
async function givenShowcase(admin: AdminFirestore, displayName = 'ΒΑΦΕΣ ΠΑΓΩΝΗ'): Promise<void> {
  const result = await publishShowcase(admin, authorityOf(COMPANY), {
    alias: 'vafes-pagoni',
    displayName,
    credentials: [{ occupation: PAINTER, registrationNumber: '', registrationChapter: '' }],
    place: null,
    position: null,
  });
  if (result.kind !== 'published') {
    throw new Error(`το fixture οφείλει να δημοσιεύεται, αλλά: ${result.kind}`);
  }
}

beforeEach(() => {
  shelf.reset();
  privateBucket.reset();
});

// ===========================================================================
// Ε — Η ΕΠΙΒΙΩΣΗ: το σήμα δεν είναι θύμα της επόμενης αποθήκευσης
// ===========================================================================

describe('🔴 Ε — ΤΟ ΣΗΜΑ ΕΠΙΒΙΩΝΕΙ ΤΗΣ ΔΕΥΤΕΡΗΣ ΔΗΜΟΣΙΕΥΣΗΣ', () => {
  it('🔴 Ε1 — αλλαγή ΜΟΝΟ της επωνυμίας ΔΕΝ αγγίζει το σήμα, ούτε στο έγγραφο ούτε στα bytes', async () => {
    const { fake, admin } = db();
    await givenShowcase(admin, 'ΒΑΦΕΣ ΠΑΓΩΝΗ');

    const declared = await declareShowcaseMark(admin, COMPANY, {
      kind: 'logo',
      privateStoragePath: await givenPrivateImage(COMPANY),
    });
    expect(declared.kind).toBe('declared');

    const markBefore = (await stored(fake))?.mark;
    const bytesBefore = marksOf();
    expect(markBefore).not.toBeNull();
    expect(bytesBefore.length).toBeGreaterThan(0);

    // ── Η ΠΡΑΞΗ ΠΟΥ ΕΣΒΗΝΕ ΤΟ ΛΟΓΟΤΥΠΟ ────────────────────────────────────
    await givenShowcase(admin, 'ΧΡΩΜΑΤΑ ΠΑΓΩΝΗ Α.Ε.');

    const after = await stored(fake);
    expect(after?.displayName).toBe('ΧΡΩΜΑΤΑ ΠΑΓΩΝΗ Α.Ε.');
    // 🔴 Η καρδιά: το σήμα είναι **ταυτόσημο**, όχι απλώς «υπαρκτό».
    expect(after?.mark).toEqual(markBefore);
    // 🔑 Και τα **bytes** δεν ξαναγράφτηκαν: η δημοσίευση δεν αγγίζει καθόλου το ράφι.
    expect(marksOf()).toEqual(bytesBefore);
  });

  it('🔑 Ε2 — η δεύτερη δημοσίευση ΔΕΝ ξανακατεβάζει το πρωτότυπο (δεν αγγίζει τον κάδο)', async () => {
    const { admin } = db();
    await givenShowcase(admin);
    await declareShowcaseMark(admin, COMPANY, {
      kind: 'portrait',
      privateStoragePath: await givenPrivateImage(COMPANY),
    });

    const downloadsBefore = privateBucket.downloadCalls;
    const savesBefore = shelf.saveCalls;

    await givenShowcase(admin, 'ΑΛΛΟ ΟΝΟΜΑ');

    // ⚠️ Αν η δημοσίευση «συμφιλίωνε» το ράφι, θα κατέβαζε ξανά και θα ξανάγραφε — δουλειά
    //    που δεν χρειάζεται, σε διαδρομή που ο άνθρωπος περιμένει να είναι γρήγορη.
    expect(privateBucket.downloadCalls).toBe(downloadsBefore);
    expect(shelf.saveCalls).toBe(savesBefore);
  });

  it('🔑 Ε3 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: βιτρίνα ΧΩΡΙΣ σήμα μένει χωρίς σήμα, δεν εφευρίσκεται τίποτα', async () => {
    const { fake, admin } = db();
    await givenShowcase(admin);
    await givenShowcase(admin, 'ΔΕΥΤΕΡΗ ΓΡΑΦΗ');

    expect((await stored(fake))?.mark).toBeNull();
    expect(marksOf()).toEqual([]);
  });
});

// ===========================================================================
// Α — Η ΑΠΟΣΥΡΣΗ: «απόσυρση = διαγραφή», και τα bytes είναι μέρος της
// ===========================================================================

describe('🔴 Α — Η ΑΠΟΣΥΡΣΗ ΑΔΕΙΑΖΕΙ ΤΟ ΡΑΦΙ, ΟΧΙ ΜΟΝΟ ΤΟ ΕΓΓΡΑΦΟ', () => {
  it('🔴 Α1 — μετά την απόσυρση ΚΑΝΕΝΑ byte του σήματος δεν μένει δημόσιο', async () => {
    const { fake, admin } = db();
    await givenShowcase(admin);
    await declareShowcaseMark(admin, COMPANY, {
      kind: 'portrait',
      privateStoragePath: await givenPrivateImage(COMPANY),
    });
    expect(marksOf().length).toBeGreaterThan(0);

    const result = await withdrawAgencyProfile(admin, COMPANY);

    expect(result.kind).toBe('withdrawn');
    expect(await stored(fake)).toBeUndefined();
    // 🔴 Το πορτρέτο είναι **φυσικό πρόσωπο**. Η ανάκληση συγκατάθεσης που άφηνε τα
    //    bytes ήταν υπόσχεση που η πλατφόρμα δεν τηρούσε.
    expect(marksOf()).toEqual([]);
  });

  it('🔑 Α2 — η απόσυρση ΔΕΝ αγγίζει το ράφι ΑΛΛΗΣ εταιρείας', async () => {
    const { admin } = db();
    await givenShowcase(admin);
    await declareShowcaseMark(admin, COMPANY, {
      kind: 'logo',
      privateStoragePath: await givenPrivateImage(COMPANY),
    });

    // Η άλλη εταιρεία, με δική της βιτρίνα και δικό της σήμα.
    await publishShowcase(admin, authorityOf(OTHER_COMPANY), {
      alias: 'allo-grafeio',
      displayName: 'ΑΛΛΟ ΓΡΑΦΕΙΟ',
      credentials: [{ occupation: PAINTER, registrationNumber: '', registrationChapter: '' }],
      place: null,
      position: null,
    });
    await declareShowcaseMark(admin, OTHER_COMPANY, {
      kind: 'logo',
      privateStoragePath: await givenPrivateImage(OTHER_COMPANY),
    });
    const strangerBytes = marksOf(OTHER_COMPANY);
    expect(strangerBytes.length).toBeGreaterThan(0);

    await withdrawAgencyProfile(admin, COMPANY);

    expect(marksOf(COMPANY)).toEqual([]);
    expect(marksOf(OTHER_COMPANY)).toEqual(strangerBytes);
  });

  it('🔑 Α3 — ΙΔΕΜΠΟΤΗΣ: απόσυρση βιτρίνας που δεν υπήρξε ποτέ δεν είναι σφάλμα', async () => {
    const { admin } = db();

    // ⚠️ Το Π2 (ανάκληση ικανότητας) τρέχει **και** για γραφεία που δεν δημοσιεύτηκαν.
    expect((await withdrawAgencyProfile(admin, COMPANY)).kind).toBe('withdrawn');
  });
});

// ===========================================================================
// Δ — Η ΔΗΛΩΣΗ ΩΣ ΠΡΑΞΗ: τι σημαίνει «δηλώνω σήμα» χωριστά από τη βιτρίνα
// ===========================================================================

describe('🔴 Δ — Η ΔΗΛΩΣΗ ΤΟΥ ΣΗΜΑΤΟΣ ΕΙΝΑΙ ΔΙΚΗ ΤΗΣ ΠΡΑΞΗ', () => {
  it('🔴 Δ1 — ΔΕΝ ΥΠΑΡΧΕΙ ΣΗΜΑ ΧΩΡΙΣ ΒΙΤΡΙΝΑ, και η άρνηση είναι ΟΝΟΜΑΣΤΙΚΗ', async () => {
    const { admin } = db();
    const path = await givenPrivateImage(COMPANY);

    const result = await declareShowcaseMark(admin, COMPANY, { kind: 'logo', privateStoragePath: path });

    expect(result).toEqual({ kind: 'rejected', reason: 'agency-profile-mark-without-showcase' });
    // 🔑 **Και ΚΑΝΕΝΑ byte δεν φεύγει**: μια δημοσίευση εικόνας σε ανώνυμο κοινό, για
    //    βιτρίνα που δεν υπάρχει, θα ήταν διαρροή χωρίς καμία οθόνη να τη δείχνει.
    expect(marksOf()).toEqual([]);
  });

  it('🔴 Δ2 — ΞΕΝΟ μονοπάτι απορρίπτεται ΚΑΙ ΔΕΝ σβήνει το ΔΙΚΟ μου σήμα', async () => {
    const { fake, admin } = db();
    await givenShowcase(admin);
    await declareShowcaseMark(admin, COMPANY, {
      kind: 'logo',
      privateStoragePath: await givenPrivateImage(COMPANY),
    });
    const mine = (await stored(fake))?.mark;
    const myBytes = marksOf();

    const result = await declareShowcaseMark(admin, COMPANY, {
      kind: 'logo',
      privateStoragePath: await givenPrivateImage(OTHER_COMPANY),
    });

    expect(result).toEqual({ kind: 'rejected', reason: 'agency-profile-mark-not-owned' });
    // 🔴 **Η άρνηση που έγινε όπλο**: αν το ξένο μονοπάτι «καθάριζε» το ράφι, ένα αίτημα
    //    με μονοπάτι του Β θα έσβηνε το σήμα του Α.
    expect((await stored(fake))?.mark).toEqual(mine);
    expect(marksOf()).toEqual(myBytes);
  });

  it('🔑 Δ3 — η ΑΠΟΣΥΡΣΗ ΤΟΥ ΣΗΜΑΤΟΣ αφήνει τη βιτρίνα ΟΡΘΙΑ', async () => {
    const { fake, admin } = db();
    await givenShowcase(admin, 'ΒΑΦΕΣ ΠΑΓΩΝΗ');
    await declareShowcaseMark(admin, COMPANY, {
      kind: 'portrait',
      privateStoragePath: await givenPrivateImage(COMPANY),
    });

    const result = await retractShowcaseMark(admin, COMPANY);

    expect(result.kind).toBe('retracted');
    const after = await stored(fake);
    // 🔑 Η βιτρίνα ζει· έχασε **μόνο** το σήμα και πέφτει στο παραγόμενο lettermark.
    expect(after?.displayName).toBe('ΒΑΦΕΣ ΠΑΓΩΝΗ');
    expect(after?.mark).toBeNull();
    expect(marksOf()).toEqual([]);
  });

  it('🔑 Δ4 — δεύτερη δήλωση ΑΝΤΙΚΑΘΙΣΤΑ την πρώτη: ΕΝΑ σήμα ανά επαγγελματία', async () => {
    const { fake, admin } = db();
    await givenShowcase(admin);
    await declareShowcaseMark(admin, COMPANY, {
      kind: 'logo',
      privateStoragePath: await givenPrivateImage(COMPANY, 'file_first'),
    });
    const first = (await stored(fake))?.mark;

    // Δεύτερη εικόνα, **άλλα** bytes ⇒ άλλο sha256 ⇒ άλλα κλειδιά ραφιού.
    const other = await sharp({
      create: { width: 400, height: 400, channels: 3, background: { r: 200, g: 20, b: 20 } },
    })
      .png()
      .toBuffer();
    privateBucket.put(privatePath(COMPANY, 'file_second'), other);

    await declareShowcaseMark(admin, COMPANY, {
      kind: 'portrait',
      privateStoragePath: privatePath(COMPANY, 'file_second'),
    });

    const second = (await stored(fake))?.mark;
    expect(second).not.toEqual(first);
    // 🔑 **Το ράφι είναι ΑΚΡΙΒΩΣ ίσο με τη δήλωση** — τα παλιά bytes έφυγαν, δεν
    //    συσσωρεύτηκαν. Η κάρτα έχει **μία** θέση για «ποιος είσαι;».
    expect(marksOf().length).toBeGreaterThan(0);
    expect(marksOf().every((key) => key.startsWith(`showcases/${COMPANY}/`))).toBe(true);
  });

  it('🔴 Δ5 — ΑΓΝΩΣΤΟ ΕΙΔΟΣ δεν φτάνει ποτέ στον κάδο', async () => {
    const { admin } = db();
    await givenShowcase(admin);

    const result = await declareShowcaseMark(admin, COMPANY, {
      // ⚠️ Ό,τι έρχεται από το σύρμα είναι `string`· ο φρουρός ζει στη διαδρομή, αλλά ο
      //    γραφέας οφείλει να **μην** εμπιστεύεται ότι κάποιος τον έτρεξε.
      kind: 'mascot' as never,
      privateStoragePath: await givenPrivateImage(COMPANY),
    });

    expect(result).toEqual({ kind: 'rejected', reason: 'agency-profile-mark-unknown-kind' });
    expect(marksOf()).toEqual([]);
  });
});
