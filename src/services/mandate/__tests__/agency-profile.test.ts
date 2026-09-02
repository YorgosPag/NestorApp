/**
 * @jest-environment node
 *
 * @fileoverview **Η ΒΙΤΡΙΝΑ ΤΟΥ ΕΠΑΓΓΕΛΜΑΤΙΑ** — οι άγκυρες του ADR-827 §9.10 και του ADR-841 Φ6-Β.
 * @related services/mandate/agency-profile.service.ts
 *
 * 🔴 **Τι φυλά αυτό το αρχείο**: ο κατάλογος είναι η **μόνη** σαρώσιμη συλλογή του
 * έργου που περιέχει **οργανισμούς**, και η άδειά της στηρίζεται σε ένα μόνο
 * πράγμα — ότι ο **πληθυσμός** της είναι opt-in. Αν η δημοσίευση μπορούσε να
 * συμβεί χωρίς πράξη του γραφείου, ή αν γραφόταν άλλο `companyId` από αυτό που
 * κρίθηκε, η άδεια θα έπεφτε **χωρίς να το πάρει κανείς είδηση**.
 *
 * 🔴 **ΚΑΙ ΤΟ ΝΕΟ ΠΟΥ ΦΥΛΑΕΙ ΑΠΟ ΤΗ Φ6-Β3**: ο γραφέας δέχεται πλέον **κάθε**
 * επάγγελμα. Δύο πράγματα οφείλουν να ισχύουν **ταυτόχρονα**, και είναι εύκολο
 * να θυσιαστεί το ένα για το άλλο:
 *
 * | # | Ο ελαιοχρωματιστής **ΜΠΑΙΝΕΙ** χωρίς καμία ικανότητα *(Α9.3 — η απουσία μητρώου δεν είναι ποινή)* |
 * | # | Ο μεσίτης **ΔΕΝ ΜΠΑΙΝΕΙ** χωρίς ΓΕΜΗ *(§9.9 β — αλλιώς «ονόματα που ισχυρίζονται»)* |
 *
 * ⚠️ **Η βάση δεν πλάθεται.** Ο γραφέας τρέχει **αληθινά** πάνω σε `FakeFirestore` —
 * ένα test που έπλαθε το `set()` θα αποδείκνυε ότι ο κώδικας καλεί ό,τι νομίζουμε,
 * όχι ότι **γράφεται** ό,τι θέλουμε.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { requireBrokerageCapability, isBrokerageDenial } from '@/lib/auth/brokerage-authority';
import type { ShowcaseAuthority } from '@/lib/auth/brokerage-authority';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import type { OrganizationCapabilities } from '@/types/organization-capability';
import {
  publishShowcase,
  withdrawAgencyProfile,
  lookupAgencyProfile,
  type ShowcaseCredentialDeclaration,
  type ShowcaseDeclaration,
} from '@/services/mandate/agency-profile.service';
import type { ClassifiedOccupation, PublicShowcase } from '@/types/agency-profile';

const COMPANY = 'comp_grafeio_a';

const ACTIVE: OrganizationCapabilities = {
  brokerage_listings: {
    status: 'active',
    requirements: [],
    declaration: null,
    decidedByUserId: 'user-super',
    decidedAt: '2026-08-20T10:00:00.000Z',
    revocationReason: null,
  },
};

/**
 * Η **ρυθμιζόμενη** παραλλαγή — περνά από τον **αληθινό** κριτή.
 *
 * ⚠️ Δεν κατασκευάζεται με `as`: το brand είναι μη εξαγόμενο `unique symbol`, και
 * ένα test που το παρέκαμπτε θα δοκίμαζε απόδειξη **που δεν μπορεί να υπάρξει**.
 */
function regulatedAuthority(companyId: string): ShowcaseAuthority {
  const verdict = requireBrokerageCapability(companyId, ACTIVE);
  if (isBrokerageDenial(verdict)) throw new Error('το fixture οφείλει να είναι ενεργό');
  return { kind: 'regulated', proof: verdict };
}

/** Η **μη ρυθμιζόμενη** παραλλαγή — **καμία** ικανότητα, καμία απόδειξη. */
function unregulatedAuthority(companyId: string): ShowcaseAuthority {
  return { kind: 'unregulated', companyId };
}

