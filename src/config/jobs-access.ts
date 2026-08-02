/**
 * ADR-748 Φάση 3 — Ο ΖΩΝΤΑΝΟΣ ΥΠΟΛΟΓΙΣΜΟΣ «ποιες δουλειές έχει ο Χ» (Ε5.α/Ε5.ζ).
 *
 * ΚΑΘΑΡΗ ΣΥΝΑΡΤΗΣΗ. Μηδέν I/O, μηδέν Firebase, μηδέν React — όπως το
 * `decideAssetPackAccess()` (ADR-655), που είναι το ρητό πρότυπο του Ε5.ζ.
 * Διαβάζει το `jobs-registry.ts`· **δεν το αντιγράφει** (Ε5.γ/Υ-5: καμία
 * αντιγραφή δικαιωμάτων ή ταξινόμησης, ΠΟΤΕ).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΥΡΗΜΑ ΠΟΥ ΟΡΙΖΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ (μετρημένο 2026-08-02)
 *
 * Το Π-15 λέει ότι οι πηγές δικαιωμάτων είναι **ΤΡΕΙΣ**. Στον browser φτάνει
 * **ΜΙΑ**. Μετρημένο στο `api/admin/set-user-claims/claims-handler.ts:159-164`:
 *
 *     finalPermissions = PREDEFINED_ROLES[globalRole].permissions
 *                      + explicit permissions
 *                      + admin_access (super_admin | company_admin)
 *
 *   • `GlobalRole`     (custom claims)                    → ✅ φτάνει
 *   • `ProjectRole`    (`/projects/{pid}/members/{uid}`)  → ❌ ΠΟΤΕ
 *   • `PermissionSets` (`members/{uid}.permissionSetIds`) → ❌ ΠΟΤΕ
 *
 * Ο Νίκος στην εταιρεία Β είναι `external_user` (μηδέν δουλειές από claims) και
 * **μελετητής στο έργο**. Υπολογισμός που θα έκρυβε ό,τι δεν βεβαιώνουν τα
 * claims θα του έκρυβε το «Σχέδιο» ⇒ **άδεια οθόνη** — κατά λέξη το σενάριο
 * που το Ε-5.1 προειδοποιεί και το ελάττωμα του ACC (§6.11.1).
 *
 * ⇒ Η ΑΠΟΦΑΣΗ ΔΕΝ ΕΙΝΑΙ BOOLEAN. Είναι **τρεις διακριτές καταστάσεις**, όπως
 *   τα διακριτά `deny:*` του `decideAssetPackAccess()`:
 *
 *     'granted'  — μετρημένο δικαίωμα τη γεννά (ή bypass ρόλος)
 *     'unknown'  — η πηγή που θα απαντούσε ΔΕΝ είναι διαθέσιμη εδώ
 *     'none'     — καμία διαθέσιμη πηγή δεν τη στηρίζει
 *
 * ΚΑΙ Ο ΚΑΝΟΝΑΣ ΑΠΟΚΡΥΨΗΣ:
 *
 *     🔒 ΚΡΥΒΕΤΑΙ ΜΟΝΟ ΤΟ 'none'. ΤΟ 'unknown' ΔΕΝ ΚΡΥΒΕΤΑΙ ΠΟΤΕ.
 *
 * Έτσι το **Ε5.ζ (fail-closed)** μένει ακέραιο στην **απόφαση** — καμία δουλειά
 * δεν επινοείται από το πουθενά — και το **Ε14.ζ** μένει ακέραιο στο **φίλτρο**:
 * *«το φίλτρο δεν προσποιείται ποτέ ότι αφαιρεί πρόσβαση»*. Fail-closed σε
 * απόφαση **ασφαλείας** είναι σωστό· fail-closed σε φίλτρο **UX** κρύβει από τον
 * χρήστη πράγματα που δικαιούται (Ε5.η: αυτό εδώ είναι UX, ΟΧΙ ασφάλεια).
 *
 * 🔑 Και ξεκλειδώνει το **Υ-6** (η αλυσίδα αιτίασης ορατή): κάθε απόφαση φέρει
 * τον **λόγο** της, άρα η οθόνη μπορεί να πει «βλέπεις το Σχέδιο επειδή έχεις
 * `dxf:files:view`» ή «δεν το ξέρω — ο ρόλος σου στο έργο δεν φτάνει εδώ».
 * **Ούτε ο ACC ούτε η Figma διακρίνουν «δεν δικαιούσαι» από «δεν ξέρω».**
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΔΕΥΤΕΡΗ ΠΑΓΙΔΑ, ΕΠΙΣΗΣ ΜΕΤΡΗΜΕΝΗ: `roles.ts:55-62`
 *
 *     super_admin: { permissions: [], isBypass: true }
 *
 * Ο υπερδιαχειριστής έχει **ΚΕΝΗ** λίστα permissions· όλη του η δύναμη ζει στο
 * `isBypass`. Στα claims του υπάρχει μόνο το `admin_access` (claims-handler:161)
 * ⇒ υπολογισμός χωρίς έλεγχο bypass θα του έδινε **μόνο τη Διαχείριση** και θα
 * του έκρυβε τις άλλες πέντε. Γι' αυτό ο έλεγχος bypass είναι **πρώτος**, και
 * γίνεται με το υπάρχον `isRoleBypass()` — **ΠΟΤΕ** χειρόγραφο
 * `globalRole === 'super_admin'` (θα ήταν έβδομο λεξιλόγιο ρόλων).
 * ─────────────────────────────────────────────────────────────────────────────
 * ΟΝΟΜΑΤΟΛΟΓΙΑ (Ε6.στ, Π-9): `Job` = ΔΟΥΛΕΙΑ. `Workspace` = ΟΡΓΑΝΙΣΜΟΣ.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-748-role-based-workspaces.md §9/Ε-5
 * @see src/config/jobs-registry.ts — τα δεδομένα· εδώ ζει μόνο η λογική
 * @see src/lib/asset-packs/asset-pack-access.ts — το πρότυπο (ADR-655)
 */

