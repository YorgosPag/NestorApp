/**
 * ADR-748 Φάση 1 — ΜΗΤΡΩΟ ΔΟΥΛΕΙΩΝ (Jobs Registry) · SSoT
 *
 * ΔΕΔΟΜΕΝΑ ΚΑΙ ΜΟΝΟ. Καμία λογική, κανένα I/O, καμία εξάρτηση από React ή
 * Firestore. Ο ζωντανός υπολογισμός «ποιες δουλειές έχει ο Χ» (Ε5.α/Ε5.ζ)
 * γράφεται στη Φάση 3 και **διαβάζει** αυτό το αρχείο — δεν ζει εδώ.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΟΝΟΜΑΤΟΛΟΓΙΑ — ΜΗ ΔΙΑΠΡΑΓΜΑΤΕΥΣΙΜΗ (ADR-748 Ε6.στ, Π-9)
 *
 *   `Workspace` = ΟΡΓΑΝΙΣΜΟΣ (ADR-032, `'company' | 'office_directory' |
 *                 'personal'`). Ο όρος είναι ΠΙΑΣΜΕΝΟΣ — δεν επαναχρησιμοποιείται.
 *   `Job`       = ΔΟΥΛΕΙΑ. Οι έξι αυτού του αρχείου. Άξονας 3.
 *
 * Ονομασία της δουλειάς ως `Workspace` φτιάχνει ΠΕΜΠΤΟ λεξιλόγιο ρόλων —
 * ακριβώς την παθολογία που το ADR-748 §3 ήρθε να θεραπεύσει.
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο ΧΡΥΣΟΣ ΚΑΝΟΝΑΣ (ADR-748 §5, §14.5, Ε5.η)
 *
 *   🔒 Η ΔΟΥΛΕΙΑ ΠΟΤΕ ΔΕΝ ΠΡΟΣΘΕΤΕΙ ΔΙΚΑΙΩΜΑ — ΜΟΝΟ ΑΦΑΙΡΕΙ ΘΟΡΥΒΟ.
 *
 * Ό,τι δηλώνεται εδώ είναι **ετικέτα ορατότητας**, όχι δικαίωμα. Ένα στοιχείο
 * εμφανίζεται όταν (α) ανήκει στην ΕΝΕΡΓΗ δουλειά ΚΑΙ (β) ο υπολογισμός των
 * δικαιωμάτων το έχει ήδη επιτρέψει. Το φιλτράρισμα είναι **UX, όχι ασφάλεια**·
 * ο server ελέγχει πάντα (firestore.rules + withAuth), όπως και σήμερα.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ΠΗΓΗ ΤΩΝ ΔΕΔΟΜΕΝΩΝ: ADR-748 §14 («ποιος βλέπει τι»), Ε-4.3 (οι έξι δουλειές
 * μετρημένες στα permission sets των 13 ρόλων του `lib/auth/roles.ts`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-748-role-based-workspaces.md
 */

import type { PermissionId } from '@/lib/auth/types';

// =============================================================================
// ΤΑΥΤΟΤΗΤΑ
// =============================================================================

/**
 * Οι ΕΞΙ δουλειές (ADR-748 Ε4.α). Δεν είναι επαγγέλματα και δεν είναι ρόλοι:
 * είναι **τι κάνει** κάποιος τώρα (Α-5, Ε4.β, Ε7.ιβ).
 *
 * Η έβδομη — «Το κοινό μου» (Σ-3: δικό του CRM/ιστοσελίδα) — έχει ΜΗΔΕΝ
 * permissions στον κώδικα και δεσμεύεται σε απόφαση GDPR (§11.4, Ε4.ζ).
 * ΔΕΝ μπαίνει εδώ.
 */
export type JobId =
  | 'design'          // Σχέδιο
  | 'site'            // Εργοτάξιο
  | 'clients'         // Πελάτες
  | 'finance'         // Οικονομικά
  | 'procurement'     // Προμήθειες
  | 'administration'; // Διαχείριση

