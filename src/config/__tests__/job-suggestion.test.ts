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
import { JOBS, JOB_ORDER } from '../jobs-registry';
import { JOB_ALL, pickDefaultJob, resolveAvailableJobs, type JobAccessInput } from '../jobs-access';
import { filterItemsByJob, summarizeHidden, type JobFilterableItem } from '../jobs-visibility';
import { MIN_JOBS_FOR_SUGGESTION, computeJobSuggestion } from '../job-suggestion';

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

function suggest(input: {
  access?: JobAccessInput;
  activeJob?: typeof JOB_ALL | ReturnType<typeof pickDefaultJob>;
  dismissed?: boolean;
}) {
  const acc = input.access ?? BYPASS;
  return computeJobSuggestion({
    access: acc,
    activeJob: input.activeJob ?? JOB_ALL,
    dismissed: input.dismissed ?? false,
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
