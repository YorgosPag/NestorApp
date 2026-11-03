/**
 * @fileoverview **Οι αποκλίσεις ενός συμφωνητικού και ποιος μπορεί να τις κρίνει τώρα** — καθαρό (ADR-928 §5.2.1
 *   τρόπος 3 · Φ2 απόφαση 6 · Φ3γ απόφαση 6).
 * @module subapps/procurement/subcontracts/agreements/deviation-decisions
 *
 * 🔑 **Οι ίδιοι φύλακες με τον γραφέα** (`agreement-deviation-writer.server.ts`), στην ίδια σειρά: δικαίωμα ·
 *    `refuseDeviationDecision` (μόνο πρόχειρο) · εκκρεμής απόκλιση · `refuseOwnRequest` (μόνο **άλλος** από τον αιτούντα).
 *    Ένας κανόνας για εκδόσεις ρητρών, μεταφράσεις και αποκλίσεις — δεν ξαναγράφεται εδώ.
 * 🔑 Μία ακόμη πύλη που ο γραφέας δεν χρειάζεται: **μη αποθηκευμένες αλλαγές του ίδιου θεατή** — η απόφαση γράφει πάνω
 *    στην αποθηκευμένη αναθεώρηση, και ο άνθρωπος θα έκρινε κάτι διαφορετικό από ό,τι βλέπει στη φόρμα του.
 */

import { refuseOwnRequest } from '../clauses/clause-governance';
import type { SubcontractAgreement } from '../types/agreement';
import type { ClauseDeviation } from '../types/commercial-terms';
import { refuseDeviationDecision } from './agreement-lifecycle';

export interface DeviationRow {
  readonly clauseKey: string;
  readonly parameterKey: string;
  readonly deviation: ClauseDeviation;
}

/** Γιατί ο θεατής δεν κρίνει αυτή την απόκλιση τώρα. Μόνο το `unsavedChanges` φαίνεται ως ανενεργό κουμπί· τα άλλα κρύβουν. */
export type DeviationDecisionBlock = 'notAuthorized' | 'notDraft' | 'notPending' | 'ownRequest' | 'unsavedChanges';

export interface DeviationDecisionContext {
  readonly actorUid: string;
  readonly canApprove: boolean;
  readonly unsaved: boolean;
}

export function deviationRowsOf(agreement: SubcontractAgreement): DeviationRow[] {
  return agreement.clauses.flatMap((selection) =>
    Object.entries(selection.deviations).map(([parameterKey, deviation]) => ({ clauseKey: selection.clauseKey, parameterKey, deviation })),
  );
}

export function deviationDecisionBlock(
  agreement: Pick<SubcontractAgreement, 'status'>,
  row: DeviationRow,
  context: DeviationDecisionContext,
): DeviationDecisionBlock | null {
  if (!context.canApprove) return 'notAuthorized';
  if (refuseDeviationDecision(agreement.status) !== null) return 'notDraft';
  if (row.deviation.decision !== 'pending') return 'notPending';
  if (refuseOwnRequest(row.deviation.requestedBy, context.actorUid) !== null) return 'ownRequest';
  return context.unsaved ? 'unsavedChanges' : null;
}
