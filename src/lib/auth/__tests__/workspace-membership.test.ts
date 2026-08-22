/**
 * `lib/auth/workspace-membership` — οι **επτά** ετυμηγορίες, και **τι κοστίζει** η καθεμία
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ (ADR-787 Κ-2 / §5.1)
 * ─────────────────────────────────────────────────────────────────────────────
 * Το βάρος **δεν** πέφτει στο «συγκρίνει δύο συμβολοσειρές». Πέφτει σε τέσσερα
 * πράγματα που, αν σπάσουν, βγάζουν **πράσινο** έλεγχο και **λάθος** εφαρμογή:
 *
 * 1. **Η ΣΕΙΡΑ.** Ένας απαντητής που ρωτά τη βάση **πριν** κοιτάξει το token
 *    απαντά σωστά και κοστίζει μια ανάγνωση σε **κάθε αίτημα** της πλατφόρμας.
 *    Γι' αυτό μετράμε **αναγνώσεις**, όχι μόνο αποτέλεσμα.
 * 2. **`unknown` ≠ `not-a-member`.** Αν συγχωνευτούν, ο άνθρωπος διαβάζει «δεν
 *    είσαι μέλος» ενώ η αλήθεια είναι «δεν μπόρεσα να ρωτήσω» (N.12).
 * 3. **Ο ιδιωτικός χώρος ΑΛΛΟΥ δεν ανοίγει ΟΥΤΕ ΣΤΟΝ super admin** (Ε-3 §3).
 * 4. **Το όνομα της συλλογής.** Με `members` και στα δύο επίπεδα, το collection
 *    group ερώτημα επιστρέφει και τα **μέλη έργου** ⇒ καλεσμένος σε ένα έργο
 *    γίνεται μέλος **ολόκληρου του γραφείου**. Η άγκυρα Δ2 αποδεικνύει τον
 *    **παρονομαστή**: ότι με το παλιό όνομα η διαρροή **θα συνέβαινε**.
 *
 * @module lib/auth/__tests__/workspace-membership
 * @see docs/centralized-systems/reference/adrs/ADR-787-multi-organization-platform.md §5.1
 */

// ─── Ελεγχόμενη «βάση» ───────────────────────────────────────────────────────
// Κλειδί: η **πλήρης διαδρομή**. Το `collectionGroup(name)` μιμείται την
// πραγματική σημασιολογία του Firestore: ταιριάζει **κάθε** έγγραφο του οποίου
// η προτελευταία διαδρομή είναι `name` — **ανεξάρτητα από γονέα**. Χωρίς αυτή
// τη μίμηση, η άγκυρα Δ2 θα ήταν ταυτολογία (το ψεύτικο θα «χώριζε» μόνο του).
const store = new Map<string, Record<string, unknown>>();
const reads: string[] = [];
let failNextRead = false;
let adminAvailable = true;

function docRef(path: string) {
  return {
    get: async () => {
      reads.push(path);
      if (failNextRead) throw new Error('ECONNRESET (προσομοίωση)');
      const data = store.get(path);
      return { exists: data !== undefined, id: path.split('/').pop(), data: () => data };
    },
    collection: (name: string) => collectionRef(`${path}/${name}`),
  };
}

function collectionRef(path: string) {
  return { doc: (id: string) => docRef(`${path}/${id}`) };
}

function collectionGroupRef(name: string) {
  const filters: Array<[string, unknown]> = [];
  const query = {
    where: (field: string, _op: string, value: unknown) => {
      filters.push([field, value]);
      return query;
    },
    get: async () => {
      reads.push(`collectionGroup:${name}`);
      if (failNextRead) throw new Error('ECONNRESET (προσομοίωση)');
      const docs = [...store.entries()]
        .filter(([path]) => path.split('/').slice(-2, -1)[0] === name)
        .filter(([, data]) => filters.every(([field, value]) => data[field] === value))
        .map(([path, data]) => ({
          data: () => data,
          ref: {
            parent: { parent: { id: path.split('/').slice(-3, -2)[0] } },
          },
        }));
      return { docs };
    },
  };
  return query;
}

function fakeDb() {
  return {
    collection: (name: string) => collectionRef(name),
    collectionGroup: (name: string) => collectionGroupRef(name),
  };
}

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => fakeDb(),
  isFirebaseAdminAvailable: () => adminAvailable,
}));

