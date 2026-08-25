/**
 * ADR-748 Φάση 3.5α — ANCHOR TESTS για την **πρόταση** δουλειάς.
 *
 * Δεν ελέγχουν «τρέχει ο κώδικας». Χαρακτηρίζουν τις αναλλοίωτες που, αν
 * σπάσουν σιωπηλά, μετατρέπουν μια προσφορά σε ενόχληση — δηλαδή σε ό,τι
 * ακριβώς ζητούν να απενεργοποιήσουν στο «Hello There!» του Revit (§6.14):
 *
 *   Σ-1  Δεν μιλάμε σε όποιον έχει ήδη διαλέξει       — `activeJob !== JOB_ALL`
 *   Σ-2  Δεν μιλάμε σε όποιον είπε «όχι»              — Α-3, μία φορά αρκεί
 *   Σ-3  Δεν προτείνουμε μονόδρομο                    — Ε7.ια, ≥2 δουλειές
 *   Σ-4  Δεν προτείνουμε ό,τι δεν αλλάζει τίποτα      — η πέμπτη συνθήκη
 *   Σ-5  🔒 Ο αριθμός είναι ο **ΙΔΙΟΣ** με το πραγματικό φίλτρο — Υ-12(β)
 *   Σ-6  Το άθροισμα κλείνει: `visible + hidden = total`
 */

import { createMainMenuItems, createToolsMenuItems, createSettingsMenuItems } from '../smart-navigation-factory';
import { JOBS, JOB_ORDER, type JobId } from '../jobs-registry';
import { JOB_ALL, decideJobAccess, pickDefaultJob, resolveAvailableJobs, type JobAccessInput } from '../jobs-access';
import { filterItemsByJob, summarizeHidden, type JobFilterableItem } from '../jobs-visibility';
import { MIN_JOBS_FOR_SUGGESTION, computeJobSuggestion } from '../job-suggestion';
import {
  ISCO_JOB_AFFINITY,
  ISCO_UNIT_GROUP_LENGTH,
  judgeIscoAffinity,
  resolveJobAffinity,
} from '../isco-job-affinity';

/** Ο browser σήμερα: μόνο ο ρόλος οργανισμού απαντά (Π-15). */
const ALL_SOURCES = ['globalRole', 'projectRoles', 'permissionSets'] as const;

function access(overrides: Partial<JobAccessInput> = {}): JobAccessInput {
  return {
    permissions: [],
    isBypass: false,
    availableSources: ALL_SOURCES,
    ...overrides,
  };
}

/**
 * Τα **ΠΡΑΓΜΑΤΙΚΑ** δέντρα της εφαρμογής, όχι στημένα.
 *
 * ⚠️ Είναι απόφαση: η Φάση 3 έμαθε **ζωντανά** ότι στημένα δέντρα περνούν
 * πράσινα ενώ η αληθινή πλοήγηση σπάει (Ε14.θ/Ε14.ια — δύο ελαττώματα που
 * **κανένα** test δεν έβλεπε). Ο έλεγχος πρέπει να ρωτά ό,τι ρωτά η οθόνη.
 */
function realMenus(permissions: readonly string[]): readonly (readonly JobFilterableItem[])[] {
  const list = [...permissions];
  return [
    createMainMenuItems('production', list),
    createToolsMenuItems('production', list),
    createSettingsMenuItems('production', list),
  ];
}

/** Ο υπερδιαχειριστής: `permissions: []` + bypass ⇒ και οι έξι δουλειές. */
const BYPASS = access({ isBypass: true });

/**
 * Δύο δουλειές, **από το ίδιο το μητρώο**.
 *
 * ⚠️ Ποτέ χειρόγραφο literal permission: αν αλλάξει το μητρώο, ο έλεγχος
 * πρέπει να ακολουθήσει — αλλιώς δοκιμάζει έναν κόσμο που έπαψε να υπάρχει.
 */
const TWO_JOBS = access({
  permissions: [JOBS.clients.permissions[0], JOBS.finance.permissions[0]],
});

/**
 * 🔴 ΓΙΑΤΙ Ο ΠΡΟΕΠΙΛΕΓΜΕΝΟΣ ΣΗΜΑΤΟΔΟΤΗΣ ΔΕΝ ΕΙΝΑΙ ΔΙΑΚΟΣΜΗΤΙΚΟΣ
 *
 * Από 2026-08-25 ο **πλήρης κάτοχος χωρίς δήλωση σωπαίνει** — πρότυπο **και των
 * τριών** μεγάλων: Revit «Autodesk Revit: **All**» · ArchiCAD **Standard** ·
 * Cinema 4D **Standard**. Όποιος δεν δήλωσε ειδίκευση παίρνει το **γενικό**,
 * ποτέ αυθαίρετη ειδικότητα.
 *
 * Οι άγκυρες παρακάτω χρησιμοποιούν τον BYPASS ως *«χρήστης με πολλές δουλειές»*
 * για να δοκιμάσουν **άλλα** πράγματα *(η επιλογή έγινε ήδη · κρύβει κάτι · ο
 * αριθμός ταιριάζει)*. Χωρίς σηματοδότη επαγγέλματος θα δοκίμαζαν έναν
 * υπερδιαχειριστή που **δεν δήλωσε ποτέ τίποτα** και όμως περιμένει πρόταση —
 * δηλαδή **κόσμο που δεν υπάρχει**, ακριβώς το σφάλμα που η ομάδα Ζ τεκμηριώνει.
 *
 * ⚠️ **ΜΗΝ** το κάνεις undefined/null καθολικά: τότε **τέσσερις** άγκυρες γίνονται
 * πράσινες επειδή **δεν κοιτάζουν τίποτα** (outcome === null παντού).
 */
