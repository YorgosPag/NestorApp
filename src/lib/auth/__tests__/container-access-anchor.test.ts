/**
 * =============================================================================
 * ΑΓΚΥΡΕΣ ΤΟΥ ΚΡΙΤΗ ΟΡΑΤΟΤΗΤΑΣ (ADR-862 Φ0 Β5 · άγκυρα Α10)
 * =============================================================================
 *
 * ⚠️ **Η ΒΑΘΜΟΝΟΜΗΣΗ ΕΙΝΑΙ ΤΟ ΚΕΝΤΡΟ** *(δόγμα `authority.test.ts`)*: ένα test
 * που τρέχει σε κόσμο που δεν υπάρχει αποδεικνύει ότι ο κώδικας συμφωνεί με τη
 * φαντασία του συγγραφέα του. Γι' αυτό:
 *
 *  • η ικανότητα των αγκυρών επαληθεύεται έναντι του **πραγματικού** `PERMISSIONS` (**Κ0**)·
 *  • οι καταστάσεις του πίνακα διασταυρώνονται με το **`CDE_STATE_VALUES`** (**Π**) —
 *    την ίδια SSoT που διαβάζει ο θεματοφύλακας·
 *  • δύο άγκυρες περνούν από τον **ΠΡΑΓΜΑΤΙΚΟ** θεματοφύλακα (`readContainerState`),
 *    όχι από χειρόγραφο `unreadable` (**Σ**).
 *
 * 🔑 **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΗΣ ΜΕΤΑΛΛΑΞΗΣ — ΓΙΑΤΙ ΥΠΑΡΧΕΙ Η ΟΜΑΔΑ `Π`.** Η εντολή
 * *«σβήσε γραμμή του `AUDIENCE_REACH` ⇒ πρέπει να κοκκινίσει»* **δεν** ικανοποιείται
 * από τις συμπεριφορικές άγκυρες μόνες τους: σβήνοντας το `SHARED: false` μέσα από
 * τη γραμμή `crew`, η αναζήτηση γυρίζει `undefined` ⇒ **falsy** ⇒ **ίδια** άρνηση
 * `denied-audience` ⇒ **όλα πράσινα**. Ο μεταγλωττιστής πιάνει τη σβησμένη
 * **γραμμή ακροατηρίου** (`Record<CdeAudience, …>`), αλλά **όχι** το σβησμένο
 * **κελί** — και το `@swc/jest` είναι **transpile-only**, άρα σε χρόνο εκτέλεσης
 * δεν φρουρεί κανείς. Η ομάδα `Π` είναι αυτή που κοκκινίζει. *(Είναι επίσης το
 * κριτήριο **Κ4** της πύλης του Β12 — η άγκυρα γεννιέται πριν την πύλη.)*
 *
 * ⛔ **ΚΑΝΕΝΑ ΟΝΟΜΑ ΡΟΛΟΥ, ΚΑΝΕΝΑ `globalRole` σε αυτό το αρχείο** — επίτηδες: η
 * ορατότητα κρίνεται από **ακροατήριο** και **ομάδα**, ποτέ από ρόλο (CHECK 3.68 Κ1′).
 * Οι ταυτότητες φέρουν **ρητό** permission, όπως ο `PROD_CONTRADICTORY` της παραγωγής.
 *
 * @see lib/auth/container-access — ο κριτής
 * @see ADR-862 §5.4.1 · ADR-787 Κ-4 · ADR-801 §7
 */

import { describe, it, expect } from '@jest/globals';

import { CDE_STATE_VALUES } from '@/config/iso19650-constants';
import { readContainerState } from '@/lib/files/file-record-read';
import {
  VISIBLE_VERDICTS,
  isContainerVisible,
  type ContainerAccessDecision,
  type ContainerAccessVerdict,
  type ContainerFacts,
  type ContainerState,
  type ContainerSubject,
} from '@/types/container-access';

import { CONTAINER_POLICY_TABLES, decideContainerAccess } from '../container-access';
import { PERMISSIONS, type PermissionId } from '../types';

const { AUDIENCE_REACH, ACTION_BY_PHASE } = CONTAINER_POLICY_TABLES;