import {
  COMMON_DASHBOARD_TILES,
  COMMON_SIDEBAR_ROUTES,
  JOBS,
  JOB_ORDER,
  REPORT_SOURCES,
  type JobId,
} from './jobs-registry';

// =============================================================================
// ΤΑΥΤΟΤΗΤΑ
// =============================================================================

/**
 * «Καμία ενεργή δουλειά» = δείξε τα πάντα, ακριβώς όπως σήμερα.
 *
 * Είναι η **προεπιλογή** και αντιγράφει συνειδητά το πιο πετυχημένο σημείο της
 * Φάσης 2 (`RIBBON_SPECIALTY_ALL`): υπάρχων χρήστης δεν βλέπει **καμία** αλλαγή
 * μέχρι να γυρίσει **ο ίδιος** τον διακόπτη (Α-1, Α-3).
 */
export const JOB_ALL = 'all' as const;

/** Ό,τι μπορεί να είναι «ενεργό»: μία από τις έξι, ή «Όλα». */
export type JobSelection = JobId | typeof JOB_ALL;

/** Οι τρεις πηγές δικαιωμάτων του Π-15, ως ταυτότητες. */
export type PermissionSourceId = 'globalRole' | 'projectRoles' | 'permissionSets';

/** Η σειρά είναι σταθερή για να είναι σταθερά και τα μηνύματα του Υ-6. */
export const PERMISSION_SOURCE_ORDER: readonly PermissionSourceId[] = [
  'globalRole',
  'projectRoles',
  'permissionSets',
] as const;

/**
 * Η **είσοδος** του υπολογισμού. Ό,τι ξέρουμε τη στιγμή της ερώτησης — και,
 * εξίσου σημαντικό, **τι δεν ξέρουμε**.
 */
export interface JobAccessInput {
  /**
   * Η **ένωση** των permissions από όσες πηγές είναι διαθέσιμες (Ε1.ζ).
   * Ποτέ αποθηκευμένη λίστα δουλειών — μόνο ωμά permissions (Ε5.α).
   */
  readonly permissions: readonly string[];
  /** `isRoleBypass(globalRole)` — υπολογισμένο από τον καλούντα, όχι εδώ. */
  readonly isBypass: boolean;
  /**
   * Ποιες πηγές **απάντησαν πραγματικά**. Πηγή που λείπει ⇒ `unknown`, όχι
   * `none`. Σήμερα στον browser: `globalRole` μόνο.
   */
  readonly availableSources: readonly PermissionSourceId[];
}

