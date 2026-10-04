/**
 * =============================================================================
 * Conveyance Case — υπόθεση μεταβίβασης (ADR-901 §5.1)
 * =============================================================================
 *
 * Η πώληση στο ακίνητο είναι **κατάσταση** (`commercial.legalPhase`)· η υπόθεση είναι
 * η **πράξη** με αρχή και τέλος (ένα ακίνητο μπορεί να πουληθεί ξανά).
 *
 * 🔑 Αποθηκεύονται ΜΟΝΟ οι αποκλίσεις από τον κατάλογο (απαντήσεις σε γεγονότα,
 *    «δεν εφαρμόζεται», έλεγχοι). Η κατάσταση κάθε γραμμής **παράγεται** κάθε φορά
 *    από τον κατάλογο + τα αρχεία (`src/lib/conveyance/derive-checklist.ts`).
 *
 * Συλλογή: `conveyance_cases` — **μόνο server** (Admin SDK, κανόνες deny-all στη Φ1).
 *
 * @module types/conveyance-case
 * @see ADR-901
 */

import type { CaseDocumentRequests } from '@/types/conveyance-document-request';
import type { CaseInvitationSummary, CredentialHint } from '@/types/engagement-invitation';
import type { DeclaredCredential, EngagementConsent, EngagementState, EngagementVerdict } from '@/types/engagement';
import type { LegalProfessionalRole } from '@/types/legal-contracts';
import type {
  ChecklistItem,
  ChecklistProvider,
  ChecklistSection,
  ConveyanceFactId,
  ConveyanceProfile,
  EvidenceLevel,
} from '@/config/conveyance-checklist/types';

// ============================================================================
// ΚΑΤΑΣΤΑΣΗ ΥΠΟΘΕΣΗΣ (AIP-216 — output-only)
// ============================================================================

/**
 * Κατάσταση που **αποθηκεύεται** — μόνο από ρητές πράξεις (ADR-901 §2 Ε-Ε).
 * Το `signed` ΔΕΝ αποθηκεύεται: παράγεται από το `legalPhase` του ADR-230.
 */
export const STORED_CASE_STATES = ['open', 'registered', 'closed', 'cancelled'] as const;
export type StoredCaseState = (typeof STORED_CASE_STATES)[number];

/** Η κατάσταση που βλέπει ο χρήστης (`effectiveCaseState`). */
const CONVEYANCE_CASE_STATES = ['open', 'signed', 'registered', 'closed', 'cancelled'] as const;
export type ConveyanceCaseState = (typeof CONVEYANCE_CASE_STATES)[number];

// ============================================================================
// ΑΠΟΚΛΙΣΕΙΣ (ό,τι αποθηκεύεται πάνω στον κατάλογο)
// ============================================================================

export interface ConveyanceFactAnswer {
  readonly value: boolean;
  readonly answeredBy: string;
  readonly answeredAt: string;
}

export const REVIEW_VERDICTS = ['accepted', 'rejected'] as const;
type ReviewVerdict = (typeof REVIEW_VERDICTS)[number];

/**
 * Έλεγχος γραμμής — **δεμένος στην έκδοση** του αρχείου (`fileFingerprint`).
 * Νέο ανέβασμα / νέα αναθεώρηση ⇒ ο έλεγχος γίνεται αυτόματα `stale`.
 * `fileId: null` = επιβεβαίωση παραλαβής εκτός πλατφόρμας (γραμμές `offline`/`notary_issued`).
 */
export interface ChecklistItemReview {
  readonly verdict: ReviewVerdict;
  readonly fileId: string | null;
  readonly fileFingerprint: string | null;
  /** Ημερομηνία έκδοσης του εγγράφου (YYYY-MM-DD) — βάση της ισχύος (ADR-901 §2 Ε-Δ). */
  readonly issuedOn: string | null;
  /** Λόγος επιστροφής (υποχρεωτικός όταν `rejected`). */
  readonly reason: string | null;
  readonly reviewedBy: string;
  readonly reviewedAt: string;
}

interface ChecklistItemNotApplicable {
  readonly reason: string;
  readonly markedBy: string;
  readonly markedAt: string;
}