// =============================================================================
// ΤΟ ΕΛΑΧΙΣΤΟ ΕΡΩΤΗΜΑ
// =============================================================================

/** Ικανότητα που **υπάρχει** στο μητρώο — επαληθεύεται στο Κ0. */
const VIEW: PermissionId = 'projects:projects:view';

const OWN_TEAM = 'team_structural';
const OTHER_TEAM = 'team_architectural';

/** Ο αναγνώστης. Προεπιλογή: μελετητής **της ομάδας** του αρχείου, χωρίς ιστορικό. */
const person = (over: Partial<ContainerSubject> = {}): ContainerSubject => ({
  uid: 'uid_reader',
  permissions: [VIEW],
  taskTeamId: OWN_TEAM,
  audience: 'design',
  historyRequested: false,
  ...over,
});

const containerFacts = (state: ContainerState): ContainerFacts => ({
  fileId: 'file_anchor',
  companyId: 'comp_1',
  createdBy: 'uid_author',
  state,
});

const askDecision = (
  subject: ContainerSubject | null,
  state: ContainerState,
): ContainerAccessDecision =>
  decideContainerAccess({ subject, facts: containerFacts(state), action: VIEW });

const ask = (subject: ContainerSubject | null, state: ContainerState): ContainerAccessVerdict =>
  askDecision(subject, state).verdict;

/** Οι έξι φάσεις ως έτοιμα γεγονότα — η ομάδα είναι **του δοχείου**. */
const WIP_OWN: ContainerState = { phase: 'WIP', teamId: OWN_TEAM };
const WIP_FOREIGN: ContainerState = { phase: 'WIP', teamId: OTHER_TEAM };
const WIP_TEAMLESS: ContainerState = { phase: 'WIP', teamId: null };
const SHARED: ContainerState = { phase: 'SHARED', teamId: OTHER_TEAM };
const PUBLISHED: ContainerState = { phase: 'PUBLISHED', teamId: OTHER_TEAM, revision: 3 };
const SUPERSEDED: ContainerState = { phase: 'SUPERSEDED', teamId: OWN_TEAM };
const PRE_CDE: ContainerState = { phase: 'pre-cde' };
const UNREADABLE: ContainerState = { phase: 'unreadable', why: 'published-without-seal' };

// =============================================================================
// Κ0 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΩΝ ΙΔΙΩΝ ΤΩΝ ΑΓΚΥΡΩΝ
// =============================================================================

describe('Κ0 — οι άγκυρες μετρούν κάτι υπαρκτό', () => {
  it('Κ0.1 — η ικανότητα VIEW υπάρχει ΠΡΑΓΜΑΤΙΚΑ στο μητρώο PERMISSIONS', () => {
    // ⚠️ Χωρίς αυτό, ένα τυπογραφικό θα έστελνε ΚΑΘΕ άγκυρα στο
    //    `denied-unknown-action` του αδελφού ⇒ `denied-capability` παντού:
    //    δεκάδες «πράσινες» αρνήσεις που δεν κοιτούν τίποτα.
    expect(Object.hasOwn(PERMISSIONS, VIEW)).toBe(true);
  });

  it('Κ0.2 — το ΡΗΤΟ permission ΟΝΤΩΣ περνά το βήμα (8), αλλιώς καμία άδεια δεν είναι παραγώγιμη', () => {
    expect(ask(person(), PRE_CDE)).toBe('visible-legacy-tenant');
  });
});

// =============================================================================
// Α — Η ΣΕΙΡΑ ΚΡΙΣΗΣ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ
// =============================================================================