// ⚠️ ΣΥΝΑΡΤΗΣΗ, ΟΧΙ ΣΤΑΘΕΡΑ: το ISCO ορίζεται ΠΙΟ ΚΑΤΩ σε αυτό το αρχείο, οπότε
//    μια σταθερά εδώ θα έσκαγε σε TDZ. Η καθυστερημένη κλήση λύνει τη σειρά
//    χωρίς να μετακινηθεί τίποτα — και το αποτέλεσμα είναι ταυτόσημο.
const declaredSurveyor = () => resolveJobAffinity(ISCO.surveyor);

function suggest(input: {
  access?: JobAccessInput;
  activeJob?: typeof JOB_ALL | ReturnType<typeof pickDefaultJob>;
  dismissed?: boolean;
  tiebreak?: JobId | null;
}) {
  const acc = input.access ?? BYPASS;
  return computeJobSuggestion({
    access: acc,
    activeJob: input.activeJob ?? JOB_ALL,
    dismissed: input.dismissed ?? false,
    tiebreak: input.tiebreak === undefined ? declaredSurveyor() : input.tiebreak,
    menus: realMenus(acc.permissions),
  });
}

// ============================================================================
// Σ-1 · Σ-2 · Σ-3 — οι τρεις σιωπές
// ============================================================================

describe('Σ-1 — δεν μιλάμε σε όποιον έχει ήδη διαλέξει', () => {
  it('προτείνει όσο η επιλογή είναι «Όλες»', () => {
    expect(suggest({})).not.toBeNull();
  });

  it('σωπαίνει μόλις ο χρήστης διαλέξει δουλειά', () => {
    const first = suggest({});
    expect(first).not.toBeNull();
    expect(suggest({ activeJob: first!.job })).toBeNull();
  });

  it('σωπαίνει και σε **άλλη** δουλειά από την προτεινόμενη', () => {
    // Η απόφαση πάρθηκε· δεύτερη γνώμη σε παρμένη απόφαση είναι ενόχληση.
    expect(suggest({ activeJob: 'finance' })).toBeNull();
  });
});

describe('Σ-2 — μία άρνηση αρκεί (Α-3)', () => {
  it('σωπαίνει όταν έχει απορριφθεί', () => {
    expect(suggest({ dismissed: true })).toBeNull();
  });

  it('η άρνηση υπερισχύει ακόμη κι όταν όλα τα υπόλοιπα ισχύουν', () => {
    expect(suggest({ access: BYPASS, dismissed: true })).toBeNull();
  });
});

describe('Σ-3 — δεν προτείνουμε μονόδρομο (Ε7.ια)', () => {
  it('σωπαίνει με μηδέν διαθέσιμες δουλειές', () => {
    // Καμία πηγή δεν λείπει ⇒ καθαρό `none`, όχι `unknown`.
    expect(suggest({ access: access({ permissions: [] }) })).toBeNull();
  });

  it('σωπαίνει με ΜΙΑ διαθέσιμη δουλειά', () => {
    const one = access({ permissions: [JOBS.finance.permissions[0]] });
    expect(resolveAvailableJobs(one)).toHaveLength(1);
    expect(suggest({ access: one })).toBeNull();
  });

  it('μιλά από τις δύο και πάνω — και το κατώφλι είναι δηλωμένο', () => {
    expect(MIN_JOBS_FOR_SUGGESTION).toBe(2);
    expect(resolveAvailableJobs(TWO_JOBS).length).toBeGreaterThanOrEqual(MIN_JOBS_FOR_SUGGESTION);
    expect(suggest({ access: TWO_JOBS })).not.toBeNull();
  });

  it('🔴 Σ-7: το `unknown` ΔΕΝ γεννά ΠΟΤΕ πρόταση — «δεν το κρύβω» ≠ «το προτείνω»', () => {
    // Μόνο ο `globalRole` απαντά (Π-15) ⇒ και οι **έξι** είναι `unknown` ⇒ και
    // οι έξι διαθέσιμες ⇒ περνούν και οι τρεις πρώτες συνθήκες. Χωρίς τον
    // έλεγχο `granted`, το `pickDefaultJob` θα επέστρεφε τη **πρώτη κατά
    // JOB_ORDER** και θα προτείναμε «Σχέδιο» σε άνθρωπο για τον οποίο δεν
    // έχουμε **κανένα** μετρημένο δικαίωμα — δηλαδή μαντεψιά.
    const blind = access({ permissions: [], availableSources: ['globalRole'] });
    expect(resolveAvailableJobs(blind)).toHaveLength(JOB_ORDER.length);
    expect(pickDefaultJob(blind)).not.toBe(JOB_ALL);
    // …και όμως: σιωπή.
    expect(suggest({ access: blind })).toBeNull();
  });

  it('Σ-7 — μία μετρημένη δουλειά ΜΕΣΑ σε τυφλό περιβάλλον προτείνεται κανονικά', () => {
    // Ίδιο τυφλό περιβάλλον, αλλά τώρα ΜΙΑ δουλειά έχει πραγματικό permission.
    // Η σιωπή του προηγούμενου δεν είναι «φοβάμαι το unknown» — είναι «θέλω
    // μέτρηση». Χωρίς αυτό το ζεύγος, ο έλεγχος θα περνούσε και σε κώδικα που
    // απλώς σώπασε για πάντα.
    const partly = access({
      permissions: [JOBS.finance.permissions[0]],
      availableSources: ['globalRole'],
    });
    const outcome = suggest({ access: partly });
    expect(outcome).not.toBeNull();
    expect(outcome!.job).toBe('finance');
  });
});

// ============================================================================
// Σ-4 — η πέμπτη συνθήκη: πρόταση που δεν αλλάζει τίποτα δεν λέγεται
// ============================================================================

