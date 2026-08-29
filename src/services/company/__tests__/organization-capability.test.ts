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
import type {
  BrokerageDeclaration,
  CapabilityStatus,
  OrganizationCapabilities,
} from '@/types/organization-capability';
import type { AgencyProfile } from '@/types/agency-profile';
import {
  approveBrokerage,
  declareBrokerage,
  revokeBrokerage,
} from '@/services/company/organization-capability.service';

const COMPANY = 'comp_grafeio_a';
const SUPER_ADMIN = 'user_super';
const REASON = 'Διαγραφή από το μητρώο μεσιτών';

const PROFILE: AgencyProfile = {
  companyId: COMPANY,
  alias: 'mesitiko-pagoni',
  displayName: 'ΜΕΣΙΤΙΚΟ ΓΡΑΦΕΙΟ ΠΑΓΩΝΗ Ι.Κ.Ε.',
  gemiNumber: '123456789000',
  place: null,
  publishedAt: '2026-08-20T10:00:00.000Z',
};

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