/** Γιατί βγήκε η απόφαση — το υλικό του Υ-6 (αλυσίδα αιτίασης). */
export type JobAccessReason =
  /** Ρόλος bypass (super_admin): τα βλέπει όλα εξ ορισμού (Ε4.ε). */
  | { readonly kind: 'bypass' }
  /** Το συγκεκριμένο permission που τη γέννησε. */
  | { readonly kind: 'permission'; readonly permission: string }
  /** Δεν ξέρουμε: αυτές οι πηγές δεν απάντησαν. */
  | { readonly kind: 'sources-unavailable'; readonly missing: readonly PermissionSourceId[] }
  /** Όλες οι πηγές απάντησαν και καμία δεν τη στηρίζει. */
  | { readonly kind: 'no-permission' };

export type JobAccessDecision = 'granted' | 'unknown' | 'none';

export interface JobAccess {
  readonly job: JobId;
  readonly decision: JobAccessDecision;
  readonly reason: JobAccessReason;
}

// =============================================================================
// Η ΑΠΟΦΑΣΗ
// =============================================================================

/** Οι πηγές που δεν απάντησαν — σταθερή σειρά (PERMISSION_SOURCE_ORDER). */
function missingSources(
  available: readonly PermissionSourceId[],
): readonly PermissionSourceId[] {
  return PERMISSION_SOURCE_ORDER.filter((source) => !available.includes(source));
}

/**
 * Σειρά ελέγχων — **η σειρά είναι ο μηχανισμός**, μην την αλλάξεις:
 *
 *   1. **bypass** πρώτα. Ο `super_admin` έχει `permissions: []` (roles.ts:58):
 *      κάθε άλλος έλεγχος θα του έκρυβε τα πάντα πλην Διαχείρισης.
 *   2. **μετρημένο permission** ⇒ `granted`, με το permission ως αιτία (Υ-6).
 *   3. **ελλιπείς πηγές** ⇒ `unknown`. ΠΟΤΕ `none` όταν κάποιος δεν ρωτήθηκε:
 *      «κανείς δεν κοίταξε» ≠ «δεν υπάρχει» (ο κανόνας N.12, ως κώδικας).
 *   4. αλλιώς ⇒ `none`.
 */
export function decideJobAccess(job: JobId, input: JobAccessInput): JobAccess {
  if (input.isBypass) {
    return { job, decision: 'granted', reason: { kind: 'bypass' } };
  }

  const matched = JOBS[job].permissions.find((permission) =>
    input.permissions.includes(permission),
  );
  if (matched !== undefined) {
    return { job, decision: 'granted', reason: { kind: 'permission', permission: matched } };
  }

  const missing = missingSources(input.availableSources);
  if (missing.length > 0) {
    return { job, decision: 'unknown', reason: { kind: 'sources-unavailable', missing } };
  }

  return { job, decision: 'none', reason: { kind: 'no-permission' } };
}

/** Και οι έξι, στη σταθερή σειρά του μητρώου (JOB_ORDER). */
export function resolveJobAccess(input: JobAccessInput): readonly JobAccess[] {
  return JOB_ORDER.map((job) => decideJobAccess(job, input));
}

/**
 * Ό,τι **δεν κρύβεται**: `granted` ∪ `unknown`.
 *
 * 🔒 Η καρδιά του κανόνα. Το `unknown` μένει μέσα επειδή η απόκρυψή του θα
 * έκρυβε δουλειά που ο χρήστης **δικαιούται** μέσω πηγής που ο browser δεν
 * ρώτησε ποτέ (Ε14.ζ). Καμία δουλειά δεν επινοείται — το `none` φεύγει.
 */
export function resolveAvailableJobs(input: JobAccessInput): readonly JobId[] {
  return resolveJobAccess(input)
    .filter((access) => access.decision !== 'none')
    .map((access) => access.job);
}

/**
 * Ε7.δ — «πάντα υπάρχει προεπιλογή» (κανόνας Revit: *if you do not select a
 * discipline, an appropriate default is used*).
 *
 * Κριτήριο: η δουλειά με τα **περισσότερα μετρημένα** δικαιώματα· σε ισοβαθμία,
 * η σταθερή σειρά του μητρώου. **Υπολογισμένη, ποτέ hardcoded.**
 *
 * ⚠️ Επιστρέφει `JOB_ALL` όταν δεν υπάρχει καμία διαθέσιμη — και **αυτό είναι η
 * απάντηση, όχι αποτυχία**: «μηδέν δουλειές» παύει να υπάρχει ως κατάσταση
 * (Ε7.α/Υ-10). Κανείς δεν βλέπει ποτέ κενή οθόνη επειδή δεν τον ρώτησε κανείς.
 */