describe('Σ-4 — καμία πρόταση χωρίς αποτέλεσμα', () => {
  it('δεν προτείνει όταν το φίλτρο δεν κρύβει τίποτα', () => {
    // Στημένο δέντρο **μόνο** από κοινές διαδρομές: καμία δουλειά δεν το αγγίζει.
    const outcome = computeJobSuggestion({
      access: BYPASS,
      activeJob: JOB_ALL,
      dismissed: false,
      menus: [[{ href: '/projects' }, { href: '/properties' }, { href: '/files' }]],
    });
    expect(outcome).toBeNull();
  });

  it('προτείνει όταν όντως κρύβει (το πραγματικό μενού)', () => {
    const outcome = suggest({});
    expect(outcome).not.toBeNull();
    expect(outcome!.visibleCount).toBeLessThan(outcome!.totalCount);
  });
});

// ============================================================================
// Σ-5 · Σ-6 — 🔒 ο αριθμός δεν μπορεί να αποκλίνει (Υ-12β)
// ============================================================================

describe('Σ-5 — ο αριθμός είναι ο ΙΔΙΟΣ με το πραγματικό φίλτρο', () => {
  it('«Χ από Υ» ταιριάζει με ό,τι θα δει ο χρήστης ένα κλικ μετά', () => {
    const outcome = suggest({});
    expect(outcome).not.toBeNull();

    // Ο ΙΔΙΟΣ υπολογισμός που τρέχει το `useJobFilteredNavigation` αφού δεχτεί.
    const menus = realMenus(BYPASS.permissions);
    const results = menus.map((items) => filterItemsByJob(items, outcome!.job));
    const { hiddenCount } = summarizeHidden(results);
    const visibleFromFilter = results.reduce((sum, r) => sum + r.visible.length, 0);

    expect(outcome!.visibleCount).toBe(visibleFromFilter);
    expect(outcome!.totalCount - outcome!.visibleCount).toBe(hiddenCount);
  });

  it('η προτεινόμενη δουλειά είναι ΑΚΡΙΒΩΣ το `pickDefaultJob` — καμία δεύτερη κρίση', () => {
    const outcome = suggest({ access: TWO_JOBS });
    expect(outcome).not.toBeNull();
    expect(outcome!.job).toBe(pickDefaultJob(TWO_JOBS));
  });
});

describe('Σ-6 — το άθροισμα κλείνει', () => {
  it('visible + hidden = total, σε κάθε περίπτωση που μιλά', () => {
    for (const acc of [BYPASS, TWO_JOBS]) {
      const outcome = computeJobSuggestion({
        access: acc,
        activeJob: JOB_ALL,
        dismissed: false,
        menus: realMenus(acc.permissions),
      });
      if (outcome === null) continue;
      const total = realMenus(acc.permissions).reduce((sum, items) => sum + items.length, 0);
      expect(outcome.totalCount).toBe(total);
      expect(outcome.visibleCount).toBeLessThanOrEqual(outcome.totalCount);
      expect(outcome.visibleCount).toBeGreaterThanOrEqual(0);
    }
  });
});

// ============================================================================
// ADR-798 ΦΑΣΗ 3 — ΤΟ ΕΠΑΓΓΕΛΜΑ ΣΠΑΕΙ ΤΗΝ ΙΣΟΒΑΘΜΙΑ
//
//   Χ-1..Χ-8  Ο πίνακας συγγένειας: πρόθεμα, εξαίρεση, σιωπή, υγιεινή
//   Ε-1       🔑 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ — καμία δήλωση δεν ΔΙΕΥΡΥΝΕΙ το σύνολο
//   Ε-2       Δύο άνθρωποι, ΙΔΙΑ permissions, ΔΙΑΦΟΡΕΤΙΚΗ απάντηση
//   Ε-3       Η μέτρηση νικά τη δήλωση — ποτέ το αντίστροφο
//   Ε-4       Χωρίς επάγγελμα: γραμμή προς γραμμή η παλιά συμπεριφορά
//   Ε-5       Η σιωπή του Σ-7 επιβιώνει του επαγγέλματος
// ============================================================================

/**
 * Πραγματικοί κωδικοί ISCO-08, **επαληθευμένοι** στην επίσημη δομή του ILO.
 *
 * ⚠️ Γράφονται ως **σταθερές του ελέγχου** και οι προσδοκίες παρακάτω είναι
 * **κυριολεκτικές** (`'design'`, `'clients'`, …) — ΠΟΤΕ υπολογισμένες από τον
 * ίδιο τον πίνακα. Παρονομαστής που διαβάζει τον κριτή μετακινείται μαζί με τη
 * μετάλλαξη και βγαίνει πράσινος πάνω σε σβησμένη γραμμή (σφάλμα ADR-790 §9.1).
 */
const ISCO = {
  /** 2165 Cartographers and Surveyors — ο τοπογράφος. */
  surveyor: '2165',
  /** 2611 Lawyers — ο δικηγόρος. */
  lawyer: '2611',
  /** 2411 Accountants (μέσα στο δηλωμένο `241`). */
  accountant: '2411',
  /** 2142 Civil Engineers (μέσα στο δηλωμένο `214`). */
  civilEngineer: '2142',
  /** 1211 Finance Managers — η **εξαίρεση** του `121`. */
  financeManager: '1211',
  /** 1212 Human Resource Managers — πέφτει στο γονικό `121`. */
  hrManager: '1212',
  /** 2166 Graphic and Multimedia Designers — μέσα στο `216`, **αδήλωτο**. */
  graphicDesigner: '2166',
  /** 2211 Generalist Medical Practitioners — εκτός κάθε κλάδου μας. */
  doctor: '2211',
} as const;

/**
 * Ισοβαθμία **κατασκευασμένη από το μητρώο**: ένα permission από καθεμία, άρα
 * σκορ 1-1. Χωρίς επάγγελμα ο νικητής βγαίνει από τη σειρά του `JOB_ORDER`
 * (`design` πριν από `clients`) — δηλαδή **από τίποτα**. Αυτό είναι το κενό.
 */
const DESIGN_AND_CLIENTS = access({
  permissions: [JOBS.design.permissions[0], JOBS.clients.permissions[0]],
});

/** Μία μόνο δουλειά — για να ασκείται και η διαδρομή «δεν προτείνουμε μονόδρομο». */
const ONE_JOB = access({ permissions: [JOBS.finance.permissions[0]] });

