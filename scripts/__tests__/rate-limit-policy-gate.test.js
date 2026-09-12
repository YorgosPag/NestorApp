/**
 * @jest-environment node
 *
 * ΑΓΚΥΡΕΣ CHECK 3.78 — Η ΠΥΛΗ ΤΗΣ ΠΟΛΙΤΙΚΗΣ ΡΥΘΜΟΥ (ADR-855 Α5 · §10 Γ1 · Γ2)
 *
 * ⚠️ **ΟΙ ΜΕΤΑΛΛΑΞΕΙΣ ΕΙΝΑΙ ΣΤΙΣ ΕΙΣΟΔΟΥΣ** — συνθετικές διαδρομές και συνθετικός πίνακας,
 *    περασμένα ως `override` στην απογραφή. Μετάλλαξη στην **πύλη** αποδεικνύει ότι το test
 *    *τρέχει*· μετάλλαξη στην **είσοδο** αποδεικνύει ότι *κοιτάζει το σωστό πράγμα*.
 *
 * ⚠️ `@jest-environment node`: η πύλη διαβάζει τον δίσκο (μάθημα CHECK 3.46 — σφάλμα
 *    περιβάλλοντος διαβάζεται ως «σπασμένη πύλη»).
 *
 * 🔴 **Ο Μ0 ΕΙΝΑΙ ΥΠΟΧΡΕΩΤΙΚΟΣ**: μια πύλη που σαρώνει **μηδέν** διαδρομές είναι επίσης
 *    «πράσινη». Το «0 = κανείς δεν κοίταξε» είναι το σχήμα που αυτή η πύλη υπάρχει για να
 *    κλείσει — δεν επιτρέπεται να το αναπαράγει η ίδια.
 */

'use strict';

const path = require('node:path');

const inventory = require('../lib/rate-limit-policy/inventory');
const { STATES, ORDER, classify, violationId, judge, idsOf } = require('../lib/rate-limit-policy/judge');

const REPO_ROOT = path.join(__dirname, '..', '..');

// =============================================================================
// ΣΥΝΘΕΤΙΚΕΣ ΕΙΣΟΔΟΙ — μία γραμμή αλλαγή ανά μετάλλαξη
// =============================================================================

const TABLE = {
  prefixes: [
    { prefix: '/api/admin', category: 'SENSITIVE' },
    { prefix: '/api/reports', category: 'HEAVY' },
  ],
  unresolved: [],
};

/** `route(url, πηγή)` — η «πηγή» είναι ό,τι θα διάβαζε η απογραφή από τον δίσκο. */
const route = (url, source) => ({ file: `src/app/api${url.slice(4)}/route.ts`, url, source });

const WITH_HEAVY = 'export const GET = withHeavyRateLimit(h);';
const WITH_SENSITIVE = 'export const GET = withSensitiveRateLimit(h);';
const WITH_STANDARD = 'export const GET = withStandardRateLimit(h);';
const VIA_FACTORY = 'export const GET = defineRoute({ rateLimit: "standard", handler });';
const SILENT = 'export const GET = async () => new Response("ok");';

function verdictFor(files) {
  return judge(inventory.takeInventory(REPO_ROOT, { files, table: TABLE, fallback: 'STANDARD' }));
}

// =============================================================================
// Μ0 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η πύλη κρίνει το ΠΡΑΓΜΑΤΙΚΟ δέντρο
// =============================================================================

