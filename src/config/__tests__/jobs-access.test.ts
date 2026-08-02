/**
 * ADR-748 Φάση 3 — ANCHOR TESTS για τον ζωντανό υπολογισμό.
 *
 * Δεν ελέγχουν «τρέχει ο κώδικας». Χαρακτηρίζουν τις **αναλλοίωτες** που, αν
 * σπάσουν σιωπηλά, δίνουν σε ανθρώπους **άδεια οθόνη** ή, χειρότερα, κρύβουν
 * κάτι που δεν έπρεπε:
 *
 *   Μ-1  Ο bypass ρόλος τα βλέπει όλα      — `roles.ts:58` → `permissions: []`
 *   Μ-2  Το `unknown` ΔΕΝ κρύβεται ποτέ    — Π-15, οι τρεις πηγές
 *   Μ-3  Το φίλτρο ΔΕΝ προσθέτει ποτέ      — ο χρυσός κανόνας §5/Ε5.η
 *   Μ-4  Η αναφορά κληρονομεί, δεν ταξινομείται — Ε14.β / Υ-5
 *   Μ-5  Καμία διαδρομή χωρίς ανάθεση      — η πύλη Υ-4
 */

import { PERMISSIONS } from '@/lib/auth/types';
import { createMainMenuItems, createToolsMenuItems, createSettingsMenuItems } from '../smart-navigation-factory';
import {
  COMMON_SIDEBAR_ROUTES,
  JOBS,
  JOB_ORDER,
  LEGAL_DOCUMENTS_STATUS,
  REPORT_SOURCES,
} from '../jobs-registry';
import {
  JOB_ALL,
  REPORTS_PARENT_ROUTE,
  decideJobAccess,
  filterItemsByJob,
  filterTilesByJob,
  isReportSubItemVisibleForJob,
  isRouteVisibleForJob,
  isTileVisibleForJob,
  pickDefaultJob,
  resolveAvailableJobs,
  resolveJobAccess,
  tileIdFromHref,
  type JobAccessInput,
} from '../jobs-access';

/** Ο browser σήμερα: μόνο ο ρόλος οργανισμού απαντά (Π-15). */
const CLIENT_SOURCES = ['globalRole'] as const;
/** Ο υποθετικός κόσμος όπου απαντούν και οι τρεις. */
const ALL_SOURCES = ['globalRole', 'projectRoles', 'permissionSets'] as const;

function input(overrides: Partial<JobAccessInput> = {}): JobAccessInput {
  return {
    permissions: [],
    isBypass: false,
    availableSources: ALL_SOURCES,
    ...overrides,
  };
}

// ============================================================================
// Μ-1 — Ο ΥΠΕΡΔΙΑΧΕΙΡΙΣΤΗΣ. Η παγίδα που θα έσπαγε την οθόνη του ιδιοκτήτη.
// ============================================================================

describe('Μ-1 — bypass ρόλος (roles.ts: super_admin έχει permissions: [])', () => {
  it('παίρνει ΚΑΙ ΤΙΣ ΕΞΙ δουλειές, παρότι η λίστα permissions είναι κενή', () => {
    const access = resolveJobAccess(input({ isBypass: true, permissions: [] }));
    expect(access).toHaveLength(6);
    expect(access.every((a) => a.decision === 'granted')).toBe(true);
  });

  it('η αιτία είναι ρητά «bypass» — όχι πλασματικό permission (Υ-6)', () => {
    const access = decideJobAccess('finance', input({ isBypass: true }));
    expect(access.reason).toEqual({ kind: 'bypass' });
  });

  it('🔴 ΧΩΡΙΣ bypass, τα σκέτα claims του υπερδιαχειριστή δίνουν ΜΟΝΟ Διαχείριση', () => {
    // Αυτό ακριβώς θα συνέβαινε αν κάποιος αφαιρούσε τον έλεγχο bypass:
    // claims-handler.ts:161 γράφει μόνο `admin_access` για τον super_admin.
    const granted = resolveJobAccess(
      input({ permissions: ['admin_access'], isBypass: false }),
    ).filter((a) => a.decision === 'granted');
    expect(granted.map((a) => a.job)).toEqual(['administration']);
  });
});

