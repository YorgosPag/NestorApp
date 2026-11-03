/**
 * @fileoverview **Προσφορά / Ιδιωτικό Συμφωνητικό Υπεργολαβίας** — το έγγραφο, τα μέρη, η εμβέλεια, ο κύκλος
 *   ζωής και οι αμετάβλητες αναθεωρήσεις (ADR-928 §5.4 – §5.6 · Φ2 §5.14).
 * @module subapps/procurement/subcontracts/types/agreement
 *
 * Συλλογές: `subcontract_agreements/{sca}` · `subcontract_agreements/{sca}/subcontract_agreement_revisions/{scrv}`
 * (όνομα **μοναδικό**, όχι `revisions`: το collection group σαρώνει κατά όνομα — Φ1 απόφαση 9).
 * Όνομα: **Subcontract Agreement** — διακριτό από `fwa` (πλαίσιο προμηθευτή, ADR-330), `lc` (πώληση ακινήτου),
 * `offr` (προσφορά ακινήτου).
 *
 * 🔑 **Χρόνος = ISO 8601 `string`** σε βάση, σύρμα και πελάτη (ADR-663 §4 · Φ2 απόφαση 1, ίδια με τη Φ1 απόφαση 1):
 * **μία** αναπαράσταση, άρα καμία τριάδα doc/wire/like, και το στιγμιότυπο περνά αυτούσιο από canonical JSON.
 *
 * 🔑 **Στιγμιότυπα, όχι αναφορές, για ό,τι τυπώνεται** — και τα γράφει **μόνο ο διακομιστής** (Φ2 απόφαση 4): ο
 * πελάτης στέλνει ids, ο γραφέας διαβάζει τις πηγές (`buildIssuer`, επαφές, έργο). Η αλλαγή διεύθυνσης της επαφής
 * αύριο δεν ξαναγράφει χαρτί που υπογράφηκε χθες.
 */

import type { CalendarDay } from '@/constants/platform-operator';
import type { InvoiceIssuer } from '@/subapps/accounting/types/invoice';
import type { ContactParty } from '@/subapps/accounting/utils/contact-party';
import type { SignatoryFieldSet } from '@/subapps/procurement/types/signatory-fields';
import type { TradeCode } from '@/subapps/procurement/types/trade';
import type { AgreementLine } from './agreement-line';
import type { ClauseBody, ClauseKey, ClauseTranslation } from './clause';
import type { ClauseLanguage, ClauseParameterDefinition, ClauseParameterValue, LocalizedText } from './clause-parameter';
import type { ClauseSelection, CommercialTerms } from './commercial-terms';
import type { AgreementDocumentMode } from './trade-template';

// ── Μέρη ────────────────────────────────────────────────────────────────────

/** Υπεργολάβος: η αντιστοίχιση επαφής → συναλλασσόμενου του λογιστικού, + πατρώνυμο (κεφαλίδα 2009). */
export interface SubcontractorSnapshot extends ContactParty {
  readonly contactId: string;
  readonly fatherName: string | null;
}

/** Οικοπεδούχος ονομαστικά: στιγμιότυπο + η επαφή του, ώστε το `issue` να ξαναδιαβάσει την πηγή (§5.4). */
export interface ProjectOwnerSnapshot extends ContactParty {
  readonly contactId: string;
}

/** Κύριος του έργου (Δ8): οι οικοπεδούχοι, ονομαστικά ή συλλογικά («ΙΔΙΟΚΤΗΤΕΣ ΟΙΚΟΠΕΔΟΥ»). */
export type ProjectOwnersPresentation =
  | { readonly kind: 'none' }
  | { readonly kind: 'collective' }
  | { readonly kind: 'named'; readonly owners: readonly ProjectOwnerSnapshot[] };

export interface AgreementParties {
  /** Ο φορέας — από `accounting_settings` μέσω `buildIssuer`, όπως το τιμολόγιο και το PO. */
  readonly issuer: InvoiceIssuer;
  readonly subcontractor: SubcontractorSnapshot;
  readonly projectOwners: ProjectOwnersPresentation;
  /** Υπογράφων της εταιρείας (ADR-336), επιλεγμένος κατά την έκδοση. */
  readonly issuerSignatory: SignatoryFieldSet | null;
}

