/**
 * Verifiable Quantity Envelope (VQE) — Contract
 *
 * Ο φάκελος μεταφοράς που τυλίγει ΚΑΘΕ ποσοτικό αποτέλεσμα το οποίο φεύγει από
 * τον Νέστορα προς πράκτορα ΤΝ. Δεν είναι νέο πρότυπο· είναι η σύνθεση τεσσάρων
 * υφιστάμενων σε ένα σχήμα MCP `structuredContent`:
 *
 * | Ερώτηση                  | Πρότυπο                        | Πεδίο        |
 * |--------------------------|--------------------------------|--------------|
 * | Με ποιον κανόνα μετρήθηκε; | buildingSMART IDS 1.0 · ICMS 3 | `basis`      |
 * | Από πού βγήκε;            | W3C PROV-O / PROV-DM           | `provenance` |
 * | Πόσο δεσμευτικό είναι;    | ISO 19650                      | `governance` |
 * | Αναπαράγεται;             | content addressing (sha256)    | `integrity`  |
 *
 * **Αιτιολόγηση:** ένας αριθμός χωρίς προέλευση, κανόνα μέτρησης και κατάσταση
 * έγκρισης δεν είναι επιμέτρηση — είναι γνώμη. Όταν ο παραλήπτης είναι LLM που
 * θα τον παρουσιάσει σε άνθρωπο που θα τον **υπογράψει**, η διάκριση είναι
 * νομική, όχι αισθητική.
 *
 * ⚠️ ΠΟΤΕ δεν αποθηκεύεται στη Firestore — υπολογίζεται at runtime, όπως το
 * `CostBreakdown` (ADR-175).
 *
 * @module types/vqe/envelope
 * @see ADR-734 §6 (Verifiable Quantity Envelope)
 */

import type {
  BOQItemStatus,
  BOQMeasurementUnit,
  BOQScope,
  CostAllocationMethod,
} from '@/types/boq';
// Type-only import: το `AllocationWarning` είναι το SSoT των κωδικών επιμερισμού
// κόστους (ADR-329 §3.7.2) και ζει δίπλα στη συνάρτηση που τους παράγει. Το
// ενσωματώνουμε αντί να το αντιγράψουμε — βλ. `EnvelopeWarning`. `import type`
// ⇒ σβήνεται στο compile, μηδενική σύζευξη runtime με το service layer.
import type { AllocationWarning } from '@/services/measurements/cost-engine';

// ============================================================================
// ΕΚΔΟΣΗ ΣΧΗΜΑΤΟΣ
// ============================================================================

/**
 * Έκδοση του **σχήματος του φακέλου** (όχι της υπολογιστικής μηχανής — αυτή
 * ζει στο `IntegrityRecord.engineVersion`). Οι MCP clients τη διαβάζουν για να
 * ξέρουν πώς να διαβάσουν το `structuredContent`. Αυξάνεται σε breaking αλλαγή
 * πεδίων.
 */
export const VQE_SCHEMA_VERSION = '1.0.0';

// ============================================================================
// ΠΡΟΕΙΔΟΠΟΙΗΣΕΙΣ
// ============================================================================

/**
 * Κωδικοί προειδοποίησης που παράγει ο ίδιος ο φάκελος (σε αντίθεση με τις
 * `AllocationWarning` που παράγει η μηχανή επιμερισμού).
 *
 * Είναι **κωδικοί μηχανής**, όχι κείμενο χρήστη — καμία υποχρέωση i18n εδώ
 * (ίδιο μοτίβο με το `AllocationWarning.type`). Το UI/LLM τους μεταφράζει.
 */
export type EnvelopeWarningCode =
  /** Το σύνολο πηγής είναι κενό — ο αριθμός είναι άθροισμα του τίποτα. */
  | 'no_source_items'
  /** Το ίδιο item εμφανίστηκε >1 φορά — πιθανή διπλομέτρηση στο `value`. */
  | 'duplicate_source_items'
  /** Το σύνολο περιέχει >1 καταστάσεις — το `effectiveStatus` είναι το χαμηλότερο. */
  | 'mixed_governance_status'
  /** Item με μη αναγνωρίσιμο status — το σύνολο υποβαθμίστηκε (fail-closed). */
  | 'unknown_governance_status'
  /** Μη πεπερασμένη αριθμητική τιμή (NaN/Infinity) σε πεδίο πηγής. */
  | 'non_finite_quantity'
  /** Το live BIM μοντέλο αποκλίνει από το υπογεγραμμένο baseline (ADR-674). */
  | 'baseline_drift_present'
  /** Πεδίο βάσης μέτρησης δεν είναι ενιαίο στο σύνολο ⇒ επιστράφηκε `null`. */
  | 'non_uniform_measurement_basis';