export interface ChecklistItemOverride {
  readonly notApplicable?: ChecklistItemNotApplicable;
  readonly review?: ChecklistItemReview;
}

// ============================================================================
// ΤΟ ΕΓΓΡΑΦΟ
// ============================================================================

export interface ConveyanceAppurtenanceRef {
  readonly entityType: 'parking_spot' | 'storage';
  readonly entityId: string;
}

export interface ConveyanceCaseSubject {
  readonly kind: 'property';
  readonly propertyId: string;
  readonly buildingId: string | null;
  readonly projectId: string | null;
  readonly appurtenances: readonly ConveyanceAppurtenanceRef[];
}

export interface ConveyanceCaseParties {
  /** Εταιρεία-πωλητής: η επαφή της νομικής οντότητας του έργου (`project.linkedCompanyId`). */
  readonly seller: { readonly contactId: string | null; readonly kind: 'person' | 'legal_entity' };
  readonly buyers: readonly { readonly contactId: string }[];
}

export interface ConveyanceCase {
  readonly id: string;
  readonly companyId: string;
  readonly subject: ConveyanceCaseSubject;
  readonly profile: ConveyanceProfile;
  readonly parties: ConveyanceCaseParties;
  readonly facts: Readonly<Partial<Record<ConveyanceFactId, ConveyanceFactAnswer>>>;
  readonly overrides: Readonly<Record<string, ChecklistItemOverride>>;
  readonly storedState: StoredCaseState;
  /** Προγραμματισμένη ημέρα υπογραφής (YYYY-MM-DD) — «θα ισχύει τότε;» (Σ-5). */
  readonly targetSigningDate: string | null;
  readonly catalogVersion: string;
  /** Μετρητής CAS — κάθε εντολή δηλώνει την έκδοση που είδε (409 σε σύγκρουση). */
  readonly version: number;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly cancellation: { readonly reason: string; readonly by: string; readonly at: string } | null;
}

// ============================================================================
// ΠΑΡΑΓΟΜΕΝΑ (δεν αποθηκεύονται)
// ============================================================================

/** Αρχείο-τεκμήριο που βρέθηκε για μια γραμμή. */
/**
 * **Από πού** ήρθε ένα τεκμήριο (ADR-901 Φ4.4):
 * - `owned`       — αρχείο του **μισθωτή-οικοδεσπότη** (`files`) — όπως από τη Φ1
 * - `transmittal` — έκδοση προσωπικού αρχείου επαγγελματία που **στάλθηκε** (`conveyance_contributions`)· το
 *                   uid του συντάκτη **δεν** ταξιδεύει (Α18) — ο server το ξαναβρίσκει από το `contributionId`.
 *                   `own` = ο θεατής είναι ο συντάκτης (μόνο τότε προσφέρεται «Απόσυρση»).
 *
 * ADR-901 Φ4.5 (Α28) — `newerVersion` υπάρχει **μόνο** στον κλάδο `own: true`: η στοίβα εκδόσεων του συντάκτη έχει
 * νεότερη, **έτοιμη** κεφαλή από τη σταλμένη. Ο τύπος το εγγυάται — θεατής που δεν είναι ο συντάκτης **δεν έχει πεδίο**
 * να το λάβει (ούτε `false`: η ύπαρξη νέας έκδοσης σε ξένο χώρο είναι πληροφορία).
 */
export interface NewerVersion {
  /** Το όνομα της κεφαλής της στοίβας — για το «Στείλε τη νέα έκδοση «X»». Το id της **δεν** ταξιδεύει: το αποφασίζει ο server. */
  readonly displayName: string;
}

type TransmittalAuthorship =
  | { readonly own: false }
  | { readonly own: true; readonly newerVersion: NewerVersion | null };

/**
 * `onBehalf` (Π2) — ο συντάκτης έστειλε έγγραφο **του πελάτη** που εκπροσωπεί (π.χ. ταυτότητα αγοραστή από τον δικηγόρο
 * του): «από: Δικηγόρος αγοραστή, εκ μέρους του αγοραστή». **Παράγεται** από τον πάροχο της γραμμής (`sentOnBehalf`).
 */