/** Καμία διαθέσιμη ⇒ `JOB_ALL`, με ή χωρίς επάγγελμα. */
const NO_JOBS = access({ permissions: [] });

/**
 * 🔴 Ο μεταλλάκτης **ΟΥΡΛΙΑΖΕΙ αν η μετάλλαξη δεν άλλαξε τίποτα**.
 *
 * Μάθημα 3.44/Μ11: μια «μετάλλαξη» που αφήνει την είσοδο ίδια αποδεικνύει
 * **μηδέν**, και το test βγαίνει πράσινο δείχνοντας σιγουριά που δεν υπάρχει.
 * Συνέβη ζωντανά στη Φάση 2 (CRLF), γι' αυτό ο έλεγχος είναι ρητός εδώ.
 */
function mutateInput<TIn, TOut>(
  label: string,
  before: TIn,
  after: TIn,
  run: (value: TIn) => TOut,
): { readonly before: TOut; readonly after: TOut } {
  if (Object.is(before, after) || JSON.stringify(before) === JSON.stringify(after)) {
    throw new Error(`Η μετάλλαξη «${label}» ΔΕΝ άλλαξε την είσοδο — δεν αποδεικνύει τίποτα.`);
  }
  return { before: run(before), after: run(after) };
}

// ----------------------------------------------------------------------------
// Χ — ο πίνακας συγγένειας
// ----------------------------------------------------------------------------

describe('Χ — ο πίνακας συγγένειας ISCO → δουλειά', () => {
  it('Χ-1: ο τετραψήφιος απαντιέται από το ΠΡΟΘΕΜΑ που δηλώθηκε', () => {
    // Δηλωμένο είναι το `214`, όχι το `2142`: το πρόθεμα απαντά για όλη την ομάδα.
    expect(resolveJobAffinity(ISCO.civilEngineer)).toBe('design');
    const verdict = judgeIscoAffinity(ISCO.civilEngineer);
    expect(verdict.kind).toBe('declared');
    if (verdict.kind === 'declared') expect(verdict.prefix).toBe('214');
  });

  it('Χ-2: ο ΜΑΚΡΥΤΕΡΟΣ πρόθεμα νικά — 1211 → Οικονομικά, 1212 → Διαχείριση', () => {
    // Και τα δύο ζουν κάτω από το δηλωμένο `121`. Μόνο το πρώτο έχει δική του
    // δήλωση — αν η ανάλυση δεν ήταν «μακρύτερος πρώτα», θα έπαιρναν ΤΟ ΙΔΙΟ.
    expect(resolveJobAffinity(ISCO.financeManager)).toBe('finance');
    expect(resolveJobAffinity(ISCO.hrManager)).toBe('administration');
  });

  it('Χ-3: ο τοπογράφος και ο δικηγόρος ΔΕΝ δείχνουν στο ίδιο πράγμα', () => {
    expect(resolveJobAffinity(ISCO.surveyor)).toBe('design');
    expect(resolveJobAffinity(ISCO.lawyer)).toBe('clients');
    expect(resolveJobAffinity(ISCO.accountant)).toBe('finance');
  });

  it('Χ-4: αδήλωτο επάγγελμα ⇒ ΣΙΩΠΗ, και η σιωπή είναι ΟΝΟΜΑΣΜΕΝΗ', () => {
    // Το 2166 ζει μέσα στο 216 — που ΔΕΝ δηλώνεται ολόκληρο ακριβώς γι΄ αυτό.
    expect(resolveJobAffinity(ISCO.graphicDesigner)).toBeNull();
    expect(judgeIscoAffinity(ISCO.graphicDesigner)).toEqual({
      kind: 'undeclared',
      code: ISCO.graphicDesigner,
    });
    expect(judgeIscoAffinity(ISCO.doctor).kind).toBe('undeclared');
  });

  it('Χ-5: απουσία και δυσμορφία είναι ΔΙΑΦΟΡΕΤΙΚΕΣ καταστάσεις', () => {
    expect(judgeIscoAffinity(null).kind).toBe('absent');
    expect(judgeIscoAffinity(undefined).kind).toBe('absent');
    expect(judgeIscoAffinity('').kind).toBe('absent');

    // ⚠️ Χωρίς έλεγχο σχήματος, το `21.6` θα έκοβε σε `21` και θα «απαντούσε».
    for (const bad of ['21.6', '2165x', 'αρχιτέκτονας', '21650', ' 214']) {
      expect(judgeIscoAffinity(bad)).toEqual({ kind: 'malformed', value: bad });
      expect(resolveJobAffinity(bad)).toBeNull();
    }
  });

  it('Χ-6: κάθε κλειδί είναι έγκυρο πρόθεμα ISCO και κάθε τιμή υπαρκτή δουλειά', () => {
    for (const [prefix, entry] of Object.entries(ISCO_JOB_AFFINITY)) {
      expect(prefix).toMatch(/^\d{1,4}$/);
      expect(prefix.length).toBeLessThanOrEqual(ISCO_UNIT_GROUP_LENGTH);
      expect(JOB_ORDER).toContain(entry.job);
    }
  });

  it('Χ-7: ΚΑΜΙΑ πλεοναστική δήλωση — πρόγονος που λέει το ίδιο', () => {
    // Μια γραμμή της οποίας ο πλησιέστερος δηλωμένος πρόγονος δίνει την ΙΔΙΑ
    // δουλειά δεν προσθέτει τίποτα σήμερα και θα αποκλίνει σιωπηλά αύριο.
    const redundant: string[] = [];
    for (const [prefix, entry] of Object.entries(ISCO_JOB_AFFINITY)) {
      for (let length = prefix.length - 1; length >= 1; length -= 1) {
        const ancestor = ISCO_JOB_AFFINITY[prefix.slice(0, length)];
        if (ancestor === undefined) continue;
        if (ancestor.job === entry.job) redundant.push(prefix);
        break; // μόνο ο ΠΛΗΣΙΕΣΤΕΡΟΣ δηλωμένος πρόγονος κρίνει
      }
    }
    expect(redundant).toEqual([]);
  });

  it('Χ-8: κάθε δήλωση φέρει ΔΙΚΟ ΤΗΣ, μη κενό `why`', () => {
    const reasons = new Set<string>();
    for (const [prefix, entry] of Object.entries(ISCO_JOB_AFFINITY)) {
      expect(entry.why.trim().length).toBeGreaterThan(20);
      // Αντιγραμμένος λόγος = γραμμή που προστέθηκε χωρίς να σκεφτεί κανείς.
      expect(reasons.has(entry.why)).toBe(false);
      reasons.add(entry.why);
      expect(prefix.length).toBeGreaterThan(0);
    }
  });
});

