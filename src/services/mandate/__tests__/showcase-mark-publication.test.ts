/**
 * @jest-environment node
 *
 * ⚠️ **`node` και ΟΧΙ `jsdom`, και είναι απαίτηση εκτέλεσης**: το `sharp` καλεί
 * `structuredClone`, που στο jsdom **δεν υπάρχει** — η σουίτα θα «περνούσε» με κάθε
 * εικόνα να μετριέται ως **μη αποκωδικοποιήσιμη**, δηλαδή θα φύλαγε **σιωπή**.
 *
 * @fileoverview 🏆 **Η ΑΓΚΥΡΑ ΤΟΥ ΤΡΙΤΟΥ ΠΑΡΑΓΩΓΟΥ** — από τη δήλωση ως τα bytes
 *   (ADR-841 §7 Α21, Στάδιο 2).
 * @related services/mandate/showcase-mark-publication · services/upload/utils/public-shelf-kinds
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΑΥΤΗ Η ΣΟΥΙΤΑ ΕΙΝΑΙ Ο ΛΟΓΟΣ ΠΟΥ ΤΟ ΣΤΑΔΙΟ 2 ΕΓΙΝΕ ΕΤΣΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το Στάδιο 2 **όπως είχε σχεδιαστεί** γενίκευε το ράφι σε «είδη» **χωρίς κανέναν
 * καταναλωτή** — ο καταναλωτής θα ερχόταν αργότερα, με την οθόνη. Αυτό συγκρούεται με
 * ρητό κανόνα του repo *(«μετακινούμε καταναλωτές, όχι αρχεία»)* και με την ίδια την
 * τιμωρία που το ADR-841 έγραψε για το `glb`: **μορφή δηλωμένη χωρίς μηχανισμό που να
 * την παράγει είναι υπόσχεση, όχι κώδικας**.
 *
 * ⚠️ Και το μετρημένο κόστος θα ήταν **ακριβώς εδώ**: μια ρίζα `showcases/` που κανείς
 * δεν γράφει δίνει άγκυρες πάνω σε **νεκρό δίδυμο** — και το repo έχει ήδη μετρήσει ότι
 * *«κάλυψη σε νεκρό δίδυμο δεν είναι κάλυψη»*.
 *
 * 🏆 **ΓΙ' ΑΥΤΟ ΑΥΤΗ Η ΣΟΥΙΤΑ ΔΕΝ ΕΛΕΓΧΕΙ ΤΥΠΟΥΣ — ΕΚΤΕΛΕΙ ΔΗΜΟΣΙΕΥΣΗ.** Ψεύτικος
 * κάδος, **αληθινό** `sharp`, αληθινό sha256: μετά την κλήση υπάρχουν **αντικείμενα
 * κάτω από `showcases/comp_…/`** — και κανένα κάτω από `listings/`.
 */

import sharp from 'sharp';

import {
  LISTING_SHELF,
  SHOWCASE_SHELF,
  shelfRecipe,
} from '@/services/upload/utils/public-shelf-kinds';

// 🔑 **Ο ψεύτικος κάδος είναι ΚΟΙΝΟΣ** (N.18 / CHECK 3.28): ζούσε αυτούσιος και εδώ και
//    στο `public-shelf-service.test.ts`, και η Φάση 2 θα τον έκανε **τρίτο**.
import { FakeShelfBucket } from '@/services/upload/__fixtures__/fake-shelf-bucket';

// 🔑 **Ο ψεύτικος Firestore είναι ΚΙ ΑΥΤΟΣ ΚΟΙΝΟΣ** (N.18): η `FakeFirestore` ζει ήδη
//    στο `services/places/__tests__` και τη χρησιμοποιεί ο κριτής της φορολογικής
//    ταυτότητας. Δεύτερη υλοποίηση εδώ θα ήταν το κλασικό sibling clone.
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';

