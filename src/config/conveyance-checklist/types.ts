/**
 * =============================================================================
 * Conveyance Checklist — Τύποι (ADR-901 §5.5)
 * =============================================================================
 *
 * Ο κατάλογος δικαιολογητικών μιας μεταβίβασης είναι **δεδομένα**, όχι κώδικας:
 * ο νόμος αλλάζει (ΗΤΚ, ΦΠΑ νεόδμητων, Ηλεκτρονικός Φάκελος Ακινήτου) και κάθε
 * διόρθωση πρέπει να γίνεται εδώ, χωρίς άγγιγμα σε component ή service.
 *
 * 🔑 Ο κατάλογος **ΑΝΤΙΣΤΟΙΧΙΖΕΙ**, δεν δημιουργεί κατηγορίες: κάθε γραμμή που
 *    ικανοποιείται από αρχεία δείχνει σε **υπάρχοντα** upload entry points
 *    (`src/config/upload-entry-points/`) και δηλώνει **σε ποιο επίπεδο** της
 *    ιεραρχίας ζουν (ADR-901 §2 Ε-Γ: οι μελέτες ζουν στο έργο, τα προσωπικά
 *    έγγραφα στην επαφή).
 *
 * Όλα τα σύνολα εδώ είναι **κλειστά** (`as const`) — ο κατάλογος, οι άγκυρες
 * και το UI ρωτούν το ίδιο λεξιλόγιο.
 *
 * @module config/conveyance-checklist/types
 * @see ADR-901 — «Οι υποθέσεις μου» (υπόθεση μεταβίβασης)
 */

// ============================================================================
// ΚΛΕΙΣΤΑ ΣΥΝΟΛΑ
// ============================================================================

/** Προφίλ καταλόγου — διαλέγει ποιες γραμμές ισχύουν (ADR-901 §3.2). */
export const CONVEYANCE_PROFILES = ['new_build_company', 'resale_private'] as const;
export type ConveyanceProfile = (typeof CONVEYANCE_PROFILES)[number];

/** Ρόλοι μέσα σε μια υπόθεση — ΘΕΣΕΙΣ, όχι auth ρόλοι (ADR-901 §9). */
const CONVEYANCE_ROLES = ['seller', 'buyer', 'seller_lawyer', 'buyer_lawyer', 'notary'] as const;
export type ConveyanceRole = (typeof CONVEYANCE_ROLES)[number];

/** Ενότητες καταλόγου — οι πίνακες Α/Β/Γ/Δ του ADR-901 §5.5. */
export const CHECKLIST_SECTIONS = ['property', 'seller', 'buyer', 'transaction'] as const;
export type ChecklistSection = (typeof CHECKLIST_SECTIONS)[number];

/** Ποιος παρέχει το έγγραφο. */
const CHECKLIST_PROVIDERS = [
  'seller', 'buyer', 'engineer', 'lawyer', 'notary', 'authority', 'bank',
] as const;
export type ChecklistProvider = (typeof CHECKLIST_PROVIDERS)[number];

/**
 * Πού ζουν τα αρχεία-τεκμήρια μιας γραμμής (ADR-901 §2 Ε-Γ, μετρημένο στον κώδικα):
 * - `property`       — η ίδια η μονάδα (`entityType: 'property'`)
 * - `appurtenance`   — παρακολουθήματα της πώλησης (θέση στάθμευσης / αποθήκη)
 * - `building`       — το κτίριο
 * - `project`        — το έργο (εκεί ζουν οι μελέτες και η οικοδομική άδεια)
 * - `seller_contact` — η επαφή του πωλητή (εταιρεία: `project.linkedCompanyId`)
 * - `buyer_contact`  — οι επαφές των αγοραστών (`commercial.owners`)
 * - `contribution`   — ό,τι **έστειλε** επαγγελματίας με transmittal (ADR-901 §5.8.1 · Φ4.4): το αρχείο ζει στον
 *                      **δικό του** χώρο (`entityType: 'conveyance_case'`) και γίνεται τεκμήριο **μόνο** μέσω
 *                      `conveyance_contributions` — ποτέ «αρχεία του επαγγελματία κατά οντότητα» (Α24)
 */
const EVIDENCE_LEVELS = [
  'property', 'appurtenance', 'building', 'project', 'seller_contact', 'buyer_contact', 'contribution',
] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

/**
 * Γεγονότα της υπόθεσης που ενεργοποιούν γραμμές υπό όρους. Όσα **παράγονται**
 * από τα δεδομένα δεν ρωτώνται ποτέ (`src/lib/conveyance/derive-facts.ts`)·
 * τα υπόλοιπα γίνονται ερωτήσεις προς τον χρήστη.
 */