// ----------------------------------------------------------------------------
// Ε — η ένωση με την πρόταση δουλειάς
// ----------------------------------------------------------------------------

describe('Ε-1 🔑 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ — το επάγγελμα ΔΕΝ διευρύνει ΠΟΤΕ το σύνολο', () => {
  it('καμία δήλωση δεν βγάζει την επιλογή έξω από τα διαθέσιμα', () => {
    // Εξαντλητικά: κάθε δουλειά ως `tiebreak`, σε κάθε προφίλ δικαιωμάτων.
    // Χωρίς αυτό, ένα «λειτουργεί» δεν αποδεικνύει ότι δεν διευρύνει.
    for (const acc of [DESIGN_AND_CLIENTS, TWO_JOBS, ONE_JOB, NO_JOBS, BYPASS]) {
      const available = resolveAvailableJobs(acc);
      for (const job of JOB_ORDER) {
        const picked = pickDefaultJob(acc, job);
        if (picked === JOB_ALL) {
          expect(available).toHaveLength(0);
          continue;
        }
        expect(available).toContain(picked);
      }
    }
  });

  it('επάγγελμα που δείχνει σε ΜΗ διαθέσιμη δουλειά αφήνει την πρόταση ΑΘΙΚΤΗ', () => {
    // Λογιστής (→ Οικονομικά) με δικαιώματα μόνο Σχεδίου + Πελατών.
    const tiebreak = resolveJobAffinity(ISCO.accountant);
    expect(tiebreak).toBe('finance');
    expect(resolveAvailableJobs(DESIGN_AND_CLIENTS)).not.toContain('finance');

    expect(pickDefaultJob(DESIGN_AND_CLIENTS, tiebreak)).toBe(
      pickDefaultJob(DESIGN_AND_CLIENTS),
    );
  });

  it('ούτε το σύνολο των διαθέσιμων αλλάζει — ο υπολογισμός δεν βλέπει επάγγελμα', () => {
    const before = resolveAvailableJobs(DESIGN_AND_CLIENTS);
    // Το `resolveAvailableJobs` δεν δέχεται καν όρισμα επαγγέλματος. Η άγκυρα
    // κλειδώνει **την υπογραφή**: αν κάποιος του περάσει επάγγελμα αύριο, εδώ
    // θα χρειαστεί να αλλάξει — και θα το δει άνθρωπος.
    expect(resolveAvailableJobs.length).toBe(1);
    expect(before).toEqual(['design', 'clients']);
  });
});

describe('Ε-2 — ίδια permissions, διαφορετικό επάγγελμα, ΔΙΑΦΟΡΕΤΙΚΗ απάντηση', () => {
  it('ο τοπογράφος παίρνει Σχέδιο και ο δικηγόρος Πελάτες', () => {
    // Η ισοβαθμία είναι πραγματική: **ένα** μετρημένο δικαίωμα η καθεμία.
    const scoreOf = (job: JobId): number =>
      JOBS[job].permissions.filter((p) => DESIGN_AND_CLIENTS.permissions.includes(p)).length;
    expect(scoreOf('design')).toBe(scoreOf('clients'));

    const { before, after } = mutateInput(
      'iscoCode: τοπογράφος → δικηγόρος',
      ISCO.surveyor,
      ISCO.lawyer,
      (isco) => pickDefaultJob(DESIGN_AND_CLIENTS, resolveJobAffinity(isco)),
    );

    expect(before).toBe('design');
    expect(after).toBe('clients');
    expect(before).not.toBe(after);
  });

  it('και η ΠΡΟΤΑΣΗ που φτάνει στην οθόνη ακολουθεί', () => {
    const suggestFor = (isco: string) =>
      computeJobSuggestion({
        access: DESIGN_AND_CLIENTS,
        activeJob: JOB_ALL,
        dismissed: false,
        tiebreak: resolveJobAffinity(isco),
        menus: realMenus(DESIGN_AND_CLIENTS.permissions),
      });

    const { before, after } = mutateInput(
      'πρόταση: τοπογράφος → δικηγόρος',
      ISCO.surveyor,
      ISCO.lawyer,
      suggestFor,
    );

    expect(before?.job).toBe('design');
    expect(after?.job).toBe('clients');
  });
});

describe('Ε-3 — η ΜΕΤΡΗΣΗ νικά τη ΔΗΛΩΣΗ, ποτέ το αντίστροφο', () => {
  it('δουλειά με λιγότερα μετρημένα δικαιώματα δεν κερδίζει επειδή ταιριάζει', () => {
    // Σχέδιο με ΔΥΟ δικαιώματα, Πελάτες με ΕΝΑ ⇒ καμία ισοβαθμία να σπάσει.
    const designWins = access({
      permissions: [
        JOBS.design.permissions[0],
        JOBS.design.permissions[1],
        JOBS.clients.permissions[0],
      ],
    });

    expect(pickDefaultJob(designWins, resolveJobAffinity(ISCO.lawyer))).toBe('design');
    // …και το ανάποδο, ώστε το «design» να μην είναι απλώς η σειρά του πίνακα:
    const clientsWin = access({
      permissions: [
        JOBS.clients.permissions[0],
        JOBS.clients.permissions[1],
        JOBS.design.permissions[0],
      ],
    });
    expect(pickDefaultJob(clientsWin, resolveJobAffinity(ISCO.surveyor))).toBe('clients');
  });
});

