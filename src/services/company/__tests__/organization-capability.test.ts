/**
 * @jest-environment node
 *
 * @fileoverview **Ο ΚΥΚΛΟΣ ΖΩΗΣ ΤΗΣ ΜΕΣΙΤΙΚΗΣ ΙΚΑΝΟΤΗΤΑΣ** — και το **Π2**, που μέχρι
 * τις 2026-08-29 ήταν γραμμένο και **δεν το εκτελούσε κανείς**.
 * @related services/company/organization-capability.service.ts · ADR-827 §9.10 · ADR-824 §5.3
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ — ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΥΠΗΡΧΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Μετρημένο**: πριν από αυτό το αρχείο, `grep -rl organization-capability.service`
 * έδινε **μηδέν** αρχεία test. Ο γραφέας μιας **ρυθμιζόμενης** ικανότητας — αυτός που
 * απαντά στην ερώτηση *«ποιος ενέκρινε αυτό το γραφείο και πότε;»* — ήταν
 * **αδοκίμαστος**. Και ο λόγος ήταν **εργαλειακός, όχι ανθρώπινος**: ο πλαστός
 * Firestore δεν είχε `update()`, άρα καμία άγκυρα **δεν μπορούσε καν να τρέξει**.
 *
 * 🔑 **Το Π2** (*«`active` που παύει ⇒ το προφίλ παύει να υπάρχει»*) ήταν
 * τεκμηριωμένο στο `withdrawAgencyProfile` με **δύο** δηλωμένους καλούντες, εκ των
 * οποίων ο **δεύτερος δεν υπήρχε**. Το σχήμα «σχόλιο που μοιάζει με έλεγχο»
 * (ADR-749 §5): ο επόμενος αναγνώστης θα διάβαζε την τεκμηρίωση ως **απόδειξη** ότι
 * το θέμα καλύφθηκε.
 *
 * ⚠️ **Η βάση δεν πλάθεται.** Ο γραφέας τρέχει **αληθινά** πάνω σε `FakeFirestore`.
 * Ένα test που έπλαθε το `update()` θα αποδείκνυε ότι ο κώδικας **καλεί** ό,τι
 * νομίζουμε, όχι ότι **γράφεται** ό,τι θέλουμε.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import {
  CAPABILITY_STATUSES,
  canDeclareCapability,
  type BrokerageDeclaration,
  type CapabilityStatus,
  type OrganizationCapabilities,
} from '@/types/organization-capability';
import {
  showcaseFixture,
  storedShowcaseDoc,
} from '@/lib/agency/__fixtures__/showcase-fixture';
import {
  approveBrokerage,
  declareBrokerage,
  revokeBrokerage,
} from '@/services/company/organization-capability.service';

const COMPANY = 'comp_grafeio_a';
const SUPER_ADMIN = 'user_super';
const REASON = 'Διαγραφή από το μητρώο μεσιτών';

/**
 * ⚠️ **ΤΟ ΑΠΟΘΗΚΕΥΜΕΝΟ σχήμα, όχι του καταναλωτή** *(δες `storedShowcaseDoc`)*: το
 * Π2 **διαβάζει** πλέον τη βιτρίνα πριν αποφασίσει, άρα ένα δείγμα με πεδία που ο
 * γραφέας δεν γράφει θα δοκίμαζε **κόσμο που δεν υπάρχει**.
 */
const PROFILE = storedShowcaseDoc({
  companyId: COMPANY,
  alias: 'mesitiko-pagoni',
  displayName: 'ΜΕΣΙΤΙΚΟ ΓΡΑΦΕΙΟ ΠΑΓΩΝΗ Ι.Κ.Ε.',
  publishedAt: '2026-08-20T10:00:00.000Z',
});

/** Η **μη ρυθμιζόμενη** βιτρίνα — ο υδραυλικός που δουλεύει στο ίδιο γραφείο. */
const PLUMBER_PROFILE = storedShowcaseDoc({
  companyId: COMPANY,
  alias: 'mesitiko-pagoni',
  displayName: 'ΠΑΓΩΝΗΣ Ι.Κ.Ε.',
  publishedAt: '2026-08-20T10:00:00.000Z',
  credentials: [
    {
      standing: 'self-declared',
      occupation: {
        escoUri: 'http://data.europa.eu/esco/occupation/plumber-fixture',
        label: { el: 'υδραυλικός', en: 'plumber' },
        iscoCode: '7126',
      },
      attestation: { state: 'unknown' },
    },
  ],
});

