import 'server-only';

/**
 * Ο γραφέας των **αποφάσεων απόκλισης** ενός συμφωνητικού (ADR-928 §5.2.1 τρόπος 3 · Φ2 απόφαση 6).
 *
 * 🔑 **Διάκριση καθηκόντων**: όποιος ζήτησε την απόκλιση δεν την αποφασίζει (`refuseOwnRequest`, ο **ίδιος** κανόνας με
 *    την έγκριση έκδοσης ρήτρας). Το **δικαίωμα** (`subcontracts:agreements:approve_deviation`) το κρίνει το σύνορο.
 * 🔑 Αποφασίζεται **μόνο** εκκρεμής απόκλιση, **μόνο** σε πρόχειρο, με CAS — η απόφαση είναι για τη συγκεκριμένη τιμή που
 *    διάβασε ο εγκρίνων· αν στο μεταξύ άλλαξε η τιμή, ο CAS το πιάνει.
 * 🔑 Η απόρριψη **δεν** σβήνει την απόκλιση: η έκδοση μένει μπλοκαρισμένη ώσπου ο συντάκτης να αλλάξει την τιμή.
 * @module server/subcontracts/agreement-deviation-writer.server
 */

import type { AuthContext } from '@/lib/auth';
import { refuseDeviationDecision } from '@/subapps/procurement/subcontracts/agreements/agreement-lifecycle';
import { refuseOwnRequest } from '@/subapps/procurement/subcontracts/clauses/clause-governance';
import type { SubcontractAgreement } from '@/subapps/procurement/subcontracts/types/agreement';
import type { ClauseDeviation, ClauseSelection } from '@/subapps/procurement/subcontracts/types/commercial-terms';
import { agreementDocRef, assertRevision, readOwned, runSubcontractTransaction, stageUpdate } from './subcontract-store.server';
import { assertGovernance, SubcontractWriteError } from './subcontract-write-error';

export interface DeviationDecisionInput {
  readonly expectedRevision: number;
  readonly clauseKey: string;
  readonly parameterKey: string;
  readonly decision: 'approved' | 'rejected';
  readonly reason: string | null;
}

/** Η απόκλιση-στόχος, ή `notFound` (ανύπαρκτη ρήτρα/παράμετρος ≡ καμία απόκλιση εκεί). */
function targetDeviation(agreement: SubcontractAgreement, input: DeviationDecisionInput): ClauseDeviation {
  const selection = agreement.clauses.find((clause) => clause.clauseKey === input.clauseKey);
  const deviation = selection?.deviations[input.parameterKey];
  if (!deviation) throw new SubcontractWriteError('notFound', [], { clauseKey: input.clauseKey, parameterKey: input.parameterKey });
  return deviation;
}

/** Οι επιλογές με την απόφαση γραμμένη στη μία απόκλιση — όλα τα άλλα αμετάβλητα. */
function withDecision(clauses: readonly ClauseSelection[], input: DeviationDecisionInput, decided: ClauseDeviation): ClauseSelection[] {
  return clauses.map((selection) => selection.clauseKey !== input.clauseKey
    ? selection
    : { ...selection, deviations: { ...selection.deviations, [input.parameterKey]: decided } });
}

export function decideSubcontractAgreementDeviation(ctx: AuthContext, agreementId: string, input: DeviationDecisionInput): Promise<SubcontractAgreement> {
  return runSubcontractTransaction(ctx, async (scope) => {
    const ref = agreementDocRef(scope.db, agreementId);
    const current = await readOwned(scope, 'agreement', ref);
    assertRevision(current, input.expectedRevision);
    assertGovernance(refuseDeviationDecision(current.status));
    const deviation = targetDeviation(current, input);
    if (deviation.decision !== 'pending') throw new SubcontractWriteError('invalidTransition');
    assertGovernance(refuseOwnRequest(deviation.requestedBy, ctx.uid));
    const decided: ClauseDeviation = { ...deviation, decision: input.decision, decidedBy: ctx.uid, decidedAt: scope.now, decisionReason: input.reason };
    return stageUpdate(scope, 'agreement', ref, current, { clauses: withDecision(current.clauses, input, decided) });
  });
}