describe('Ε-4 — χωρίς επάγγελμα: γραμμή προς γραμμή η παλιά συμπεριφορά', () => {
  it('παράλειψη, `null` και `undefined` δίνουν ΤΟ ΙΔΙΟ με πριν', () => {
    for (const acc of [DESIGN_AND_CLIENTS, TWO_JOBS, ONE_JOB, NO_JOBS, BYPASS]) {
      const baseline = pickDefaultJob(acc);
      expect(pickDefaultJob(acc, null)).toBe(baseline);
      expect(pickDefaultJob(acc, undefined)).toBe(baseline);
      // Επάγγελμα εκτός πίνακα ⇒ `null` ⇒ ίδιο αποτέλεσμα.
      expect(pickDefaultJob(acc, resolveJobAffinity(ISCO.doctor))).toBe(baseline);
    }
  });

  it('και η πρόταση χωρίς `tiebreak` μένει ταυτόσημη', () => {
    const withoutField = computeJobSuggestion({
      access: TWO_JOBS,
      activeJob: JOB_ALL,
      dismissed: false,
      menus: realMenus(TWO_JOBS.permissions),
    });
    const withNull = computeJobSuggestion({
      access: TWO_JOBS,
      activeJob: JOB_ALL,
      dismissed: false,
      tiebreak: null,
      menus: realMenus(TWO_JOBS.permissions),
    });
    expect(withoutField).toEqual(withNull);
  });
});

describe('Ε-5 — η σιωπή του Σ-7 ΕΠΙΒΙΩΝΕΙ του επαγγέλματος', () => {
  it('τυφλό περιβάλλον + δηλωμένο επάγγελμα ⇒ ΑΚΟΜΑ σιωπή', () => {
    // Μόνο ο `globalRole` απαντά ⇒ και οι έξι `unknown` ⇒ διαθέσιμες, αλλά
    // **καμία μετρημένη**. Το επάγγελμα ΔΕΝ επιτρέπεται να μετατρέψει το «δεν
    // ξέρω» σε ισχυρισμό γνώσης: αλλιώς μια αυτο-δήλωση θα γεννούσε πρόταση
    // πάνω σε μηδέν αποδείξεις.
    const blind = access({ permissions: [], availableSources: ['globalRole'] });
    expect(resolveAvailableJobs(blind)).toHaveLength(JOB_ORDER.length);
    expect(pickDefaultJob(blind, resolveJobAffinity(ISCO.lawyer))).toBe('clients');

    expect(
      computeJobSuggestion({
        access: blind,
        activeJob: JOB_ALL,
        dismissed: false,
        tiebreak: resolveJobAffinity(ISCO.lawyer),
        menus: realMenus(blind.permissions),
      }),
    ).toBeNull();
  });

  it('η άρνηση και η ήδη-παρμένη απόφαση υπερισχύουν του επαγγέλματος', () => {
    const base = {
      access: DESIGN_AND_CLIENTS,
      tiebreak: resolveJobAffinity(ISCO.lawyer),
      menus: realMenus(DESIGN_AND_CLIENTS.permissions),
    };
    expect(computeJobSuggestion({ ...base, activeJob: JOB_ALL, dismissed: true })).toBeNull();
    expect(computeJobSuggestion({ ...base, activeJob: 'design', dismissed: false })).toBeNull();
  });
});

// ----------------------------------------------------------------------------
// Ζ — 🔴 Ο ΥΠΕΡΔΙΑΧΕΙΡΙΣΤΗΣ: ΤΟ BYPASS ΔΕΝ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΟ ΔΙΚΑΙΩΜΑ
//
// Μετρήθηκε ζωντανά (2026-08-25) ότι το `tiebreak` ήταν **αδρανής φρουρός**
// (ADR-749 §5): **0 στους 4** λογαριασμούς της βάσης μπορούσαν να το
// πυροδοτήσουν. Ο δηλωμένος μηχανικός (ISCO 2149 → πρόθεμα 214 → Σχέδιο)
// προσγειωνόταν στη **Διαχείριση**.
//
// 🔑 ΓΙΑΤΙ ΚΑΜΙΑ ΑΓΚΥΡΑ ΔΕΝ ΤΟ ΕΙΔΕ — ΤΟ FIXTURE ΔΟΚΙΜΑΖΕ ΚΟΣΜΟ ΠΟΥ ΔΕΝ ΥΠΑΡΧΕΙ.
// Το `BYPASS` παραπάνω δηλώνει `permissions: []`. **Ζωντανά είναι αδύνατο**: το
// `useEffectivePermissions:91-93` προσθέτει **πάντα** `admin_access` στον
// `super_admin`. Και με **κενά** permissions όλα ισοβαθμούν στο 0, οπότε το
// tiebreak δούλευε — δηλαδή οι άγκυρες ήταν **πράσινες πάνω σε μηχανισμό που
// ζωντανά ήταν νεκρός**. Το σχόλιο του fixture, γραμμένο με βεβαιότητα, **ήταν
// η ίδια η απόκλιση** — σχήμα CHECK 3.34 (63) · 3.37 (18 vs 26) · 3.57 (19/20).
// ----------------------------------------------------------------------------

/**
 * Ο υπερδιαχειριστής **όπως τον φτιάχνει ο browser**, όχι όπως τον φανταζόμαστε.
 *
 * ⚠️ **ΜΗΝ** το «απλοποιήσεις» σε `permissions: []`: αυτή ακριβώς η
 * απλοποίηση έκρυβε το ελάττωμα. Η τιμή έρχεται από το
 * `useEffectivePermissions:91-93` και είναι **αμετάβλητη** για κάθε
 * `super_admin`.
 */