export function pickDefaultJob(input: JobAccessInput): JobSelection {
  const available = resolveAvailableJobs(input);
  if (available.length === 0) return JOB_ALL;

  let best: JobId = available[0];
  let bestScore = -1;
  for (const job of available) {
    const score = JOBS[job].permissions.filter((permission) =>
      input.permissions.includes(permission),
    ).length;
    // Αυστηρό `>`: η ισοβαθμία κρατά τον πρώτο κατά JOB_ORDER (Ε7.δ).
    if (score > bestScore) {
      best = job;
      bestScore = score;
    }
  }
  return best;
}

// =============================================================================
// ΟΡΑΤΟΤΗΤΑ ΔΙΑΔΡΟΜΩΝ — η ετικέτα, όχι το δικαίωμα (§14.5)
// =============================================================================

/**
 * Ανήκει η διαδρομή στην ενεργή δουλειά;
 *
 * ⚠️ ΔΕΝ απαντά «δικαιούται ο χρήστης τη διαδρομή» — αυτό το απαντά το
 * `filterItemsByPermissions()` που **ήδη τρέχει** (smart-navigation-factory).
 * Τα δύο φίλτρα είναι **διαδοχικά και ανεξάρτητα** (§14.5): ένα στοιχείο
 * εμφανίζεται όταν *(α)* ανήκει στην ενεργή δουλειά **ΚΑΙ** *(β)* ο έλεγχος
 * δικαιωμάτων το έχει ήδη επιτρέψει.
 */
export function isRouteVisibleForJob(route: string, active: JobSelection): boolean {
  if (active === JOB_ALL) return true;
  if (COMMON_SIDEBAR_ROUTES.includes(route)) return true;
  if (isCrossCuttingRoute(route)) return true;
  // 🔴 ΑΤΑΞΙΝΟΜΗΤΟ ⇒ ΟΡΑΤΟ. Φίλτρο θορύβου, όχι πύλη (Ε14.ζ).
  //
  // Η αντίστροφη επιλογή («δεν το ξέρω ⇒ κρύψ' το») είναι **fail-closed σε
  // φίλτρο UX** — ακριβώς το λάθος που το Ε5.ι απαγορεύει, και το ίδιο που
  // κάνει ήδη σωστά το `isReportSubItemVisibleForJob`. Το κόστος του
  // μετρήθηκε ζωντανά στην οθόνη (2026-08-02): έκρυβε το `/legal-documents`
  // — που το **Ε14.στ ρητά απαγορεύει να κρυφτεί** όσο είναι ανεπίβλητο
  // (OWASP A01: απόκρυψη χωρίς προστασία κάνει το πρόβλημα αόρατο).
  //
  // Η προστασία από «όλα αταξινόμητα ⇒ φίλτρο που δεν κάνει τίποτα» ΔΕΝ είναι
  // αυτή η γραμμή — είναι το anchor test Μ-5 (η πύλη Υ-4), που κοκκινίζει με
  // την πρώτη διαδρομή χωρίς ανάθεση.
  if (!CLASSIFIED_SIDEBAR_ROUTES.has(route)) return true;
  return JOBS[active].sidebar.includes(route);
}

/** Κάθε διαδρομή που **κάποια** δουλειά διεκδικεί. Υπολογίζεται μία φορά. */
const CLASSIFIED_SIDEBAR_ROUTES: ReadonlySet<string> = new Set(
  JOB_ORDER.flatMap((job) => JOBS[job].sidebar),
);

/**
 * Ρητά δηλωμένο **ορατό παντού**: κοινό ή εγκάρσιο.
 *
 * ⚠️ ΔΕΝ είναι το ίδιο με «αταξινόμητο». Η διαφορά είναι όλο το νόημα του
 * Ε14.ι: **μόνο** ένα ρητά κοινό παιδί κρατά ζωντανό έναν γονιό που ανήκει
 * αλλού. Αν αρκούσε ένα *αταξινόμητο* παιδί, κάθε γονιός με υπο-μενού θα
 * επιβίωνε πάντα και το φίλτρο θα ήταν διακοσμητικό — μετρημένο ζωντανά
 * (2026-08-02 16:58): τα «Χώροι · Πωλήσεις · CRM» έμειναν στα Οικονομικά
 * επειδή τα 4+5+11 παιδιά τους δεν έχουν δική τους ετικέτα.
 */
