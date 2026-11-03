/**
 * @fileoverview **Προσφορά / Ιδιωτικό Συμφωνητικό Υπεργολαβίας** — το έγγραφο, τα μέρη, η εμβέλεια, ο κύκλος
 *   ζωής και οι αμετάβλητες αναθεωρήσεις (ADR-928 §5.4 – §5.6).
 * @module subapps/procurement/subcontracts/types/agreement
 *
 * Συλλογές: `subcontract_agreements/{sca}` · `subcontract_agreements/{sca}/revisions/{scrv}`.
 * Όνομα: **Subcontract Agreement** — διακριτό από `fwa` (πλαίσιο προμηθευτή, ADR-330), `lc` (πώληση ακινήτου),
 * `offr` (προσφορά ακινήτου).
 *
 * 🔑 **Τριάδα αναπαραστάσεων** (ADR-663 §4 μέρος 5, όπως το `FrameworkAgreement`): τα πεδία-στιγμές δηλώνονται
 * **μία** φορά (`SubcontractAgreementTimestampField`) και οι μορφές wire/like παράγονται από αυτά.
 *
 * 🔑 **Στιγμιότυπα, όχι αναφορές, για ό,τι τυπώνεται**: εκδότης, υπεργολάβος, έργο αντιγράφονται τη στιγμή της
 * έκδοσης (όπως το `InvoiceIssuer`, ADR-ACC-018). Η αλλαγή διεύθυνσης της επαφής αύριο δεν ξαναγράφει χαρτί
 * που υπογράφηκε χθες.
 */

import type { Timestamp } from 'firebase/firestore';
import type { CalendarDay } from '@/constants/platform-operator';
import type { InvoiceIssuer } from '@/subapps/accounting/types/invoice';
import type { ContactParty } from '@/subapps/accounting/utils/contact-party';
import type { SignatoryFieldSet } from '@/subapps/procurement/types/signatory-fields';
import type { TradeCode } from '@/subapps/procurement/types/trade';
import type { AgreementLine } from './agreement-line';
import type { ClauseLanguage, LocalizedText } from './clause-parameter';
import type { ClauseSelection, CommercialTerms } from './commercial-terms';
import type { AgreementDocumentMode } from './trade-template';

// ── Μέρη ────────────────────────────────────────────────────────────────────

/** Υπεργολάβος: η αντιστοίχιση επαφής → συναλλασσόμενου του λογιστικού, + πατρώνυμο (κεφαλίδα 2009). */
export interface SubcontractorSnapshot extends ContactParty {
  readonly contactId: string;
  readonly fatherName: string | null;
}

/** Κύριος του έργου (Δ8): οι οικοπεδούχοι, ονομαστικά ή συλλογικά («ΙΔΙΟΚΤΗΤΕΣ ΟΙΚΟΠΕΔΟΥ»). */
export type ProjectOwnersPresentation =
  | { readonly kind: 'none' }
  | { readonly kind: 'collective' }
  | { readonly kind: 'named'; readonly owners: readonly ContactParty[] };

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
  /**
   * ISO 8601. Όχι `Timestamp`: η ανάθεση ζει **μέσα** στο έγγραφο και στο στιγμιότυπο της αναθεώρησης, που
   * περνά από canonical JSON — ένθετο `Timestamp` θα έσπαγε και την τριάδα και το hash.
   */
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
 * Ο πίνακας μεταβάσεων — η ΜΙΑ περιγραφή του διαγράμματος του ADR. Ο γραφέας (Φ2) τον ρωτά· κανένας
 * καταναλωτής δεν ξαναγράφει «από ποια κατάσταση επιτρέπεται…».
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

/** Γλώσσες του εκτυπωμένου εγγράφου (§5.2.2): πάντα ελληνικά· προαιρετικά δεύτερη σε παράλληλη στήλη. */
export interface AgreementLanguages {
  readonly secondary: ClauseLanguage | null;
}

// ── Το έγγραφο ──────────────────────────────────────────────────────────────