describe('Μ0 — παρονομαστής', () => {
  it('Μ0α: ο πληθυσμός είναι ΟΛΟ το δέντρο διαδρομών, όχι δείγμα', () => {
    const v = judge(inventory.takeInventory(REPO_ROOT));

    // Πύλη που σαρώνει λίγα αρχεία είναι «πράσινη» χωρίς να κοιτάξει.
    expect(v.population).toBeGreaterThan(400);
  });

  it('Μ0β: η λογιστική ΚΛΕΙΝΕΙ πάνω στο πραγματικό δέντρο', () => {
    const v = judge(inventory.takeInventory(REPO_ROOT));
    const summed = ORDER.reduce((acc, s) => acc + v.tally[s], 0);

    expect({ summed }).toEqual({ summed: v.population });
  });

  it('Μ0γ: ο πίνακας προθεμάτων διαβάζεται ΑΠΟ ΤΗΝ ΠΗΓΗ και δεν είναι κενός', () => {
    const { table } = inventory.takeInventory(REPO_ROOT);

    expect(table.prefixes.length).toBeGreaterThan(5);
  });

  it('🔴 Μ0δ: ΚΑΘΕ υπολογισμένο κλειδί επιλύεται — ή δηλώνεται, ποτέ μαντεύεται', () => {
    const { table } = inventory.takeInventory(REPO_ROOT);
    const resolved = table.prefixes.filter((p) => p.from);

    // Τα τρία γνωστά υπολογισμένα κλειδιά, με τις ΕΠΑΛΗΘΕΥΜΕΝΕΣ τιμές τους.
    expect(resolved.map((p) => `${p.from} → ${p.prefix}`).sort()).toEqual([
      'API_ROUTES.PROJECTS.LIST → /api/projects/list',
      'API_ROUTES.SEARCH → /api/search',
      'EMAIL_SUBSCRIPTION_API → /api/notifications/email/subscription',
    ]);
  });
});

// =============================================================================
// Π — Η ΒΑΘΜΟΝΟΜΗΣΗ ΤΟΥ ΣΦΑΛΜΑΤΟΣ ΠΟΥ ΠΛΗΡΩΘΗΚΕ
// =============================================================================

describe('Π — βαθμονόμηση: το σφάλμα του ονόματος `LIST`', () => {
  /**
   * 🔴 Η πρώτη γραφή έψαχνε `\bLIST\s*[:=]` και έπαιρνε το ΠΡΩΤΟ από **πέντε** ταιριάσματα
   * στο `domain-constants.ts` ⇒ `API_ROUTES.PROJECTS.LIST → /api/admin/backup/list`.
   * Το `expect` στο κλειστό σύνολο κάνει το λάθος **ανέκφραστο**.
   */
  it('🔴 Π1: η επίλυση απαιτεί ΖΕΥΓΟΣ ονόματος+τιμής — σκέτο όνομα ΔΕΝ αρκεί', () => {
    // Το `LIST` υπάρχει πολλές φορές· μόνο το ζεύγος με την προσδοκία ταιριάζει.
    expect(inventory.resolveComputedKey(REPO_ROOT, 'API_ROUTES.PROJECTS.LIST'))
      .toBe('/api/projects/list');
  });

  it('🔑 Π2: σταθερά που η πηγή ΔΕΝ βεβαιώνει ⇒ `null`, ποτέ μαντεμένη τιμή', () => {
    expect(inventory.resolveComputedKey(REPO_ROOT, 'API_ROUTES.ΑΝΥΠΑΡΚΤΟ')).toBeNull();
  });

  /**
   * 🔴 **Η ΠΕΜΠΤΗ ΠΤΩΣΗ ΨΕΥΔΩΣ ΘΕΤΙΚΩΝ — ΚΑΙ ΤΗΝ ΕΠΙΑΣΕ Η ΙΔΙΑ Η ΠΥΛΗ, ΤΗΝ ΠΡΩΤΗ ΜΕΡΑ.**
   *
   * Ο ταξινομητής ρωτούσε `source.includes(name + '(')`, οπότε μια δήλωση **με παράμετρο
   * τύπου** — `withSensitiveRateLimit<Segment>(` — δεν φαινόταν καθόλου: η διαδρομή
   * `workspace-invitations/[invitationId]/revoke` καταγγέλθηκε ως `undeclared` ενώ
   * **δήλωνε σωστά**. Το δέντρο έχει **δύο** τέτοιες μορφές, και μετά τη διόρθωση η
   * απογραφή μετακινήθηκε **77→55 σιωπηλές** και **75→94 εργοστασιακές**: δηλαδή η
   * baseline ήταν φουσκωμένη κατά **22** διαδρομές που δηλώνουν κανονικά.
   *
   * ⚠️ Χωρίς αυτή την άγκυρα, ο επόμενος που «απλοποιεί» σε `includes()` ξαναφέρνει
   * σιωπηλά 22 ψευδώς θετικά — και θα στείλει ανθρώπους να «διορθώσουν» σωστό κώδικα.
   */
  it('🔴 Π3: δήλωση ΜΕ παράμετρο τύπου μετράει — `withSensitiveRateLimit<Segment>(`', () => {
    const withGeneric = 'export const POST = withSensitiveRateLimit<Segment>(withAuth(h));';
    const v = verdictFor([route('/api/thing', withGeneric)]);

    expect(idsOf(v, STATES.UNDECLARED)).toEqual([]);
  });

  it('🔑 Π3β: το ίδιο για εργοστάσιο — η παράμετρος τύπου δεν κρύβει τη δήλωση', () => {
    const factoryGeneric = 'export const GET = defineRoute<Ctx>({ rateLimit: "standard", handler });';
    const v = verdictFor([route('/api/thing', factoryGeneric)]);

    expect(idsOf(v, STATES.UNDECLARED)).toEqual([]);
  });
});