const shelf = new FakeShelfBucket();
const privateBucket = new FakeShelfBucket();
const db = new FakeFirestore();

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminStorage: () => ({ bucket: () => shelf }),
  getAdminBucket: () => privateBucket,
  // 🔴 **Α21.12**: ο γραφέας καταγράφει πλέον **πού ήταν το πρωτότυπο**. Χωρίς αυτή τη
  //    γραμμή η σουίτα θα έσκαγε σε `getAdminFirestore is not a function` — δηλαδή το
  //    mock θα ήταν **στενότερο από τον κώδικα που δοκιμάζει**.
  getAdminFirestore: () => db,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { publishShowcaseMark, markSourceForCompany } = require('../showcase-mark-publication') as
  typeof import('../showcase-mark-publication');

// ---------------------------------------------------------------------------
// Βοηθοί
// ---------------------------------------------------------------------------

const COMPANY = 'comp_9c7c1a50';
const OTHER_COMPANY = 'comp_ff000000';

/** Το κανονικό ιδιωτικό μονοπάτι ενός αρχείου εταιρείας (ADR-709). */
function privatePath(companyId: string, fileId = 'file_logo'): string {
  return `companies/${companyId}/entities/company/${companyId}/domains/admin/categories/photos/files/${fileId}.png`;
}

/** Βάζει μια αληθινή εικόνα στον **ιδιωτικό** κάδο και επιστρέφει το μονοπάτι της. */
async function putPrivateImage(companyId: string, fileId = 'file_logo'): Promise<string> {
  const bytes = await sharp({
    create: { width: 512, height: 512, channels: 3, background: { r: 10, g: 90, b: 200 } },
  })
    .png()
    .toBuffer();

  const path = privatePath(companyId, fileId);
  privateBucket.put(path, bytes);
  return path;
}

const shelfKeys = (): string[] => shelf.keys();

beforeEach(() => {
  shelf.reset();
  privateBucket.reset();
  // 🔴 **Α21.12**: ο ψεύτικος Firestore είναι αιχμαλωτισμένος στο `jest.mock`, άρα
  //    **δεν** ξαναγεννιέται ανά test. Χωρίς μηδενισμό, η σημείωση του προηγούμενου
  //    test κάνει το επόμενο να περνά ή να κόβει για **λάθος λόγο** — μετρημένο.
  db.reset();
});

// ===========================================================================

describe('🔴 Κ1 — Ο ΦΡΟΥΡΟΣ ΚΑΤΟΧΗΣ: το μονοπάτι έρχεται από το ΣΥΡΜΑ', () => {
  // ────────────────────────────────────────────────────────────────────────
  // Οι δύο άλλοι παραγωγοί παίρνουν μονοπάτια από **αποθηκευμένο έγγραφο** που ο
  // άνθρωπος ήδη κατέχει· εδώ το στέλνει ο πελάτης. Χωρίς φρουρό, ο επαγγελματίας Α
  // δηλώνει μονοπάτι του Β και το **δημοσιεύει σε ανώνυμο κοινό**.
  // ────────────────────────────────────────────────────────────────────────

  it('δέχεται μονοπάτι μέσα στον ΔΙΚΟ του χώρο', () => {
    expect(
      markSourceForCompany(COMPANY, { kind: 'logo', privateStoragePath: privatePath(COMPANY) }),
    ).toEqual({
      privateStoragePath: privatePath(COMPANY),
      material: { kind: 'logo' },
    });
  });

  it('🔴 ΑΠΟΡΡΙΠΤΕΙ μονοπάτι ΞΕΝΗΣ εταιρείας', () => {
    expect(
      markSourceForCompany(COMPANY, {
        kind: 'logo',
        privateStoragePath: privatePath(OTHER_COMPANY),
      }),
    ).toBeNull();
  });

  it('απορρίπτει ό,τι δεν είναι κανονικό μονοπάτι εταιρείας', () => {
    for (const path of [
      '',
      'owner_properties/user_1/photo.png',
      `companies/${COMPANY}`,
      `../companies/${COMPANY}/entities/company/x/domains/admin/categories/photos/files/f.png`,
    ]) {
      expect(markSourceForCompany(COMPANY, { kind: 'logo', privateStoragePath: path })).toBeNull();
    }
  });
});