// ── Έργο και εμβέλεια ───────────────────────────────────────────────────────

/** Ταυτότητα έργου όπως τυπώνεται (άδεια, Ο.Τ., οικόπεδο, διεύθυνση) — στιγμιότυπο από `Project`. */
export interface ProjectIdentitySnapshot {
  readonly projectId: string;
  readonly name: string;
  readonly address: string;
  readonly licenseNumber: string | null;
  readonly issuingAuthority: string | null;
  readonly buildingBlock: string | null;
  readonly plotNumber: string | null;
  readonly buildingIds: readonly string[];
}

/** Ανάθεση εργοταξίου σε συμφωνητικό πολλών έργων — **χωρίς** νέο έγγραφο (Δ2). */
export interface SiteAssignment {
  readonly id: string;                          // scas_*
  readonly project: ProjectIdentitySnapshot;
  readonly startDate: CalendarDay | null;
  /** Τοπικές διαφοροποιήσεις (π.χ. προθεσμία)· όλα τα άλλα από το συμφωνητικό. */
  readonly durationDays: number | null;
  readonly note: string | null;
  readonly assignedBy: string;
  readonly assignedAt: string;
}

export type AgreementScope =
  | { readonly kind: 'single_project'; readonly project: ProjectIdentitySnapshot }
  | { readonly kind: 'multi_project'; readonly assignments: readonly SiteAssignment[] };

// ── Κύκλος ζωής (§5.5) ──────────────────────────────────────────────────────

export const SUBCONTRACT_AGREEMENT_STATUSES = [
  'draft',
  'issued',
  'accepted',
  'in_execution',
  'completed',
  'discarded',
  'withdrawn',
  'expired',
  'terminated',
] as const;
export type SubcontractAgreementStatus = (typeof SUBCONTRACT_AGREEMENT_STATUSES)[number];

export const SUBCONTRACT_AGREEMENT_TRANSITIONS = [
  'issue',
  'accept',
  'mobilize',
  'complete',
  'discard',
  'withdraw',
  'expire',
  'terminate',
] as const;
export type SubcontractAgreementTransition = (typeof SUBCONTRACT_AGREEMENT_TRANSITIONS)[number];

/**
 * Ο πίνακας μεταβάσεων — η ΜΙΑ περιγραφή του διαγράμματος του ADR. Ο γραφέας τον ρωτά μέσω της καθαρής μηχανής
 * (`agreements/agreement-lifecycle.ts`)· κανένας καταναλωτής δεν ξαναγράφει «από ποια κατάσταση επιτρέπεται…».
 */
export const SUBCONTRACT_AGREEMENT_FSM: Readonly<
  Record<SubcontractAgreementTransition, { readonly from: readonly SubcontractAgreementStatus[]; readonly to: SubcontractAgreementStatus }>
> = {
  issue: { from: ['draft'], to: 'issued' },
  accept: { from: ['issued'], to: 'accepted' },
  mobilize: { from: ['accepted'], to: 'in_execution' },
  complete: { from: ['in_execution'], to: 'completed' },
  discard: { from: ['draft'], to: 'discarded' },
  withdraw: { from: ['issued', 'accepted'], to: 'withdrawn' },
  expire: { from: ['issued'], to: 'expired' },
  terminate: { from: ['in_execution'], to: 'terminated' },
};

/** Στον Τρόπο Β το ίδιο μοντέλο κρατά δύο έγγραφα: την προσφορά και το συμφωνητικό που αυτή γέννησε. */
export const AGREEMENT_DOCUMENT_ROLES = ['offer', 'agreement'] as const;
export type AgreementDocumentRole = (typeof AGREEMENT_DOCUMENT_ROLES)[number];

/** Πηγή τιμών (§5.9): απευθείας, ανάθεση RFQ, ή καταχώριση εκ μέρους του υποψηφίου. */
export const AGREEMENT_ENTRY_CHANNELS = ['phone', 'paper', 'link'] as const;
export type AgreementOrigin =
  | { readonly kind: 'direct' }
  | { readonly kind: 'rfq_award'; readonly rfqId: string; readonly quoteId: string }
  | { readonly kind: 'entered_on_behalf'; readonly channel: (typeof AGREEMENT_ENTRY_CHANNELS)[number] };