import {
  decideMembership,
  listMemberWorkspaces,
  normalizeMembership,
  readsFor,
} from '../workspace-membership';
import {
  isAllowed,
  orgWorkspace,
  personalWorkspace,
  type MembershipVerdict,
} from '@/types/workspace-membership';

const NIKOS = 'uid-nikos';
const MARIA = 'uid-maria';
const HOME = 'comp_home';
const FOREIGN = 'comp_foreign';

/** Ο μόνος ρόλος με `isBypass: true` στο `PREDEFINED_ROLES`. */
const BYPASS_ROLE = 'super_admin';
const NORMAL_ROLE = 'company_admin';

function memberPath(companyId: string, uid: string): string {
  return `companies/${companyId}/workspace_members/${uid}`;
}

function ask(overrides: Partial<Parameters<typeof decideMembership>[0]> = {}) {
  return decideMembership({
    uid: NIKOS,
    claimCompanyId: HOME,
    globalRole: NORMAL_ROLE,
    requested: orgWorkspace(FOREIGN),
    ...overrides,
  });
}

beforeEach(() => {
  store.clear();
  reads.length = 0;
  failNextRead = false;
  adminAvailable = true;
});

// =============================================================================
// Κ — ΟΙ ΕΠΤΑ ΕΤΥΜΗΓΟΡΙΕΣ, ΜΕ ΤΟ ΚΟΣΤΟΣ ΤΟΥΣ
// =============================================================================

describe('Κ. Οι επτά ετυμηγορίες — και οι αναγνώσεις που κοστίζουν', () => {
  it('Κ1 — ο ΔΙΚΟΣ του ιδιωτικός χώρος ⇒ `self`, ΜΗΔΕΝ αναγνώσεις', async () => {
    const decision = await ask({ requested: personalWorkspace(NIKOS) });

    expect(decision.verdict).toBe('self');
    expect(reads).toHaveLength(0);
  });

  it('Κ2 — ο χώρος του token ⇒ `home`, ΜΗΔΕΝ αναγνώσεις', async () => {
    const decision = await ask({ requested: orgWorkspace(HOME) });

    expect(decision.verdict).toBe('home');
    // ⚠️ Ο παρονομαστής της υπόσχεσης «η συνήθης περίπτωση είναι δωρεάν»
    //    (ADR-787 Ε-5, ανοιχτό #3). Αν αυτό γίνει 1, κάθε αίτημα της
    //    πλατφόρμας πληρώνει μια ανάγνωση.
    expect(reads).toHaveLength(0);
  });

  it('Κ3 — ρόλος bypass σε ξένο ΓΡΑΦΕΙΟ ⇒ `platform-bypass`, ΜΗΔΕΝ αναγνώσεις', async () => {
    const decision = await ask({ globalRole: BYPASS_ROLE });

    expect(decision.verdict).toBe('platform-bypass');
    // Κρατά ακέραιο τον σημερινό `CompanySwitcher`: καμία νέα καθυστέρηση.
    expect(reads).toHaveLength(0);
  });

  it('Κ4 — υπάρχει ενεργή εγγραφή ⇒ `member`, ΜΙΑ ανάγνωση', async () => {
    store.set(memberPath(FOREIGN, NIKOS), { uid: NIKOS, status: 'active', globalRole: NORMAL_ROLE });

    const decision = await ask();

    expect(decision.verdict).toBe('member');
    expect(decision.membership?.uid).toBe(NIKOS);
    expect(reads).toEqual([memberPath(FOREIGN, NIKOS)]);
  });

  it('Κ5 — δεν υπάρχει εγγραφή ⇒ `not-a-member`', async () => {
    const decision = await ask();

    expect(decision.verdict).toBe('not-a-member');
    expect(isAllowed(decision.verdict)).toBe(false);
  });

  it('Κ6 — ανασταλμένη εγγραφή ⇒ `suspended`, ΞΕΧΩΡΙΣΤΑ από το «δεν υπάρχει»', async () => {
    store.set(memberPath(FOREIGN, NIKOS), { uid: NIKOS, status: 'suspended' });

    const decision = await ask();

    // ADR-787 Ε-2 §5: ο ανακληθείς **ξέρει** ότι ο χώρος υπάρχει ⇒ του
    // χρωστάμε άλλη απάντηση από τον άγνωστο.
    expect(decision.verdict).toBe('suspended');
    expect(decision.verdict).not.toBe('not-a-member');
    expect(isAllowed(decision.verdict)).toBe(false);
  });

  it('Κ7 — η αναζήτηση ΑΠΕΤΥΧΕ ⇒ `unknown`, ΠΟΤΕ `not-a-member`', async () => {
    failNextRead = true;

    const decision = await ask();

    // 🔴 Η καρδιά του N.12. Αν αυτό γίνει `not-a-member`, ο άνθρωπος διαβάζει
    //    «δεν είσαι μέλος» ενώ η αλήθεια είναι «δεν μπόρεσα να ρωτήσω».
    expect(decision.verdict).toBe('unknown');
    expect(decision.verdict).not.toBe('not-a-member');
    expect(isAllowed(decision.verdict)).toBe(false);
  });

  it('Κ7β — Firebase Admin μη διαθέσιμο ⇒ `unknown`, όχι σιωπηλή άρνηση', async () => {
    adminAvailable = false;

    const decision = await ask();

    expect(decision.verdict).toBe('unknown');
    expect(reads).toHaveLength(0);
  });
});