const DECLARATION: BrokerageDeclaration = {
  gemiNumber: '123456789000',
  chamberRegistryNumber: 'EE-4821',
  legalRepresentativeName: 'ΝΕΣΤΩΡ ΠΑΓΩΝΗΣ',
  declaredAt: '2026-08-20T08:00:00.000Z',
  declaredByUserId: 'user_idrytis',
};

function capabilities(status: CapabilityStatus): OrganizationCapabilities {
  return {
    brokerage_listings: {
      status,
      requirements: [],
      declaration: null,
      decidedByUserId: status === 'unrequested' ? null : SUPER_ADMIN,
      decidedAt: status === 'unrequested' ? null : '2026-08-20T10:00:00.000Z',
      revocationReason: null,
    },
  };
}

interface Harness {
  readonly fake: FakeFirestore;
  readonly admin: AdminFirestore;
}

/**
 * Στήνει **οργανισμό** σε δεδομένη κατάσταση, προαιρετικά **με δημοσιευμένη βιτρίνα**.
 *
 * ⚠️ Το `companies/{id}` κουβαλά **και άλλα** πεδία (`settings`, `plan`). Είναι εδώ
 * επίτηδες: το Ρ7 αποδεικνύει ότι το `update` με μονοπάτι πεδίου **δεν τα σβήνει**.
 */
function harness(status: CapabilityStatus, withProfile: boolean): Harness {
  const fake = new FakeFirestore();
  fake.seed(COLLECTIONS.COMPANIES, COMPANY, {
    name: 'ΠΑΓΩΝΗΣ Ι.Κ.Ε.',
    settings: { locale: 'el' },
    plan: 'pro',
    capabilities: capabilities(status),
  });
  if (withProfile) fake.seed(COLLECTIONS.AGENCY_PROFILES, COMPANY, { ...PROFILE });
  return { fake, admin: fake as unknown as AdminFirestore };
}

async function profileExists(fake: FakeFirestore): Promise<boolean> {
  return (await fake.collection(COLLECTIONS.AGENCY_PROFILES).doc(COMPANY).get()).exists;
}

async function statusOf(fake: FakeFirestore): Promise<CapabilityStatus | undefined> {
  const snap = await fake.collection(COLLECTIONS.COMPANIES).doc(COMPANY).get();
  const data = snap.data() as { capabilities?: OrganizationCapabilities } | undefined;
  return data?.capabilities?.brokerage_listings?.status;
}

/**
 * Βάση όπου **η διαγραφή της βιτρίνας αποτυγχάνει**, και **μόνο** αυτή.
 *
 * 🔴 Η στοχευμένη βλάβη είναι το ζητούμενο: μια ολική βλάβη θα έριχνε **και** την
 * ανάγνωση του οργανισμού, οπότε το test θα ήταν πράσινο για **λάθος λόγο** — δεν θα
 * ξεχώριζε *«ματαίωσε η μετάβαση επειδή απέτυχε το παράγωγο»* από *«δεν έτρεξε τίποτα»*.
 */
function withBrokenProfileDelete(fake: FakeFirestore): AdminFirestore {
  return new Proxy(fake, {
    get(target, property, receiver) {
      if (property !== 'collection') return Reflect.get(target, property, receiver);
      return (name: string) => {
        const collection = target.collection(name);
        if (name !== COLLECTIONS.AGENCY_PROFILES) return collection;
        return {
          doc: (id: string) => ({
            ...collection.doc(id),
            get: () => collection.doc(id).get(),
            delete: () => Promise.reject(new Error('UNAVAILABLE')),
          }),
        };
      };
    },
  }) as unknown as AdminFirestore;
}

/**
 * Βάση όπου **η ΑΝΑΓΝΩΣΗ της βιτρίνας αποτυγχάνει**, και μόνο αυτή.
 *
 * 🔴 Αδελφή του {@link withBrokenProfileDelete}, και **όχι** αντίγραφό της: το Π2
 * κάνει πλέον **δύο** πράξεις στη συλλογή *(διαβάζει, μετά ίσως σβήνει)*, και οι
 * δύο βλάβες έχουν **διαφορετικό νόημα**. Μία στοχευμένη βλάβη «σε ό,τι αγγίζει
 * τη συλλογή» θα ήταν πράσινη για **λάθος λόγο**.
 */