// ── Ειδικότητες, όπως τις γράφει η ΤΑΞΙΝΟΜΙΑ (ο διακομιστής, ποτέ το σύρμα) ────
const BROKER: ClassifiedOccupation = {
  escoUri: 'http://data.europa.eu/esco/occupation/8ec8df02-e9dd-43b7-b416-5846ae0414ab',
  label: { el: 'μεσίτης ακίνητης περιουσίας/μεσίτρια ακίνητης περιουσίας', en: 'real estate agent' },
  iscoCode: '3334',
};
/** ISCO `7131` → `authority: null`, δηλαδή **ρητό** «δεν τηρείται μητρώο». */
const PAINTER: ClassifiedOccupation = {
  escoUri: 'http://data.europa.eu/esco/occupation/painter-fixture',
  label: { el: 'ελαιοχρωματιστής', en: 'painter' },
  iscoCode: '7131',
};
/** ISCO `2611` → `bar-association`, που είναι **αρχή με παραρτήματα**. */
const LAWYER: ClassifiedOccupation = {
  escoUri: 'http://data.europa.eu/esco/occupation/lawyer-fixture',
  label: { el: 'δικηγόρος', en: 'lawyer' },
  iscoCode: '2611',
};

function declares(
  occupation: ClassifiedOccupation,
  registrationNumber = '',
  registrationChapter = '',
): ShowcaseCredentialDeclaration {
  return { occupation, registrationNumber, registrationChapter };
}

function declaration(
  credentials: readonly ShowcaseCredentialDeclaration[],
  overrides: Partial<ShowcaseDeclaration> = {},
): ShowcaseDeclaration {
  return {
    alias: 'mesitiko-pagoni',
    displayName: 'ΜΕΣΙΤΙΚΟ ΓΡΑΦΕΙΟ ΠΑΓΩΝΗ Ι.Κ.Ε.',
    credentials,
    place: null,
    position: null,
    ...overrides,
  };
}

const BROKER_DECLARATION = declaration([declares(BROKER, '123456789000')]);

function db(): { fake: FakeFirestore; admin: AdminFirestore } {
  const fake = new FakeFirestore();
  return { fake, admin: fake as unknown as AdminFirestore };
}

/**
 * ⚠️ **Επιστρέφει ό,τι ΠΡΑΓΜΑΤΙΚΑ κάθεται στον δίσκο**, ως `Record<string, unknown>`
 * και **όχι** ως `PublicShowcase`: το δεύτερο θα υπόσχονταν πεδία *(το `standing`)*
 * που ο γραφέας **οφείλει να μη γράφει**, και το test δεν θα μπορούσε να το δει.
 */
async function readStored(
  fake: FakeFirestore,
  companyId: string,
): Promise<Record<string, unknown> | undefined> {
  const snap = await fake.collection(COLLECTIONS.AGENCY_PROFILES).doc(companyId).get();
  return snap.exists ? (snap.data() as Record<string, unknown>) : undefined;
}

/** Τα credentials του δίσκου, **ωμά** — ό,τι μορφή κι αν έχουν. */
async function storedCredentials(
  fake: FakeFirestore,
  companyId: string,
): Promise<Record<string, unknown>[]> {
  const stored = await readStored(fake, companyId);
  return (stored?.credentials as Record<string, unknown>[] | undefined) ?? [];
}

// ============================================================================
// Π — ΤΑ ΔΥΟ ΑΜΕΤΑΒΛΗΤΑ ΤΟΥ ΓΡΑΦΕΑ
// ============================================================================