// ============================================================================
// Μ-2 — «ΔΕΝ ΞΕΡΩ» ≠ «ΔΕΝ ΔΙΚΑΙΟΥΣΑΙ». Η καρδιά της Φάσης 3.
// ============================================================================

describe('Μ-2 — ελλιπείς πηγές ⇒ unknown, και το unknown δεν κρύβεται ΠΟΤΕ', () => {
  it('με μόνο τον ρόλο οργανισμού, οι μη-βεβαιωμένες δουλειές είναι unknown', () => {
    const access = decideJobAccess('design', input({ availableSources: CLIENT_SOURCES }));
    expect(access.decision).toBe('unknown');
    expect(access.reason).toEqual({
      kind: 'sources-unavailable',
      missing: ['projectRoles', 'permissionSets'],
    });
  });

  it('🔴 ο external_user με ρόλο ΜΟΝΟ σε έργο δεν χάνει το «Σχέδιο» (Ε-5.1)', () => {
    // Ο Νίκος στην εταιρεία Β: μηδέν permissions από claims. Ο ρόλος του
    // μελετητή ζει στο έργο και ΔΕΝ φτάνει στον browser. Αν τον κρύβαμε, θα
    // κοιτούσε άδεια οθόνη — κατά λέξη το ελάττωμα του ACC.
    const available = resolveAvailableJobs(
      input({ permissions: [], availableSources: CLIENT_SOURCES }),
    );
    expect(available).toEqual([...JOB_ORDER]);
  });

  it('όταν ΟΛΕΣ οι πηγές απαντήσουν, το ίδιο κενό γίνεται none', () => {
    const access = resolveJobAccess(input({ permissions: [], availableSources: ALL_SOURCES }));
    expect(access.every((a) => a.decision === 'none')).toBe(true);
    expect(resolveAvailableJobs(input({ permissions: [] }))).toEqual([]);
  });

  it('το granted υπερισχύει του unknown: μετρημένο permission δίνει αιτία (Υ-6)', () => {
    const access = decideJobAccess(
      'finance',
      input({ permissions: ['finance:invoices:view'], availableSources: CLIENT_SOURCES }),
    );
    expect(access.decision).toBe('granted');
    expect(access.reason).toEqual({ kind: 'permission', permission: 'finance:invoices:view' });
  });
});

// ============================================================================
// Ε7.δ — ΠΑΝΤΑ ΥΠΑΡΧΕΙ ΠΡΟΕΠΙΛΟΓΗ (κανόνας Revit)
// ============================================================================

describe('Ε7.δ — η προεπιλεγμένη δουλειά είναι υπολογισμένη, ποτέ hardcoded', () => {
  it('διαλέγει αυτή με τα περισσότερα μετρημένα δικαιώματα', () => {
    const permissions = [...JOBS.clients.permissions.slice(0, 3), JOBS.finance.permissions[0]];
    expect(pickDefaultJob(input({ permissions }))).toBe('clients');
  });

  it('σε ισοβαθμία κρατά τη σειρά του μητρώου (JOB_ORDER)', () => {
    const permissions = [JOBS.finance.permissions[0], JOBS.procurement.permissions[0]];
    // finance.order = 4 < procurement.order = 5
    expect(pickDefaultJob(input({ permissions }))).toBe('finance');
  });

  it('καμία διαθέσιμη ⇒ «Όλα», ΠΟΤΕ κενό (Ε7.α / Υ-10)', () => {
    expect(pickDefaultJob(input({ permissions: [] }))).toBe(JOB_ALL);
  });
});

// ============================================================================
// Μ-3 — Ο ΧΡΥΣΟΣ ΚΑΝΟΝΑΣ: ΤΟ ΦΙΛΤΡΟ ΜΟΝΟ ΑΦΑΙΡΕΙ
// ============================================================================

