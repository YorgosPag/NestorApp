/**
 * ADR-748 Φάση 3.6 — Η **ΟΡΑΤΟΤΗΤΑ**: «τι δείχνει η ενεργή δουλειά».
 *
 * ΚΑΘΑΡΗ ΣΥΝΑΡΤΗΣΗ. Μηδέν I/O, μηδέν React — όπως και το `jobs-access.ts`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ (Φάση 3.6)
 *
 * Το `jobs-access.ts` έφτασε στις **497/500** γραμμές απαντώντας σε **δύο**
 * διαφορετικές ερωτήσεις:
 *
 *   1. «**Ποιες δουλειές έχει ο Χ;**»   → απόφαση δικαιωμάτων  → `jobs-access.ts`
 *   2. «**Τι δείχνει η ενεργή δουλειά;**» → ετικέτα ορατότητας  → **εδώ**
 *
 * Το σύνορο δεν το εφηύρε η Φάση 3.6 — ήταν ήδη χαραγμένο ως κεφαλίδα ενότητας
 * μέσα στο αρχείο. Η εξαγωγή απλώς το έκανε δομικό. 🔒 **Η εξάρτηση είναι
 * μονόδρομη**: ορατότητα → απόφαση → μητρώο. Ποτέ ανάποδα.
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΙ ΑΛΛΑΞΕ ΟΥΣΙΑΣΤΙΚΑ ΣΤΗ ΦΑΣΗ 3.6: ΤΟ ΦΙΛΤΡΟ ΔΕΝ ΠΕΤΑΕΙ ΠΙΑ Ο,ΤΙ ΚΟΒΕΙ
 *
 * Μέχρι τη Φάση 3 το φίλτρο **γνώριζε** ακριβώς τι έκοβε και το **πετούσε**,
 * κρατώντας μόνο έναν αριθμό. Αυτό κόστισε δύο φορές:
 *
 *   • ο αριθμός μπορούσε να **αποκλίνει** από τη λίστα (το ελάττωμα των 17:13:
 *     δύο μονοπάτια αύξαναν τον ίδιο μετρητή με **διαφορετική** μονάδα ⇒ 22
 *     αντί για 9)· και
 *   • τα **13** υπο-στοιχεία που κλαδεύονται μέσα σε **ΟΡΑΤΟΥΣ** γονείς δεν
 *     μπορούσαν να αναφερθούν **πουθενά**, γιατί δεν υπήρχε τίποτα να δείξεις.
 *
 * Τώρα το αποτέλεσμα μεταφέρει **τα ίδια τα στοιχεία** (`hidden`,
 * `hiddenSubItems`) και το `hiddenCount` είναι **`hidden.length`**, παραγόμενο
 * σε **ΕΝΑ** σημείο (`buildResult`). Η αναλλοίωτη του anchor **Μ-7**
 * — `hiddenCount === items.length - visible.length` — παύει να είναι κάτι που
 * ένα test *ελέγχει* και γίνεται κάτι που ο κώδικας **δεν μπορεί να ψεύσει**.
 *
 * Και ξεκλειδώνει και τα τρία επίπεδα του δείκτη (§14.7):
 *   Επίπεδο 1 — `hiddenCount`                → ο δείκτης της κεφαλίδας
 *   Επίπεδο 2 — `hiddenSubItems.get(id)`     → «+7 κρυμμένα» μέσα στην ομάδα
 *   Επίπεδο 3 — και τα δύο μαζί              → «Αποκάλυψη κρυμμένων»
 * ─────────────────────────────────────────────────────────────────────────────
 * ΟΝΟΜΑΤΟΛΟΓΙΑ (Ε6.στ, Π-9): `Job` = ΔΟΥΛΕΙΑ. `Workspace` = ΟΡΓΑΝΙΣΜΟΣ.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-748-role-based-workspaces.md §14
 * @see src/config/jobs-access.ts — η **απόφαση**· εδώ ζει μόνο η **ορατότητα**
 */