function isAlwaysVisibleRoute(route: string): boolean {
  return COMMON_SIDEBAR_ROUTES.includes(route) || isCrossCuttingRoute(route);
}

/**
 * Ορατότητα **υπο-στοιχείου** — και εδώ ζει η γενίκευση του Ε14.β.
 *
 * 🔑 **ΤΟ ΠΑΙΔΙ ΧΩΡΙΣ ΔΙΚΗ ΤΟΥ ΤΑΞΙΝΟΜΗΣΗ ΔΕΝ ΕΙΝΑΙ «ΑΤΑΞΙΝΟΜΗΤΟ» —
 * ΚΛΗΡΟΝΟΜΕΙ ΤΟΝ ΓΟΝΙΟ ΤΟΥ.** Η πηγή του είναι ο γονιός· ακριβώς όπως η
 * αναφορά κληρονομεί τη διαδρομή-πηγή της αντί να φέρει ετικέτα (Υ-5).
 * Άρα φτάνει εδώ **μόνο** όταν ο γονιός έχει ήδη κριθεί ορατός, και τότε:
 *
 *   • ρητά κοινό/εγκάρσιο  ⇒ ορατό πάντα
 *   • έχει δική του ετικέτα ⇒ κρίνεται μόνο του *(π.χ. τα `/admin/*` μέσα στο
 *     `/crm` και στο `/settings` — §14.1/11 και §14.1/15)*
 *   • αλλιώς               ⇒ **κληρονομεί** ⇒ ορατό μαζί με τον γονιό
 */
function isSubItemVisibleForJob(subRoute: string, active: JobSelection): boolean {
  if (active === JOB_ALL) return true;
  if (isAlwaysVisibleRoute(subRoute)) return true;
  if (!CLASSIFIED_SIDEBAR_ROUTES.has(subRoute)) return true;
  return JOBS[active].sidebar.includes(subRoute);
}

/**
 * Τα **εγκάρσια**: μένουν ορατά σε **κάθε** δουλειά (Ε14.α).
 *
 * 🔴 Μετρημένος λόγος να ΜΗΝ φιλτράρεται ο γονιός `/reports`: το
 * `reports:reports:view` το έχουν **μόνο** `project_manager`, `site_manager`,
 * `accountant`, `viewer` — **όχι** ο `company_admin` (Π-14). Φίλτρο στον γονιό
 * θα έκρυβε τις αναφορές από τον διαχειριστή της εταιρείας.
 */
export function isCrossCuttingRoute(route: string): boolean {
  return route === REPORTS_PARENT_ROUTE;
}

/** Ο γονιός των αναφορών. Μία φορά γραμμένος (το `REPORT_SOURCES` δίνει παιδιά). */
export const REPORTS_PARENT_ROUTE = '/reports';

/**
 * Ε14.β — **ΚΛΗΡΟΝΟΜΙΑ, ΟΧΙ ΤΑΞΙΝΟΜΗΣΗ.** Η υπο-αναφορά δεν έχει δική της
 * ετικέτα δουλειάς: ρωτά **την πηγή της** και κληρονομεί ζωντανά.
 *
 * Ομοφωνία ACC · Procore · Salesforce · SAP Fiori (§6.12.1). Ετικέτα ανά
 * υπο-αναφορά θα ήταν **αντιγραφή ταξινόμησης** = το ελάττωμα Υ-5: αν αύριο το
 * `/sales` αλλάξει δουλειά, η ετικέτα του `/reports/sales` μένει πίσω και
 * αποκλίνει σιωπηλά. Εδώ **δεν μπορεί** να αποκλίνει: δεν υπάρχει δεύτερη τιμή.
 *
 * Άγνωστη υπο-αναφορά ⇒ **ορατή**. Είναι φίλτρο θορύβου, όχι πύλη: ένα στοιχείο
 * που κανείς δεν χαρτογράφησε δεν εξαφανίζεται σιωπηλά (Α-3).
 */
export function isReportSubItemVisibleForJob(
  subRoute: string,
  active: JobSelection,
): boolean {
  if (active === JOB_ALL) return true;

  const source = REPORT_SOURCES[subRoute];
  if (source === undefined) return true;
  if (source.kind === 'job') return source.job === active;
  return isRouteVisibleForJob(source.route, active);
}