describe('Μ-3 — §5/Ε5.η: η δουλειά ΠΟΤΕ δεν προσθέτει, μόνο αφαιρεί', () => {
  const items = [
    { href: '/dxf/viewer' },
    { href: '/accounting' },
    { href: '/settings' },
    { href: REPORTS_PARENT_ROUTE, subItems: [{ href: '/reports/financial' }] },
  ];

  it.each([...JOB_ORDER, JOB_ALL])('η έξοδος είναι πάντα υποσύνολο της εισόδου (%s)', (job) => {
    const result = filterItemsByJob(items, job);
    for (const visible of result.visible) {
      expect(items.some((item) => item.href === visible.href)).toBe(true);
    }
    expect(result.visible.length).toBeLessThanOrEqual(items.length);
  });

  it('«Όλα» δεν αγγίζει τίποτα — υπάρχων χρήστης βλέπει ό,τι έβλεπε χθες', () => {
    const result = filterItemsByJob(items, JOB_ALL);
    expect(result.visible).toBe(items);
    expect(result.hiddenCount).toBe(0);
  });

  it('ό,τι κρύβεται ΜΕΤΡΙΕΤΑΙ — καμία σιωπηλή απόκρυψη (Α-3)', () => {
    const result = filterItemsByJob(items, 'finance');
    expect(result.visible.map((i) => i.href)).toEqual([
      '/accounting',
      '/settings',
      REPORTS_PARENT_ROUTE,
    ]);
    expect(result.hiddenCount).toBe(1); // το /dxf/viewer
  });
});

// ============================================================================
// Μ-6 — ΤΟ ΔΟΧΕΙΟ ΔΕΝ ΠΑΡΑΣΥΡΕΙ ΤΟ ΠΕΡΙΕΧΟΜΕΝΟ
//
// 🔴 Βρέθηκε ΖΩΝΤΑΝΑ στην οθόνη (2026-08-02), όχι από test: το `/obligations`
// δηλώνεται ΚΟΙΝΟ σε όλες τις δουλειές, αλλά ζει αποκλειστικά ως παιδί του
// `/legal-documents` (smart-navigation-factory.ts:605-617) — και εξαφανιζόταν
// μαζί του. Το φίλτρο έκρυβε κάτι που το ίδιο το μητρώο δηλώνει ορατό παντού.
// ============================================================================