// =============================================================================
// Ι — Ο ΙΔΙΩΤΙΚΟΣ ΧΩΡΟΣ: Η ΑΥΣΤΗΡΟΤΕΡΗ ΓΡΑΜΜΗ (ADR-787 Ε-3 §3)
// =============================================================================

describe('Ι. Ο ιδιωτικός χώρος ΑΛΛΟΥ ανθρώπου', () => {
  it('Ι1 — ο Νίκος ΔΕΝ μπαίνει στον ιδιωτικό χώρο της Μαρίας', async () => {
    const decision = await ask({ requested: personalWorkspace(MARIA) });

    expect(decision.verdict).toBe('not-a-member');
    expect(reads).toHaveLength(0);
  });

  it('Ι2 — 🔴 ΟΥΤΕ Ο SUPER ADMIN μπαίνει στον ιδιωτικό χώρο της Μαρίας', async () => {
    // ADR-787 Ε-3 §3, αυτολεξεί: «Κανένας χώρος εργασίας δεν κατέχει ποτέ τον
    // ιδιωτικό χώρο ενός ανθρώπου. Ούτε τον βλέπει, ούτε τον διαχειρίζεται.»
    // ⚠️ Αυτό ΔΕΝ προκύπτει από τον τύπο — προκύπτει από τη ΣΕΙΡΑ: ο κλάδος
    //    `personal` επιστρέφει **πριν** φτάσει ο έλεγχος bypass. Μετακίνηση του
    //    `isRoleBypass` πιο πάνω κάνει αυτό το test κόκκινο, και σωστά.
    const decision = await ask({ globalRole: BYPASS_ROLE, requested: personalWorkspace(MARIA) });

    expect(decision.verdict).toBe('not-a-member');
    expect(decision.verdict).not.toBe('platform-bypass');
  });

  it('Ι3 — ούτε εγγραφή μέλους «σώζει» τον ιδιωτικό χώρο ΑΛΛΟΥ', async () => {
    // Ακόμα κι αν κάποιος γράψει εγγραφή, ο ιδιωτικός χώρος δεν διαβάζεται καν.
    store.set(memberPath(MARIA, NIKOS), { uid: NIKOS, status: 'active' });

    const decision = await ask({ requested: personalWorkspace(MARIA) });

    expect(decision.verdict).toBe('not-a-member');
    expect(reads).toHaveLength(0);
  });
});

// =============================================================================
// Δ — Ο ΚΑΤΑΛΟΓΟΣ, ΚΑΙ Η ΝΑΡΚΗ ΤΟΥ ΟΝΟΜΑΤΟΣ
// =============================================================================