/**
 * Οι ίδιοι κωδικοί σε **χρόνο εκτέλεσης**, για το `outputSchema` των adapters.
 * `Record<EnvelopeWarningCode, true>` ⇒ νέος κωδικός σπάει τη μεταγλώττιση εδώ.
 */
const ENVELOPE_WARNING_CODE_PRESENCE: Readonly<Record<EnvelopeWarningCode, true>> = {
  no_source_items: true,
  duplicate_source_items: true,
  mixed_governance_status: true,
  unknown_governance_status: true,
  non_finite_quantity: true,
  baseline_drift_present: true,
  non_uniform_measurement_basis: true,
};

/** Κατάλογος κωδικών προειδοποίησης φακέλου — παράγεται, δεν ξαναγράφεται. */
export const ENVELOPE_WARNING_CODES: readonly EnvelopeWarningCode[] =
  Object.keys(ENVELOPE_WARNING_CODE_PRESENCE) as EnvelopeWarningCode[];

/** Προειδοποίηση που γεννήθηκε στο στρώμα του φακέλου. */
export interface EnvelopeIssue {
  readonly source: 'envelope';
  readonly code: EnvelopeWarningCode;
  /** Ids των υπαίτιων items (ταξινομημένα κατά code unit). Απόν = αφορά όλο το σύνολο. */
  readonly itemIds?: readonly string[];
  /** Όνομα πεδίου (κλειδί `BOQItem` ή `MeasurementBasis`) που αφορά το εύρημα. */
  readonly field?: string;
  /** Κανονικοποιημένη αποτύπωση της υπαίτιας τιμής. Ποτέ πρόζα, ποτέ user-facing. */
  readonly rawValue?: string;
}

/**
 * Προειδοποίηση επιμερισμού κόστους, **ενσωματωμένη** από το υπάρχον SSoT.
 * Οι κωδικοί ΔΕΝ αντιγράφονται εδώ — αν προστεθεί νέος στο `AllocationWarning`,
 * ισχύει αυτόματα και μέσα στον φάκελο.
 */
export interface AllocationIssue {
  readonly source: 'allocation';
  readonly detail: AllocationWarning;
}

/** Ενοποιημένη προειδοποίηση φακέλου — διακριτή ένωση κατά `source`. */
export type EnvelopeWarning = EnvelopeIssue | AllocationIssue;

// ============================================================================
// ΒΑΣΗ ΜΕΤΡΗΣΗΣ — «με ποιον κανόνα μετρήθηκε;»
// ============================================================================

/**
 * buildingSMART IDS + ICMS 3 + ΑΤΟΕ.
 *
 * ⚠️ **Όλα τα πεδία είναι nullable** και παράγονται από τα ίδια τα items, ποτέ
 * από δήλωση του καλούντος. `null` σημαίνει «το σύνολο ΔΕΝ είναι ενιαίο ως προς
 * αυτό το πεδίο» (π.χ. σύνοψη κτιρίου με m³ σκυρόδεμα ΚΑΙ kg χάλυβα).
 * Απόκλιση από το ADR-734 §6.2 που τα είχε non-null — βλ. changelog §13:
 * ένα ενιαίο `unit` σε ετερογενές σύνολο θα ήταν **ψέμα**, και το κύριο
 * ζητούμενο του φακέλου είναι να μη λέει ψέματα.
 */
export interface MeasurementBasis {
  /** Κατηγορία ΑΤΟΕ, όταν ενιαία σε όλο το σύνολο. */
  readonly atoeCategoryCode: string | null;
  /** Μονάδα μέτρησης, όταν ενιαία (SSoT: `types/boq`). */
  readonly unit: BOQMeasurementUnit | null;
  /** Εύρος (ADR-329), όταν ενιαίο. */
  readonly scope: BOQScope | null;
  /** Συντελεστής φύρας (ADR-175 §4.1.4), όταν ενιαίος. */
  readonly wasteFactorApplied: number | null;
  /** Μέθοδος επιμερισμού κόστους (ADR-329 §3.1.1), όταν ενιαία. */
  readonly costAllocationMethod: CostAllocationMethod | null;
  /** ICMS 3 κωδικός — δηλώνεται από τον καλούντα· κενό μέχρι τη Φάση 3. */
  readonly icmsCode: string | null;
}

// ============================================================================
// ΠΡΟΕΛΕΥΣΗ — «από πού βγήκε;»
// ============================================================================