describe('Μ-6 — κρυμμένος γονιός δεν παρασύρει ορατό παιδί', () => {
  const legalBranch = [
    { href: LEGAL_DOCUMENTS_STATUS.route, subItems: [{ href: LEGAL_DOCUMENTS_STATUS.livingChildRoute }] },
  ];

  it.each([...JOB_ORDER])('το /obligations επιβιώνει σε κάθε δουλειά (%s)', (job) => {
    const result = filterItemsByJob(legalBranch, job);
    const survivors = result.visible.flatMap((i) => i.subItems?.map((s) => s.href) ?? []);
    expect(survivors).toContain(LEGAL_DOCUMENTS_STATUS.livingChildRoute);
  });

  it('🔴 το /legal-documents ΔΕΝ κρύβεται — Ε14.στ: απόκρυψη χωρίς επιβολή = OWASP A01', () => {
    // Είναι ανεπίβλητο (Π-13): rules tenant-only, /api/contracts χωρίς
    // permission. Απόκρυψη θα έκρυβε το ΣΦΑΛΜΑ, όχι τα δεδομένα.
    expect(LEGAL_DOCUMENTS_STATUS.enforced).toBe(false);
    for (const job of JOB_ORDER) {
      expect(isRouteVisibleForJob(LEGAL_DOCUMENTS_STATUS.route, job)).toBe(true);
    }
  });

  it('αταξινόμητη διαδρομή ⇒ ορατή (φίλτρο θορύβου, όχι πύλη)', () => {
    expect(isRouteVisibleForJob('/kapoia-nea-diadromi', 'finance')).toBe(true);
  });

  it('…αλλά ταξινομημένη σε ΑΛΛΗ δουλειά ⇒ κρύβεται κανονικά', () => {
    expect(isRouteVisibleForJob('/dxf/viewer', 'finance')).toBe(false);
    expect(isRouteVisibleForJob('/dxf/viewer', 'design')).toBe(true);
  });

  it('γονιός που ανήκει αλλού σώζεται ΜΟΝΟ από ρητά κοινό παιδί, και κρατά μόνο αυτό', () => {
    const branch = [{ href: '/dxf/viewer', subItems: [{ href: '/settings' }, { href: '/geo/canvas' }] }];
    const result = filterItemsByJob(branch, 'finance');
    expect(result.visible[0]?.subItems?.map((s) => s.href)).toEqual(['/settings']);
  });

  it('🔴 ΑΤΑΞΙΝΟΜΗΤΟ παιδί ΔΕΝ σώζει γονιό που ανήκει αλλού — αλλιώς το φίλτρο ακυρώνεται', () => {
    // Βρέθηκε ΖΩΝΤΑΝΑ (2026-08-02 16:58): «Χώροι · Πωλήσεις · CRM» έμειναν
    // στα Οικονομικά επειδή τα 4+5+11 παιδιά τους δεν έχουν δική τους ετικέτα.
    // Το παιδί χωρίς ταξινόμηση ΚΛΗΡΟΝΟΜΕΙ τον γονιό — δεν είναι ελεύθερο.
    const branch = [
      { href: '/spaces', subItems: [{ href: '/spaces/properties' }, { href: '/spaces/parking' }] },
    ];
    expect(filterItemsByJob(branch, 'finance')).toEqual({ visible: [], hiddenCount: 1 });
    // …και στη δουλειά του, ο γονιός φέρνει ΟΛΑ τα παιδιά του (κληρονομιά).
    const kept = filterItemsByJob(branch, 'clients');
    expect(kept.visible[0]?.subItems).toHaveLength(2);
    expect(kept.hiddenCount).toBe(0);
  });

  it('παιδί με ΔΙΚΗ ΤΟΥ ετικέτα κρίνεται μόνο του (§14.1/11: admin μέσα στο /crm)', () => {
    const branch = [
      { href: '/crm', subItems: [{ href: '/crm/leads' }, { href: '/admin/ai-inbox' }] },
    ];
    const result = filterItemsByJob(branch, 'clients');
    expect(result.visible[0]?.subItems?.map((s) => s.href)).toEqual(['/crm/leads']);
    expect(result.hiddenCount).toBe(1);
  });

  it('ο δείκτης μετρά ΕΝΑ ανά κλάδο που φεύγει — όχι τα κλειστά υπο-στοιχεία', () => {
    // Ο χρήστης έχασε ένα στοιχείο από το μενού, όχι δεκατρία. Αλλιώς ο
    // δείκτης δείχνει δεκάδες και παύει να σημαίνει κάτι.
    const branch = [{ href: '/crm', subItems: Array.from({ length: 11 }, (_, i) => ({ href: `/crm/x${i}` })) }];
    expect(filterItemsByJob(branch, 'finance').hiddenCount).toBe(1);
  });
});

// ============================================================================
// Μ-4 — Η ΑΝΑΦΟΡΑ ΚΛΗΡΟΝΟΜΕΙ (Ε14.α–Ε14.δ)
// ============================================================================