describe('Δ. listMemberWorkspaces — η αντίστροφη ερώτηση', () => {
  it('Δ1 — επιστρέφει μόνο τους χώρους με ΕΝΕΡΓΗ εγγραφή', async () => {
    store.set(memberPath(FOREIGN, NIKOS), { uid: NIKOS, status: 'active' });
    store.set(memberPath('comp_other', NIKOS), { uid: NIKOS, status: 'suspended' });
    store.set(memberPath('comp_third', MARIA), { uid: MARIA, status: 'active' });

    const result = await listMemberWorkspaces(NIKOS);

    expect(result).toEqual({ outcome: 'ok', companyIds: [FOREIGN] });
  });

  it('Δ2 — 🔴 μέλος ΕΡΓΟΥ ΔΕΝ γίνεται μέλος ΧΩΡΟΥ — και ο παρονομαστής', async () => {
    // Ο Νίκος είναι καλεσμένος σε ΕΝΑ ΕΡΓΟ του ξένου γραφείου, τίποτε άλλο.
    const projectMemberPath = `companies/${FOREIGN}/projects/proj-1/members/mbr_1`;
    store.set(projectMemberPath, { uid: NIKOS, status: 'active', projectId: 'proj-1' });

    const result = await listMemberWorkspaces(NIKOS);

    // ✅ Ο κατάλογος είναι κενός: το έργο δεν είναι ο χώρος.
    expect(result).toEqual({ outcome: 'ok', companyIds: [] });

    // 🔴 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ — χωρίς αυτόν το παραπάνω θα μπορούσε να είναι πράσινο
    //    επειδή **δεν υπήρξε ποτέ βλάβη**. Εδώ αποδεικνύεται ότι με το ΠΑΛΙΟ
    //    όνομα (`members` και στα δύο επίπεδα) το ίδιο ερώτημα **θα έβρισκε**
    //    το έγγραφο του έργου, δηλαδή η διαρροή ήταν πραγματική.
    const asOldName = await collectionGroupRef('members').where('uid', '==', NIKOS).get();
    expect(asOldName.docs).toHaveLength(1);
  });

  it('Δ3 — αποτυχία ερωτήματος ⇒ `unknown`, ΠΟΤΕ κενή λίστα', async () => {
    failNextRead = true;

    const result = await listMemberWorkspaces(NIKOS);

    // Το ζωντανό ελάττωμα του §2.7: κενή λίστα διαβαζόταν «δεν έχεις χώρους».
    expect(result.outcome).toBe('unknown');
    expect(result).not.toHaveProperty('companyIds');
  });

  it('Δ4 — Firebase Admin μη διαθέσιμο ⇒ `unknown`', async () => {
    adminAvailable = false;

    const result = await listMemberWorkspaces(NIKOS);

    expect(result.outcome).toBe('unknown');
  });
});

// =============================================================================
// Ν — Η ΜΙΑ ΜΕΤΑΦΡΑΣΗ (fail-closed)
// =============================================================================

describe('Ν. normalizeMembership — η μία μετάφραση, κλειστή προς τα έξω', () => {
  it('Ν1 — άγνωστο `status` ⇒ `suspended`, ΠΟΤΕ `active`', () => {
    // Η προηγούμενη (δεύτερη) μετάφραση στο `role-management/users/route.ts`
    // έκανε `?? 'active'`: χαλασμένο έγγραφο γινόταν σιωπηλά ενεργό μέλος.
    expect(normalizeMembership('u', { status: 'κάτι άλλο' }).status).toBe('suspended');
    expect(normalizeMembership('u', {}).status).toBe('suspended');
    expect(normalizeMembership('u', undefined).status).toBe('suspended');
  });

  it('Ν2 — κρατά τις τρεις έγκυρες καταστάσεις αυτούσιες', () => {
    expect(normalizeMembership('u', { status: 'active' }).status).toBe('active');
    expect(normalizeMembership('u', { status: 'suspended' }).status).toBe('suspended');
    expect(normalizeMembership('u', { status: 'pending' }).status).toBe('pending');
  });

  it('Ν3 — το `uid` έρχεται από το ΚΛΕΙΔΙ του εγγράφου, όχι από το πεδίο', () => {
    // Το κλειδί **είναι** η ταυτότητα (εμποδίζει τη διπλή συμμετοχή). Ένα πεδίο
    // που διαφωνεί με το κλειδί δεν επιτρέπεται να νικήσει.
    expect(normalizeMembership(NIKOS, { uid: MARIA }).uid).toBe(NIKOS);
  });

  it('Ν4 — χαλασμένο `permissionSetIds` δεν σκάει και δεν περνά σκουπίδια', () => {
    expect(normalizeMembership('u', { permissionSetIds: 'όχι πίνακας' }).permissionSetIds).toEqual([]);
    expect(normalizeMembership('u', { permissionSetIds: ['a', 7, null, 'b'] }).permissionSetIds)
      .toEqual(['a', 'b']);
  });
});

// =============================================================================
// Λ — Η ΛΟΓΙΣΤΙΚΗ ΤΟΥ ΚΟΣΤΟΥΣ
// =============================================================================