describe('Α — το συμβόλαιο της σειράς', () => {
  it('Α1 — καμία ταυτότητα ⇒ denied-unauthenticated, ΑΚΟΜΑ ΚΑΙ σε PUBLISHED', () => {
    expect(ask(null, PUBLISHED)).toBe('denied-unauthenticated');
  });

  it('Α2 — άγνωστη κατάσταση ⇒ denied-unknown-state (fail-closed), πριν από ΚΑΘΕ άλλη ερώτηση', () => {
    // Υποκείμενο που τα έχει όλα: ομάδα, ακροατήριο, διακόπτη, ικανότητα.
    expect(ask(person({ historyRequested: true }), UNREADABLE)).toBe('denied-unknown-state');
  });

  it('Α3 — pre-cde ⇒ «όπως σήμερα»: ορατό ΧΩΡΙΣ ακροατήριο και ΧΩΡΙΣ ομάδα', () => {
    // 🔑 Τα 35 από 35 ζωντανά αρχεία είναι εδώ. Αν αυτό κοκκινίσει, η Φ0 έκρυψε
    //    παραγωγή.
    expect(ask(person({ audience: null, taskTeamId: null }), PRE_CDE)).toBe(
      'visible-legacy-tenant',
    );
  });

  it('Α3β — ΚΑΙ ΟΜΩΣ το pre-cde ΔΕΝ παρακάμπτει τον έλεγχο ικανότητας (βήμα 8)', () => {
    // ⚠️ «Όπως σήμερα» σημαίνει *ακριβώς* τον σημερινό έλεγχο — όχι «ανοιχτό».
    expect(ask(person({ permissions: [] }), PRE_CDE)).toBe('denied-capability');
  });

  it('Α4 — δεν συμμετέχει στην υπόθεση ⇒ denied-not-engaged', () => {
    expect(ask(person({ audience: null }), SHARED)).toBe('denied-not-engaged');
  });

  it('Α5 — 🔑 ΤΟ ΣΥΝΕΡΓΕΙΟ ΜΠΡΟΣΤΑ ΣΕ WIP ΠΑΙΡΝΕΙ denied-audience, ΟΧΙ denied-foreign-wip', () => {
    // 🔴 Η ΣΕΙΡΑ ΕΙΝΑΙ ΔΙΑΡΡΟΗ ΠΛΗΡΟΦΟΡΙΑΣ, ΟΧΙ ΣΤΥΛ: το `denied-foreign-wip` θα
    //    έλεγε στο συνεργείο ότι **υπάρχει ομάδα** και ότι το αρχείο ανήκει σε
    //    άλλη. Το συνεργείο δεν πρέπει να μάθει καν ότι υπάρχουν ομάδες.
    expect(ask(person({ audience: 'crew', taskTeamId: OTHER_TEAM }), WIP_OWN)).toBe(
      'denied-audience',
    );
  });

  it('Α6 — ξένο WIP μελετητή ⇒ denied-foreign-wip (η κανονική άρνηση της Α10)', () => {
    expect(ask(person(), WIP_FOREIGN)).toBe('denied-foreign-wip');
  });

  it('Α7 — WIP ΧΩΡΙΣ ομάδα ⇒ denied-teamless: κανείς δεν κληρονομεί ανώνυμο WIP', () => {
    // ⚠️ Δύο `null` ΔΕΝ «ταιριάζουν». Αλλιώς η απουσία δεδομένου θα ήταν άδεια.
    expect(ask(person({ taskTeamId: null }), WIP_TEAMLESS)).toBe('denied-teamless');
    expect(ask(person(), WIP_TEAMLESS)).toBe('denied-teamless');
    expect(ask(person({ taskTeamId: null }), WIP_OWN)).toBe('denied-teamless');
  });

  it('Α8 — SUPERSEDED: χωρίς διακόπτη κρύβεται, με διακόπτη γίνεται ιστορικό', () => {
    expect(ask(person(), SUPERSEDED)).toBe('denied-superseded-hidden');
    expect(ask(person({ historyRequested: true }), SUPERSEDED)).toBe('visible-history');
  });

  it('Α9 — πέρασε το ακροατήριο, το έκοψε η ικανότητα ⇒ denied-capability', () => {
    expect(ask(person({ permissions: [] }), PUBLISHED)).toBe('denied-capability');
  });

  it('Α10 — η απόφαση κουβαλά ΡΗΤΑ τον πόρο και τη φάση που κρίθηκαν', () => {
    // ⚠️ Ώστε ένα «ναι» να μην μπορεί ποτέ να εφαρμοστεί σε ΑΛΛΟ αρχείο.
    const d = decideContainerAccess({
      subject: person(),
      facts: containerFacts(SHARED),
      action: VIEW,
    });
    expect(d.fileId).toBe('file_anchor');
    expect(d.phase).toBe('SHARED');
    expect(d.reason).toBeNull();
  });
});