describe('Μ-4 — /reports: κληρονομιά από την πηγή, όχι ταξινόμηση', () => {
  it('ο γονιός μένει ορατός σε ΚΑΘΕ δουλειά (Ε14.α/Π-14)', () => {
    for (const job of JOB_ORDER) {
      expect(isRouteVisibleForJob(REPORTS_PARENT_ROUTE, job)).toBe(true);
    }
  });

  it('η οικονομική αναφορά ακολουθεί το /accounting, όχι δική της ετικέτα', () => {
    expect(isReportSubItemVisibleForJob('/reports/financial', 'finance')).toBe(true);
    expect(isReportSubItemVisibleForJob('/reports/financial', 'design')).toBe(false);
  });

  it('όποια αναφορά δηλώνει δουλειά, την ακολουθεί ακριβώς', () => {
    expect(isReportSubItemVisibleForJob('/reports/compliance', 'administration')).toBe(true);
    expect(isReportSubItemVisibleForJob('/reports/compliance', 'clients')).toBe(false);
  });

  it('🔴 αχαρτογράφητη αναφορά ⇒ ΟΡΑΤΗ (φίλτρο θορύβου, όχι πύλη)', () => {
    expect(isReportSubItemVisibleForJob('/reports/kainourgia', 'finance')).toBe(true);
  });

  it('τα παιδιά κλαδεύονται και μετριούνται μέσα στον γονιό', () => {
    const parent = {
      href: REPORTS_PARENT_ROUTE,
      subItems: Object.keys(REPORT_SOURCES).map((href) => ({ href })),
    };
    const result = filterItemsByJob([parent], 'finance');
    expect(result.visible).toHaveLength(1);
    // Δύο από το /accounting (πηγή «Οικονομικά») ΚΑΙ μία από το /projects —
    // που είναι **κοινή** διαδρομή (ο άξονας 2, §14.1/2), άρα ορατή παντού.
    // Αυτό ΕΙΝΑΙ η κληρονομιά: η αναφορά δεν ξέρει τίποτα για δουλειές, ρωτά
    // την πηγή της. Ετικέτα «Οικονομικά» στο /reports/projects θα ήταν το Υ-5.
    expect(result.visible[0].subItems?.map((s) => s.href)).toEqual([
      '/reports/financial',
      '/reports/cash-flow',
      '/reports/projects',
    ]);
    expect(result.hiddenCount).toBe(Object.keys(REPORT_SOURCES).length - 3);
  });

  it('κάθε υπο-αναφορά συμφωνεί με την πηγή της — καμία ανεξάρτητη τιμή', () => {
    // Ο πραγματικός έλεγχος του Υ-5: το αποτέλεσμα ΠΡΕΠΕΙ να παράγεται από την
    // πηγή. Αν κάποιος βάλει ετικέτα, οι δύο τιμές θα αποκλίνουν και εδώ.
    for (const [subRoute, source] of Object.entries(REPORT_SOURCES)) {
      for (const job of JOB_ORDER) {
        const expected =
          source.kind === 'job' ? source.job === job : isRouteVisibleForJob(source.route, job);
        expect(isReportSubItemVisibleForJob(subRoute, job)).toBe(expected);
      }
    }
  });
});

// ============================================================================
// ΠΛΑΚΙΔΙΑ (§14.2) — και το καταγεγραμμένο σφάλμα
// ============================================================================

describe('§14.2 — πλακίδια της ενεργής δουλειάς', () => {
  it('η ταυτότητα πλακιδίου είναι το href χωρίς αρχική κάθετο', () => {
    expect(tileIdFromHref('/dxf/viewer')).toBe('dxf/viewer');
    expect(tileIdFromHref('buildings')).toBe('buildings');
  });

  it('τα κοινά πλακίδια φαίνονται σε κάθε δουλειά', () => {
    for (const job of JOB_ORDER) {
      expect(isTileVisibleForJob('/projects', job)).toBe(true);
    }
  });

  it('οι Προμήθειες δεν έχουν κανένα δικό τους πλακίδιο (Ε4.στ, §14.4/3)', () => {
    expect(JOBS.procurement.dashboardTiles).toHaveLength(0);
    // Συνέπεια: στη δουλειά «Προμήθειες» ΚΑΘΕ ταξινομημένο πλακίδιο φεύγει —
    // μένουν μόνο τα κοινά. Είναι η «αληθινή αλλά ανώριμη» δουλειά, ορατή.
    const classified = JOB_ORDER.flatMap((job) => JOBS[job].dashboardTiles);
    expect(classified.length).toBeGreaterThan(0);
    for (const tile of classified) {
      expect(isTileVisibleForJob(tile, 'procurement')).toBe(false);
    }
  });

  it('🔴 ΕΝΑΣ κανόνας για διαδρομές ΚΑΙ πλακίδια — αλλιώς η ίδια οθόνη λέει δύο πράγματα', () => {
    // Το `/legal-documents` είναι το ακριβές σημείο όπου δύο κανόνες θα
    // αποκλίνανε: ορατό στο sidebar, εξαφανισμένο από την αρχική.
    expect(LEGAL_DOCUMENTS_STATUS.hasPage).toBe(false);
    for (const job of JOB_ORDER) {
      expect(isTileVisibleForJob(LEGAL_DOCUMENTS_STATUS.route, job)).toBe(
        isRouteVisibleForJob(LEGAL_DOCUMENTS_STATUS.route, job),
      );
    }
  });

  it('ταξινομημένο πλακίδιο άλλης δουλειάς κρύβεται και ΜΕΤΡΙΕΤΑΙ', () => {
    const tiles = [{ href: '/dxf/viewer' }, { href: '/files' }];
    expect(filterTilesByJob(tiles, JOB_ALL).hiddenCount).toBe(0);
    const filtered = filterTilesByJob(tiles, 'finance');
    expect(filtered.visible.map((t) => t.href)).toEqual(['/files']);
    expect(filtered.hiddenCount).toBe(1);
  });
});