/**
 * Πηγή ορατότητας για ένα **εγκάρσιο** στοιχείο (σήμερα: οι αναφορές).
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ (ADR-748, έρευνα 2026-08-02): ACC · Procore · Salesforce ·
 * SAP Fiori κάνουν **όλοι** το ίδιο — η αναφορά ΔΕΝ ταξινομείται σε τμήμα·
 * **κληρονομεί την ορατότητα της πηγής της**.
 *
 *   ACC: «the reports you can view are based on your access to project modules»
 *   Procore: «determined by your existing tool permissions»
 *
 * Ετικέτα δουλειάς ανά αναφορά θα ήταν **ΑΝΤΙΓΡΑΦΗ ΤΑΞΙΝΟΜΗΣΗΣ** — το ελάττωμα
 * του ACC που το Ε5.γ/Υ-5 απαγορεύει ρητά: αν αύριο το `/sales` αλλάξει δουλειά,
 * η ετικέτα του `/reports/sales` μένει πίσω και **αποκλίνει σιωπηλά**.
 */
export type ReportSource =
  /** Κληρονομεί ό,τι ισχύει για αυτή τη διαδρομή (η συνήθης περίπτωση). */
  | { readonly kind: 'route'; readonly route: string }
  /** Κληρονομεί από δουλειά — μόνο όπου δεν υπάρχει διαδρομή-πηγή. */
  | { readonly kind: 'job'; readonly job: JobId };

/** Μια δουλειά: ταυτότητα, τι τη γεννά, τι δείχνει. */
export interface JobDefinition {
  readonly id: JobId;
  /** Σταθερή σειρά εμφάνισης — και η σειρά ισοβαθμίας του Ε7.δ. */
  readonly order: number;
  /** i18n key (namespace `navigation`). ΠΟΤΕ ωμό αλφαριθμητικό (N.11). */
  readonly labelKey: string;
  readonly descriptionKey: string;
  /**
   * Τα permissions που **γεννούν** τη δουλειά: **ΟΠΟΙΟΔΗΠΟΤΕ** από αυτά αρκεί.
   *
   * ⚠️ Είναι η **είσοδος** του υπολογισμού του Ε-5, ΟΧΙ αποθηκευμένο αποτέλεσμα.
   * Καμία λίστα δουλειών δεν αποθηκεύεται ποτέ (Ε5.α, Ε5.γ).
   *
   * Το σύνολο είναι το μετρημένο του Ε-4.2 (αφαιρώντας όσα έχουν σχεδόν όλοι:
   * `notifications:*`, `projects:projects:view`, `properties:properties:view`,
   * `units:units:view`), **επεκταμένο στο ίδιο domain** όπου το domain είναι
   * προφανώς αδιαίρετο (π.χ. όλο το `crm:*`). Επέκταση σε ΑΛΛΟ domain απαιτεί
   * επαναμέτρηση στο `lib/auth/roles.ts` — μην την κάνεις «με το μάτι».
   */
  readonly permissions: readonly PermissionId[];
  /** Στοιχεία sidebar **αποκλειστικά** αυτής της δουλειάς (§14.1). */
  readonly sidebar: readonly string[];
  /** Πλακίδια dashboard **αποκλειστικά** αυτής της δουλειάς (§14.2). */
  readonly dashboardTiles: readonly string[];
  /**
   * Αν ο DXF viewer ανήκει σε αυτή τη δουλειά. **Ακριβώς μία** τον έχει (§14.3).
   * Ο διακόπτης ειδικότητας ζει **μέσα** του και ΔΕΝ περιγράφεται εδώ: τα 16
   * ribbon tabs έχουν ήδη SSoT στο subapp (`ribbon-tab-specialties.ts`).
   * Δεύτερη λίστα tabs εδώ = διπλότυπο.
   */
  readonly ownsDxfViewer: boolean;
}

// =============================================================================
// ΚΟΙΝΑ — ανήκουν σε ΟΛΕΣ τις δουλειές (§14.1, §14.2)
// =============================================================================