// =============================================================================
// Κ1 — «ΔΗΛΩΝΕΙ;» (μεταλλάξεις στις εισόδους)
// =============================================================================

describe('Κ1 — η δήλωση', () => {
  it('🔴 Κ1α: διαδρομή ΧΩΡΙΣ καμία δήλωση ⇒ `undeclared`', () => {
    const v = verdictFor([route('/api/thing', SILENT)]);

    expect(idsOf(v, STATES.UNDECLARED)).toEqual(['/api/thing']);
  });

  it('🔑 Κ1β: ΕΡΓΟΣΤΑΣΙΟ μετράει ως δήλωση — ΔΕΝ είναι αδήλωτη (49% ψευδώς θετικά)', () => {
    const v = verdictFor([route('/api/thing', VIA_FACTORY)]);

    expect(idsOf(v, STATES.UNDECLARED)).toEqual([]);
    expect(idsOf(v, STATES.VIA_FACTORY)).toEqual(['/api/thing']);
  });

  it('🔴 Κ1γ: ωμό `withRateLimit` ΧΩΡΙΣ `category` είναι αδήλωτο ως προς την ΠΟΛΙΤΙΚΗ', () => {
    const v = verdictFor([route('/api/thing', 'export const GET = withRateLimit(h);')]);

    expect(idsOf(v, STATES.UNDECLARED)).toEqual(['/api/thing']);
  });

  it('🔑 Κ1δ: ρητό `category` μετράει ως δήλωση, ακόμη και με ωμό wrapper', () => {
    const src = "export const GET = withRateLimit(h, { category: 'HEAVY' });";
    const v = verdictFor([route('/api/reports/x', src)]);

    // `/api/reports` → HEAVY στον συνθετικό πίνακα ⇒ συμφωνεί.
    expect(idsOf(v, STATES.AGREES)).toEqual(['/api/reports/x']);
  });
});

// =============================================================================
// Κ2 — «ΣΥΜΦΩΝΕΙ;» (το δεύτερο, ΑΝΕΞΑΡΤΗΤΟ κριτήριο)
// =============================================================================