const BYPASS_LIVE = access({ isBypass: true, permissions: ['admin_access'] });

describe('Ζ-1 🔴 ο ζωντανός υπερδιαχειριστής — το επάγγελμα ΠΡΕΠΕΙ να ακούγεται', () => {
  it('ΠΑΡΟΝΟΜΑΣΤΗΣ: το `admin_access` ζει σε ΑΚΡΙΒΩΣ ΜΙΑ δουλειά', () => {
    // Χωρίς αυτό, το «σκορ 1 μόνο στη Διαχείριση» θα ήταν ισχυρισμός. Αν αύριο
    // δεύτερη δουλειά αποκτήσει `admin_access`, η αιτία αλλάζει και πρέπει να
    // το δει άνθρωπος.
    const owners = JOB_ORDER.filter((job) => JOBS[job].permissions.includes('admin_access'));
    expect(owners).toEqual(['administration']);
  });

  it('ΠΑΡΟΝΟΜΑΣΤΗΣ: ο bypass δικαιούται ΚΑΙ ΤΙΣ ΕΞΙ', () => {
    // Αλλιώς μια πράσινη «θεραπεία» θα μπορούσε να σημαίνει «λιγότερες δουλειές».
    expect(resolveAvailableJobs(BYPASS_LIVE)).toEqual([...JOB_ORDER]);
  });

  it('🔴 ο δηλωμένος ΜΗΧΑΝΙΚΟΣ παίρνει Σχέδιο, ΟΧΙ Διαχείριση', () => {
    // Η άγκυρα που κοκκινίζει χωρίς τη διόρθωση: πριν επέστρεφε 'administration'.
    const tiebreak = resolveJobAffinity(ISCO.civilEngineer);
    expect(tiebreak).toBe('design');
    expect(pickDefaultJob(BYPASS_LIVE, tiebreak)).toBe('design');
  });

  it('🔴 ο δηλωμένος ΔΙΚΗΓΟΡΟΣ παίρνει Πελάτες — ίδια permissions, άλλη απάντηση', () => {
    // Το ζεύγος είναι ο μηχανισμός: **ίδιος** λογαριασμός, **μόνο** το επάγγελμα
    // αλλάζει. Ένα μονό test θα μπορούσε να είναι πράσινο από σύμπτωση σειράς.
    const tiebreak = resolveJobAffinity(ISCO.lawyer);
    expect(tiebreak).toBe('clients');
    expect(pickDefaultJob(BYPASS_LIVE, tiebreak)).toBe('clients');
    expect(pickDefaultJob(BYPASS_LIVE, resolveJobAffinity(ISCO.civilEngineer))).toBe('design');
  });

  it('🔒 Α4: το επάγγελμα ΔΕΝ διευρύνει — κάθε επιλογή μένει μέσα στα διαθέσιμα', () => {
    const available = resolveAvailableJobs(BYPASS_LIVE);
    for (const job of JOB_ORDER) {
      expect(available).toContain(pickDefaultJob(BYPASS_LIVE, job));
    }
  });

  it('⚠️ ΔΗΛΩΜΕΝΗ ΣΥΝΕΠΕΙΑ: χωρίς επάγγελμα ⇒ σειρά μητρώου (Ε7.δ), όχι Διαχείριση', () => {
    // Η συμπεριφορά **αλλάζει** εδώ, και είναι σκόπιμο: το «Διαχείριση» ήταν
    // παρενέργεια ενός fallback **ορατότητας**, που κανείς δεν αποφάσισε ως
    // προεπιλογή. Το Ε7.δ δηλώνει «σε ισοβαθμία, η σταθερή σειρά του μητρώου».
    // 🔶 ΑΝΟΙΧΤΟ (απόφαση προϊόντος): και οι δύο τιμές είναι **μαντεψιά** για
    //    bypass χωρίς δήλωση· το τιμιότερο θα ήταν **σιωπή**. Δες ADR-798.
    expect(pickDefaultJob(BYPASS_LIVE, null)).toBe(JOB_ORDER[0]);
  });

  it('🔒 όποιος ΔΕΝ έχει bypass μένει ΑΘΙΚΤΟΣ — η μέτρηση προηγείται της δήλωσης', () => {
    // Ο company_admin έχει **μετρημένο** `admin_access` (όχι bypass): εκεί το
    // σκορ είναι πραγματικό και το επάγγελμα δεν επιτρέπεται να το ανατρέψει.
    const counted = access({ isBypass: false, permissions: ['admin_access'] });
    expect(pickDefaultJob(counted, 'design')).toBe('administration');
    expect(pickDefaultJob(counted, null)).toBe('administration');
  });
});

// ----------------------------------------------------------------------------
// Η — 🏆 Η ΣΙΩΠΗ ΤΟΥ ΠΛΗΡΟΥΣ ΚΑΤΟΧΟΥ (πρότυπο Revit / ArchiCAD / Cinema 4D)
//
// Έρευνα 2026-08-25, με τις πηγές διαβασμένες **ολόκληρες**:
//   Revit     «if you do not select a discipline … Autodesk Revit: **All**;
//              Revit Architecture: Architectural; Revit MEP: Mechanical»
//              ⇒ η ειδικότητα είναι για τις ΠΕΡΙΟΡΙΣΜΕΝΕΣ άδειες· ο κάτοχος
//              της ΠΛΗΡΟΥΣ παίρνει «All».
//   ArchiCAD  πρώτη εκκίνηση ⇒ Standard (Visualization/Layouting θέλουν ρητή
//              επιλογή)
//   C4D       Standard layout (ομοίως)
//
// ⇒ Ομόφωνο: όποιος δεν δήλωσε ειδίκευση παίρνει το ΓΕΝΙΚΟ. Εδώ το γενικό
//   είναι το JOB_ALL — και είναι **ήδη** η ενεργή κατάσταση.
//
// ⚠️ Η κομμένη παράθεση («Architectural») είναι το σφάλμα που το ADR-748 Ε7.δ′
//   έχει ήδη πληρώσει ΜΙΑ φορά. Διαβάζεται ΟΛΟΚΛΗΡΗ ή καθόλου.
// ----------------------------------------------------------------------------