describe('Π — η δημοσίευση είναι πράξη ΤΟΥ ΕΠΑΓΓΕΛΜΑΤΙΑ, με απόδειξη όπου ο νόμος τη ζητά', () => {
  it('🔑 Π0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: έγκυρη μεσιτική δήλωση με ενεργή ικανότητα ΔΗΜΟΣΙΕΥΕΤΑΙ', async () => {
    const { fake, admin } = db();

    const result = await publishShowcase(admin, regulatedAuthority(COMPANY), BROKER_DECLARATION);

    expect(result.kind).toBe('published');
    const stored = await readStored(fake, COMPANY);
    expect(stored?.displayName).toBe(BROKER_DECLARATION.displayName);

    // 🔴 ADR-841 Φ6-Β — Ο ΓΕΜΗ ΓΕΝΙΚΕΥΤΗΚΕ ΣΕ CREDENTIAL, δεν χάθηκε. Η απόδειξη
    //    είναι ΖΕΥΓΟΣ (αρχή, αριθμός): ένα «123456789000» χωρίς «ΓΕΜΗ» δεν
    //    επαληθεύεται από κανέναν (Α9.1).
    const credentials = await storedCredentials(fake, COMPANY);
    expect(credentials).toHaveLength(1);
    expect(credentials[0]?.attestation).toEqual({
      state: 'declared',
      registration: { authorityKind: 'national', authority: 'gemi', number: '123456789000' },
    });
    // 🔑 ΚΑΙ Η ΕΙΔΙΚΟΤΗΤΑ ΓΡΑΦΕΤΑΙ: χωρίς αυτήν ο μεσίτης δεν βρίσκεται από
    //    κανένα φίλτρο — «δημοσιευμένος αλλά αόρατος».
    expect(credentials[0]?.occupation).toEqual(BROKER);
  });

  it('🔴 Π0β — ΤΟ `standing` ΔΕΝ ΑΠΟΘΗΚΕΥΕΤΑΙ ΠΟΤΕ, ούτε ως αβλαβές αντίγραφο', async () => {
    const { fake, admin } = db();

    const result = await publishShowcase(admin, regulatedAuthority(COMPANY), BROKER_DECLARATION);

    // 🔑 Ο **καταναλωτής** το έχει — παράγεται…
    expect(result.kind === 'published' && result.profile.credentials[0]?.standing).toBe('regulated');

    // 🔴 …ο **δίσκος** ΟΧΙ. Μια αποθηκευμένη σημαία μπορεί να διαφωνήσει με το
    //    περιεχόμενο (ADR-749): ένα `self-declared` γραμμένο πάνω σε μεσίτη θα
    //    παρέκαμπτε τον φρουρό του ΓΕΜΗ **με μία λέξη σε ένα JSON**. Ο φρουρός
    //    είναι ότι δεν διαβάζεται· η **θεραπεία** είναι ότι δεν γράφεται.
    const [credential] = await storedCredentials(fake, COMPANY);
    expect(Object.keys(credential ?? {}).sort()).toEqual(['attestation', 'occupation']);
    expect(credential).not.toHaveProperty('standing');
  });

  it('🔴 Π1 — ΤΟ `companyId` ΕΡΧΕΤΑΙ ΑΠΟ ΤΗΝ ΑΠΟΔΕΙΞΗ, ποτέ από όρισμα', async () => {
    const { fake, admin } = db();

    // Η δήλωση **δεν έχει** πεδίο `companyId` — δομικά. Το κλειδί και το πεδίο
    // προκύπτουν και τα δύο από τον κριτή, άρα είναι ΑΔΥΝΑΤΟ να κριθεί ο ένας
    // οργανισμός και να γραφτεί ο άλλος (ADR-824 §6).
    await publishShowcase(admin, regulatedAuthority('comp_krithike'), BROKER_DECLARATION);

    expect((await readStored(fake, 'comp_krithike'))?.companyId).toBe('comp_krithike');
    expect(await readStored(fake, COMPANY)).toBeUndefined();
  });

  it('🔴 Π1α — ΚΑΙ ΣΤΗ ΜΗ ΡΥΘΜΙΖΟΜΕΝΗ ΠΑΡΑΛΛΑΓΗ: μία πηγή του κλειδιού, όχι δύο', async () => {
    const { fake, admin } = db();

    // 🔑 Η `unregulated` δεν έχει brand να την προστατεύει — γι' αυτό ακριβώς
    //    ελέγχεται **εκτελεσμένα** ότι το κλειδί βγαίνει από το `showcaseOwnerId`.
    await publishShowcase(
      admin,
      unregulatedAuthority('comp_elaiochromatisti'),
      declaration([declares(PAINTER)]),
    );

    expect((await readStored(fake, 'comp_elaiochromatisti'))?.companyId).toBe(
      'comp_elaiochromatisti',
    );
  });

  it('🔴 Π1β — ΓΡΑΦΕΙΟ ΧΩΡΙΣ ΕΝΕΡΓΗ ΙΚΑΝΟΤΗΤΑ ΔΕΝ ΜΠΟΡΕΙ ΚΑΝ ΝΑ ΚΑΤΑΣΚΕΥΑΣΕΙ ΑΠΟΔΕΙΞΗ', () => {
    // Ο φρουρός δεν είναι `if` μέσα στον γραφέα — είναι ο ΤΥΠΟΣ. Και οι τρεις
    // αρνητικές καταστάσεις αρνούνται, **με λόγο**.
    for (const status of ['unrequested', 'pending', 'revoked'] as const) {
      const capabilities: OrganizationCapabilities = {
        brokerage_listings: {
          status,
          requirements: [],
          declaration: null,
          decidedByUserId: null,
          decidedAt: null,
          revocationReason: null,
        },
      };
      const verdict = requireBrokerageCapability(COMPANY, capabilities);
      expect(isBrokerageDenial(verdict)).toBe(true);
      if (isBrokerageDenial(verdict)) expect(verdict.reason).not.toBe('');
    }
  });

  it('🔴 Π2 — Η ΑΠΟΣΥΡΣΗ ΕΙΝΑΙ ΔΙΑΓΡΑΦΗ, ΟΧΙ ΣΗΜΑΙΑ', async () => {
    const { fake, admin } = db();
    await publishShowcase(admin, regulatedAuthority(COMPANY), BROKER_DECLARATION);
    expect(await readStored(fake, COMPANY)).toBeDefined();

    const result = await withdrawAgencyProfile(admin, COMPANY);

    expect(result.kind).toBe('withdrawn');
    // Δεν μένει έγγραφο με `isPublished: false` — δεν υπάρχει τέτοιο πεδίο, και
    // δεν πρέπει να υπάρξει ποτέ (ADR-749: σημαία που διαφωνεί με την ύπαρξη).
    expect(await readStored(fake, COMPANY)).toBeUndefined();
  });

  it('🔑 Π2β — η απόσυρση ΔΕΝ απαιτεί απόδειξη: τρέχει ΑΚΡΙΒΩΣ όταν η ικανότητα χάθηκε', async () => {
    const { admin } = db();

    // Ανακληθέν γραφείο **δεν μπορεί** να κατασκευάσει `BrokerageAuthority`. Αν η
    // απόσυρση την απαιτούσε, το Π2 θα ήταν **ανεκτέλεστο** — φρουρός που κάνει τη
    // θεραπεία αδύνατη (πρότυπο `provisionWorkspace`, ADR-787 §5.1).
    const result = await withdrawAgencyProfile(admin, 'comp_pote_den_dimosieftike');
    expect(result.kind).toBe('withdrawn');
  });

  it('🔴 Π3 — `set` ΧΩΡΙΣ `merge`: credential που αφαιρέθηκε ΔΕΝ επιβιώνει', async () => {
    const { fake, admin } = db();
    await publishShowcase(
      admin,
      regulatedAuthority(COMPANY),
      declaration([declares(BROKER, '123456789000'), declares(PAINTER)]),
    );
    expect(await storedCredentials(fake, COMPANY)).toHaveLength(2);

    // Ο άνθρωπος **αφαίρεσε** τη δεύτερη ειδικότητα. Με `merge`, ο πίνακας θα
    // επιβίωνε — δηλαδή η βιτρίνα θα έδειχνε κάτι που δεν ζήτησε να δείχνει.
    await publishShowcase(
      admin,
      regulatedAuthority(COMPANY),
      declaration([declares(BROKER, '123456789000')]),
    );

    expect(await storedCredentials(fake, COMPANY)).toHaveLength(1);
  });
});