export type EvidenceSource =
  | { readonly kind: 'owned' }
  | ({
      readonly kind: 'transmittal';
      readonly contributionId: string;
      readonly authorRole: LegalProfessionalRole;
      readonly onBehalf: boolean;
    } & TransmittalAuthorship);

/**
 * 🔒 Π2 — **σφραγισμένη παράδοση**: έγγραφο που στάλθηκε **εκ μέρους** του πελάτη σε ακροατήριο όπου ο θεατής **δεν**
 * ανήκει, ενώ **βλέπει** τη γραμμή (στην πράξη: ο οικοδεσπότης-πωλητής για την ταυτότητα/Ε1 του αγοραστή, §5.10).
 * Μαθαίνει **ότι** παραδόθηκε — ποτέ **τι**. Ο τύπος δεν έχει `fileId`, όνομα ή `contributionId`: λήψη, έλεγχος
 * (review) ή διαρροή ονόματος είναι **μη αναπαραστάσιμα** (το «!» του Aconex, συν την πρόοδο).
 */
export interface SealedDelivery {
  readonly itemId: string;
  readonly deliveredAt: string;
  readonly authorRole: LegalProfessionalRole;
}

export interface EvidenceFile {
  readonly source: EvidenceSource;
  readonly fileId: string;
  readonly displayName: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly purpose: string;
  readonly level: EvidenceLevel;
  /** `fileId:revision:updatedAt` — αλλάζει σε κάθε νέα έκδοση/αναθεώρηση. */
  readonly fingerprint: string;
  readonly createdAt: string;
}

const CHECKLIST_ROW_STATUSES = [
  'needs_answer',
  'missing',
  'uploaded',
  'stale',
  'rejected',
  'accepted',
  'expiring',
  'expired',
  'notary_side',
  /** Π2 — παραδόθηκε σε ακροατήριο όπου ο θεατής δεν ανήκει (`SealedDelivery`): η υποχρέωση πέρασε, το περιεχόμενο όχι. */
  'delivered_sealed',
  'not_applicable',
] as const;
export type ChecklistRowStatus = (typeof CHECKLIST_ROW_STATUSES)[number];

export interface ChecklistRow {
  readonly itemId: string;
  readonly item: ChecklistItem;
  readonly section: ChecklistSection;
  readonly provider: ChecklistProvider;
  readonly status: ChecklistRowStatus;
  /** Αρχεία-τεκμήρια, νεότερο πρώτο. */
  readonly files: readonly EvidenceFile[];
  /** Π2 — η νεότερη σφραγισμένη παράδοση της γραμμής για αυτόν τον θεατή (μόνο ο οικοδεσπότης μπορεί να έχει). */
  readonly sealed: SealedDelivery | null;
  readonly review: ChecklistItemReview | null;
  readonly notApplicable: ChecklistItemNotApplicable | null;
  /** Γιατί δεν εφαρμόζεται: απάντηση σε γεγονός ή ρητή σήμανση. */
  readonly notApplicableBy: 'fact' | 'manual' | null;
  /** Το γεγονός που περιμένει απάντηση (μόνο σε `needs_answer`). */
  readonly pendingFact: ConveyanceFactId | null;
  /** Λήξη ισχύος (YYYY-MM-DD) — μόνο όταν είναι υπολογίσιμη. */
  readonly expiresOn: string | null;
  /** Θα ισχύει την ημέρα υπογραφής; `null` = άγνωστο (χωρίς ημερομηνία ή χωρίς λήξη). */
  readonly validOnSigning: boolean | null;
}

export interface ChecklistSummary {
  /** Γραμμές που εφαρμόζονται (χωρίς `not_applicable` και `needs_answer`). */
  readonly applicable: number;
  /** Ολοκληρωμένες: `accepted` + `notary_side` + `delivered_sealed` (η υποχρέωση βγήκε από τα χέρια του θεατή). */
  readonly complete: number;
  /** Αναμένουν έλεγχο: `uploaded` + `stale`. */
  readonly awaitingReview: number;
  readonly missing: number;
  readonly rejected: number;
  readonly expiring: number;
  readonly expired: number;
  /** Γεγονότα που ΔΕΝ παράγονται από τα δεδομένα και δεν έχουν απαντηθεί. */
  readonly openQuestions: readonly ConveyanceFactId[];
}