// =============================================================================
// Ε — Η ΕΜΒΕΛΕΙΑ ΤΟΥ ΑΚΡΟΑΤΗΡΙΟΥ (ΠΙΝΑΚΑΣ Α, ADR-862 §5.4.1)
// =============================================================================

describe('Ε — ποιο πρότυπο φτάνει πού', () => {
  it('Ε1 — μελετητής: δικό του WIP ✅ · SHARED ✅ · PUBLISHED ✅', () => {
    expect(ask(person(), WIP_OWN)).toBe('visible-own-wip');
    expect(ask(person(), SHARED)).toBe('visible-shared-to-design');
    expect(ask(person(), PUBLISHED)).toBe('visible-published');
  });

  it('Ε2 — συνεργείο: ΜΟΝΟ PUBLISHED', () => {
    const crew = person({ audience: 'crew', taskTeamId: null, historyRequested: true });
    expect(ask(crew, PUBLISHED)).toBe('visible-published');
    expect(ask(crew, SHARED)).toBe('denied-audience');
    expect(ask(crew, WIP_OWN)).toBe('denied-audience');
    // 🌐 Αυστηρότεροι από το Procore: εκεί το αποσυρμένο μένει «reference-able»
    //    και η τεκμηρίωση ΔΕΝ λέει ποιος το βλέπει. Εδώ φεύγει από τα μάτια του
    //    συνεργείου (ADR-862 §5.4.1.γ) — ακόμη και με ρητό διακόπτη ιστορικού.
    expect(ask(crew, SUPERSEDED)).toBe('denied-audience');
  });

  it('Ε3 — πελάτης: PUBLISHED ✅, αλλά ΠΟΤΕ τα SHARED του συντονισμού', () => {
    const client = person({ audience: 'client', taskTeamId: null });
    expect(ask(client, PUBLISHED)).toBe('visible-published');
    expect(ask(client, SHARED)).toBe('denied-audience');
    expect(ask(client, WIP_OWN)).toBe('denied-audience');
  });

  it('Ε4 — προμηθευτής: ΤΙΠΟΤΑ μέσω κατάστασης — ο μηχανισμός του είναι το πακέτο (Φ3)', () => {
    const supplier = person({ audience: 'supplier', historyRequested: true });
    for (const state of [WIP_OWN, SHARED, PUBLISHED, SUPERSEDED]) {
      expect(ask(supplier, state)).toBe('denied-audience');
    }
  });
});

// =============================================================================
// Π — ΠΛΗΡΟΤΗΤΑ ΤΩΝ ΠΙΝΑΚΩΝ (Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΗΣ ΜΕΤΑΛΛΑΞΗΣ · Β12 Κ4)
// =============================================================================

describe('Π — οι δύο πίνακες είναι ΚΛΕΙΣΤΟΙ', () => {
  const audiences = Object.keys(AUDIENCE_REACH) as Array<keyof typeof AUDIENCE_REACH>;

  it('Π1 — ΚΑΘΕ ακροατήριο δηλώνει εμβέλεια για ΚΑΘΕ τιμή του CDE_STATES (SSoT)', () => {
    // 🔑 Η διασταύρωση γίνεται με το `CDE_STATE_VALUES` — **ανεξάρτητη** αυθεντία.
    //    Σβησμένο κελί ⇒ `undefined` ⇒ ΕΔΩ κοκκινίζει, όχι στη συμπεριφορά.
    expect(audiences.length).toBeGreaterThan(0);
    for (const audience of audiences) {
      const row = AUDIENCE_REACH[audience];
      for (const state of CDE_STATE_VALUES) {
        expect(Object.hasOwn(row, state)).toBe(true);
        expect(typeof row[state]).toBe('boolean');
      }
      // Καμία επιπλέον κατάσταση που το πρότυπο δεν ονομάζει.
      expect(Object.keys(row).sort()).toEqual([...CDE_STATE_VALUES].sort());
    }
  });

  it('Π2 — ΚΑΘΕ κατάσταση του ISO έχει πόρτα, και η γέφυρα προς τον πίνακα Α δείχνει στον εαυτό της', () => {
    for (const state of CDE_STATE_VALUES) {
      const gate = ACTION_BY_PHASE[state];
      expect(gate.kind).toBe('cde');
      // ⚠️ Αν το `state` της γραμμής αποκλίνει από το κλειδί της, ο πίνακας Β θα
      //    ρωτούσε τον πίνακα Α για ΑΛΛΗ κατάσταση — σιωπηλά.
      if (gate.kind === 'cde') expect(gate.state).toBe(state);
    }
  });

  it('Π3 — η ΑΠΟΥΣΙΑ και η ΒΛΑΒΗ έχουν κι αυτές γραμμή, με διαφορετικό είδος πόρτας', () => {
    expect(ACTION_BY_PHASE['pre-cde'].kind).toBe('legacy');
    expect(ACTION_BY_PHASE.unreadable.kind).toBe('closed');
  });
});

