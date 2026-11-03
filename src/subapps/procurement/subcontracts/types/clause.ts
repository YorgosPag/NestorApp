/**
 * @fileoverview **Βιβλιοθήκη ρητρών ανά εταιρεία** — ρήτρα, εκδόσεις, μεταφράσεις, διακυβέρνηση (ADR-928 §5.2).
 * @module subapps/procurement/subcontracts/types/clause
 *
 * Συλλογές: `subcontract_clauses/{sccl}` (ταυτότητα της ρήτρας) · `subcontract_clauses/{sccl}/versions/{sccv}`
 * (αμετάβλητες εκδόσεις). Ids **ντετερμινιστικά** (`enterprise-id-prefixes-subcontract.ts`).
 *
 * 🔑 **Το κείμενο είναι δομή, όχι πρότυπο συμβολοσειράς.** Μια παράγραφος είναι λίστα τμημάτων «κείμενο» και
 * «παράμετρος» — το σχήμα μπλοκ του ADR-861 (`paragraph` · `list`) με τη θέση της παραμέτρου **ως κόμβο**. Δεν
 * υπάρχει τίποτα να αναλυθεί, άρα τίποτα να εγχυθεί, και η απόδοση (Typst, οθόνη, κινητό) είναι ίδια παντού.
 *
 * 🔑 **Δύο ανεξάρτητοι κύκλοι σε κάθε έκδοση** (ADR-928 §4 · §5.2.1):
 * - `state` — η **διακυβέρνηση** της εταιρείας (πρόταση → έγκριση → αντικατάσταση).
 * - `professionalReview` — αν το κείμενο το είδε **λογιστής/νομικός**. Οι προεπιλογές ξεκινούν
 *   `needs_professional_review`: η εφαρμογή δεν κωδικοποιεί νόμο, και δεν προσποιείται ότι ξέρει.
 */

import type { Timestamp } from 'firebase/firestore';
import type { CalendarDay } from '@/constants/platform-operator';
import type { ClauseLanguage, ClauseParameterDefinition, LocalizedText } from './clause-parameter';

/** Η μόνη νομικά δεσμευτική γλώσσα (ADR-928 §5.2.2). */
export const CLAUSE_AUTHORITATIVE_LANGUAGE = 'el' as const satisfies ClauseLanguage;

/** Σταθερό κλειδί ρήτρας, π.χ. `payment.schedule`, `retention.performance`, `tax.withholding_technical_works`. */
export type ClauseKey = string;

/** Τμήμα παραγράφου: κείμενο, ή η θέση μιας παραμέτρου της ίδιας έκδοσης. */
export type ClauseInline =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'param'; readonly key: string };

/** Μπλοκ σώματος — υποσύνολο του σχήματος ADR-861, με τμήματα αντί για ωμό κείμενο. */
export type ClauseBlock =
  | { readonly kind: 'paragraph'; readonly inlines: readonly ClauseInline[] }
  | { readonly kind: 'list'; readonly ordered: boolean; readonly items: readonly (readonly ClauseInline[])[] };

/** Το κείμενο μιας ρήτρας σε **μία** γλώσσα. */
export interface ClauseBody {
  readonly heading: string;
  readonly blocks: readonly ClauseBlock[];
}

/** Κύκλος διακυβέρνησης έκδοσης (§5.2.1). */
export const CLAUSE_VERSION_STATES = ['proposed', 'approved', 'rejected', 'superseded'] as const;
export type ClauseVersionState = (typeof CLAUSE_VERSION_STATES)[number];

/** Επαγγελματικός έλεγχος — ανεξάρτητος από τη διακυβέρνηση. */
export const CLAUSE_PROFESSIONAL_REVIEW_STATUSES = ['needs_professional_review', 'reviewed'] as const;
export type ClauseProfessionalReviewStatus = (typeof CLAUSE_PROFESSIONAL_REVIEW_STATUSES)[number];

/**
 * Μετάφραση ανά έκδοση (§5.2.2). 🔑 Το `sourceHash` είναι το sha256 του **ελληνικού** σώματος τη στιγμή της
 * μετάφρασης: αλλάζει το ελληνικό ⇒ το hash δεν ταιριάζει ⇒ η μετάφραση **δομικά** παύει να είναι εγκεκριμένη.
 */
export interface ClauseTranslation {
  readonly body: ClauseBody;
  readonly status: 'draft' | 'approved';
  readonly origin: 'human' | 'machine_draft';
  readonly sourceHash: string;
  readonly approvedBy: string | null;
  readonly approvedAt: Timestamp | null;
}

/** Η ταυτότητα της ρήτρας — ό,τι ΔΕΝ αλλάζει με τις εκδόσεις. */
export interface SubcontractClause {
  readonly id: string;                         // sccl_*
  readonly companyId: string;
  readonly clauseKey: ClauseKey;
  readonly title: LocalizedText;
  /** Η εγκεκριμένη έκδοση σε ισχύ σήμερα, ή `null` πριν την πρώτη έγκριση. */
  readonly currentVersion: number | null;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly createdBy: string;
}

/** Αμετάβλητη έκδοση ρήτρας. Η αλλαγή είναι ΠΑΝΤΑ νέα έκδοση. */
export interface SubcontractClauseVersion {
  readonly id: string;                         // sccv_*
  readonly companyId: string;
  readonly clauseId: string;
  readonly version: number;                    // 1, 2, 3…
  readonly state: ClauseVersionState;
  readonly professionalReview: ClauseProfessionalReviewStatus;
  readonly effectiveFrom: CalendarDay | null;  // ορίζεται στην έγκριση
  readonly supersededBy: number | null;
  /** Το ελληνικό σώμα — η αυθεντία. */
  readonly body: ClauseBody;
  readonly parameters: readonly ClauseParameterDefinition[];
  readonly translations: Readonly<Record<ClauseLanguage, ClauseTranslation>>;
  /** sha256 του canonical JSON του `body` + `parameters` — δένει μεταφράσεις και αναθεωρήσεις συμφωνητικών. */
  readonly contentHash: string;
  /** Διάκριση καθηκόντων: ο προτείνων δεν εγκρίνει τη δική του πρόταση. */
  readonly proposedBy: string;
  readonly proposalReason: string | null;
  readonly decidedBy: string | null;
  readonly decidedAt: Timestamp | null;
  readonly createdAt: Timestamp;
}