export interface DerivedChecklist {
  readonly rows: readonly ChecklistRow[];
  readonly summary: ChecklistSummary;
}

/** Ό,τι επιστρέφει ο server στην καρτέλα: η πράξη + ο παραγόμενος κατάλογος. */
export interface ConveyanceCaseView {
  readonly conveyanceCase: ConveyanceCase;
  readonly state: ConveyanceCaseState;
  /** Γεγονότα που παράχθηκαν από τα δεδομένα (το UI τα δείχνει ως «από τα στοιχεία»). */
  readonly derivedFacts: Readonly<Partial<Record<ConveyanceFactId, boolean>>>;
  /** Όλα τα αρχεία-τεκμήρια — ο client ξανατρέχει τον ίδιο πυρήνα για optimistic updates. */
  readonly evidence: readonly EvidenceFile[];
  /** Π2 — οι σφραγισμένες παραδόσεις (ταξιδεύουν μαζί με τα τεκμήρια για τον **ίδιο** optimistic πυρήνα). */
  readonly sealedDeliveries: readonly SealedDelivery[];
  readonly checklist: DerivedChecklist;
  /** ADR-901 Φ4.5 — «Ζήτησε έγγραφο»: παραλήπτες ανά γραμμή + τα αιτήματα που αφορούν τον οικοδεσπότη. */
  readonly documentRequests: CaseDocumentRequests;
}

// ============================================================================
// ADR-901 Φ2 — ΟΙ ΟΨΕΙΣ ΤΗΣ ΣΥΜΜΕΤΟΧΗΣ (επαγγελματίες μέσω ADR-862 `engagements`)
// ============================================================================

/** Πού βρίσκεται η αλυσίδα «ορισμός → λογαριασμός» μιας θέσης (`conveyance-professional.server`). */
export type ProfessionalAppointment = 'not-appointed' | 'no-email' | 'needs-invitation' | 'account';

/** Μία συμμετοχή όπως τη βλέπει ο **οικοδεσπότης** — χωρίς τίποτα που δεν του ανήκει. */
export interface CaseEngagementSummary {
  readonly engagementId: string;
  readonly role: LegalProfessionalRole;
  readonly state: EngagementState;
  readonly email: string;
  readonly offeredAt: string;
  readonly respondedAt: string | null;
  readonly closedAt: string | null;
  readonly expiresAt: string;
  readonly consents: readonly EngagementConsent[];
  /** ADR-901 Ε-4 — η ιδιότητα όπως τη **δήλωσε** ο επαγγελματίας· εμφανίζεται ως «(δηλωμένο)». */
  readonly declaredCredential: DeclaredCredential | null;
}

/** Μία **θέση** επαγγελματία στην υπόθεση — ο ορισμός, η συμμετοχή, και αν θέλει δηλωμένη συναίνεση. */
export interface CaseProfessionalSlot {
  readonly role: LegalProfessionalRole;
  readonly appointment: ProfessionalAppointment;
  /** Η τρέχουσα συμμετοχή της θέσης (ζωντανή, αλλιώς η πιο πρόσφατη) — `null` αν δεν προτάθηκε ποτέ. */
  readonly engagement: CaseEngagementSummary | null;
  /** ADR-901 Φ3 — η πιο πρόσφατη πρόσκληση με email της θέσης — `null` αν δεν στάλθηκε ποτέ. */
  readonly invitation: CaseInvitationSummary | null;
  readonly requiresAttestation: boolean;
}

/**
 * ADR-901 Φ4 — ένας επαγγελματίας της υπόθεσης όπως τον βλέπουν οι **άλλοι**. ⛔ **Κανένα** email/uid/συναίνεση
 * (ελαχιστοποίηση ΓΚΠΔ): μόνο ρόλος, όνομα και η ιδιότητα **όπως δηλώθηκε** (Ε-4, «(δηλωμένο)»).
 */
export interface CaseParticipantView {
  readonly role: LegalProfessionalRole;
  /** Το όνομα του λογαριασμού — `null` αν δεν έχει δηλωθεί (ποτέ εφεδρεία στο email). */
  readonly displayName: string | null;
  readonly declaredCredential: DeclaredCredential | null;
  /** Είναι ο ίδιος ο θεατής. */
  readonly isViewer: boolean;
}