/**
 * Ορατά σε κάθε δουλειά. Δεν είναι «αταξινόμητα» — είναι το **πλαίσιο**:
 *  • `/dashboard` `/projects` `/properties` `/files` `/settings` → §14.1 (1-4, 15)
 *  • `/dashboard` **αντικατέστησε** το `/` (ADR-777 §8.13, `4cfe274e`): η αρχική του
 *    συνδεδεμένου μετακόμισε και το `/` έγινε **δημόσια** οθόνη αναζήτησης. Το μενού
 *    εκπέμπει `AUTH_ROUTES.home` και **ωμό `/` δεν εκπέμπει πουθενά** — άρα η παλιά
 *    γραμμή ταξινομούσε διαδρομή που κανείς δεν ζωγραφίζει, ενώ η ζωντανή έμενε
 *    αταξινόμητη και σωζόταν **μόνο** από το φίλτρο θορύβου του Ε14.ζ.
 *  • `/projects` ειδικά: είναι ο **άξονας 2** (Ε4.η′), όχι περιεχόμενο δουλειάς
 *  • `/obligations` → βλ. LEGAL_DOCUMENTS_STATUS παρακάτω
 */
export const COMMON_SIDEBAR_ROUTES: readonly string[] = [
  '/dashboard',
  '/projects',
  '/properties',
  '/files',
  '/settings',
  '/obligations',
] as const;

/** §14.2, γραμμή «όλες». */
export const COMMON_DASHBOARD_TILES: readonly string[] = [
  'properties',
  'projects',
  'files',
] as const;

// =============================================================================
// ΤΟ ΜΗΤΡΩΟ
// =============================================================================