export interface SubcontractAgreement {
  id: string;                                    // sca_*
  companyId: string;
  /** Αριθμός εγγράφου από μετρητή, μοναδικός ανά χώρο (π.χ. «ΣΥΜ-2026-014»). */
  documentNumber: string;
  role: AgreementDocumentRole;
  documentMode: AgreementDocumentMode;
  /** Τρόπος Β: η προσφορά που γέννησε αυτό το συμφωνητικό / το συμφωνητικό που γέννησε αυτή η προσφορά. */
  sourceOfferId: string | null;
  agreementId: string | null;
  /** Πηγή τιμών (§5.9): απευθείας, ανάθεση RFQ, ή καταχώριση εκ μέρους του υποψηφίου. */
  origin:
    | { kind: 'direct' }
    | { kind: 'rfq_award'; rfqId: string; quoteId: string }
    | { kind: 'entered_on_behalf'; channel: 'phone' | 'paper' | 'link' };
  trade: TradeCode;
  templateId: string | null;
  title: LocalizedText;
  status: SubcontractAgreementStatus;
  parties: AgreementParties;
  scope: AgreementScope;
  lines: AgreementLine[];
  terms: CommercialTerms;
  clauses: ClauseSelection[];
  languages: AgreementLanguages;
  /** Ισχύς προσφοράς — μετά, `expire`. */
  validUntil: CalendarDay | null;
  /** Ημερομηνία εγκατάστασης στο εργοτάξιο — το Υ.Γ. του 2009. */
  mobilizedOn: CalendarDay | null;
  /** Η τελευταία παγωμένη αναθεώρηση, ή `null` πριν το `issue`. */
  currentRevision: number | null;
  /** CAS του γραφέα (ADR-928 §5.5): κάθε μετάβαση ελέγχει και αυξάνει. */
  writeVersion: number;
  isDeleted: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  issuedAt: Timestamp | null;
  acceptedAt: Timestamp | null;
  createdBy: string;
}

/** Αμετάβλητη αναθεώρηση (§5.6): πλήρες στιγμιότυπο → canonical JSON → sha256 → PDF. */
export interface SubcontractAgreementRevision {
  readonly id: string;                           // scrv_*
  readonly companyId: string;
  readonly agreementId: string;
  readonly revision: number;                     // 1, 2, 3…
  /** Η αναθεώρηση που τροποποιεί αυτή (μετά το `accepted` κάθε αλλαγή είναι τροποποίηση). */
  readonly amends: number | null;
  readonly snapshot: SubcontractAgreementSnapshot;
  /** sha256 του canonical JSON του `snapshot`. */
  readonly contentHash: string;
  /** Το PDF στα αρχεία με custody (Φ4)· `null` μέχρι να αποδοθεί. */
  readonly pdfFileId: string | null;
  readonly sealed: boolean;
  readonly issuedBy: string;
  readonly issuedAt: Timestamp;
}

/**
 * Ό,τι παγώνει: το έγγραφο χωρίς τα πεδία κύκλου ζωής/αποθήκευσης, με τα **κείμενα** των ρητρών στην ακριβή τους
 * έκδοση ενσωματωμένα από τον γραφέα (Φ2) — η αναθεώρηση διαβάζεται χωρίς τη βιβλιοθήκη.
 */
export type SubcontractAgreementSnapshot = Readonly<
  Omit<SubcontractAgreement, 'status' | 'currentRevision' | 'writeVersion' | 'isDeleted' | SubcontractAgreementTimestampField>
>;

// ── Τριάδα αναπαραστάσεων (ADR-663 §4 μέρος 5) ──────────────────────────────

export type SubcontractAgreementTimestampField = 'createdAt' | 'updatedAt' | 'issuedAt' | 'acceptedAt';

/** JSON-ασφαλής μορφή στο σύνορο HTTP: στιγμές σε ISO 8601 (AIP-142). */
export type SubcontractAgreementWire =
  Omit<SubcontractAgreement, SubcontractAgreementTimestampField> &
  Record<'createdAt' | 'updatedAt', string> &
  Record<'issuedAt' | 'acceptedAt', string | null>;

/** Οποιαδήποτε από τις τρεις μορφές — για κώδικα που διαβάζει στιγμές μέσω `normalizeToDate` (ADR-218). */
export type SubcontractAgreementLike =
  Omit<SubcontractAgreement, SubcontractAgreementTimestampField> &
  Record<SubcontractAgreementTimestampField, unknown>;