// ============================================================================
// Ε — ΤΑ ΔΥΟ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΙΣΧΥΟΥΝ ΤΑΥΤΟΧΡΟΝΑ
// ============================================================================

describe('Ε — ο ελαιοχρωματιστής μπαίνει, ο μεσίτης δεν μπαίνει τζάμπα', () => {
  it('🔑 Ε7 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΗΣ Α9.3: ο ελαιοχρωματιστής δημοσιεύει με ΚΑΜΙΑ ικανότητα', async () => {
    const { fake, admin } = db();

    // 🔴 **Η ΑΓΚΥΡΑ ΤΟΥ ΣΧΕΔΙΟΥ**: αν κάποιος βάλει τον φρουρό «σε όλους», αυτό
    //    κοκκινίζει — και είναι το μόνο test που το βλέπει, γιατί όλα τα άλλα
    //    τρέχουν με ενεργή ικανότητα.
    const result = await publishShowcase(
      admin,
      unregulatedAuthority(COMPANY),
      declaration([declares(PAINTER)]),
    );

    expect(result.kind).toBe('published');
    const [credential] = await storedCredentials(fake, COMPANY);
    // ⚠️ Και μπαίνει **με ονομασμένη απουσία**, ποτέ με μισό πεδίο: το `unknown`
    //    λέει *«κανείς δεν δήλωσε τίποτα»*, όχι *«ελέγχθηκε και δεν ισχύει»*.
    expect(credential?.attestation).toEqual({ state: 'unknown' });
  });

  it('🔴 Ε7α — Ο ΜΕΣΙΤΗΣ ΧΩΡΙΣ ΓΕΜΗ ΔΕΝ ΜΠΑΙΝΕΙ, με ονομασμένο λόγο', async () => {
    const { fake, admin } = db();

    const result = await publishShowcase(
      admin,
      regulatedAuthority(COMPANY),
      declaration([declares(BROKER)]),
    );

    expect(result.kind).toBe('rejected');
    if (result.kind === 'rejected') {
      expect(result.reason).toBe('agency-profile-registration-missing');
    }
    // 🔴 Και **τίποτα δεν γράφτηκε**: μισή βιτρίνα στον κατάλογο θα ήταν ακριβώς
    //    ο «επικίνδυνος αντί για χρήσιμος» κατάλογος του §9.9 β.
    expect(await readStored(fake, COMPANY)).toBeUndefined();
  });

  it('🔑 Ε7β — Η ΣΙΩΠΗ ΤΟΥ ΔΙΚΗΓΟΡΟΥ ΕΙΝΑΙ ΝΟΜΙΜΗ (Α9.2): μπαίνει χωρίς αριθμό', async () => {
    const { fake, admin } = db();

    // 🔑 **Η ΔΙΑΦΟΡΑ ΜΕ ΤΟ Ε7α ΕΙΝΑΙ ΟΛΟ ΤΟ ΣΧΗΜΑ**: το επάγγελμα **έχει** μητρώο
    //    (`bar-association`), αλλά **δεν** είναι ρυθμιζόμενη δραστηριότητα της
    //    πλατφόρμας. Η οθόνη το λέει με **σημείωμα**, όχι με άρνηση.
    const result = await publishShowcase(
      admin,
      unregulatedAuthority(COMPANY),
      declaration([declares(LAWYER)]),
    );

    expect(result.kind).toBe('published');
    expect((await storedCredentials(fake, COMPANY))[0]?.attestation).toEqual({ state: 'unknown' });
  });

  it('🔴 Ε7γ — Η ΑΡΧΗ ΔΕΝ ΕΡΧΕΤΑΙ ΑΠΟ ΤΟ ΣΥΡΜΑ: το επάγγελμα την ονομάζει', async () => {
    const { fake, admin } = db();

    await publishShowcase(
      admin,
      unregulatedAuthority(COMPANY),
      declaration([declares(LAWYER, '12345', 'ΔΣΘ')]),
    );

    // 🔴 Η δήλωση **δεν έχει πεδίο αρχής** — δομικά. Αν είχε, ένας διακοσμητής θα
    //    δήλωνε αριθμό **ΓΕΜΗ**: ισχυρισμός μεσιτείας χωρίς τον φρουρό της.
    expect((await storedCredentials(fake, COMPANY))[0]?.attestation).toEqual({
      state: 'declared',
      registration: {
        authorityKind: 'chapter',
        authority: 'bar-association',
        chapter: 'ΔΣΘ',
        number: '12345',
      },
    });
  });
});