export const JOBS: Readonly<Record<JobId, JobDefinition>> = {
  // ───────────────────────────────────────────────────────────────────────────
  // 1. ΣΧΕΔΙΟ — architect, engineer
  //
  // 🔑 Ο κώδικας το είχε ήδη πει (Ε-4.4/1): `architect` = 22 permissions,
  // `engineer` = τα ΙΔΙΑ 22 + `specs:specs:view`. **Ένα** permission διαφορά
  // στα 23 ⇒ αρχιτέκτονας και μηχανικός είναι ΗΔΗ η ίδια δουλειά. Η αρχή «ένα
  // Σχέδιο + διακόπτης ειδικότητας» δεν προτάθηκε — επιβεβαιώθηκε εμπειρικά.
  // ───────────────────────────────────────────────────────────────────────────
  design: {
    id: 'design',
    order: 1,
    labelKey: 'jobs.design.label',
    descriptionKey: 'jobs.design.description',
    permissions: [
      'dxf:files:view',
      'dxf:files:upload',
      'dxf:layers:view',
      'dxf:layers:manage',
      'dxf:layers:unlock',
      'dxf:annotations:edit',
      'dxf:text:create',
      'dxf:text:edit',
      'dxf:text:delete',
      'dxf:dictionary:view',
      'dxf:dictionary:manage',
      'bim_dimensions_3d:dimensions:create',
      'bim_dimensions_3d:dimensions:read',
      'bim_dimensions_3d:dimensions:update',
      'bim_dimensions_3d:dimensions:delete',
      'bim_comments:comments:create',
      'bim_comments:comments:read',
      'bim_comments:comments:update',
      'bim_comments:comments:delete',
      'bim_comments:comments:assign',
      'bim_comments:comments:archive',
      'bim_animations:animations:create',
      'bim_animations:animations:read',
      'bim_animations:animations:update',
      'bim_animations:animations:delete',
    ],
    sidebar: ['/dxf/viewer', '/buildings'],
    dashboardTiles: ['dxf/viewer', 'buildings'],
    ownsDxfViewer: true,
  },

  // ───────────────────────────────────────────────────────────────────────────
  // 2. ΕΡΓΟΤΑΞΙΟ — site_manager
  // ⚠️ Ε4.στ: αληθινή αλλά ΑΝΩΡΙΜΗ — 1 στοιχείο sidebar, 0 δικά της πλακίδια
  // (§14.4/3). Δηλώνεται τώρα, γεμίζει αργότερα. Δεν είναι λόγος να μην υπάρχει.
  // ───────────────────────────────────────────────────────────────────────────
  site: {
    id: 'site',
    order: 2,
    labelKey: 'jobs.site.label',
    descriptionKey: 'jobs.site.description',
    permissions: [
      'photos:photos:upload',
      'progress:progress:update',
      'reports:reports:create',
      'floorplans:floorplans:process',
    ],
    sidebar: ['/construction/portfolio', '/buildings'],
    // «buildings» κοινό με το Σχέδιο: το κτίριο μελετάται ΚΑΙ χτίζεται (§14.1/7).
    dashboardTiles: ['buildings'],
    ownsDxfViewer: false,
  },

  // ───────────────────────────────────────────────────────────────────────────
  // 3. ΠΕΛΑΤΕΣ — sales_agent, data_entry
  // ⚠️ GDPR (§11.4): οι επαφές ανήκουν στον ΟΡΓΑΝΙΣΜΟ, δεν είναι κοινή δεξαμενή.
  // ───────────────────────────────────────────────────────────────────────────
  clients: {
    id: 'clients',
    order: 3,
    labelKey: 'jobs.clients.label',
    descriptionKey: 'jobs.clients.description',
    permissions: [
      'crm:contacts:view',
      'crm:contacts:create',
      'crm:contacts:update',
      'crm:contacts:delete',
      'crm:contacts:export',
      'crm:opportunities:view',
      'crm:opportunities:create',
      'crm:opportunities:update',
      'crm:communications:view',
      'crm:tasks:view',
      'crm:tasks:create',
      'crm:tasks:update',
      'comm:conversations:list',
      'comm:conversations:view',
      'comm:conversations:update',
      'comm:messages:view',
      'comm:messages:send',
      'comm:messages:delete',
      'listings:listings:publish',
    ],
    // ADR-777 §8.34 — ο κατάλογος εντολών ανήκει στη δουλειά **των πελατών**: η
    // εντολή είναι σχέση με άνθρωπο (ποιος ενέκρινε, ποιος δεν απάντησε), όχι
    // διαχείριση κτίσματος. Χωρίς αυτή τη γραμμή η διαδρομή θα ήταν **αταξινόμητη**
    // και η άγκυρα Μ-5 (πύλη Υ-4) θα κοκκίνιζε — σωστά.
    sidebar: ['/spaces', '/sales', '/crm', '/contacts', '/listings/mandates'],
    dashboardTiles: ['contacts', 'crm', 'sales', 'spaces'],
    ownsDxfViewer: false,
  },

  // ───────────────────────────────────────────────────────────────────────────
  // 4. ΟΙΚΟΝΟΜΙΚΑ — accountant (μόνος)
  // ⚠️ Ε5.θ / Π-7: ο `company_admin` ΔΕΝ έχει `finance:invoices` ⇒ ο διαχειριστής
  // της εταιρείας δεν βλέπει τα Οικονομικά της. Πιθανό κενό στα σημερινά
  // δικαιώματα — το αποκάλυψε ο υπολογισμός, ΔΕΝ διορθώνεται εδώ (οι Φάσεις 1-4
  // δεν αγγίζουν permissions, §10).
  // ───────────────────────────────────────────────────────────────────────────
  finance: {
    id: 'finance',
    order: 4,
    labelKey: 'jobs.finance.label',
    descriptionKey: 'jobs.finance.description',
    permissions: [
      'finance:invoices:view',
      'finance:invoices:update',
      'finance:invoices:approve',
    ],
    sidebar: ['/accounting'],
    dashboardTiles: ['accounting'],
    ownsDxfViewer: false,
  },

  // ───────────────────────────────────────────────────────────────────────────
  // 5. ΠΡΟΜΗΘΕΙΕΣ — vendor (μόνος)
  // 🔑 Ε-4.4/2: δύο domains που ΚΑΝΕΙΣ άλλος δεν αγγίζει (`orders`,`deliveries`)
  // — η καθαρότερα απομονωμένη δουλειά όλου του συστήματος. Είχε παραλειφθεί
  // στην πρώτη απόπειρα. ⚠️ Ανώριμη κι αυτή: 1 στοιχείο, 0 πλακίδια (§14.4/3).
  // ───────────────────────────────────────────────────────────────────────────
  procurement: {
    id: 'procurement',
    order: 5,
    labelKey: 'jobs.procurement.label',
    descriptionKey: 'jobs.procurement.description',
    permissions: [
      'orders:orders:view',
      'deliveries:deliveries:view',
      'specs:specs:view',
    ],
    sidebar: ['/procurement'],
    dashboardTiles: [],
    ownsDxfViewer: false,
  },

  // ───────────────────────────────────────────────────────────────────────────
  // 6. ΔΙΑΧΕΙΡΙΣΗ — company_admin, super_admin
  // 🔑 §14.4/4: η ΜΟΝΗ δουλειά που φιλτράρεται ήδη σήμερα — και τα 8 υπάρχοντα
  // `smartConfig.permissions` είναι `admin_access`. Οι άλλες πέντε χρειάζονται
  // ΔΕΔΟΜΕΝΑ, όχι μηχανισμό (§2.1).
  // ───────────────────────────────────────────────────────────────────────────
  administration: {
    id: 'administration',
    order: 6,
    labelKey: 'jobs.administration.label',
    descriptionKey: 'jobs.administration.description',
    permissions: [
      'admin_access',
      'users:users:view',
      'users:users:manage',
      'settings:settings:manage',
      'admin:migrations:execute',
      'admin:data:fix',
      'admin:direct:operations',
      'admin:debug:read',
      'admin:system:configure',
      'admin:backup:execute',
    ],
    sidebar: [
      '/admin/ai-inbox',
      '/admin/operator-inbox',
      '/admin/setup',
      '/admin/role-management',
      '/admin/audit-log',
      '/admin/backup',
      '/debug',
      '/settings/company',
    ],
    dashboardTiles: [],
    ownsDxfViewer: false,
  },
} as const;