// =============================================================================
// ΤΟ ΦΙΛΤΡΟ — μία συνάρτηση, χρησιμοποιείται από sidebar ΚΑΙ dashboard
// =============================================================================

/**
 * Το ελάχιστο σχήμα που χρειάζεται το φίλτρο. Γενικό επίτηδες: το
 * `SmartNavigationItem` (sidebar) και το `NavigationTile` (dashboard) το
 * ικανοποιούν και τα δύο **χωρίς** να μπει τύπος UI σε αυτό το καθαρό αρχείο.
 */
export interface JobFilterableItem {
  readonly href: string;
  readonly subItems?: readonly JobFilterableItem[];
}

export interface JobFilterResult<T> {
  readonly visible: readonly T[];
  /** Α-3/Ε5.ε: πόσα κρύφτηκαν — **ποτέ σιωπηλή απόκρυψη**. */
  readonly hiddenCount: number;
}

/**
 * Φιλτράρει **αναδρομικά** (όπως το υπάρχον `filterItemsByPermissions`) και
 * **μετράει** ό,τι έφυγε. Ο γονιός `/reports` επιβιώνει πάντα· τα παιδιά του
 * κληρονομούν (Ε14.α/Ε14.β) — γι' αυτό ο ίδιος βρόχος ρωτά διαφορετική ερώτηση
 * ανά επίπεδο αντί να αντιγράφει ταξινόμηση προς τα κάτω.
 */
export function filterItemsByJob<T extends JobFilterableItem & { readonly subItems?: readonly T[] }>(
  items: readonly T[],
  active: JobSelection,
): JobFilterResult<T> {
  if (active === JOB_ALL) return { visible: items, hiddenCount: 0 };

  let hiddenCount = 0;
  const visible: T[] = [];

  for (const item of items) {
    const subItems = item.subItems;
    const isReportsParent = item.href === REPORTS_PARENT_ROUTE;

    // 🔑 Ο ΓΟΝΙΟΣ ΕΙΝΑΙ ΔΟΧΕΙΟ — αλλά **ΜΟΝΟ ρητά κοινό παιδί** τον κρατά
    // ζωντανό όταν ο ίδιος ανήκει αλλού (Ε14.ι). Το `/obligations` δηλώνεται
    // κοινό σε όλες τις δουλειές και ζει αποκλειστικά μέσα στο
    // `/legal-documents`: χωρίς αυτόν τον κανόνα εξαφανίζεται μαζί του.
    const selfVisible = isRouteVisibleForJob(item.href, active);
    const rescuedByChild =
      !selfVisible &&
      subItems !== undefined &&
      subItems.some((sub) => isAlwaysVisibleRoute(sub.href));

    if (!selfVisible && !rescuedByChild) {
      // Ο κλάδος φεύγει ολόκληρος. Μετριέται **ένα**: ο χρήστης έχασε ένα
      // στοιχείο από το μενού του, όχι δεκατρία — τα υπο-στοιχεία ενός
      // κλειστού μενού δεν ήταν ορατά ούτως ή άλλως. Ο δείκτης οφείλει να
      // μετρά ό,τι όντως έλειψε από την οθόνη (Α-3), αλλιώς γίνεται θόρυβος.
      hiddenCount += 1;
      continue;
    }

    if (subItems === undefined) {
      visible.push(item);
      continue;
    }

    const keptSubItems = subItems.filter((sub) => {
      if (isReportsParent) return isReportSubItemVisibleForJob(sub.href, active);
      // Ο γονιός σώθηκε χάρη σε κοινό παιδί ⇒ κρατάμε **μόνο** τα κοινά:
      // τα υπόλοιπα κληρονομούν τον γονιό, που δεν ανήκει εδώ.
      if (rescuedByChild) return isAlwaysVisibleRoute(sub.href);
      return isSubItemVisibleForJob(sub.href, active);
    });

    hiddenCount += subItems.length - keptSubItems.length;
    // `Object.assign` και όχι object literal με spread: το `{ ...item }` πάνω σε
    // generic `T` ΔΕΝ είναι εκχωρήσιμο στο `T` (γνωστός περιορισμός TS) και θα
    // απαιτούσε assertion. Το `Object.assign` δίνει `T & {...}`, που είναι.
    visible.push(Object.assign({}, item, { subItems: keptSubItems }));
  }

  return { visible, hiddenCount };
}