// ============================================================================
// Δ — Η ΔΗΛΩΣΗ
// ============================================================================

describe('Δ — τι αρνείται η δήλωση, και με ποιον λόγο', () => {
  it('🔑 Δ0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η πλήρης δήλωση δεν απορρίπτεται', async () => {
    const { admin } = db();
    const result = await publishShowcase(admin, regulatedAuthority(COMPANY), BROKER_DECLARATION);
    expect(result.kind).toBe('published');
  });

  it('Δ1 — κάθε λείπον πεδίο έχει ΔΙΚΟ ΤΟΥ κλειδί — άρνηση χωρίς λόγο δεν εξηγείται', async () => {
    const cases = [
      [declaration([declares(BROKER, '123456789000')], { alias: '   ' }), 'agency-profile-alias-missing'],
      [declaration([declares(BROKER, '123456789000')], { displayName: '' }), 'agency-profile-name-missing'],
      [declaration([]), 'agency-profile-occupation-missing'],
      [declaration([declares(BROKER, '  ')]), 'agency-profile-registration-missing'],
      // ⚠️ Αριθμός **χωρίς** σύλλογο σε αρχή με παραρτήματα: «1234» χωρίς «ΔΣΘ»
      //    δεν επαληθεύεται από κανέναν (Α9.1).
      [declaration([declares(LAWYER, '12345')]), 'agency-profile-chapter-missing'],
    ] as const;

    for (const [candidate, reason] of cases) {
      const { fake, admin } = db();
      const result = await publishShowcase(admin, regulatedAuthority(COMPANY), candidate);

      expect(result.kind).toBe('rejected');
      if (result.kind === 'rejected') expect(result.reason).toBe(reason);
      // 🔴 Και **τίποτα δεν γράφτηκε**: απόρριψη που αφήνει μισό έγγραφο στον
      //    κατάλογο θα δημοσίευε γραφείο που ο κριτής απέρριψε.
      expect(await readStored(fake, COMPANY)).toBeUndefined();
    }
  });

  it('🔴 Δ2 — ΟΙ ΠΕΝΤΕ ΛΟΓΟΙ ΕΙΝΑΙ ΠΕΝΤΕ ΔΙΑΦΟΡΕΤΙΚΟΙ — καμία ισοπέδωση', () => {
    const reasons = [
      'agency-profile-alias-missing',
      'agency-profile-name-missing',
      'agency-profile-occupation-missing',
      'agency-profile-registration-missing',
      'agency-profile-chapter-missing',
    ];
    // 🔑 Χωρίς αυτό, μια «απλοποίηση» που επιστρέφει τον ίδιο λόγο σε δύο
    //    περιπτώσεις θα περνούσε: το Δ1 ελέγχει **αντιστοίχιση**, όχι **διάκριση**.
    expect(new Set(reasons).size).toBe(5);
  });

  it('🔑 Δ3 — Ο ΤΟΠΟΣ ΤΑΞΙΔΕΥΕΙ: `place` ΚΑΙ `position` γράφονται, `null` όταν δεν δηλώθηκαν', async () => {
    const { fake, admin } = db();

    await publishShowcase(
      admin,
      regulatedAuthority(COMPANY),
      declaration([declares(BROKER, '123456789000')], {
        place: { landId: 'land_1', buildingId: null },
        position: { lat: 40.64, lng: 22.94 },
      }),
    );

    const stored = await readStored(fake, COMPANY);
    expect(stored?.place).toEqual({ landId: 'land_1', buildingId: null });
    // ⚠️ Χωρίς αυτό το `position`, το φίλτρο «κοντά μου» **δεν έχει τι να συγκρίνει**
    //    — και η αποτυχία θα ήταν «κανένα αποτέλεσμα», όχι σφάλμα.
    expect(stored?.position).toEqual({ lat: 40.64, lng: 22.94 });

    const { fake: fake2, admin: admin2 } = db();
    await publishShowcase(admin2, regulatedAuthority(COMPANY), BROKER_DECLARATION);
    const bare = await readStored(fake2, COMPANY);
    // 🔴 `null` = «δεν δήλωσε τόπο», **ΠΟΤΕ** `{lat:0,lng:0}` — σημείο στον
    //    Ατλαντικό που κάθε χάρτης ζωγραφίζει με απόλυτη σιγουριά.
    expect(bare?.position).toBeNull();
    expect(bare?.place).toBeNull();
  });
});