// ============================================================================
// Μ-5 — Η ΠΥΛΗ Υ-4: νέα διαδρομή χωρίς ανάθεση ⇒ ΚΟΚΚΙΝΟ
// ============================================================================

describe('Μ-5 — Υ-4: κάθε στοιχείο πλοήγησης ανήκει κάπου', () => {
  const ALL_PERMISSIONS = Object.keys(PERMISSIONS);
  const liveTopLevelRoutes = [
    ...createMainMenuItems('production', ALL_PERMISSIONS),
    ...createToolsMenuItems('production', ALL_PERMISSIONS),
    ...createSettingsMenuItems('production', ALL_PERMISSIONS),
  ].map((item) => item.href);

  const CLASSIFIED = new Set<string>([
    ...COMMON_SIDEBAR_ROUTES,
    ...JOB_ORDER.flatMap((job) => JOBS[job].sidebar),
    REPORTS_PARENT_ROUTE,
    // Καταγεγραμμένο σφάλμα, ΟΧΙ στοιχείο του μητρώου (Ε14.ε).
    LEGAL_DOCUMENTS_STATUS.route,
  ]);

  it('η ζωντανή πλοήγηση δεν είναι κενή (αλλιώς ο έλεγχος είναι ψεύτικος)', () => {
    expect(liveTopLevelRoutes.length).toBeGreaterThan(5);
  });

  it('🔴 καμία διαδρομή πρώτου επιπέδου δεν είναι αταξινόμητη', () => {
    const orphans = liveTopLevelRoutes.filter((href) => !CLASSIFIED.has(href));
    expect(orphans).toEqual([]);
  });

  it('🔴 Η ΖΩΝΤΑΝΗ ΜΕΤΡΗΣΗ: τι μένει όρθιο στα «Οικονομικά»', () => {
    // Το test που θα είχε πιάσει το ελάττωμα των 16:58 πριν φτάσει στην οθόνη:
    // τρέχει πάνω στην ΠΡΑΓΜΑΤΙΚΗ πλοήγηση, όχι σε πλασματικά items.
    const main = filterItemsByJob(createMainMenuItems('production', ALL_PERMISSIONS), 'finance');
    const survivors = main.visible.map((item) => item.href);

    // Τα κοινά + το εγκάρσιο + η διαδρομή της δουλειάς. Τίποτα άλλο.
    expect(survivors).toContain('/accounting');
    expect(survivors).toContain(REPORTS_PARENT_ROUTE);
    expect(survivors).toContain('/projects');
    // Ό,τι ανήκει ρητά σε ΑΛΛΗ δουλειά ΔΕΝ επιβιώνει — ούτε ως άδειο δοχείο.
    for (const route of ['/spaces', '/sales', '/crm', '/contacts', '/buildings']) {
      expect(survivors).not.toContain(route);
    }
  });

  it('και αντίστροφα: κάθε διαδρομή του μητρώου υπάρχει στην πλοήγηση', () => {
    // Πιάνει το ανάποδο σφάλμα: ετικέτα σε διαδρομή που διαγράφηκε ⇒ νεκρό
    // δεδομένο που κανείς δεν θα παρατηρούσε.
    const live = new Set(
      [
        ...createMainMenuItems('production', ALL_PERMISSIONS),
        ...createToolsMenuItems('production', ALL_PERMISSIONS),
        ...createSettingsMenuItems('production', ALL_PERMISSIONS),
      ].flatMap((item) => [item.href, ...(item.subItems ?? []).map((s) => s.href)]),
    );
    const dangling = JOB_ORDER.flatMap((job) => JOBS[job].sidebar).filter((r) => !live.has(r));
    expect(dangling).toEqual([]);
  });
});