export const CONVEYANCE_FACT_IDS = [
  'is_new_build',
  'seller_is_legal_entity',
  'has_antiparochi',
  'is_unit_in_multi_owner_building',
  'has_appurtenances',
  'existing_building_with_manager',
  'has_unauthorized_works',
  'seller_by_proxy',
  'buyer_has_mortgage',
  'first_home_exemption',
  'special_zone',
] as const;
export type ConveyanceFactId = (typeof CONVEYANCE_FACT_IDS)[number];

// ============================================================================
// ΣΧΗΜΑ ΓΡΑΜΜΗΣ
// ============================================================================

/** Υποχρεωτικότητα — `when` = ισχύει μόνο όταν το γεγονός έχει την τιμή. */
type ChecklistRequirement =
  | { readonly kind: 'mandatory' }
  | { readonly kind: 'when'; readonly fact: ConveyanceFactId; readonly equals: boolean };

/**
 * Ισχύς εγγράφου:
 * - `none`       — δεν λήγει (τίτλοι, άδειες, σχέδια)
 * - `days`       — λήγει N ημέρες μετά την έκδοση
 * - `act_day`    — εκδίδεται την ημέρα της πράξης (π.χ. πιστοποιητικό βαρών)
 * - `unverified` — έχει περιορισμένη ισχύ αλλά η διάρκεια **ΔΕΝ** επαληθεύτηκε (Φ0, §11)
 */
type ChecklistValidity =
  | { readonly kind: 'none' }
  | { readonly kind: 'days'; readonly days: number }
  | { readonly kind: 'act_day' }
  | { readonly kind: 'unverified' };

/** Ένα επίπεδο + τα entry points που ικανοποιούν τη γραμμή σε αυτό (any-of). */
export interface EvidenceMatcher {
  readonly level: EvidenceLevel;
  readonly entryPointIds: readonly string[];
}

/**
 * Πώς ικανοποιείται μια γραμμή:
 * - `files`         — από υπάρχοντα αρχεία. `notaryFallback` ⇒ αν λείπει, το εκδίδει ο
 *                     συμβολαιογράφος (κατάσταση `notary_side`, όχι `missing`)
 * - `notary_issued` — το εκδίδει ο συμβολαιογράφος (Ηλ. Φάκελος) — ο πολίτης ΔΕΝ το κυνηγά
 * - `offline`       — **ρητή** δήλωση: δεν υπάρχει ακόμη entry point· παρακολουθείται με
 *                     χειροκίνητη επιβεβαίωση. Ποτέ σιωπηλό ορφανό (άγκυρα Α7).
 */
export type ChecklistSatisfaction =
  | { readonly kind: 'files'; readonly matchers: readonly EvidenceMatcher[]; readonly notaryFallback?: true }
  | { readonly kind: 'notary_issued' }
  | { readonly kind: 'offline' };

/** Μία γραμμή του καταλόγου. */
export interface ChecklistItem {
  /** Σταθερό αναγνωριστικό — αποθηκεύεται στις αποκλίσεις της υπόθεσης. ΠΟΤΕ μετονομασία. */
  readonly id: string;
  readonly section: ChecklistSection;
  /** Κλειδί i18n στο namespace `conveyance` (`items.<id>.label`). */
  readonly labelKey: string;
  readonly provider: ChecklistProvider;
  /** Ποιοι ρόλοι βλέπουν τη γραμμή και τα αρχεία της (ελαχιστοποίηση, ADR-901 §5.10). */
  readonly visibleTo: readonly ConveyanceRole[];
  /** Ορατό **μόνο** στη δική του πλευρά (έκθεση νομικού ελέγχου — Σ-3). */
  readonly ownSideOnly?: true;
  readonly requirement: ChecklistRequirement;
  readonly validity: ChecklistValidity;
  readonly satisfaction: ChecklistSatisfaction;
  /**
   * Πότε επαλήθευσε τη γραμμή επαγγελματίας (συμβολαιογράφος/δικηγόρος, ADR-901 §11).
   * `null` = v0 από δευτερογενείς πηγές — το UI το δηλώνει.
   */
  readonly verifiedAt: string | null;
}

/** Διαδικασία (όψη του καταλόγου) — καταναλωτής: AI knowledge base (ADR-257 / SPEC-257G). */
const PROCEDURE_CATEGORIES = ['sale', 'finance', 'transfer'] as const;
export type ProcedureCategory = (typeof PROCEDURE_CATEGORIES)[number];

export interface ConveyanceProcedure {
  readonly id: string;
  readonly category: ProcedureCategory;
  /** Λέξεις-κλειδιά (πεζά ελληνικά) για αντιστοίχιση ερωτήματος — όχι κείμενο UI. */
  readonly keywords: readonly string[];
  /** Οι γραμμές του καταλόγου που απαιτεί η διαδικασία. */
  readonly itemIds: readonly string[];
}