describe('🏆 Κ2 — ΑΠΟ ΑΚΡΗ ΣΕ ΑΚΡΗ: η δήλωση γίνεται bytes στον δημόσιο κάδο', () => {
  it('🔴 δημοσιεύει κάτω από `showcases/{companyId}/`, ΠΟΤΕ κάτω από `listings/`', async () => {
    const path = await putPrivateImage(COMPANY);

    const outcome = await publishShowcaseMark(COMPANY, { kind: 'logo', privateStoragePath: path });

    expect(outcome.kind).toBe('published');
    expect(shelfKeys().length).toBeGreaterThan(0);
    for (const key of shelfKeys()) {
      expect(key.startsWith(`showcases/${COMPANY}/`)).toBe(true);
      expect(key.startsWith('listings/')).toBe(false);
      // Content-addressed: sha256 των ΚΑΘΑΡΙΣΜΕΝΩΝ bytes + `.webp`.
      expect(key).toMatch(new RegExp(`^showcases/${COMPANY}/[0-9a-f]{64}\\.webp$`));
    }
  });

  it('🔑 το σήμα φέρνει ΟΛΑ τα παράγωγα της δικής του κλίμακας — όχι της γκαλερί', async () => {
    const path = await putPrivateImage(COMPANY);

    const outcome = await publishShowcaseMark(COMPANY, { kind: 'logo', privateStoragePath: path });
    if (outcome.kind !== 'published') throw new Error('περίμενα δημοσίευση');

    expect(outcome.mark.image.sources.map((s) => s.width)).toEqual([
      ...SHOWCASE_SHELF.encoding.widths,
    ]);
    // 🔴 **ΠΑΡΑΓΟΜΕΝΟ, ΟΧΙ ΓΡΑΜΜΕΝΟ ΜΕ ΤΟ ΧΕΡΙ — ΚΑΙ ΤΟ ΜΑΘΗΜΑ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΟ:**
    //    εδώ ήταν καρφωμένο `256`. Όταν η **Α21.9** πρόσθεσε τη βαθμίδα **512** για τη
    //    ζώνη, αυτή η γραμμή έγινε κόκκινη — και **έμεινε κόκκινη ασχολίαστη**, επειδή
    //    η εντολή επαλήθευσης εκείνης της συνεδρίας δεν περιλάμβανε το
    //    `src/services/mandate`. Το ίδιο σχήμα με τη «σιωπή» που κυνηγά όλο το ADR:
    //    πράσινο **επειδή κανείς δεν κοίταξε**.
    // 🔑 Το κανονικό είναι **το τελευταίο του ραφιού** — και η κλίμακα του σήματος,
    //    ποτέ της γκαλερί: το επόμενο `expect` κρατά **αυτό** το νόημα δεμένο.
    const widths = SHOWCASE_SHELF.encoding.widths;
    expect(outcome.mark.image.width).toBe(widths[widths.length - 1]);
    expect(outcome.mark.image.width).toBeLessThan(LISTING_SHELF.encoding.widths.at(-1)!);
    expect(outcome.mark.image.url).toBe(
      outcome.mark.image.sources[outcome.mark.image.sources.length - 1].url,
    );
  });

  it('τα αντικείμενα κουβαλούν τη ΔΙΚΗ ΤΟΥΣ συνταγή, όχι της γκαλερί', async () => {
    const path = await putPrivateImage(COMPANY);
    await publishShowcaseMark(COMPANY, { kind: 'logo', privateStoragePath: path });

    // 🔴 Αν η συνταγή ήταν κοινή, τα παράγωγα του ενός είδους θα περνούσαν για έγκυρα
    //    του άλλου — και επειδή η γρήγορη διαδρομή δεν κατεβάζει bytes, ΑΟΡΑΤΑ.
    // 🔑 **Η ΣΥΝΤΑΓΗ ΡΩΤΙΕΤΑΙ ΑΠΟ ΤΗ ΓΡΑΜΜΗ** (Α21.10), όπως στην παραγωγή: το
    //    πλαισίωμα εξαρτάται από το **υλικό**, άρα το λογότυπο γράφει **άλλη** συνταγή
    //    από το πορτρέτο της **ίδιας** ρίζας. Ένα σταθερό `FRAMING_AS_GIVEN` εδώ θα
    //    έλεγχε συνταγή που **κανείς δεν γράφει**.
    const logoRecipe = shelfRecipe(SHOWCASE_SHELF.encoding, SHOWCASE_SHELF.framingOf({ kind: 'logo' }));

    for (const saved of shelf.objects.values()) {
      expect(saved.custom?.shelfRecipe).toBe(logoRecipe);
      expect(saved.custom?.shelfRecipe).not.toBe(
        shelfRecipe(LISTING_SHELF.encoding, LISTING_SHELF.framingOf({ kind: 'photo' })),
      );
      expect(saved.contentType).toBe('image/webp');
    }
  });

  it('🔴 Α21.10 — ΛΟΓΟΤΥΠΟ και ΠΟΡΤΡΕΤΟ γράφουν ΔΙΑΦΟΡΕΤΙΚΗ συνταγή στην ΙΔΙΑ ρίζα', async () => {
    // Αλλιώς ένα άτριφτο πορτρέτο θα περνούσε για τριμμένο λογότυπο και **δεν θα
    // ξαναπαραγόταν ποτέ** — η γρήγορη διαδρομή δεν αποκωδικοποιεί τίποτα.
    const path = await putPrivateImage(COMPANY);

    await publishShowcaseMark(COMPANY, { kind: 'logo', privateStoragePath: path });
    const asLogo = [...shelf.objects.values()].map((o) => o.custom?.shelfRecipe);

    // 🔑 **ΓΙΑΤΙ ΜΗΔΕΝΙΖΕΤΑΙ ΤΟ ΡΑΦΙ — ΙΔΙΟΤΗΤΑ ΠΟΥ ΒΡΗΚΕ ΑΥΤΗ Η ΑΓΚΥΡΑ.** Το δείγμα
    //    είναι ομοιόχρωμο, άρα ο κριτής του περιγράμματος το κρίνει `body` και **δεν
    //    τρίβεται** — οπότε λογότυπο και πορτρέτο δίνουν **ταυτόσημα bytes** ⇒ ταυτόσημο
    //    sha256 ⇒ **ίδια κλειδιά**. Ο γραφέας γράφει μεταδεδομένα **μόνο μαζί με νέα
    //    bytes** *(δηλωμένο συμβόλαιο του `uploadMissing`)*, άρα η παλιά συνταγή **μένει**.
    // ✅ **Και είναι ασφαλές προς τη σωστή κατεύθυνση**: παλιά συνταγή ⇒ αστοχία της
    //    γρήγορης διαδρομής ⇒ **ξανακωδικοποίηση**. Ποτέ το αντίστροφο, δηλαδή ποτέ
    //    επαναχρήση bytes που παρήχθησαν με **άλλη** συνταγή. Χρεώνει μια περιττή
    //    κωδικοποίηση, δεν δημοσιεύει ποτέ λάθος bytes.
    // ⇒ Εδώ ρωτάμε *«τι γράφει μια ΚΑΘΑΡΗ δημοσίευση;»*, που είναι το ερώτημα της Α21.10.
    shelf.reset();

    await publishShowcaseMark(COMPANY, { kind: 'portrait', privateStoragePath: path });
    const asPortrait = [...shelf.objects.values()].map((o) => o.custom?.shelfRecipe);

    expect(new Set(asLogo).size).toBe(1);
    expect(new Set(asPortrait).size).toBe(1);
    expect(asPortrait[0]).not.toBe(asLogo[0]);
  });

  it('🔴 το `altKey` βγαίνει από το ΕΙΔΟΣ — λογότυπο ≠ πρόσωπο', async () => {
    const logoPath = await putPrivateImage(COMPANY, 'file_logo');
    const logo = await publishShowcaseMark(COMPANY, {
      kind: 'logo',
      privateStoragePath: logoPath,
    });
    if (logo.kind !== 'published') throw new Error('περίμενα δημοσίευση');

    const portrait = await publishShowcaseMark(COMPANY, {
      kind: 'portrait',
      privateStoragePath: logoPath,
    });
    if (portrait.kind !== 'published') throw new Error('περίμενα δημοσίευση');

    expect(logo.mark.kind).toBe('logo');
    expect(portrait.mark.kind).toBe('portrait');
    expect(logo.mark.image.altKey).not.toBe(portrait.mark.image.altKey);
    // Κλειδιά i18n, ποτέ ωμό κείμενο (N.11).
    expect(logo.mark.image.altKey).toMatch(/^property-market:/);
  });
});