// =============================================================================
// ΠΛΑΚΙΔΙΑ DASHBOARD (§14.2) — ξεχωριστή λίστα, με μετρημένο λόγο
// =============================================================================

/**
 * ⚠️ ΓΙΑΤΙ ΤΑ ΠΛΑΚΙΔΙΑ ΔΕΝ ΠΑΡΑΓΟΝΤΑΙ ΑΠΟ ΤΙΣ ΔΙΑΔΡΟΜΕΣ (μετρημένο 2026-08-02):
 * οι δύο λίστες του μητρώου **διαφέρουν πραγματικά**. Οι Προμήθειες έχουν
 * `sidebar: ['/procurement']` και `dashboardTiles: []` — 1 διαδρομή, **0**
 * πλακίδια· ίδιο και η Διαχείριση (§14.4/3, «αληθινές αλλά ανώριμες»).
 * Παραγωγή από τις διαδρομές θα **εφεύρισκε** πλακίδια που δεν υπάρχουν.
 *
 * Ταυτότητα πλακιδίου = το `href` **χωρίς την αρχική κάθετο** — έτσι είναι ήδη
 * γραμμένο το μητρώο (`'dxf/viewer'`, `'buildings'`) και έτσι είναι γραμμένα τα
 * `href` του `DashboardHome` (`'/dxf/viewer'`). Η κανονικοποίηση ζει **εδώ**,
 * μία φορά, ώστε να μη σκορπιστεί σε κάθε καταναλωτή.
 */
export function tileIdFromHref(href: string): string {
  return href.startsWith('/') ? href.slice(1) : href;
}

/** Κάθε πλακίδιο που **κάποια** δουλειά διεκδικεί. Υπολογίζεται μία φορά. */
const CLASSIFIED_TILES: ReadonlySet<string> = new Set(
  JOB_ORDER.flatMap((job) => JOBS[job].dashboardTiles),
);

/**
 * Ανήκει το πλακίδιο στην ενεργή δουλειά; (§14.2)
 *
 * ⚠️ **Ο ΙΔΙΟΣ κανόνας με τις διαδρομές**, όχι παρόμοιος: αταξινόμητο ⇒ ορατό.
 * Δύο κανόνες για το ίδιο ερώτημα σημαίνει ότι το `/legal-documents` θα έμενε
 * στο sidebar και θα εξαφανιζόταν από την αρχική — η ίδια οθόνη να λέει δύο
 * διαφορετικά πράγματα για το ίδιο στοιχείο.
 */
export function isTileVisibleForJob(href: string, active: JobSelection): boolean {
  if (active === JOB_ALL) return true;
  const tileId = tileIdFromHref(href);
  if (COMMON_DASHBOARD_TILES.includes(tileId)) return true;
  if (!CLASSIFIED_TILES.has(tileId)) return true;
  return JOBS[active].dashboardTiles.includes(tileId);
}

/**
 * Το ίδιο συμβόλαιο με το `filterItemsByJob`, για τα πλακίδια.
 *
 * 🔴 ΤΟ `/legal-documents` **ΜΕΝΕΙ ΟΡΑΤΟ** — και είναι απόφαση, όχι παράλειψη.
 * Το πλακίδιό του οδηγεί σε **404** (`LEGAL_DOCUMENTS_STATUS`, Ε14.ε) και τα
 * `legal:*` είναι **ανεπίβλητα** (Π-13). Απόκρυψή του θα έκρυβε **το σφάλμα**,
 * όχι τα δεδομένα: ο εργάτης και ο προμηθευτής θα συνέχιζαν να διαβάζουν τα
 * συμβόλαια από το API. Κατά λέξη το **Ε14.στ** *(OWASP A01: «reliance on
 * client-side access check enforcement»)*. Όταν επιβληθεί το δικαίωμα, η
 * απόκρυψη θα έρθει **δωρεάν** από το φίλτρο permissions — πρότυπο Procore.
 */
export function filterTilesByJob<T extends { readonly href: string }>(
  tiles: readonly T[],
  active: JobSelection,
): JobFilterResult<T> {
  if (active === JOB_ALL) return { visible: tiles, hiddenCount: 0 };
  const visible = tiles.filter((tile) => isTileVisibleForJob(tile.href, active));
  return { visible, hiddenCount: tiles.length - visible.length };
}