describe('Λ. readsFor — η υπόσχεση απόδοσης είναι μετρήσιμη', () => {
  const ALL: MembershipVerdict[] = [
    'home', 'self', 'platform-bypass', 'member', 'not-a-member', 'suspended', 'unknown',
  ];

  it('Λ1 — και οι επτά ετυμηγορίες έχουν δηλωμένο κόστος', () => {
    for (const verdict of ALL) {
      expect([0, 1]).toContain(readsFor(verdict));
    }
  });

  it('Λ2 — οι τρεις δωρεάν είναι ΑΚΡΙΒΩΣ αυτές που δεν αγγίζουν τη βάση', () => {
    const free = ALL.filter((v) => readsFor(v) === 0);
    expect(free.sort()).toEqual(['home', 'platform-bypass', 'self']);
  });

  it('Λ3 — άγνωστη ετυμηγορία ΡΙΧΝΕΙ ΜΕ ΟΝΟΜΑ (fail-closed)', () => {
    // ⚠️ Η άγκυρα κρίνει **δομή**, όχι διατύπωση: (α) ότι ρίχνει· (β) ότι το
    //    μήνυμα **ονομάζει την τιμή** που το προκάλεσε — αλλιώς ο επόμενος
    //    βλέπει «κάτι πήγε στραβά» χωρίς να ξέρει τι.
    //    🔴 Η πρώτη γραφή ταίριαζε **ελληνικό κείμενο** και κοκκίνισε μόλις το
    //    μήνυμα μεταφράστηκε στα αγγλικά για τον N.11 (server invariant, δεν
    //    ζωγραφίζεται ποτέ). Μια άγκυρα δεμένη σε **λέξεις** σπάει σε αλλαγή που
    //    δεν αλλάζει **καμία συμπεριφορά** — ίδιο σφάλμα με τη μετάλλαξη `Μ6`
    //    του CHECK 3.44.
    expect(() => readsFor('φαντασία' as MembershipVerdict)).toThrow(/φαντασία/);
    expect(() => readsFor('φαντασία' as MembershipVerdict)).toThrow(/MEMBERSHIP/);
  });

  it('Λ4 — το `unknown` ΔΕΝ είναι επιτρεπτική ετυμηγορία', () => {
    // Μετάλλαξη που το προσθέτει στο `ALLOWING_VERDICTS` κοκκινίζει εδώ.
    expect(isAllowed('unknown')).toBe(false);
    expect(ALL.filter(isAllowed).sort()).toEqual(['home', 'member', 'platform-bypass', 'self']);
  });
});

// =============================================================================
// Α — ΑΠΟΜΝΗΜΟΝΕΥΣΗ: ΑΝΑ ΑΙΤΗΜΑ, ΠΟΤΕ ΜΕ ΧΡΟΝΟ ΛΗΞΗΣ
// =============================================================================

describe('Α. Η απομνημόνευση', () => {
  it('Α1 — δεύτερη ερώτηση για τον ΙΔΙΟ χώρο δεν ξαναδιαβάζει', async () => {
    store.set(memberPath(FOREIGN, NIKOS), { uid: NIKOS, status: 'active' });
    const cache = new Map();

    await ask({ cache });
    await ask({ cache });

    expect(reads).toHaveLength(1);
  });

  it('Α2 — ΔΙΑΦΟΡΕΤΙΚΟΣ χώρος δεν κληρονομεί την απάντηση του πρώτου', async () => {
    store.set(memberPath(FOREIGN, NIKOS), { uid: NIKOS, status: 'active' });
    const cache = new Map();

    const first = await ask({ cache });
    const second = await ask({ cache, requested: orgWorkspace('comp_third') });

    expect(first.verdict).toBe('member');
    expect(second.verdict).toBe('not-a-member');
  });

  it('Α3 — ο ιδιωτικός χώρος ΔΕΝ μπερδεύεται με γραφείο ίδιου αναγνωριστικού', async () => {
    // Το κλειδί απομνημόνευσης φέρει το είδος (`org:` / `personal:`). Αν το
    // έχανε, ένα uid ίδιο με companyId θα μοιραζόταν απάντηση.
    const cache = new Map();

    const asOrg = await ask({ cache, requested: orgWorkspace(NIKOS) });
    const asPersonal = await ask({ cache, requested: personalWorkspace(NIKOS) });

    expect(asOrg.verdict).toBe('not-a-member');
    expect(asPersonal.verdict).toBe('self');
  });
});