/**
 * Ρητός κατάλογος υπολογιστικών δραστηριοτήτων (PROV-O `prov:Activity`).
 *
 * Σκόπιμα **κλειστή ένωση** και όχι `string`: η προέλευση ενός αριθμού που θα
 * υπογραφεί δεν επιτρέπεται να περιέχει τυπογραφικό λάθος. Νέο εργαλείο ⇒
 * ρητή προσθήκη εδώ. Είναι το ανάλογο του Figma Code Connect: ο πράκτορας δεν
 * *μαντεύει* τι παρήγαγε την τιμή — του δηλώνεται.
 */
export type ProvenanceActivity =
  | 'cost-engine.computeItemCost'
  | 'cost-engine.computeVariance'
  | 'cost-engine.computeBaselineDrift'
  | 'cost-engine.computeBuildingSummary'
  | 'cost-engine.allocateCost'
  | 'boq-service.search'
  | 'boq-service.getById'
  | 'boq-service.getStatistics'
  | 'boq-service.getCategories';

/**
 * Οι ίδιες δραστηριότητες σε **χρόνο εκτέλεσης** — τις χρειάζονται τα adapters
 * για να δηλώσουν `enum` στο `outputSchema` που βλέπουν οι MCP clients.
 *
 * ⚠️ Ο τύπος `Record<ProvenanceActivity, true>` είναι σκόπιμος: νέα τιμή στην
 * κλειστή ένωση σπάει **εδώ** τη μεταγλώττιση. Καμία σιωπηλή απόκλιση μεταξύ
 * του τύπου και του σχήματος που δημοσιεύεται προς τα έξω (ίδιο μοτίβο με το
 * `BOQ_STATUS_RANK` του `types/boq/lifecycle.ts`).
 */
const PROVENANCE_ACTIVITY_PRESENCE: Readonly<Record<ProvenanceActivity, true>> = {
  'cost-engine.computeItemCost': true,
  'cost-engine.computeVariance': true,
  'cost-engine.computeBaselineDrift': true,
  'cost-engine.computeBuildingSummary': true,
  'cost-engine.allocateCost': true,
  'boq-service.search': true,
  'boq-service.getById': true,
  'boq-service.getStatistics': true,
  'boq-service.getCategories': true,
};

/** Κατάλογος δραστηριοτήτων — παράγεται, δεν ξαναγράφεται. */
export const PROVENANCE_ACTIVITIES: readonly ProvenanceActivity[] =
  Object.keys(PROVENANCE_ACTIVITY_PRESENCE) as ProvenanceActivity[];

/** W3C PROV-O aligned ίχνος παραγωγής. */
export interface ProvenanceRecord {
  /** `prov:Entity` — τα BOQ items που συνεισέφεραν (μοναδικά, ταξινομημένα). */
  readonly sourceItemIds: readonly string[];
  /** `prov:wasDerivedFrom` — BIM entity ids, όταν η ποσότητα προήλθε από γεωμετρία. */
  readonly sourceEntityIds: readonly string[];
  /** `prov:Activity` — ποια συνάρτηση παρήγαγε την τιμή. */
  readonly computedBy: ProvenanceActivity;
  /** `prov:atTime` — ISO 8601. ΔΕΝ συμμετέχει στο `inputsHash`. */
  readonly computedAt: string;
  /** Προειδοποιήσεις υπολογισμού, σε ντετερμινιστική σειρά. */
  readonly warnings: readonly EnvelopeWarning[];
}

// ============================================================================
// ΔΙΑΚΥΒΕΡΝΗΣΗ — «πόσο δεσμευτικό είναι;»
// ============================================================================

/**
 * Συγκεντρωτική απόκλιση live BIM μοντέλου από το ΠΑΓΩΜΕΝΟ υπογεγραμμένο
 * baseline (ADR-674). Το `BaselineDriftResult` του `types/boq/cost` είναι
 * **ανά item**· αυτό είναι η σύνοψη του συνόλου.
 *
 * `null` στο `GovernanceRecord.baselineDrift` σημαίνει «κανένα item δεν
 * παρακολουθείται» — ΔΙΑΦΟΡΕΤΙΚΟ από `driftedItemCount: 0` που σημαίνει
 * «ελέγχθηκαν και δεν αποκλίνουν». Η διάκριση είναι ουσιώδης για πράκτορα που
 * παρουσιάζει αριθμό προς υπογραφή.
 */