describe('Κ2 — η νεκρή γραμμή πίνακα', () => {
  it('🔴 Κ2α: δηλώνει HEAVY, ο πίνακας λέει SENSITIVE ⇒ η γραμμή του πίνακα είναι νεκρή', () => {
    const v = verdictFor([route('/api/admin/x', WITH_HEAVY)]);

    expect(idsOf(v, STATES.SHADOWED)).toEqual(['/api/admin/x']);
  });

  it('🔴 Κ2β: ΚΑΙ η αντίστροφη κατεύθυνση — δηλώνει STANDARD, ο πίνακας λέει HEAVY', () => {
    const v = verdictFor([route('/api/reports/x', WITH_STANDARD)]);

    expect(idsOf(v, STATES.SHADOWED)).toEqual(['/api/reports/x']);
  });

  it('🔑 Κ2γ: δηλώνει ό,τι επιβάλλεται ⇒ `declared-agrees`, καμία παραβίαση', () => {
    const v = verdictFor([route('/api/admin/x', WITH_SENSITIVE)]);

    expect(v.violationIds).toEqual([]);
    expect(idsOf(v, STATES.AGREES)).toEqual(['/api/admin/x']);
  });

  it('🔑 Κ2ε: δήλωση ≠ ΠΡΟΕΠΙΛΟΓΗ χωρίς γραμμή πίνακα ⇒ ΚΑΜΙΑ παραβίαση (ήταν 57/84 ψεύτικες)', () => {
    // 🔴 **ΤΟ ΖΕΥΓΟΣ ΕΙΝΑΙ Η ΑΠΟΔΕΙΞΗ, ΚΑΙ ΓΙ' ΑΥΤΟ ΖΟΥΝ ΜΑΖΙ ΣΕ ΜΙΑ ΑΓΚΥΡΑ.**
    //    Ίδια δήλωση (`HEAVY`), ίδια διαφορά από το επιβαλλόμενο, **αντίθετη** ετυμηγορία —
    //    και το μόνο που αλλάζει είναι αν ο πίνακας **έχει γραμμή** για τη διεύθυνση.
    //    Χωριστές άγκυρες θα μπορούσαν να είναι και οι δύο πράσινες με το κριτήριο
    //    σπασμένο προς τη μία κατεύθυνση.
    const v = verdictFor([
      // `/api/elsewhere` — **κανένα** πρόθεμα του TABLE δεν ταιριάζει ⇒ fallback STANDARD.
      route('/api/elsewhere', WITH_HEAVY),
      // `/api/admin/x` — ταιριάζει γραμμή (SENSITIVE) ⇒ εκείνη **νεκρώνει**.
      route('/api/admin/x', WITH_HEAVY),
    ]);

    expect({
      overDefault: idsOf(v, STATES.DECLARED_OVER_DEFAULT),
      shadowed: idsOf(v, STATES.SHADOWED),
      violations: v.violationIds.length,
    }).toEqual({
      overDefault: ['/api/elsewhere'],
      shadowed: ['/api/admin/x'],
      violations: 1,
    });
  });

  it('🔴 Κ2στ: η αθώωση είναι fail-closed — απογραφή ΧΩΡΙΣ `enforcedFrom` μετράει παραβίαση', () => {
    // ⚠️ Η μετάλλαξη είναι στην **είσοδο**: route object παλιότερης μορφής, όπως θα
    //    ερχόταν από απογραφή που δεν έμαθε ποτέ να απαντά «από πού». Αν το κριτήριο
    //    αθώωνε το `undefined`, μια μισοαναβαθμισμένη μηχανή θα **έσβηνε** σιωπηλά και
    //    τις 27 πραγματικές νεκρές γραμμές.
    expect(classify({ kind: 'direct', declared: 'HEAVY', enforced: 'STANDARD' }))
      .toBe(STATES.SHADOWED);

    // Ο παρονομαστής: με το ρητό `'default'` **αθωώνεται**.
    expect(classify({ kind: 'direct', declared: 'HEAVY', enforced: 'STANDARD', enforcedFrom: 'default' }))
      .toBe(STATES.DECLARED_OVER_DEFAULT);
  });

  it('🔴 Κ2δ: τα ΔΥΟ κριτήρια είναι ΑΝΕΞΑΡΤΗΤΑ — ποτέ ένα με «ή»', () => {
    // Η μία σιωπά, η άλλη αντιφάσκει: **δύο** παραβιάσεις, διαφορετικού είδους.
    const v = verdictFor([
      route('/api/silent', SILENT),
      route('/api/admin/loud', WITH_HEAVY),
    ]);

    expect({
      undeclared: idsOf(v, STATES.UNDECLARED),
      shadowed: idsOf(v, STATES.SHADOWED),
    }).toEqual({ undeclared: ['/api/silent'], shadowed: ['/api/admin/loud'] });
  });
});

