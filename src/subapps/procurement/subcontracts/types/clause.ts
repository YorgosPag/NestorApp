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
 *
 * 🔑 **Χρόνος = ISO 8601 `string`** σε βάση, σύρμα και πελάτη (ADR-663 §4, όπως ο κατάλογος ADR-923): **μία**
 * αναπαράσταση, και το έγγραφο περνά αυτούσιο από canonical JSON (ADR-928 Φ1 απόφαση 1).
 */

import type { CalendarDay } from '@/constants/platform-operator';
import type { ClauseLanguage, ClauseParameterDefinition, LocalizedText } from './clause-parameter';

/** Η μόνη νομικά δεσμευτική γλώσσα (ADR-928 §5.2.2). */
export const CLAUSE_AUTHORITATIVE_LANGUAGE = 'el' as const satisfies ClauseLanguage;

/** Ο προτείνων των εκδόσεων της προεπιλεγμένης βιβλιοθήκης — **όχι** άνθρωπος, άρα κάθε άνθρωπος μπορεί να εγκρίνει. */
export const DEFAULT_LIBRARY_PROPOSER = 'system:default-library';

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

/** Προέλευση μετάφρασης: άνθρωπος, ή πρόχειρο μηχανής που **πάντα** εγκρίνει άνθρωπος (§5.2.2). */
export const CLAUSE_TRANSLATION_ORIGINS = ['human', 'machine_draft'] as const;
export type ClauseTranslationOrigin = (typeof CLAUSE_TRANSLATION_ORIGINS)[number];

/**
 * Μετάφραση ανά έκδοση (§5.2.2). 🔑 Το `sourceHash` είναι το sha256 του **ελληνικού** σώματος τη στιγμή της
 * μετάφρασης: αλλάζει το ελληνικό ⇒ το hash δεν ταιριάζει ⇒ η μετάφραση **δομικά** παύει να είναι εγκεκριμένη.
 */
export interface ClauseTranslation {
  readonly body: ClauseBody;
  readonly status: 'draft' | 'approved';
  readonly origin: ClauseTranslationOrigin;
  readonly sourceHash: string;
  readonly proposedBy: string;
  readonly approvedBy: string | null;
  readonly approvedAt: string | null;
}

/** Η ταυτότητα της ρήτρας — ό,τι ΔΕΝ αλλάζει με τις εκδόσεις. */
export interface SubcontractClause {
  readonly id: string;                         // sccl_*
  readonly companyId: string;
  readonly clauseKey: ClauseKey;
  readonly title: LocalizedText;
  /** Η εγκεκριμένη έκδοση σε ισχύ σήμερα, ή `null` πριν την πρώτη έγκριση. */
  readonly currentVersion: number | null;
  /** Η μεγαλύτερη έκδοση που γράφτηκε (κάθε κατάστασης) — η επόμενη πρόταση είναι η `latestVersion + 1`. */
  readonly latestVersion: number;
  /** Η ανοιχτή πρόταση, αν υπάρχει. **Μία** ανά ρήτρα (Φ1 απόφαση 3). */
  readonly openProposal: number | null;
  readonly isArchived: boolean;
  /** CAS (ADR-923 §5.9): κάθε αλλαγή +1. */
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string;
  readonly updatedBy: string;
}

/**
 * Ό,τι ορίζει ο άνθρωπος για μια **νέα** ρήτρα ή έκδοση — το περίβλημα (ids, κατάσταση, αποτυπώματα, σφραγίδες) το
 * γράφει ο γραφέας. Και η μορφή κάθε εγγραφής της προεπιλεγμένης βιβλιοθήκης.
 */
export interface SubcontractClauseDraft {
  readonly clauseKey: ClauseKey;
  readonly title: LocalizedText;
  readonly body: ClauseBody;
  readonly parameters: readonly ClauseParameterDefinition[];
}

/** Αμετάβλητη έκδοση ρήτρας. Η αλλαγή κειμένου είναι ΠΑΝΤΑ νέα έκδοση· μόνο η διακυβέρνηση γράφει εδώ μετά. */
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
  /** sha256 του canonical JSON του `body` + `parameters` — δένει αναθεωρήσεις συμφωνητικών. */
  readonly contentHash: string;
  /** sha256 του canonical JSON του ελληνικού `body` — δένει τις μεταφράσεις. */
  readonly sourceHash: string;
  /** Διάκριση καθηκόντων: ο προτείνων δεν εγκρίνει τη δική του πρόταση. */
  readonly proposedBy: string;
  readonly proposalReason: string | null;
  readonly decidedBy: string | null;
  readonly decidedAt: string | null;
  readonly decisionReason: string | null;
  readonly reviewedBy: string | null;
  readonly reviewedAt: string | null;
  readonly createdAt: string;
  /** CAS της έκδοσης — η διακυβέρνηση (έγκριση, έλεγχος, μετάφραση) την ανεβάζει. */
  readonly revision: number;
  readonly updatedAt: string;
  readonly updatedBy: string;
}