describe('🔑 Κ3 — Η ΑΠΟΣΥΡΣΗ ΕΡΧΕΤΑΙ ΔΩΡΕΑΝ: κενή δήλωση ⇒ το πρόθεμα ΑΔΕΙΑΖΕΙ', () => {
  it('`null` σβήνει ό,τι είχε δημοσιευτεί', async () => {
    const path = await putPrivateImage(COMPANY);
    await publishShowcaseMark(COMPANY, { kind: 'logo', privateStoragePath: path });
    expect(shelfKeys().length).toBeGreaterThan(0);

    const outcome = await publishShowcaseMark(COMPANY, null);

    expect(outcome).toEqual({ kind: 'cleared' });
    expect(shelfKeys()).toEqual([]);
  });

  it('🔴 και ΔΕΝ αγγίζει το ράφι ΑΛΛΗΣ εταιρείας', async () => {
    const mine = await putPrivateImage(COMPANY);
    const theirs = await putPrivateImage(OTHER_COMPANY, 'file_theirs');
    await publishShowcaseMark(COMPANY, { kind: 'logo', privateStoragePath: mine });
    await publishShowcaseMark(OTHER_COMPANY, { kind: 'logo', privateStoragePath: theirs });

    await publishShowcaseMark(COMPANY, null);

    expect(shelfKeys().every((key) => key.startsWith(`showcases/${OTHER_COMPANY}/`))).toBe(true);
    expect(shelfKeys().length).toBeGreaterThan(0);
  });
});

