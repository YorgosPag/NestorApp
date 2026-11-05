/**
 * @fileoverview **Οι πράξεις της βιβλιοθήκης υπεργολαβίας, όπως τις στέλνει η οθόνη** — μεταφορά, όχι κρίση (ADR-928
 *   §5.13 · Φ3γ-0).
 * @related subapps/procurement/subcontracts/subcontract-routes.ts (οι διαδρομές) · app/api/subcontracts/{clauses,
 *   trade-templates,library}/** (ο αυθεντικός γραφέας) · services/procurement/subcontracts/subcontract-failure.ts
 * @module services/procurement/subcontracts/subcontract-library-api.client
 *
 * 🔑 Τα σώματα είναι **οι τύποι των ίδιων zod schemas** που κρίνουν οι διαδρομές (`z.infer`, μόνο τύπος — κανένα
 *    σχήμα δεν φτάνει στο bundle): αλλαγή πεδίου στη διαδρομή σπάει εδώ τη μεταγλώττιση, όχι το αίτημα στην παραγωγή.
 * 🔑 `apiClient` ⇒ `Idempotency-Key` σε κάθε εγγραφή (CHECK 3.92): η επανάληψη μετά από διακοπή δεν εγκρίνει δύο φορές.
 * 🔑 Καμία κρίση εδώ: η οθόνη κρίνει με τους **ίδιους** φύλακες (`library-action-blocks` → `clause-governance`) και ο
 *    γραφέας ξανακρίνει. Οι αναγνώσεις ακούν απευθείας τη Firestore (`useSubcontractLibrary`).
 */

import type { z } from 'zod';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type {
  approveClauseVersionBodySchema,
  archiveBodySchema,
  createClauseBodySchema,
  decideClauseVersionBodySchema,
  proposeClauseVersionBodySchema,
  proposeTranslationBodySchema,
  revisionOnlyBodySchema,
} from '@/subapps/procurement/subcontracts/schema/clause.schema';
import type { createTradeTemplateBodySchema, updateTradeTemplateBodySchema } from '@/subapps/procurement/subcontracts/schema/trade-template.schema';
import { SUBCONTRACT_API } from '@/subapps/procurement/subcontracts/subcontract-routes';
import type { SubcontractClause, SubcontractClauseVersion } from '@/subapps/procurement/subcontracts/types/clause';
import type { DefaultLibrarySeedReport } from '@/subapps/procurement/subcontracts/types/library-seed';
import type { SubcontractTradeTemplate } from '@/subapps/procurement/subcontracts/types/trade-template';

export type ApproveClauseVersionInput = z.infer<typeof approveClauseVersionBodySchema>;
export type DecideClauseVersionInput = z.infer<typeof decideClauseVersionBodySchema>;
export type ProposeTranslationInput = z.infer<typeof proposeTranslationBodySchema>;
export type CreateClauseInput = z.infer<typeof createClauseBodySchema>;
export type ProposeClauseVersionInput = z.infer<typeof proposeClauseVersionBodySchema>;
export type CreateTradeTemplateInput = z.infer<typeof createTradeTemplateBodySchema>;
export type UpdateTradeTemplateInput = z.infer<typeof updateTradeTemplateBodySchema>;
type RevisionOnlyInput = z.infer<typeof revisionOnlyBodySchema>;
type ArchiveInput = z.infer<typeof archiveBodySchema>;

/** Η αναφορά έκδοσης που στοχεύει μια πράξη: ρήτρα + αριθμός έκδοσης. */
export interface ClauseVersionRef {
  readonly clauseId: string;
  readonly version: number;
}

const clauses = SUBCONTRACT_API.clauses;

/** Σπορά της προτεινόμενης βιβλιοθήκης — ιδεμποτική· ρήτρες ως προτάσεις, πρότυπα όσα περνούν τον έλεγχο. */
export function seedSubcontractLibrary(): Promise<DefaultLibrarySeedReport> {
  return apiClient.post<DefaultLibrarySeedReport>(SUBCONTRACT_API.library.seed, {});
}

