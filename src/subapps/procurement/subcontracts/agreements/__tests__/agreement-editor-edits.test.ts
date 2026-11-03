/**
 * ADR-928 Φ3γ — οι πράξεις του επεξεργαστή πάνω στις ρήτρες και η πύλη της απόφασης απόκλισης, ελεγμένες απέναντι
 * στον ΙΔΙΟ κριτή με τον γραφέα.
 */

import { draftInputOf } from '../agreement-draft-input';
import { deviationDecisionBlock, deviationRowsOf } from '../deviation-decisions';
import {
  addClause,
  removeClause,
  resetClauseParameter,
  setClauseDeviationReason,
  setClauseParameterValue,
  upgradeClauseVersion,
} from '../draft-clause-edits';
import { judgeAgreementDraft } from '../judge-agreement-draft';
import { judgeClauseSelections } from '../judge-deviations';
import { LIBRARY, sampleAgreement } from './agreement-fixtures';

const CONTEXT = { library: LIBRARY, previous: [], actorUid: 'u_author', today: '2026-11-03' };
const codes = (issues: readonly { code: string }[]) => issues.map((issue) => issue.code);
const CHEQUE = { kind: 'enum' as const, value: 'cheque' };

describe('draft-clause-edits — κάθε αλλαγή με έναν κανόνα', () => {
  const draft = draftInputOf(sampleAgreement());

  it('τιμή εκτός ελεύθερης ζώνης ⇒ ο κριτής ζητά λόγο· με λόγο ⇒ απόκλιση εκκρεμής', () => {
    const changed = setClauseParameterValue(draft, 1, 'instrument', CHEQUE);
    expect(codes(judgeAgreementDraft(changed, CONTEXT).issues)).toEqual(['deviationReasonRequired']);
    const reasoned = setClauseDeviationReason(changed, 1, 'instrument', 'επιταγή 4 μηνών');
    const judged = judgeAgreementDraft(reasoned, CONTEXT);
    expect(judged.issues).toEqual([]);
    expect(judged.selections[1].deviations.instrument.decision).toBe('pending');
  });

  it('επιστροφή στην προτιμώμενη σβήνει ΚΑΙ τον λόγο (αλλιώς θα ζητούσε έγκριση για τίποτα)', () => {
    const reasoned = setClauseDeviationReason(setClauseParameterValue(draft, 1, 'instrument', CHEQUE), 1, 'instrument', 'λόγος');
    const reset = resetClauseParameter(reasoned, 1, 'instrument');
    expect(reset.clauses[1].parameterValues).toEqual({});
    expect(reset.clauses[1].deviationReasons).toEqual({});
    expect(judgeAgreementDraft(reset, CONTEXT).selections[1].deviations).toEqual({});
  });

  it('προσθήκη ρήτρας: έκδοση σε ισχύ, ιδεμποτική· αφαίρεση', () => {
    const inForce = LIBRARY.get('payment.instruments');
    if (!inForce) throw new Error('fixture');
    const only = removeClause(draft, 1);
    const added = addClause(only, 'payment.instruments', inForce);
    expect(added.clauses.map((clause) => [clause.clauseKey, clause.version])).toEqual([['retention.performance', 1], ['payment.instruments', 2]]);
    expect(addClause(added, 'payment.instruments', inForce)).toBe(added);
  });

  it('ενημέρωση στην έκδοση σε ισχύ: κρατά μόνο ό,τι επιβιώνει — ο κριτής δεν βρίσκει άγνωστη παράμετρο', () => {
    const inForce = LIBRARY.get('payment.instruments');
    if (!inForce) throw new Error('fixture');
    const outdated = { ...draft, clauses: [{ clauseKey: 'payment.instruments', version: 1, parameterValues: { instrument: CHEQUE, gone: CHEQUE }, deviationReasons: { instrument: 'λόγος', gone: 'x' } }] };
    expect(codes(judgeAgreementDraft(outdated, CONTEXT).issues)).toEqual(['clauseVersionOutdated']);
    const upgraded = upgradeClauseVersion(outdated, 0, inForce);
    expect(upgraded.clauses[0]).toEqual({ clauseKey: 'payment.instruments', version: 2, parameterValues: { instrument: CHEQUE }, deviationReasons: { instrument: 'λόγος' } });
    expect(judgeAgreementDraft(upgraded, CONTEXT).issues).toEqual([]);
  });
});

describe('deviationDecisionBlock — οι φύλακες του γραφέα, στην ίδια σειρά', () => {
  const pending = judgeClauseSelections(
    [{ clauseKey: 'payment.instruments', version: 2, parameterValues: { instrument: CHEQUE }, deviationReasons: { instrument: 'λόγος' } }],
    LIBRARY, sampleAgreement().terms, [], { uid: 'u_author' },
  ).selections;
  const agreement = sampleAgreement({ clauses: pending });
  const [row] = deviationRowsOf(agreement);
  const allowed = { actorUid: 'u_admin', canApprove: true, unsaved: false };

  it('μία γραμμή ανά απόκλιση, με ρήτρα και παράμετρο', () => {
    expect(deviationRowsOf(agreement).map((entry) => [entry.clauseKey, entry.parameterKey])).toEqual([['payment.instruments', 'instrument']]);
  });

  it('άλλος με δικαίωμα ⇒ κρίνει· ο αιτών ΠΟΤΕ', () => {
    expect(deviationDecisionBlock(agreement, row, allowed)).toBeNull();
    expect(deviationDecisionBlock(agreement, row, { ...allowed, actorUid: 'u_author' })).toBe('ownRequest');
  });

  it('χωρίς δικαίωμα · εκτός πρόχειρου · ήδη κριμένη · με μη αποθηκευμένες αλλαγές', () => {
    expect(deviationDecisionBlock(agreement, row, { ...allowed, canApprove: false })).toBe('notAuthorized');
    expect(deviationDecisionBlock({ status: 'issued' }, row, allowed)).toBe('notDraft');
    expect(deviationDecisionBlock(agreement, { ...row, deviation: { ...row.deviation, decision: 'approved' } }, allowed)).toBe('notPending');
    expect(deviationDecisionBlock(agreement, row, { ...allowed, unsaved: true })).toBe('unsavedChanges');
  });
});