/**
 * Σταθερή σειρά. Είναι **δεδομένο**, όχι υπολογισμός: το Ε7.δ την ορίζει ως τον
 * κανόνα ισοβαθμίας όταν δύο δουλειές έχουν ίδιο πλήθος δικαιωμάτων.
 */
export const JOB_ORDER: readonly JobId[] = [
  'design',
  'site',
  'clients',
  'finance',
  'procurement',
  'administration',
] as const;

// =============================================================================
// ΕΓΚΑΡΣΙΑ ΣΤΟΙΧΕΙΑ — οι αναφορές (§14.4/1)
// =============================================================================

/**
 * Το `/reports` (ο γονιός) ΔΕΝ έχει ετικέτα δουλειάς: μένει **ορατό σε όλες**.
 * Πρότυπο ACC: «the reports tool is accessible to all… however the reports you
 * can view are based on your access to project modules».
 *
 * ⚠️ ΚΑΙ ΥΠΑΡΧΕΙ ΜΕΤΡΗΜΕΝΟΣ ΛΟΓΟΣ ΝΑ ΜΗΝ ΦΙΛΤΡΑΡΕΤΑΙ Ο ΓΟΝΙΟΣ (2026-08-02):
 * το `reports:reports:view` το έχουν **μόνο** `project_manager`, `site_manager`,
 * `accountant`, `viewer`. ΔΕΝ το έχουν `architect`, `engineer`, `sales_agent`,
 * `company_admin`. Φίλτρο στον γονιό θα έκρυβε τις αναφορές από τον διαχειριστή
 * της εταιρείας — δεύτερο Π-7, ίδιο σχήμα.
 *
 * Τα υπο-στοιχεία **κληρονομούν** — δεν ταξινομούνται. Οκτώ από τα δέκα
 * κληρονομούν από διαδρομή που ΗΔΗ ταξινομείται παραπάνω· δύο (`compliance`,
 * `export`) δεν έχουν διαδρομή-πηγή και δηλώνουν δουλειά ρητά.
 *
 * Αν όλα φιλτραριστούν, ο χρήστης βλέπει **κενή κατάσταση κατά NN/g**
 * (πού είσαι · τι κάνει εδώ · μία κίνηση) — ΠΟΤΕ εξαφανισμένο μενού (Α-3, Ε7.ε).
 */
export const REPORT_SOURCES: Readonly<Record<string, ReportSource>> = {
  '/reports/financial':    { kind: 'route', route: '/accounting' },
  '/reports/cash-flow':    { kind: 'route', route: '/accounting' },
  '/reports/construction': { kind: 'route', route: '/construction/portfolio' },
  '/reports/sales':        { kind: 'route', route: '/sales' },
  '/reports/crm':          { kind: 'route', route: '/crm' },
  '/reports/contacts':     { kind: 'route', route: '/contacts' },
  '/reports/spaces':       { kind: 'route', route: '/spaces' },
  '/reports/projects':     { kind: 'route', route: '/projects' },
  '/reports/compliance':   { kind: 'job',   job: 'administration' },
  '/reports/export':       { kind: 'job',   job: 'administration' },
} as const;