// =============================================================================
// Γ — Η ΤΑΥΤΟΤΗΤΑ: η ΑΝΤΑΛΛΑΓΗ πρέπει να μπλοκάρει (ADR-749)
// =============================================================================

describe('Γ — ratchet κατά ταυτότητα', () => {
  it('🔴 Γ2: αλλαγή ΖΕΥΓΟΥΣ βαθμίδων αλλάζει την ταυτότητα (αλλιώς «78 → 78» περνά)', () => {
    const a = verdictFor([route('/api/admin/x', WITH_HEAVY)]).violationIds;
    const b = verdictFor([route('/api/admin/x', WITH_STANDARD)]).violationIds;

    // Ίδια διαδρομή, ίδιο πλήθος — **άλλη** παραβίαση.
    expect(a).not.toEqual(b);
    expect({ lenA: a.length, lenB: b.length }).toEqual({ lenA: 1, lenB: 1 });
  });

  it('🔑 Γ2β: η ταυτότητα ΔΕΝ κουβαλά αριθμό γραμμής (μετακίνηση ≠ νέα παραβίαση)', () => {
    const id = violationId({ state: STATES.SHADOWED, declared: 'HEAVY', enforced: 'STANDARD', url: '/api/x' });

    expect(id).toBe('prefix-shadowed-by-declaration::HEAVY→STANDARD::/api/x');
  });

  it('🔑 Γ3: το κλειστό σύνολο κρατά ΠΟΙΟ εργοστάσιο κρύβει τη βαθμίδα', () => {
    const v = verdictFor([route('/api/thing', VIA_FACTORY)]);

    expect(v.declarations).toEqual(['defineRoute::/api/thing']);
  });
});

// =============================================================================
// Λ — FAIL-CLOSED: η λογιστική δεν επιτρέπεται να χαθεί η ΙΔΙΑ
// =============================================================================

describe('Λ — fail-closed', () => {
  it('🔴 Λ1: άγνωστη κατάσταση ⇒ `throw` με όνομα, ποτέ σιωπηλή απόρριψη', () => {
    const broken = { routes: [{ url: '/api/x', kind: 'ΑΓΝΩΣΤΟ', declared: null, enforced: 'STANDARD' }], table: TABLE };

    expect(() => judge(broken)).toThrow(/άγνωστη κατάσταση/);
  });

  it('🔑 Λ2: ο ταξινομητής δίνει ΑΚΡΙΒΩΣ μία κατάσταση για κάθε είδος εισόδου', () => {
    const cases = [
      [{ kind: 'silent' }, STATES.UNDECLARED],
      [{ kind: 'factory', factory: 'defineRoute' }, STATES.VIA_FACTORY],
      [{ kind: 'direct', declared: null }, STATES.UNDECLARED],
      [{ kind: 'direct', declared: 'HEAVY', enforced: 'HEAVY' }, STATES.AGREES],
      [{ kind: 'direct', declared: 'HEAVY', enforced: 'STANDARD' }, STATES.SHADOWED],
    ];

    expect(cases.map(([input]) => classify(input))).toEqual(cases.map(([, expected]) => expected));
  });
});