function withBrokenProfileRead(fake: FakeFirestore): AdminFirestore {
  return new Proxy(fake, {
    get(target, property, receiver) {
      if (property !== 'collection') return Reflect.get(target, property, receiver);
      return (name: string) => {
        const collection = target.collection(name);
        if (name !== COLLECTIONS.AGENCY_PROFILES) return collection;
        return {
          doc: (id: string) => ({
            ...collection.doc(id),
            get: () => Promise.reject(new Error('UNAVAILABLE')),
            delete: () => collection.doc(id).delete(),
          }),
        };
      };
    },
  }) as unknown as AdminFirestore;
}

beforeEach(() => {
  // ⚠️ Το ίχνος καταπίνει τα δικά του σφάλματα και χτυπά **αληθινό** Admin SDK. Η
  //    κατασκόπευση κρατά τις άγκυρες πάνω στη **μετάβαση**, και ταυτόχρονα επιτρέπει
  //    στο Ρ8 να ρωτήσει **αν** γράφτηκε ίχνος — που είναι δικό του, ξεχωριστό ερώτημα.
  jest.spyOn(EntityAuditService, 'recordChange').mockResolvedValue('audit_1');
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ============================================================================
// Ρ — ΤΟ Π2: Η ΑΝΑΚΛΗΣΗ ΣΒΗΝΕΙ ΤΗ ΒΙΤΡΙΝΑ
// ============================================================================

describe('Ρ — «active που παύει ⇒ το προφίλ παύει να υπάρχει» (ADR-827 §9.10 Π2)', () => {
  it('🔑 Ρ0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: ανάκληση ΧΩΡΙΣ βιτρίνα εφαρμόζεται κανονικά', async () => {
    const { fake, admin } = harness('active', false);

    const result = await revokeBrokerage(admin, COMPANY, SUPER_ADMIN, REASON);

    // Χωρίς αυτό, κάθε «δεν έμεινε προφίλ» παρακάτω θα ήταν πράσινο επειδή η
    // μετάβαση **δεν τρέχει καθόλου** — το σχήμα «0 = κανείς δεν κοίταξε».
    expect(result.kind).toBe('applied');
    expect(await statusOf(fake)).toBe('revoked');
  });

  it('🔴 Ρ1 — ΑΝΑΚΛΗΣΗ ΜΕ ΔΗΜΟΣΙΕΥΜΕΝΗ ΒΙΤΡΙΝΑ: η βιτρίνα ΣΒΗΝΕΙ', async () => {
    const { fake, admin } = harness('active', true);
    expect(await profileExists(fake)).toBe(true);

    const result = await revokeBrokerage(admin, COMPANY, SUPER_ADMIN, REASON);

    expect(result.kind).toBe('applied');
    expect(await statusOf(fake)).toBe('revoked');
    // 🔴 Η ΑΓΚΥΡΑ ΤΟΥ Β0: αφαίρεσε τον γάντζο από το `revokeBrokerage` και **αυτό**
    //    κοκκινίζει. Ήταν η μόνη γραμμή που έλειπε ώστε το Π2 να είναι φρουρός.
    expect(await profileExists(fake)).toBe(false);
  });

  it('🔑 Ρ2 — Η ΣΕΙΡΑ: αν ΑΠΟΤΥΧΕΙ η διαγραφή, η ΚΑΤΑΣΤΑΣΗ ΜΕΝΕΙ ΩΣ ΕΙΧΕ', async () => {
    const { fake } = harness('active', true);
    const broken = withBrokenProfileDelete(fake);

    const result = await revokeBrokerage(broken, COMPANY, SUPER_ADMIN, REASON);

    expect(result.kind).toBe('failed');
    // 🔴 ΤΟ ΚΑΡΔΙΑΚΟ: με τη σειρά «γραφή → διαγραφή» η κατάσταση θα ήταν ήδη
    //    `revoked` **με τη βιτρίνα ζωντανή** — δηλαδή γραφείο που διαφημίζεται με
    //    ανύπαρκτη άδεια. Και χειρότερα: **αδιόρθωτο**, γιατί το `ALLOWED_FROM.revoke`
    //    δεν δέχεται `revoked` ⇒ δεύτερο πάτημα δίνει 409 και δεν ξαναδοκιμάζει ποτέ.
    expect(await statusOf(fake)).toBe('active');
    expect(await profileExists(fake)).toBe(true);
  });

  it('🔑 Ρ2β — και ΓΙ᾽ ΑΥΤΟ η επισκευή περνά από την ΙΔΙΑ πόρτα: το δεύτερο πάτημα πετυχαίνει', async () => {
    const { fake } = harness('active', true);

    expect((await revokeBrokerage(withBrokenProfileDelete(fake), COMPANY, SUPER_ADMIN, REASON)).kind)
      .toBe('failed');

    // Η βλάβη πέρασε· ο διαχειριστής ξαναπατά **το ίδιο κουμπί**. Αν η πρώτη
    // προσπάθεια είχε προλάβει να γράψει `revoked`, εδώ θα έπαιρνε
    // `illegal-transition` και η ορφανή βιτρίνα θα έμενε **για πάντα**.
    const retry = await revokeBrokerage(fake as unknown as AdminFirestore, COMPANY, SUPER_ADMIN, REASON);

    expect(retry.kind).toBe('applied');
    expect(await profileExists(fake)).toBe(false);
  });

  it('🔴 Ρ3 — ΠΑΡΑΝΟΜΗ ΜΕΤΑΒΑΣΗ ΔΕΝ ΣΒΗΝΕΙ ΤΙΠΟΤΑ: απορριφθέν πάτημα ΔΕΝ έχει παρενέργεια', async () => {
    // Το `unrequested` δεν είναι στο `ALLOWED_FROM.revoke`. Αν ο γάντζος έτρεχε
    // **πριν** τον έλεγχο νομιμότητας, ένα 409 θα είχε ήδη σβήσει τη βιτρίνα.
    const { fake, admin } = harness('unrequested', true);

    const result = await revokeBrokerage(admin, COMPANY, SUPER_ADMIN, REASON);

    expect(result.kind).toBe('illegal-transition');
    expect(await profileExists(fake)).toBe(true);
  });

  it('Ρ4 — ανύπαρκτος οργανισμός: «absent», και καμία πράξη', async () => {
    const fake = new FakeFirestore();
    fake.seed(COLLECTIONS.AGENCY_PROFILES, COMPANY, { ...PROFILE });

    const result = await revokeBrokerage(fake as unknown as AdminFirestore, COMPANY, SUPER_ADMIN, REASON);

    expect(result.kind).toBe('absent');
    expect(await profileExists(fake)).toBe(true);
  });

  it('Ρ5 — ανάκληση από «pending» επιτρέπεται, και είναι ιδεμποτής ως προς τη βιτρίνα', async () => {
    // Το `pending` **δεν μπορεί** να έχει δημοσιεύσει (Π1: η απόδειξη απαιτεί
    // `active`), οπότε η διαγραφή είναι no-op — και **δεν** επιτρέπεται να είναι λάθος.
    const { fake, admin } = harness('pending', false);

    const result = await revokeBrokerage(admin, COMPANY, SUPER_ADMIN, REASON);

    expect(result.kind).toBe('applied');
    expect(await statusOf(fake)).toBe('revoked');
  });

  it('🔴 Ρ6 — Ε8: Η ΑΝΑΚΛΗΣΗ ΜΕΣΙΤΕΙΑΣ ΔΕΝ ΕΞΑΦΑΝΙΖΕΙ ΤΟΝ ΥΔΡΑΥΛΙΚΟ', async () => {
    // ────────────────────────────────────────────────────────────────────────
    // 🔴 ADR-841 Φ6-Β3 — ΤΟ Π2 ΕΓΙΝΕ ΠΑΡΑΛΛΑΓΗΣ-ΣΥΝΕΙΔΗΤΟ
    //
    // Όσο ο κατάλογος είχε **μόνο** μεσιτικά γραφεία, το *«ανάκληση ⇒ διαγραφή»*
    // ήταν ταυτολογία. Με κατάλογο **επαγγελματιών** η ίδια γραμμή σβήνει
    // προβολή που **καμία αρχή δεν απαγόρευσε** — η απουσία μητρώου γινόμενη
    // **ποινή** (Α9.3).
    // ────────────────────────────────────────────────────────────────────────
    const fake = new FakeFirestore();
    fake.seed(COLLECTIONS.COMPANIES, COMPANY, {
      name: 'ΠΑΓΩΝΗΣ Ι.Κ.Ε.',
      capabilities: capabilities('active'),
    });
    fake.seed(COLLECTIONS.AGENCY_PROFILES, COMPANY, { ...PLUMBER_PROFILE });

    const result = await revokeBrokerage(
      fake as unknown as AdminFirestore,
      COMPANY,
      SUPER_ADMIN,
      REASON,
    );

    // Η **μετάβαση** εφαρμόζεται κανονικά…
    expect(result.kind).toBe('applied');
    expect(await statusOf(fake)).toBe('revoked');
    // …και η **βιτρίνα μένει**. Δεν του πήρε τίποτα καμία αρχή.
    expect(await profileExists(fake)).toBe(true);
  });

  it('🔴 Ρ6α — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΟΥ Ρ6: η ΡΥΘΜΙΖΟΜΕΝΗ βιτρίνα ΟΝΤΩΣ σβήνει', async () => {
    // 🔑 Χωρίς αυτό, το Ρ6 θα ήταν πράσινο και σε κόσμο όπου το Π2 **δεν σβήνει
    //    ποτέ τίποτα** — δηλαδή ο ανακληθείς μεσίτης θα συνέχιζε να διαφημίζεται
    //    με ανύπαρκτη άδεια, ακριβώς η βλάβη που το Π2 υπάρχει να κλείσει.
    const { fake, admin } = harness('active', true);

    const result = await revokeBrokerage(admin, COMPANY, SUPER_ADMIN, REASON);

    expect(result.kind).toBe('applied');
    expect(await profileExists(fake)).toBe(false);
  });

  it('🔴 Ρ7 — ΑΓΝΩΣΤΟ ≠ ΚΕΝΟ: βλάβη ΑΝΑΓΝΩΣΗΣ της βιτρίνας ΜΑΤΑΙΩΝΕΙ τη μετάβαση', async () => {
    // ⚠️ *«Δεν μπόρεσα να διαβάσω»* **δεν** είναι *«δεν έχει ρυθμιζόμενο
    //    credential»*. Η σιωπηλή δεύτερη ανάγνωση θα άφηνε ανακληθέν μεσιτικό
    //    γραφείο στον κατάλογο — **και** θα κατέγραφε τη μετάβαση ως επιτυχή.
    const fake = new FakeFirestore();
    fake.seed(COLLECTIONS.COMPANIES, COMPANY, {
      name: 'ΠΑΓΩΝΗΣ Ι.Κ.Ε.',
      capabilities: capabilities('active'),
    });
    fake.seed(COLLECTIONS.AGENCY_PROFILES, COMPANY, { ...PROFILE });

    const result = await revokeBrokerage(
      withBrokenProfileRead(fake),
      COMPANY,
      SUPER_ADMIN,
      REASON,
    );

    expect(result.kind).toBe('failed');
    // Η κατάσταση **μένει ως είχε** — ο υπερδιαχειριστής ξαναπατά.
    expect(await statusOf(fake)).toBe('active');
  });
});

// ============================================================================
// Α — ΟΙ ΑΛΛΕΣ ΔΥΟ ΜΕΤΑΒΑΣΕΙΣ ΔΕΝ ΑΓΓΙΖΟΥΝ ΤΗ ΒΙΤΡΙΝΑ
// ============================================================================

describe('Α — η βιτρίνα ΔΕΝ επαναφέρεται και ΔΕΝ δημοσιεύεται από τρίτον', () => {
  it('🔴 Α1 — Η ΕΠΑΝΕΓΚΡΙΣΗ ΔΕΝ ΞΑΝΑΔΗΜΟΣΙΕΥΕΙ: η παρουσία ΕΙΝΑΙ η συγκατάθεση', async () => {
    const { fake, admin } = harness('pending', false);

    const result = await approveBrokerage(admin, COMPANY, SUPER_ADMIN);

    expect(result.kind).toBe('applied');
    expect(await statusOf(fake)).toBe('active');
    // 🔑 Οι **αγγελίες** επανέρχονται αυτόματα (ανήκουν στον ιδιοκτήτη, αθώο τρίτο).
    //    Η **βιτρίνα** όχι: θα δημοσίευε οργανισμό που δεν το ξαναζήτησε — ακριβώς η
    //    ακούσια ιδιότητα μέλους που κάνει το `workspace_aliases` μη σαρώσιμο.
    expect(await profileExists(fake)).toBe(false);
  });

  it('Α2 — η έγκριση ΔΕΝ σβήνει βιτρίνα που υπάρχει ήδη', async () => {
    const { fake, admin } = harness('pending', true);

    await approveBrokerage(admin, COMPANY, SUPER_ADMIN);

    // Ο γάντζος είναι δεμένος **μόνο** στην ανάκληση. Αν ζούσε στο `transition`
    // χωρίς όρο, θα έσβηνε τη βιτρίνα σε **κάθε** μετάβαση.
    expect(await profileExists(fake)).toBe(true);
  });

  it('Α3 — η δήλωση (revoked → pending) ΔΕΝ αγγίζει τη βιτρίνα', async () => {
    const { fake, admin } = harness('revoked', true);

    const result = await declareBrokerage(admin, COMPANY, {
      ...DECLARATION,
      declaredAt: '2026-08-29T09:00:00.000Z',
    });

    expect(result.kind).toBe('applied');
    expect(await statusOf(fake)).toBe('pending');
    expect(await profileExists(fake)).toBe(true);
  });
});

// ============================================================================
// Γ — Η ΓΡΑΦΗ ΚΑΘΑΥΤΗ
// ============================================================================

describe('Γ — τι γράφεται στο έγγραφο του οργανισμού', () => {
  it('🔴 Γ1 — ΜΟΝΟΠΑΤΙ ΠΕΔΙΟΥ: τα αδέλφια ΔΕΝ σβήνονται', async () => {
    const { fake, admin } = harness('active', false);

    await revokeBrokerage(admin, COMPANY, SUPER_ADMIN, REASON);

    const snap = await fake.collection(COLLECTIONS.COMPANIES).doc(COMPANY).get();
    const data = snap.data() as { settings?: unknown; plan?: unknown; name?: unknown };
    // Ένα ολικό `set()` από εδώ θα τα έσβηνε — και ο γραφέας **δεν τα ξέρει καν**.
    expect(data.settings).toEqual({ locale: 'el' });
    expect(data.plan).toBe('pro');
    expect(data.name).toBe('ΠΑΓΩΝΗΣ Ι.Κ.Ε.');
  });

  it('Γ2 — η ανάκληση γράφει ΤΟΝ ΛΟΓΟ και ΔΙΑΤΗΡΕΙ τη δήλωση', async () => {
    const fake = new FakeFirestore();
    const declaration: BrokerageDeclaration = { ...DECLARATION };
    fake.seed(COLLECTIONS.COMPANIES, COMPANY, {
      capabilities: {
        brokerage_listings: {
          status: 'active',
          requirements: [],
          declaration,
          decidedByUserId: SUPER_ADMIN,
          decidedAt: '2026-08-20T10:00:00.000Z',
          revocationReason: null,
        },
      },
    });

    await revokeBrokerage(fake as unknown as AdminFirestore, COMPANY, SUPER_ADMIN, REASON);

    const snap = await fake.collection(COLLECTIONS.COMPANIES).doc(COMPANY).get();
    const record = (snap.data() as { capabilities: OrganizationCapabilities }).capabilities
      .brokerage_listings;
    expect(record?.revocationReason).toBe(REASON);
    // Χωρίς τη δήλωση, ένα ανακληθέν γραφείο δεν μπορεί να απαντήσει «τι είχα
    // δηλώσει;» — ο ρυθμιστικός φάκελος θα έσβηνε μαζί με το δικαίωμα.
    expect(record?.declaration).toEqual(declaration);
  });

  it('🔴 Γ3 — ΤΟ ΙΧΝΟΣ ΓΡΑΦΕΤΑΙ ΜΟΝΟ ΟΤΑΝ Η ΜΕΤΑΒΑΣΗ ΕΦΑΡΜΟΣΤΗΚΕ', async () => {
    const { fake } = harness('active', true);

    await revokeBrokerage(withBrokenProfileDelete(fake), COMPANY, SUPER_ADMIN, REASON);
    // Ματαιωμένη μετάβαση ⇒ **καμία** εγγραφή στο ίχνος: μια σημείωση «ανακλήθηκε» για
    // απόφαση που δεν ίσχυσε θα ήταν ψευδής απάντηση στον ρυθμιστή.
    expect(EntityAuditService.recordChange).not.toHaveBeenCalled();

    await revokeBrokerage(fake as unknown as AdminFirestore, COMPANY, SUPER_ADMIN, REASON);
    expect(EntityAuditService.recordChange).toHaveBeenCalledTimes(1);
    expect(EntityAuditService.recordChange).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: COMPANY,
        performedBy: SUPER_ADMIN,
        changes: [
          expect.objectContaining({ oldValue: 'active', newValue: 'revoked' }),
        ],
      }),
    );
  });
});