// =============================================================================
// ΚΑΤΑΓΕΓΡΑΜΜΕΝΑ ΚΕΝΑ — δεν διορθώνονται εδώ, δεν κρύβονται κιόλας
// =============================================================================

/**
 * 🔴 ΤΟ `/legal-documents` ΔΕΝ ΕΙΝΑΙ ΣΤΟΙΧΕΙΟ ΤΟΥ ΜΗΤΡΩΟΥ — ΕΙΝΑΙ ΣΦΑΛΜΑ.
 * Απόφαση Γιώργου 2026-08-02, μετά από μέτρηση.
 *
 * ΤΙ ΜΕΤΡΗΘΗΚΕ:
 *  (α) `find src/app -name page.tsx | grep -i legal` → **ΚΕΝΟ**. Κανένα
 *      rewrite/redirect/middleware. Το στοιχείο μενού δίνει **404** — και φέρει
 *      σχόλιο «Increased priority for visibility», δηλαδή κάποιος το έκανε πιο
 *      ορατό. Ζωντανό είναι μόνο το υπο-στοιχείο του, το `/obligations`.
 *  (β) Κανένας από τους 13 ρόλους δεν έχει κανένα από τα 7 `legal:*`.
 *      Εκ σχεδιασμού: ζουν σε add-on πακέτα `legal_viewer` / `legal_manager`
 *      (`lib/auth/permission-sets.ts`), **και τα δύο `requiresMfaEnrolled`**.
 *  (γ) Η επιβολή όμως ΔΕΝ υπάρχει πουθενά: τα rules των `obligations` είναι
 *      tenant-scoped (companyId) χωρίς διάκριση ρόλου, και το
 *      `/api/contracts/route.ts` καλεί `withAuth(...)` **χωρίς permission**.
 *      Ο server προστατεύει τον ΟΡΓΑΝΙΣΜΟ, όχι τον ΡΟΛΟ.
 *
 * ΓΙΑΤΙ ΤΟ `/obligations` ΔΗΛΩΝΕΤΑΙ **ΚΟΙΝΟ** ΚΑΙ ΟΧΙ «Πελάτες»:
 * επειδή δεν υπάρχει επιβολή, ετικέτα δουλειάς θα έκρυβε το κουμπί ενώ ο
 * εργάτης και ο προμηθευτής της ίδιας εταιρείας θα συνέχιζαν να διαβάζουν τα
 * συμβόλαια. Είναι κατά λέξη το αντι-πρότυπο του OWASP A01:2021 («reliance on
 * client-side access check enforcement») και θα έκανε το πρόβλημα **αόρατο**.
 * Το φίλτρο UX δεν χρησιμοποιείται ΠΟΤΕ ως υποκατάστατο ασφάλειας (§5, Ε5.η).
 *
 * ΤΟ ΣΩΣΤΟ ΤΕΛΟΣ: όταν επιβληθεί πραγματικά το `legal:documents:view`, η
 * απόκρυψη έρχεται **δωρεάν** — πρότυπο Procore: permission «None» ⇒ το
 * εργαλείο φεύγει μόνο του από το μενού. Η απόκρυψη ΑΚΟΛΟΥΘΕΙ το δικαίωμα.
 *
 * ⚠️ ΜΗΝ προσθέσεις εδώ το `/legal-documents` «για πληρότητα». Το μητρώο
 * περιγράφει ό,τι **υπάρχει**· σφάλμα στα θεμέλια δεν είναι πληρότητα.
 */
export const LEGAL_DOCUMENTS_STATUS = {
  route: '/legal-documents',
  /** Νεκρός σύνδεσμος: δεν υπάρχει `page.tsx` ούτε rewrite (μετρήθηκε 2026-08-02). */
  hasPage: false,
  /** Το ζωντανό υπο-στοιχείο, δηλωμένο στα COMMON_SIDEBAR_ROUTES. */
  livingChildRoute: '/obligations',
  /** Τα permissions υπάρχουν αλλά δεν επιβάλλονται σε rules/API. */
  enforced: false,
} as const;