// =============================================================================
// Σ — Η ΣΥΝΘΕΣΗ ΜΕ ΤΟΝ ΘΕΜΑΤΟΦΥΛΑΚΑ (ΟΧΙ ΧΕΙΡΟΓΡΑΦΟ `unreadable`)
// =============================================================================

describe('Σ — ο θεματοφύλακας και ο κριτής κουμπώνουν', () => {
  const DOC = {
    id: 'file_anchor',
    createdBy: 'uid_author',
    companyId: 'comp_1',
    revision: 3,
  } as const;

  it('Σ1 — cdeState PUBLISHED ΧΩΡΙΣ σφραγίδα ⇒ ο θεματοφύλακας λέει unreadable ⇒ ο κριτής αρνείται', () => {
    // 🔒 Αυτό είναι που κάνει τη «δεύτερη αλήθεια» ΜΗ ΚΕΡΔΟΦΟΡΑ: χειρόγραφο
    //    'PUBLISHED' στη βάση δίνει **κλειστή** πόρτα, όχι ανοιχτή.
    const state = readContainerState({ ...DOC, cdeState: 'PUBLISHED' });
    expect(state.phase).toBe('unreadable');
    expect(ask(person({ historyRequested: true }), state)).toBe('denied-unknown-state');
  });

  it('Σ2 — κατάσταση ΕΚΤΟΣ λεξιλογίου ⇒ άρνηση, ποτέ μαντεψιά', () => {
    const state = readContainerState({ ...DOC, cdeState: 'APPROVED' });
    expect(state.phase).toBe('unreadable');
    expect(ask(person(), state)).toBe('denied-unknown-state');
  });

  it('Σ3 — έγγραφο χωρίς cdeState ⇒ pre-cde ⇒ ορατό (τα 35 της παραγωγής)', () => {
    const state = readContainerState({ ...DOC });
    expect(state.phase).toBe('pre-cde');
    expect(ask(person(), state)).toBe('visible-legacy-tenant');
  });
});

// =============================================================================
// Λ — ΛΕΞΙΛΟΓΙΟ: ΚΑΜΙΑ ΑΠΟ ΤΙΣ 13 ΕΤΥΜΗΓΟΡΙΕΣ ΔΕΝ ΕΙΝΑΙ ΝΕΚΡΗ
// =============================================================================