/**
 * Η υπόθεση όπως τη βλέπει ο **επαγγελματίας**. ⛔ **ΟΧΙ** το ωμό `ConveyanceCase`: γεγονότα, εξαιρέσεις,
 * μέρη και σημειώσεις άλλων πλευρών μένουν στον server — ο κατάλογος έρχεται **ήδη** φιλτραρισμένος
 * ανά ρόλο (`visibleTo`) και εμβέλεια (`decideEngagedEvidenceReach`).
 */
export interface EngagedCaseView {
  readonly engagementId: string;
  readonly role: LegalProfessionalRole;
  readonly caseId: string;
  readonly state: ConveyanceCaseState;
  readonly propertyName: string | null;
  readonly targetSigningDate: string | null;
  readonly checklist: DerivedChecklist;
  /** ADR-901 Φ4 — όσοι συμμετέχουν **τώρα** (μαζί με τον θεατή), με τη δηλωμένη ιδιότητά τους. */
  readonly participants: readonly CaseParticipantView[];
  /** ADR-901 Φ4.5 — «Ζήτησε έγγραφο»: παραλήπτες ανά γραμμή + τα αιτήματα όπου ο θεατής είναι αιτών/παραλήπτης. */
  readonly documentRequests: CaseDocumentRequests;
}

/**
 * ADR-901 Φ4 §5.9 — μία γραμμή του ίχνους όπως τη βλέπει ο **επαγγελματίας**. ⛔ Κανένα όνομα/email άλλου:
 * ο άλλος φαίνεται **μόνο** με τον ρόλο του (`actorRole`).
 */
export interface CaseActivityItem {
  readonly id: string;
  readonly at: string;
  /** Φ4.5: `requested` = ο θεατής ζήτησε έγγραφο · `request-received` = ζητήθηκε από τον ρόλο του. */
  readonly kind: 'viewed' | 'downloaded' | 'answered' | 'transmitted' | 'withdrawn' | 'requested' | 'request-received';
  readonly documentName: string | null;
  /** Φ4.5 — η γραμμή του καταλόγου (για αιτήματα): το όνομά της το αποδίδει ο client στη γλώσσα του θεατή. */
  readonly itemId: string | null;
  /** Την έκανε ο ίδιος ο θεατής. */
  readonly byViewer: boolean;
  /**
   * Ο **άλλος** ρόλος της ενέργειας: όποιος άνοιξε το τεκμήριο · όποιος ζήτησε (`request-received`) · από ποιον
   * ζητήθηκε (`requested`). `null` για ενέργειες χωρίς δεύτερο μέρος.
   */
  readonly actorRole: CaseActorRole | null;
}

/** Ποιος **ενεργεί** στην υπόθεση: ένας επαγγελματίας ή ο οικοδεσπότης (ADR-901 Φ4.4 — ανοίγει πια τεκμήρια). */
export type CaseActorRole = LegalProfessionalRole | 'host';

/** Μία κάρτα στα «Οι υποθέσεις μου» (ADR-901 §5.4). */
export interface MyCaseCard {
  readonly engagementId: string;
  readonly role: LegalProfessionalRole;
  readonly engagementState: EngagementState;
  readonly verdict: EngagementVerdict;
  readonly offeredAt: string;
  readonly expiresAt: string;
  readonly propertyName: string | null;
  readonly caseState: ConveyanceCaseState | null;
  /** Μόνο για **ενεργή** συμμετοχή — πρόταση δεν βλέπει τίποτα από την υπόθεση (Entra). */
  readonly summary: ChecklistSummary | null;
  readonly targetSigningDate: string | null;
  /**
   * ADR-901 Φ4 — η **προσυμπλήρωση** της δήλωσης ιδιότητας για το «Αναλαμβάνω»: πρώτα η πιο πρόσφατη δήλωση
   * του ίδιου, μετά το βιβλίο του οικοδεσπότη. Υπάρχει **μόνο** σε πρόταση `offered`.
   */
  readonly credentialHint: CredentialHint | null;
}