export interface BaselineDriftSummary {
  /** Πλήθος items με `liveQuantity` καταγεγραμμένο (παρακολουθούμενα). */
  readonly trackedItemCount: number;
  /** Πλήθος items όπου live ≠ baseline. */
  readonly driftedItemCount: number;
  /** Συνολικό πλήθος items του συνόλου. */
  readonly totalItemCount: number;
  /** Μέγιστη απόλυτη ποσοστιαία απόκλιση (μονάδο-ανεξάρτητη ⇒ πάντα ασφαλής). */
  readonly maxAbsPercent: number;
  /**
   * Άθροισμα αποκλίσεων σε μονάδες ποσότητας — **μόνο** όταν το σύνολο έχει
   * ενιαία μονάδα (`MeasurementBasis.unit !== null`). Αλλιώς `null`:
   * m³ + kg δεν αθροίζονται.
   */
  readonly netQuantityDelta: number | null;
  /** Το item με τη μεγαλύτερη απόλυτη ποσοστιαία απόκλιση. */
  readonly worstItemId: string | null;
  /** Πιο πρόσφατο `liveQuantitySyncedAt` του συνόλου (ISO 8601 UTC). */
  readonly latestSyncedAt: string | null;
}

/** ISO 19650 aligned κατάσταση ωριμότητας του συνόλου. */
export interface GovernanceRecord {
  /**
   * Η **ΧΑΜΗΛΟΤΕΡΗ** κατάσταση μεταξύ όλων των συνεισφερόντων items
   * (ADR-734 §6.3 κανόνας 1). Κενό σύνολο ή άγνωστη κατάσταση ⇒ `draft`.
   */
  readonly effectiveStatus: BOQItemStatus;
  /** Κατανομή καταστάσεων — αποκαλύπτει ανάμεικτα σύνολα. Πάντα και τα 5 κλειδιά. */
  readonly statusBreakdown: Readonly<Record<BOQItemStatus, number>>;
  /** true ΜΟΝΟ αν υπάρχει ≥1 item και ΟΛΑ είναι certified ή locked. */
  readonly isSignable: boolean;
  /** ADR-674 — ΤΟ ΔΙΑΦΟΡΟΠΟΙΗΤΙΚΟ. `null` = τίποτα δεν παρακολουθείται. */
  readonly baselineDrift: BaselineDriftSummary | null;
}

// ============================================================================
// ΑΚΕΡΑΙΟΤΗΤΑ — «αναπαράγεται;»
// ============================================================================

/** Ντετερμινιστικό αποτύπωμα των **εισόδων** (ποτέ του αποτελέσματος). */
export interface IntegrityRecord {
  /**
   * sha256 (hex) των κανονικοποιημένων εισόδων. Ίδιες είσοδοι + ίδια
   * `engineVersion` ⇒ ίδιο hash (ADR-734 §6.3 κανόνας 2).
   */
  readonly inputsHash: string;
  /**
   * Έκδοση υπολογιστικής μηχανής, μορφή `<semver>+<fingerprint>`.
   * Το `fingerprint` παράγεται από την **πραγματική συμπεριφορά** του
   * cost-engine ⇒ αλλαγή τύπου αλλάζει την έκδοση **αυτόματα**, χωρίς να
   * θυμηθεί κανείς να αυξήσει σταθερά.
   */
  readonly engineVersion: string;
}

// ============================================================================
// Ο ΦΑΚΕΛΟΣ
// ============================================================================

/** Φάκελος επαληθευσιμότητας. Τυλίγει ΚΑΘΕ ποσοτικό αποτέλεσμα. */
export interface VerifiableQuantityEnvelope<T> {
  /** Έκδοση σχήματος φακέλου (`VQE_SCHEMA_VERSION`). */
  readonly schemaVersion: string;
  /**
   * Το ωφέλιμο φορτίο — **ΑΚΡΙΒΩΣ** ό,τι επιστρέφει σήμερα το service.
   * Ο φάκελος *τυλίγει*, δεν *μετασχηματίζει* (ADR-734 §6.3 κανόνας 3).
   */
  readonly value: T;
  /** ΒΑΣΗ — «με ποιον κανόνα μετρήθηκε;» */
  readonly basis: MeasurementBasis;
  /** ΠΡΟΕΛΕΥΣΗ — «από πού βγήκε;» */
  readonly provenance: ProvenanceRecord;
  /** ΔΙΑΚΥΒΕΡΝΗΣΗ — «πόσο δεσμευτικό είναι;» */
  readonly governance: GovernanceRecord;
  /** ΑΚΕΡΑΙΟΤΗΤΑ — «αναπαράγεται;» */
  readonly integrity: IntegrityRecord;
}