/** Γλώσσες του εκτυπωμένου εγγράφου (§5.2.2): πάντα ελληνικά· προαιρετικά δεύτερη σε παράλληλη στήλη. */
export interface AgreementLanguages {
  readonly secondary: ClauseLanguage | null;
}

// ── Το έγγραφο ──────────────────────────────────────────────────────────────

export interface SubcontractAgreement {
  readonly id: string;                           // sca_*
  readonly companyId: string;
  /** Αριθμός εγγράφου από μετρητή ανά χώρο και έτος (π.χ. «ΣΥΜ-2026-014») — Φ2 απόφαση 7. */
  readonly documentNumber: string;
  readonly role: AgreementDocumentRole;
  readonly documentMode: AgreementDocumentMode;
  /** Τρόπος Β: η προσφορά που γέννησε αυτό το συμφωνητικό / το συμφωνητικό που γέννησε αυτή η προσφορά. */
  readonly sourceOfferId: string | null;
  readonly agreementId: string | null;
  readonly origin: AgreementOrigin;
  readonly trade: TradeCode;
  readonly templateId: string | null;
  readonly title: LocalizedText;
  readonly status: SubcontractAgreementStatus;
  readonly parties: AgreementParties;
  readonly scope: AgreementScope;
  /**
   * Παράγωγο του `scope` — το γράφει **μόνο** ο γραφέας (Φ2 απόφαση 12): ένα `array-contains` για τη λίστα ανά έργο,
   * είτε το συμφωνητικό είναι ενός έργου είτε πολλών.
   */
  readonly projectIds: readonly string[];
  readonly lines: readonly AgreementLine[];
  readonly terms: CommercialTerms;
  readonly clauses: readonly ClauseSelection[];
  readonly languages: AgreementLanguages;
  /** Ισχύς προσφοράς — μετά, `expire` (και το `accept` αρνείται). */
  readonly validUntil: CalendarDay | null;
  /** Ημερομηνία εγκατάστασης στο εργοτάξιο — το Υ.Γ. του 2009. */
  readonly mobilizedOn: CalendarDay | null;
  /** Η τελευταία παγωμένη αναθεώρηση, ή `null` πριν το `issue`. (Όχι CAS — αυτό είναι το `revision`.) */
  readonly issuedRevision: number | null;
  /** CAS (ADR-923 §5.9 · Φ2 απόφαση 2): κάθε αλλαγή +1, όπως η ρήτρα και το πρότυπο. */
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly issuedAt: string | null;
  readonly acceptedAt: string | null;
  readonly createdBy: string;
  readonly updatedBy: string;
}

/** Το περίβλημα που γράφει **μόνο** ο γραφέας (ταυτότητα, αριθμός, κύκλος ζωής, σφραγίδες). */
export type SubcontractAgreementEnvelopeField =
  | 'id' | 'companyId' | 'documentNumber' | 'role' | 'sourceOfferId' | 'agreementId' | 'status' | 'mobilizedOn'
  | 'issuedRevision' | 'revision' | 'createdAt' | 'updatedAt' | 'issuedAt' | 'acceptedAt' | 'createdBy' | 'updatedBy';

/** Το περιεχόμενο του εγγράφου — ό,τι ορίζει ο άνθρωπος + ό,τι έλυσε ο διακομιστής από τις πηγές (μέρη, έργο). */
export type SubcontractAgreementContent = Omit<SubcontractAgreement, SubcontractAgreementEnvelopeField>;

/**
 * Το κείμενο μιας ρήτρας **όπως πάγωσε** (§5.6): σώμα, παράμετροι και **εγκεκριμένες** μεταφράσεις της καρφωμένης
 * έκδοσης. Η αναθεώρηση διαβάζεται χωρίς τη βιβλιοθήκη· το `contentHash` δένει με την έκδοση της βιβλιοθήκης.
 */