describe('🔴 Κ4 — Η ΑΡΝΗΣΗ ΕΙΝΑΙ ΟΝΟΜΑΣΤΙΚΗ, ΚΑΙ ΔΕΝ ΓΙΝΕΤΑΙ ΟΠΛΟ', () => {
  it('ξένο μονοπάτι ⇒ ονομασμένη άρνηση, ΚΑΝΕΝΑ byte δεν διαβάζεται', async () => {
    await putPrivateImage(OTHER_COMPANY, 'file_theirs');

    const outcome = await publishShowcaseMark(COMPANY, {
      kind: 'logo',
      privateStoragePath: privatePath(OTHER_COMPANY, 'file_theirs'),
    });

    expect(outcome).toEqual({ kind: 'refused', reason: 'showcase-mark-not-owned' });
    expect(shelfKeys()).toEqual([]);
  });

  it('🏆 η άρνηση ΔΕΝ σβήνει το ΥΠΑΡΧΟΝ σήμα — αλλιώς θα ήταν εργαλείο σαμποτάζ', async () => {
    // Αν η άρνηση περνούσε από τη «συμφιλίωση με κενό σύνολο», ένα αίτημα με ξένο
    // μονοπάτι θα **έσβηνε το δικό μου** σήμα. Η άρνηση σταματά ΠΡΙΝ τον κάδο.
    const mine = await putPrivateImage(COMPANY);
    await publishShowcaseMark(COMPANY, { kind: 'logo', privateStoragePath: mine });
    const before = shelfKeys();

    await publishShowcaseMark(COMPANY, {
      kind: 'logo',
      privateStoragePath: privatePath(OTHER_COMPANY),
    });

    expect(shelfKeys()).toEqual(before);
  });

  it('πηγή που ΔΕΝ είναι εικόνα ⇒ `unpublishable`, όχι κατάρρευση', async () => {
    const path = privatePath(COMPANY, 'file_broken');
    privateBucket.put(path, Buffer.from('δεν είναι εικόνα'));

    const outcome = await publishShowcaseMark(COMPANY, { kind: 'logo', privateStoragePath: path });

    expect(outcome).toEqual({ kind: 'refused', reason: 'showcase-mark-unpublishable' });
  });
});

describe('🔑 Κ5 — ΙΔΕΜΠΟΤΕΝΤΙΚΟΤΗΤΑ: ίδια δήλωση δύο φορές ⇒ ίδιο ράφι', () => {
  it('η δεύτερη κλήση δεν προσθέτει αντικείμενα', async () => {
    const path = await putPrivateImage(COMPANY);

    await publishShowcaseMark(COMPANY, { kind: 'logo', privateStoragePath: path });
    const first = shelfKeys().sort();

    await publishShowcaseMark(COMPANY, { kind: 'logo', privateStoragePath: path });

    expect(shelfKeys().sort()).toEqual(first);
  });
});