describe('Η-1 🏆 ο πλήρης κάτοχος χωρίς δήλωση ΣΩΠΑΙΝΕΙ', () => {
  it('καμία πρόταση όταν λείπει ο σηματοδότης επαγγέλματος', () => {
    expect(suggest({ tiebreak: null })).toBeNull();
  });

  it('🔑 ΤΟ ΖΕΥΓΟΣ: με δήλωση ΜΙΛΑΕΙ — η σιωπή δεν είναι «χαλασμένο»', () => {
    // Ο παρονομαστής. Χωρίς αυτό, μια μετάλλαξη που σωπαίνει **πάντα** θα
    // περνούσε πράσινη, και η πύλη θα φύλαγε το τίποτα.
    const spoken = suggest({ tiebreak: declaredSurveyor() });
    expect(spoken).not.toBeNull();
    expect(spoken!.job).toBe('design');
  });

  it('🔒 η σιωπή ΔΕΝ επεκτείνεται σε όποιον έχει ΜΕΤΡΗΜΕΝΑ δικαιώματα', () => {
    // Ο κανόνας αφορά **μόνο** τον bypass: εκεί καμία δουλειά δεν έχει μετρημένο
    // δικαίωμα, οπότε ο νικητής θα έβγαινε από τη σειρά του μητρώου — από τίποτα.
    // Όποιος έχει πραγματική μέτρηση παίρνει πρόταση και χωρίς δήλωση.
    expect(suggest({ access: DESIGN_AND_CLIENTS, tiebreak: null })).not.toBeNull();
  });

  it('⚠️ ΓΙΑΤΙ ΔΕΝ ΑΡΚΕΙ Ο ΥΠΑΡΧΩΝ ΦΡΟΥΡΟΣ ΤΟΥ granted', () => {
    // Για bypass **κάθε** δουλειά είναι granted (decideJobAccess, κλάδος 1), άρα
    // ο φρουρός «δεν το κρύβω ≠ το προτείνω» **δεν μπορεί** να πυροδοτήσει εδώ.
    // Η άγκυρα κλειδώνει ότι η σιωπή χρειάζεται ΔΙΚΟ ΤΗΣ ρητό έλεγχο.
    for (const job of JOB_ORDER) {
      expect(decideJobAccess(job, BYPASS).decision).toBe('granted');
    }
    expect(suggest({ tiebreak: null })).toBeNull();
  });
});

// ----------------------------------------------------------------------------
// Θ — Υ-6: Η ΑΙΤΙΑ ΤΗΣ ΠΡΟΤΑΣΗΣ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΗ, ΟΧΙ ΥΠΟΤΙΘΕΜΕΝΗ
//
// 🔴 Βρέθηκε ΣΤΗΝ ΟΘΟΝΗ (2026-08-25): το popover έλεγε «με βάση τα δικαιώματά
// σου» σε υπερδιαχειριστή — όπου ΟΛΕΣ οι δουλειές έχουν ταυτόσημα δικαιώματα.
// Η αιτία ήταν το ΕΠΑΓΓΕΛΜΑ, και το απέδειξε το ίδιο το πείραμα: σβήνοντας τη
// δήλωση η πρόταση εξαφανίστηκε, με τα δικαιώματα ΑΜΕΤΑΒΛΗΤΑ.
//
// ⚠️ ΚΑΝΕΝΑ test δεν μπορούσε να το δει: το κλειδί i18n ήταν υπαρκτό και η
//    μετάφραση σωστή. Έλεγε απλώς ΛΑΘΟΣ ΠΡΑΓΜΑ.
// ----------------------------------------------------------------------------

describe('Θ-1 — η αιτία ονομάζεται σωστά', () => {
  it('🔴 ο υπερδιαχειριστής παίρνει αιτία «επάγγελμα», ΠΟΤΕ «δικαιώματα»', () => {
    // Η άγκυρα που θα είχε πιάσει το ελάττωμα της οθόνης.
    const out = suggest({ tiebreak: declaredSurveyor() });
    expect(out).not.toBeNull();
    expect(out!.basis).toBe('occupation');
  });

  it('🔑 ΤΟ ΖΕΥΓΟΣ: όπου η αιτία ΕΙΝΑΙ τα δικαιώματα, το λέει', () => {
    // Χωρίς αυτό, μια μετάλλαξη που επιστρέφει πάντα «occupation» περνά πράσινη.
    // Ο λογιστής (→ Οικονομικά) δεν αλλάζει την απάντηση σε χρήστη που ήδη
    // κλίνει αλλού από ΜΕΤΡΗΜΕΝΑ δικαιώματα.
    const out = suggest({ access: DESIGN_AND_CLIENTS, tiebreak: null });
    expect(out).not.toBeNull();
    expect(out!.basis).toBe('permissions');
  });

  it('🔒 μη-bypass όπου το επάγγελμα ΕΣΠΑΣΕ ισοβαθμία ⇒ «επάγγελμα»', () => {
    // Το κριτήριο ΔΕΝ είναι «είναι bypass;» — είναι «άλλαξε ο σηματοδότης την
    // απάντηση;». Εδώ ο χρήστης έχει μετρημένα δικαιώματα ΚΑΙ ισοβαθμία, και ο
    // δικηγόρος τη σπάει προς Πελάτες.
    const lawyer = resolveJobAffinity(ISCO.lawyer);
    const withSignal = suggest({ access: DESIGN_AND_CLIENTS, tiebreak: lawyer });
    const without = suggest({ access: DESIGN_AND_CLIENTS, tiebreak: null });
    expect(withSignal).not.toBeNull();
    expect(withSignal!.job).not.toBe(without!.job);
    expect(withSignal!.basis).toBe('occupation');
  });
});