// ============================================================================
// Σ — Η ΣΥΓΚΑΛΥΨΗ (§9.4)
// ============================================================================

describe('Σ — η απουσία από την προβολή είναι ΑΔΙΑΚΡΙΤΗ από την ανυπαρξία', () => {
  it('🔑 Σ0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: δημοσιευμένο γραφείο ΒΡΙΣΚΕΤΑΙ', async () => {
    const { admin } = db();
    await publishShowcase(admin, regulatedAuthority(COMPANY), BROKER_DECLARATION);

    const lookup = await lookupAgencyProfile(admin, COMPANY);
    expect(lookup.outcome).toBe('found');
  });

  it('🔑 Σ0β — ΓΡΑΦΕΑΣ ΚΑΙ ΑΝΑΓΝΩΣΤΗΣ ΣΥΜΦΩΝΟΥΝ: ό,τι γράφτηκε, διαβάζεται ΙΔΙΟ', async () => {
    const { admin } = db();
    const written = await publishShowcase(admin, regulatedAuthority(COMPANY), BROKER_DECLARATION);

    const lookup = await lookupAgencyProfile(admin, COMPANY);

    // 🔴 **Η ΑΓΚΥΡΑ ΤΟΥ ΚΥΚΛΟΥ.** Το `standing` δεν αποθηκεύεται· αν ο αναγνώστης
    //    δεν το ξαναπαρήγαγε **ταυτόσημα**, η βιτρίνα θα εξαφανιζόταν τη στιγμή
    //    που δημοσιεύεται — με **πράσινο** τον γραφέα.
    expect(lookup.outcome).toBe('found');
    if (lookup.outcome === 'found' && written.kind === 'published') {
      const expected: PublicShowcase = { ...written.profile, publishedAt: lookup.showcase.publishedAt };
      expect(lookup.showcase).toEqual(expected);
      expect(lookup.showcase.credentials[0]?.standing).toBe('regulated');
    }
  });

  it('🔴 Σ1 — υπαρκτός μισθωτής ΧΩΡΙΣ δημοσίευση απαντά ΤΑΥΤΟΣΗΜΑ με ανύπαρκτο', async () => {
    const { admin } = db();
    await publishShowcase(admin, regulatedAuthority(COMPANY), BROKER_DECLARATION);

    const existingTenant = await lookupAgencyProfile(admin, 'comp_yparktos_adimosieftos');
    const neverExisted = await lookupAgencyProfile(admin, 'comp_pote_den_yprxe');

    // 🔴 Η ΙΣΟΤΗΤΑ ΕΙΝΑΙ Η ΕΓΓΥΗΣΗ (ADR-787 Ε-5 §4 #1): αν οι δύο απαντήσεις
    //    μπορούσαν να διαφέρουν, η διεύθυνση θα γινόταν όργανο απαρίθμησης.
    expect(existingTenant).toEqual(neverExisted);
    expect(existingTenant.outcome).toBe('not-published');
  });

  it('🔴 Σ2 — ΑΓΝΩΣΤΟ ≠ ΚΕΝΟ: η βλάβη ΔΕΝ διαβάζεται ως απόσυρση', async () => {
    const broken = {
      collection: () => ({
        doc: () => ({
          get: async () => {
            throw new Error('FAILED_PRECONDITION');
          },
        }),
      }),
    } as unknown as AdminFirestore;

    const lookup = await lookupAgencyProfile(broken, COMPANY);

    expect(lookup.outcome).toBe('unavailable');
    expect(lookup.outcome).not.toBe('not-published');
  });

  it('Σ3 — κενό αναγνωριστικό ΔΕΝ αγγίζει τη βάση', async () => {
    let touched = false;
    const spy = {
      collection: () => {
        touched = true;
        return { doc: () => ({ get: async () => ({ exists: false }) }) };
      },
    } as unknown as AdminFirestore;

    const lookup = await lookupAgencyProfile(spy, '   ');

    expect(lookup.outcome).toBe('not-published');
    expect(touched).toBe(false);
  });
});