/** Έγκριση πρότασης — από **άλλον** από τον προτείνοντα (403 `selfApproval` αλλιώς). */
export function approveClauseVersion(ref: ClauseVersionRef, input: ApproveClauseVersionInput): Promise<SubcontractClauseVersion> {
  return apiClient.post<SubcontractClauseVersion>(clauses.versionAction(ref.clauseId, ref.version, 'approve'), input);
}

export function rejectClauseVersion(ref: ClauseVersionRef, input: DecideClauseVersionInput): Promise<SubcontractClauseVersion> {
  return apiClient.post<SubcontractClauseVersion>(clauses.versionAction(ref.clauseId, ref.version, 'reject'), input);
}

/** Απόσυρση — μόνο ο προτείνων (403 `notProposer` αλλιώς). */
export function withdrawClauseVersion(ref: ClauseVersionRef, input: DecideClauseVersionInput): Promise<SubcontractClauseVersion> {
  return apiClient.post<SubcontractClauseVersion>(clauses.versionAction(ref.clauseId, ref.version, 'withdraw'), input);
}

/** «Ελέγχθηκε νομικά» σε εγκεκριμένη έκδοση. */
export function markClauseVersionReviewed(ref: ClauseVersionRef, input: RevisionOnlyInput): Promise<SubcontractClauseVersion> {
  return apiClient.post<SubcontractClauseVersion>(clauses.versionAction(ref.clauseId, ref.version, 'review'), input);
}

export function proposeClauseTranslation(ref: ClauseVersionRef, input: ProposeTranslationInput): Promise<SubcontractClauseVersion> {
  return apiClient.post<SubcontractClauseVersion>(clauses.translations(ref.clauseId, ref.version), input);
}

/** Έγκριση μετάφρασης — τρέχουσα (`translationStale` 409 αλλιώς) και από άλλον από τον μεταφραστή. */
export function approveClauseTranslation(ref: ClauseVersionRef, language: string, input: RevisionOnlyInput): Promise<SubcontractClauseVersion> {
  return apiClient.post<SubcontractClauseVersion>(clauses.approveTranslation(ref.clauseId, ref.version, language), input);
}

export function setClauseArchived(clauseId: string, input: ArchiveInput): Promise<SubcontractClause> {
  return apiClient.put<SubcontractClause>(clauses.archive(clauseId), input);
}

export function setTradeTemplateArchived(templateId: string, input: ArchiveInput): Promise<SubcontractTradeTemplate> {
  return apiClient.put<SubcontractTradeTemplate>(SUBCONTRACT_API.tradeTemplates.archive(templateId), input);
}

// ── Συγγραφή (ADR-928 §5.22 · Φ3γ-0b) ──────────────────────────────────────────

/** Νέα ρήτρα: γεννιέται με την έκδοση 1 ως **πρόταση** — ισχύει μόνο αφού την εγκρίνει άλλος (409 `duplicate` αν το κλειδί υπάρχει). */
export function createClause(input: CreateClauseInput): Promise<SubcontractClause> {
  return apiClient.post<SubcontractClause>(clauses.collection, input);
}

/** Νέα έκδοση υπάρχουσας ρήτρας ως πρόταση (CAS στη ρήτρα· 409 `proposalPending` αν υπάρχει ήδη ανοιχτή). */
export function proposeClauseVersion(clauseId: string, input: ProposeClauseVersionInput): Promise<SubcontractClauseVersion> {
  return apiClient.post<SubcontractClauseVersion>(clauses.versions(clauseId), input);
}

export function createTradeTemplate(input: CreateTradeTemplateInput): Promise<SubcontractTradeTemplate> {
  return apiClient.post<SubcontractTradeTemplate>(SUBCONTRACT_API.tradeTemplates.collection, input);
}

/** Ολική αντικατάσταση του ορισμού με CAS· ο κωδικός μένει αμετάβλητος (ο γραφέας τον κρατά). */
export function updateTradeTemplate(templateId: string, input: UpdateTradeTemplateInput): Promise<SubcontractTradeTemplate> {
  return apiClient.put<SubcontractTradeTemplate>(SUBCONTRACT_API.tradeTemplates.item(templateId), input);
}