import {
  COMMON_DASHBOARD_TILES,
  COMMON_SIDEBAR_NODES,
  JOBS,
  JOB_ORDER,
  REPORT_SOURCES,
  type JobId,
} from './jobs-registry';
import { JOB_ALL, type JobSelection } from './jobs-access';
import {
  isNavGroup,
  navNodeKey,
  withGroupItems,
  type NavGroupNode,
  type NavLinkNode,
} from './navigation-node';
import type { OfficeGroupId } from './office-navigation/catalog-types';

// =============================================================================
// ΟΡΑΤΟΤΗΤΑ ΔΙΑΔΡΟΜΩΝ — η ετικέτα, όχι το δικαίωμα (§14.5)
// =============================================================================

/**
 * Ανήκει ο κόμβος (σύνδεσμος ή ομάδα, `navNodeKey`) στην ενεργή δουλειά;
 *
 * ⚠️ ΔΕΝ απαντά «δικαιούται ο χρήστης τη διαδρομή» — αυτό το απαντά η
 * μηχανή του καταλόγου που **ήδη τρέχει** (`office-navigation/resolve-office-navigation.ts`).
 * Τα δύο φίλτρα είναι **διαδοχικά και ανεξάρτητα** (§14.5): ένα στοιχείο
 * εμφανίζεται όταν *(α)* ανήκει στην ενεργή δουλειά **ΚΑΙ** *(β)* ο έλεγχος
 * δικαιωμάτων το έχει ήδη επιτρέψει.
 */
export function isNodeVisibleForJob(key: string, active: JobSelection): boolean {
  if (active === JOB_ALL) return true;
  if (COMMON_NODES.has(key)) return true;
  if (isCrossCuttingNode(key)) return true;
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
  if (!CLASSIFIED_SIDEBAR_NODES.has(key)) return true;
  return jobClaims(active, key);
}

/**
 * Διεκδικεί η δουλειά τον κόμβο; Το `readonly SidebarNodeKey[]` διαβάζεται ως
 * `readonly string[]` (ασφαλής, συμμεταβλητή διεύρυνση — όχι `as`), γιατί το ερώτημα
 * έρχεται από τον κατάλογο ως σκέτο κλειδί.
 */
function jobClaims(job: JobId, key: string): boolean {
  const claimed: readonly string[] = JOBS[job].sidebar;
  return claimed.includes(key);
}

/** Κάθε κόμβος που **κάποια** δουλειά διεκδικεί. Υπολογίζεται μία φορά. */
const CLASSIFIED_SIDEBAR_NODES: ReadonlySet<string> = new Set(
  JOB_ORDER.flatMap((job) => JOBS[job].sidebar),
);

/** Οι κοινοί κόμβοι, ως σύνολο — το ερώτημα έρχεται ως σκέτο κλειδί. */
const COMMON_NODES: ReadonlySet<string> = new Set(COMMON_SIDEBAR_NODES);

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
function isAlwaysVisibleNode(key: string): boolean {
  return COMMON_NODES.has(key) || isCrossCuttingNode(key);
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
  if (isAlwaysVisibleNode(subRoute)) return true;
  if (!CLASSIFIED_SIDEBAR_NODES.has(subRoute)) return true;
  return jobClaims(active, subRoute);
}

/**
 * Τα **εγκάρσια**: μένουν ορατά σε **κάθε** δουλειά (Ε14.α).
 *
 * 🔴 Μετρημένος λόγος να ΜΗΝ φιλτράρεται η ομάδα `reports`: το
 * `reports:reports:view` το έχουν **μόνο** `project_manager`, `site_manager`,
 * `accountant`, `viewer` — **όχι** ο `company_admin` (Π-14). Φίλτρο στον γονιό
 * θα έκρυβε τις αναφορές από τον διαχειριστή της εταιρείας.
 */
export function isCrossCuttingNode(key: string): boolean {
  return key === REPORTS_GROUP_ID;
}

/**
 * Η ομάδα των αναφορών. Μία φορά γραμμένη (το `REPORT_SOURCES` δίνει παιδιά). Ήταν
 * «ο γονιός `/reports`» — η ομάδα όμως **δεν έχει** διαδρομή (ADR-871 §10.6 Υ13/Υ14).
 */