// ===========================================================================
// Κ7 — Η ΣΗΜΕΙΩΣΗ ΤΗΣ ΠΡΟΕΛΕΥΣΗΣ (ADR-841 §7 Α21.12)
// ===========================================================================

describe('🏆 Κ7 — ΤΟ ΣΥΣΤΗΜΑ ΘΥΜΑΤΑΙ ΠΟΥ ΗΤΑΝ ΤΟ ΠΡΩΤΟΤΥΠΟ', () => {
  const SOURCES = 'showcase_mark_sources';

  it('🔴 μετά από ΕΠΙΤΥΧΗ δημοσίευση, η προέλευση καταγράφεται με κλειδί το companyId', async () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: βγάλε το `recordShowcaseMarkSource` από το
    //    `publishShowcaseMark` ⇒ κοκκινίζει, και μαζί του πεθαίνει η δυνατότητα
    //    μαζικής αναπαραγωγής.
    const path = await putPrivateImage(COMPANY);

    const outcome = await publishShowcaseMark(COMPANY, { kind: 'logo', privateStoragePath: path });
    expect(outcome.kind).toBe('published');

    const saved = await db.collection(SOURCES).doc(COMPANY).get();
    expect(saved.exists).toBe(true);
    expect(saved.data()).toMatchObject({
      companyId: COMPANY,
      kind: 'logo',
      privateStoragePath: path,
    });
  });

  it('🔴 ΞΕΝΟ μονοπάτι ΔΕΝ αφήνει σημείωση — ο φρουρός κατοχής προηγείται', async () => {
    // Αλλιώς η επόμενη μαζική σάρωση θα διάβαζε μονοπάτι που **απορρίφθηκε** και θα
    // προσπαθούσε να το δημοσιεύσει ξανά, για πάντα.
    const foreign = await putPrivateImage(OTHER_COMPANY, 'file_xeno');

    const outcome = await publishShowcaseMark(COMPANY, {
      kind: 'logo',
      privateStoragePath: foreign,
    });

    expect(outcome.kind).toBe('refused');
    expect((await db.collection(SOURCES).doc(COMPANY).get()).exists).toBe(false);
  });

  it('🔴 η ΑΠΟΣΥΡΣΗ παίρνει τη σημείωση μαζί της — αλλιώς η σάρωση ΑΝΑΣΤΑΙΝΕΙ το σήμα', async () => {
    // 🔑 Ίδια αρχή με το ράφι: «απόσυρση = το πρόθεμα αδειάζει». Σημείωση που επιβιώνει
    //    θα ήταν **δεύτερη κατάσταση** δίπλα στην ύπαρξη του εγγράφου, ελεύθερη να
    //    διαφωνήσει μαζί της — και η διαφωνία θα ξαναέφερνε στον κόσμο εικόνα που ο
    //    άνθρωπος αφαίρεσε.
    const path = await putPrivateImage(COMPANY);
    await publishShowcaseMark(COMPANY, { kind: 'logo', privateStoragePath: path });
    expect((await db.collection(SOURCES).doc(COMPANY).get()).exists).toBe(true);

    await publishShowcaseMark(COMPANY, null);

    expect((await db.collection(SOURCES).doc(COMPANY).get()).exists).toBe(false);
  });

  it('🔑 δεύτερη δήλωση ΑΝΤΙΚΑΘΙΣΤΑ, δεν προσθέτει — ΜΙΑ απάντηση ανά οργανισμό', async () => {
    const first = await putPrivateImage(COMPANY, 'file_proto');
    const second = await putPrivateImage(COMPANY, 'file_deutero');

    await publishShowcaseMark(COMPANY, { kind: 'logo', privateStoragePath: first });
    await publishShowcaseMark(COMPANY, { kind: 'portrait', privateStoragePath: second });

    const all = db.all<{ privateStoragePath: string; kind: string }>(SOURCES);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ privateStoragePath: second, kind: 'portrait' });
  });
});