describe('Λ — πληρότητα λεξιλογίου (ο παρονομαστής)', () => {
  /**
   * Είσοδοι που **παράγουν** κάθε ετυμηγορία, μέσα από τον **πραγματικό** κριτή.
   *
   * ⚠️ Δέκατη τέταρτη ετυμηγορία χωρίς είσοδο που να τη γεννά ⇒ το `Λ2`
   * κοκκινίζει. Αυτό ακριβώς έλειπε από το `capabilitiesForRole`, όπου **10 από
   * 13** κλάδους ήταν αδύνατο να πυροδοτήσουν.
   */
  const PRODUCERS: ReadonlyArray<{
    verdict: ContainerAccessVerdict;
    run: () => ContainerAccessDecision;
  }> = [
    { verdict: 'visible-own-wip', run: () => askDecision(person(), WIP_OWN) },
    { verdict: 'visible-shared-to-design', run: () => askDecision(person(), SHARED) },
    {
      verdict: 'visible-published',
      run: () => askDecision(person({ audience: 'crew', taskTeamId: null }), PUBLISHED),
    },
    {
      verdict: 'visible-history',
      run: () => askDecision(person({ historyRequested: true }), SUPERSEDED),
    },
    { verdict: 'visible-legacy-tenant', run: () => askDecision(person(), PRE_CDE) },
    { verdict: 'denied-unauthenticated', run: () => askDecision(null, PUBLISHED) },
    { verdict: 'denied-not-engaged', run: () => askDecision(person({ audience: null }), SHARED) },
    { verdict: 'denied-foreign-wip', run: () => askDecision(person(), WIP_FOREIGN) },
    { verdict: 'denied-audience', run: () => askDecision(person({ audience: 'crew' }), SHARED) },
    { verdict: 'denied-superseded-hidden', run: () => askDecision(person(), SUPERSEDED) },
    { verdict: 'denied-unknown-state', run: () => askDecision(person(), UNREADABLE) },
    { verdict: 'denied-teamless', run: () => askDecision(person({ taskTeamId: null }), WIP_OWN) },
    { verdict: 'denied-capability', run: () => askDecision(person({ permissions: [] }), PUBLISHED) },
  ];

  it.each(PRODUCERS)('Λ1 — η ετυμηγορία $verdict είναι ΠΑΡΑΓΩΓΙΜΗ', ({ verdict, run }) => {
    expect(run().verdict).toBe(verdict);
  });

  it('Λ2 — ΚΑΘΕ ετυμηγορία του τύπου έχει παραγωγό (κλειστή λογιστική)', () => {
    // Οι άδειες έρχονται από τον ΕΞΑΓΟΜΕΝΟ κατάλογο — ποτέ χειρόγραφη τρίτη λίστα.
    const declared: readonly ContainerAccessVerdict[] = [
      ...VISIBLE_VERDICTS,
      'denied-unauthenticated',
      'denied-not-engaged',
      'denied-foreign-wip',
      'denied-audience',
      'denied-superseded-hidden',
      'denied-unknown-state',
      'denied-teamless',
      'denied-capability',
    ];
    const produced = new Set(PRODUCERS.map(p => p.verdict));
    for (const verdict of declared) expect(produced.has(verdict)).toBe(true);
    expect(produced.size).toBe(declared.length);
    expect(declared.length).toBe(13);
  });

  it('Λ3 — isContainerVisible: ΜΟΝΟ οι visible-* επιτρέπουν', () => {
    for (const { verdict } of PRODUCERS) {
      expect(isContainerVisible(verdict)).toBe(verdict.startsWith('visible-'));
    }
  });

  it('Λ4 — κάθε άρνηση φέρει λόγο, κάθε άδεια ΔΕΝ φέρει — σε ΚΑΘΕ έναν από τους 13', () => {
    // ⚠️ Άρνηση χωρίς λόγο = κενή οθόνη που ο άνθρωπος δεν μπορεί να εξηγήσει
    //    (το αντίθετο από τα *determining policies* του Cedar).
    // 🔑 Ο έλεγχος γίνεται στην **ΠΡΑΓΜΑΤΙΚΗ** απόφαση καθενός από τους 13 — όχι
    //    σε δύο αντιπροσωπευτικές. *(Το `authority.test.ts` Λ4 έκανε το δεύτερο:
    //    έτρεχε τον παραγωγό και μετά έκρινε **άλλο** ερώτημα. Δώδεκα από τους
    //    δεκατρείς λόγους δεν διαβάζονταν ποτέ.)*
    for (const { verdict, run } of PRODUCERS) {
      const decision = run();
      expect(decision.verdict).toBe(verdict);
      if (isContainerVisible(verdict)) expect(decision.reason).toBeNull();
      else expect(typeof decision.reason).toBe('string');
    }
  });
});