export const REPORTS_GROUP_ID = 'reports' as const satisfies OfficeGroupId;

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
  return isNodeVisibleForJob(source.node, active);
}

// =============================================================================
// ΤΟ ΦΙΛΤΡΟ — μία συνάρτηση, χρησιμοποιείται από sidebar ΚΑΙ dashboard
// =============================================================================

/**
 * Το φίλτρο της στήλης δέχεται σύνδεσμο **ή** ομάδα (`navigation-node.ts`, ADR-871 §10.6
 * Υ13) — γενικό επίτηδες: το συμβόλαιο απόδοσης (`MenuLink`/`MenuGroup`) το ικανοποιεί
 * **χωρίς** να μπει τύπος UI σε αυτό το καθαρό αρχείο. Τα πλακίδια του dashboard έχουν
 * δικό τους, πιο απλό φίλτρο (`filterTilesByJob`).
 *
 * @typeParam T — τα στοιχεία **αυτού** του επιπέδου (σύνδεσμοι + ομάδες, ή πλακίδια)
 * @typeParam L — τα **παιδιά** των ομάδων (πάντα σύνδεσμοι)
 */
export interface JobFilterResult<T, L = T> {
  readonly visible: readonly T[];
  /**
   * Ε14.ιβ — **τα στοιχεία που έφυγαν από ΑΥΤΟ το επίπεδο**, όχι φύλλα του
   * δέντρου. Ένας κλάδος με 11 παιδιά που φεύγει είναι **ένα** στοιχείο εδώ.
   *
   * 🔑 Δεν είναι μόνο για μέτρημα: είναι το **υλικό της «Αποκάλυψης»**
   * (Επίπεδο 3) — τα ίδια αντικείμενα ξαναμπαίνουν στη θέση τους
   * υποβαθμισμένα, όπως το `Reveal Hidden Elements` του Revit.
   */
  readonly hidden: readonly T[];
  /**
   * Τα κλαδεμένα παιδιά **ΟΡΑΤΩΝ** ομάδων, με κλειδί το `id` της ομάδας.
   *
   * ⚠️ Αυτά **ΔΕΝ** μετρώνται στο `hiddenCount` — και είναι απόφαση, όχι
   * παράλειψη (Ε14.ιβ): ο χρήστης βλέπει τον γονιό στη θέση του, άρα δεν
   * «έχασε» εννιά στοιχεία από την οθόνη του. Ο δείκτης τους ζει **μέσα** στο
   * ανοιγμένο δοχείο (Επίπεδο 2), εκεί που αφορά.
   */
  readonly hiddenSubItems: ReadonlyMap<string, readonly L[]>;
  /**
   * Α-3/Ε5.ε: πόσα κρύφτηκαν — **ποτέ σιωπηλή απόκρυψη**.
   *
   * 🔒 **Παράγεται ΠΑΝΤΑ ως `hidden.length`, σε ένα σημείο (`buildResult`).**
   * Δεν είναι ανεξάρτητος μετρητής που μπορεί να αποκλίνει από τη λίστα — και
   * αυτή ακριβώς η απόκλιση ήταν το ελάττωμα των 17:13 (22 αντί για 9).
   */
  readonly hiddenCount: number;
}

/**
 * 🔒 **ΤΟ ΜΟΝΑΔΙΚΟ ΣΗΜΕΙΟ ΠΟΥ ΓΕΝΝΑΕΙ `JobFilterResult`.**
 *
 * Όσο κάθε επιστροφή περνά από εδώ, το «ο αριθμός συμφωνεί με τη λίστα» παύει
 * να είναι σύμβαση που τηρείς και γίνεται ιδιότητα που **ισχύει**.
 */
function buildResult<T, L = T>(
  visible: readonly T[],
  hidden: readonly T[],
  hiddenSubItems: ReadonlyMap<string, readonly L[]>,
): JobFilterResult<T, L> {
  return { visible, hidden, hiddenSubItems, hiddenCount: hidden.length };
}