// ============================================================================
// Κ13ζ — Η ΟΘΟΝΗ ΚΑΙ Ο ΓΡΑΦΕΑΣ ΣΥΜΦΩΝΟΥΝ, ΚΑΙ ΤΟ ΑΠΟΔΕΙΚΝΥΕΙ Η ΕΚΤΕΛΕΣΗ
// ============================================================================

/**
 * 🔴 **ΤΟ ΕΡΩΤΗΜΑ: ΕΙΝΑΙ ΤΟ `canDeclareCapability` ΔΕΥΤΕΡΟ ΒΙΒΛΙΟ;**
 *
 * Η οθόνη του ιδρυτή (`BrokerageCapabilityContent`) αποφασίζει αν θα ζωγραφίσει τη
 * φόρμα ρωτώντας το `canDeclareCapability`. Η **αυθεντία** όμως της μετάβασης είναι ο
 * πίνακας `ALLOWED_FROM` αυτού του αρχείου, που είναι `server-only` και **δομικά
 * απρόσιτος** στον φυλλομετρητή. Δύο βιβλία για την ίδια μετάβαση μπορούν να
 * αποκλίνουν — και η απόκλιση **δεν σκάει**:
 *
 * | Απόκλιση | Τι βλέπει ο άνθρωπος |
 * |---|---|
 * | οθόνη επιτρέπει, γραφέας αρνείται | συμπληρώνει τη φόρμα και τρώει **409** |
 * | οθόνη αρνείται, γραφέας επιτρέπει | 🔴 **δεν μπορεί να δηλώσει ΠΟΤΕ** — σιωπηλά |
 *
 * ⇒ Η συμφωνία **εκτελείται**: για καθεμία από τις τέσσερις καταστάσεις καλείται ο
 * **πραγματικός** γραφέας πάνω σε πραγματικό έγγραφο, και το αποτέλεσμά του
 * συγκρίνεται με ό,τι υπόσχεται η οθόνη. Είναι το ίδιο δόγμα με το Κ12 *(«η άγκυρα
 * καλεί τον γραφέα, γιατί η πύλη σιωπά»)*.
 *
 * ⛔ ΜΕΤΑΛΛΑΞΗ: πρόσθεσε ή αφαίρεσε κατάσταση από το `ALLOWED_FROM.declare` ⇒ κόκκινο.
 * ⛔ ΜΕΤΑΛΛΑΞΗ: γύρνα το `canDeclareCapability` σε `() => true` ⇒ κόκκινο.
 */
describe('Κ13ζ — η υπόσχεση της οθόνης ισούται με την πράξη του γραφέα', () => {
  it.each(CAPABILITY_STATUSES.map((status) => [status] as const))(
    'από %s: ό,τι λέει η οθόνη, το κάνει ο γραφέας',
    async (status: CapabilityStatus) => {
      const { fake, admin } = harness(status, false);

      const result = await declareBrokerage(admin, COMPANY, DECLARATION);
      const accepted = result.kind === 'applied';

      // ✅ ΘΕΤΙΚΟΣ ΣΥΝΟΔΟΣ: ο γραφέας **έτρεξε** και απάντησε αναγνωρίσιμα — η
      //    σύγκριση παρακάτω δεν κρίνει σιωπή.
      expect(['applied', 'illegal-transition']).toContain(result.kind);
      expect(accepted).toBe(canDeclareCapability(status));

      // Και η **συνέπεια** στη βάση συμφωνεί με την απάντηση: δεκτή δήλωση ⇒ `pending`,
      // απορριφθείσα ⇒ η κατάσταση **έμεινε ως είχε**.
      expect(await statusOf(fake)).toBe(accepted ? 'pending' : status);
    },
  );
});