export interface FrozenClause {
  readonly clauseId: string;
  readonly clauseKey: ClauseKey;
  readonly version: number;
  readonly contentHash: string;
  readonly title: LocalizedText;
  readonly body: ClauseBody;
  readonly parameters: readonly ClauseParameterDefinition[];
  readonly translations: Readonly<Record<ClauseLanguage, ClauseTranslation>>;
  /** Οι τιμές που τυπώνονται — των δεσμευμένων παραμέτρων διαβασμένες από τα `CommercialTerms` του εγγράφου. */
  readonly values: Readonly<Record<string, ClauseParameterValue>>;
}

/** Πεδία κύκλου ζωής / αποθήκευσης που ΔΕΝ παγώνουν. */
export type SubcontractAgreementLifecycleField =
  | 'status' | 'issuedRevision' | 'revision' | 'createdAt' | 'updatedAt' | 'issuedAt' | 'acceptedAt' | 'updatedBy';

/** Ό,τι παγώνει: το έγγραφο χωρίς τον κύκλο ζωής, με τα **κείμενα** των ρητρών ενσωματωμένα. */
export type SubcontractAgreementSnapshot = Readonly<Omit<SubcontractAgreement, SubcontractAgreementLifecycleField>> & {
  readonly frozenClauses: readonly FrozenClause[];
};

/** Αμετάβλητη αναθεώρηση (§5.6): πλήρες στιγμιότυπο → canonical JSON → sha256 → PDF (Φ4). Γράφεται **μία** φορά. */
export interface SubcontractAgreementRevision {
  readonly id: string;                           // scrv_*
  readonly companyId: string;
  readonly agreementId: string;
  readonly revisionNumber: number;               // 1, 2, 3…
  /** Η αναθεώρηση που τροποποιεί αυτή (μετά το `accepted` κάθε αλλαγή είναι τροποποίηση — μελλοντικά). */
  readonly amends: number | null;
  readonly snapshot: SubcontractAgreementSnapshot;
  /** sha256 του canonical JSON του `snapshot`. */
  readonly contentHash: string;
  /** Το PDF στα αρχεία με custody (Φ4)· `null` μέχρι να αποδοθεί. */
  readonly pdfFileId: string | null;
  readonly sealed: boolean;
  readonly issuedBy: string;
  readonly issuedAt: string;
}

// ── Πράξεις: είσοδος και αποτέλεσμα (Φ3α-2) ─────────────────────────────────
// Ένας ορισμός για τον γραφέα (`src/server/subcontracts/`) και τον πελάτη (`subcontract-agreements-api.client`):
// ως τη Φ3α-1 ζούσαν σε αρχεία `server-only`, όπου η οθόνη δεν μπορούσε να τα δει.

/** Μετάβαση κύκλου ζωής: η αναθεώρηση που διάβασε ο πελάτης (CAS) + η ημέρα εγκατάστασης στο `mobilize`. */
export interface AgreementTransitionInput {
  readonly expectedRevision: number;
  readonly mobilizedOn: CalendarDay | null;
}

/** Το `issue` παγώνει αναθεώρηση· το `accept` του Τρόπου Β γεννά συμφωνητικό. */
export interface AgreementTransitionResult {
  readonly agreement: SubcontractAgreement;
  readonly revision: SubcontractAgreementRevision | null;
  readonly spawnedAgreement: SubcontractAgreement | null;
}

/** Εντολή εργασίας (§5.15): ανάθεση εργοταξίου σε κύρια σύμβαση. */
export interface AgreementAssignmentInput {
  readonly expectedRevision: number;
  readonly projectId: string;
  readonly buildingIds: readonly string[];
  readonly startDate: CalendarDay | null;
  readonly durationDays: number | null;
  readonly note: string | null;
}

/** Απόφαση απόκλισης από **άλλον** από τον αιτούντα (§5.2.1 τρόπος 3). */
export interface AgreementDeviationDecisionInput {
  readonly expectedRevision: number;
  readonly clauseKey: string;
  readonly parameterKey: string;
  readonly decision: 'approved' | 'rejected';
  readonly reason: string | null;
}