const NO_HIDDEN_SUB_ITEMS: ReadonlyMap<string, readonly never[]> = new Map();

/** «Καμία ενεργή δουλειά» ⇒ τίποτα δεν κρύβεται. Μία γραμμή, τρεις καλούντες. */
function unfiltered<T, L = T>(items: readonly T[]): JobFilterResult<T, L> {
  return buildResult<T, L>(items, [], NO_HIDDEN_SUB_ITEMS);
}

/** Οι τρεις τύχες ενός κλάδου πρώτου επιπέδου. */
type BranchOutcome = 'visible' | 'rescued' | 'hidden';

/**
 * 🔑 Η ΟΜΑΔΑ ΕΙΝΑΙ ΔΟΧΕΙΟ — αλλά **ΜΟΝΟ ρητά κοινό παιδί** την κρατά ζωντανή
 * όταν η ίδια ανήκει αλλού (Ε14.ι). Το `/obligations` δηλώνεται κοινό σε όλες
 * τις δουλειές και ζει αποκλειστικά μέσα στην ομάδα `legal`: χωρίς αυτόν τον
 * κανόνα εξαφανίζεται μαζί της.
 */
function classifyBranch<L extends NavLinkNode, G extends NavGroupNode<L>>(
  entry: L | G,
  active: JobSelection,
): BranchOutcome {
  if (isNodeVisibleForJob(navNodeKey(entry), active)) return 'visible';
  if (!isNavGroup<L, G>(entry)) return 'hidden';
  return entry.items.some((sub) => isAlwaysVisibleNode(sub.href)) ? 'rescued' : 'hidden';
}

/** Η ερώτηση που κρίνει ένα παιδί — διαφορετική ανά είδος ομάδας. */
function keepSubItem(
  sub: NavLinkNode,
  groupId: string,
  outcome: BranchOutcome,
  active: JobSelection,
): boolean {
  if (groupId === REPORTS_GROUP_ID) return isReportSubItemVisibleForJob(sub.href, active);
  // Η ομάδα σώθηκε χάρη σε κοινό παιδί ⇒ κρατάμε **μόνο** τα κοινά: τα
  // υπόλοιπα κληρονομούν την ομάδα, που δεν ανήκει εδώ.
  if (outcome === 'rescued') return isAlwaysVisibleNode(sub.href);
  return isSubItemVisibleForJob(sub.href, active);
}

/**
 * Φιλτράρει σύνδεσμους **και** ομάδες, και **κρατά** ό,τι έφυγε. Η ομάδα
 * `reports` επιβιώνει πάντα· τα παιδιά της κληρονομούν (Ε14.α/Ε14.β) — γι' αυτό ο
 * ίδιος βρόχος ρωτά διαφορετική ερώτηση ανά επίπεδο αντί να αντιγράφει ταξινόμηση.
 *
 * 🔑 **Ορατή ομάδα που άδειασε ΜΕΤΡΑΕΙ ΣΤΑ ΚΡΥΜΜΕΝΑ** (ADR-871 §10.6 Υ19): δεν
 * αποδίδεται (κουμπί που ανοίγει το τίποτα), άρα **λείπει** από την οθόνη — και ο
 * δείκτης «Χ κρυμμένα» οφείλει να το πει. Ο κανόνας «κενή» είναι ο ένας `withGroupItems`.
 */
export function filterItemsByJob<L extends NavLinkNode, G extends NavGroupNode<L>>(
  items: readonly (L | G)[],
  active: JobSelection,
): JobFilterResult<L | G, L> {
  if (active === JOB_ALL) return unfiltered<L | G, L>(items);

  const visible: (L | G)[] = [];
  const hidden: (L | G)[] = [];
  const hiddenSubItems = new Map<string, readonly L[]>();

  for (const entry of items) {
    const outcome = classifyBranch<L, G>(entry, active);
    if (outcome === 'hidden') {
      hidden.push(entry);
    } else if (!isNavGroup<L, G>(entry)) {
      visible.push(entry);
    } else {
      const kept: L[] = [];
      const pruned: L[] = [];
      for (const sub of entry.items) {
        (keepSubItem(sub, entry.id, outcome, active) ? kept : pruned).push(sub);
      }
      const group = withGroupItems<L, G>(entry, kept);
      if (group === null) {
        hidden.push(entry);
        continue;
      }
      if (pruned.length > 0) hiddenSubItems.set(entry.id, pruned);
      visible.push(group);
    }
  }

  return buildResult(visible, hidden, hiddenSubItems);
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
  if (active === JOB_ALL) return unfiltered(tiles);

  const visible: T[] = [];
  const hidden: T[] = [];
  for (const tile of tiles) {
    (isTileVisibleForJob(tile.href, active) ? visible : hidden).push(tile);
  }
  return buildResult(visible, hidden, NO_HIDDEN_SUB_ITEMS);
}

// =============================================================================
// Η ΣΥΝΟΨΗ — ό,τι χρειάζονται τα τρία επίπεδα του δείκτη, από ΕΝΑ σημείο
// =============================================================================

/**
 * Η σύνοψη πολλών φίλτρων μαζί *(το sidebar τρέχει **τρία**: κύριο, εργαλεία,
 * ρυθμίσεις)*.
 *
 * ⚠️ ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΟΝ HOOK: η ένωση των τριών αποτελεσμάτων είναι
 * **αριθμητική λογική**, όχι React. Στον hook θα ήταν αδοκίμαστη χωρίς
 * render· εδώ ελέγχεται με καθαρές κλήσεις. Είναι ο ίδιος λόγος που το φίλτρο
 * ζει σε `config/` και όχι μέσα στο `AppSidebar`.
 */
export interface JobHiddenSummary {
  /** Επίπεδο 1 — ο δείκτης της κεφαλίδας. Κλάδοι που λείπουν από την οθόνη. */
  readonly hiddenCount: number;
  /** Επίπεδο 1 (ανάλυση tooltip) — τα υπο-στοιχεία μέσα σε ΟΡΑΤΟΥΣ γονείς. */
  readonly hiddenSubItemCount: number;
  /** Επίπεδο 2 — πόσα λείπουν **ανά δοχείο**, με κλειδί το `id` της ομάδας. */
  readonly hiddenSubItemCountByParent: ReadonlyMap<string, number>;
  /**
   * Επίπεδο 3 — κάθε **κλειδί κόμβου** (`navNodeKey`: href συνδέσμου, id ομάδας) που
   * το φίλτρο έκρυψε, σε **οποιοδήποτε** επίπεδο.
   *
   * Ένα `Set` και όχι σημαία πάνω στα ίδια τα στοιχεία: σημαία θα μόλυνε τον
   * τύπο `MenuEntry` με πεδίο που αφορά **μόνο** τον τρόπο «Αποκάλυψη», και θα
   * ταξίδευε σε κάθε καταναλωτή της πλοήγησης χωρίς λόγο.
   */
  readonly hiddenKeys: ReadonlySet<string>;
}

export function summarizeHidden<L extends NavLinkNode, G extends NavGroupNode<L>>(
  results: readonly JobFilterResult<L | G, L>[],
): JobHiddenSummary {
  let hiddenCount = 0;
  let hiddenSubItemCount = 0;
  const hiddenSubItemCountByParent = new Map<string, number>();
  const hiddenKeys = new Set<string>();

  for (const result of results) {
    hiddenCount += result.hiddenCount;
    for (const entry of result.hidden) hiddenKeys.add(navNodeKey(entry));

    for (const [groupId, pruned] of result.hiddenSubItems) {
      hiddenSubItemCount += pruned.length;
      hiddenSubItemCountByParent.set(
        groupId,
        (hiddenSubItemCountByParent.get(groupId) ?? 0) + pruned.length,
      );
      for (const sub of pruned) hiddenKeys.add(sub.href);
    }
  }

  return { hiddenCount, hiddenSubItemCount, hiddenSubItemCountByParent, hiddenKeys };
}
