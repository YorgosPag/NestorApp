/**
 * ADR-928 Φ2 — κρίση ρητρών συμφωνητικού: καρφωμένη έκδοση, ζώνες, αποκλίσεις δεμένες με την τιμή.
 */

import { judgeClauseSelections, selectionInputsOf } from '../judge-deviations';
import { instrumentInput, LIBRARY, plasteringTerms, retentionInput, termsWithRetention } from './agreement-fixtures';

const ENGINEER = { uid: 'u-engineer' };
const codes = (result: { issues: readonly { code: string }[] }) => result.issues.map((issue) => issue.code);

describe('ελεύθερες ζώνες', () => {
  it('προτιμώμενες τιμές ⇒ καμία απόκλιση· η τιμή της ρήτρας γράφεται ρητά, η δεσμευμένη ΟΧΙ', () => {
    const result = judgeClauseSelections([retentionInput, instrumentInput('bank')], LIBRARY, plasteringTerms, [], ENGINEER);
    expect(result.issues).toEqual([]);
    expect(result.selections.map((selection) => selection.deviations)).toEqual([{}, {}]);
    expect(result.selections[0].parameterValues).toEqual({});
    expect(result.selections[1]).toMatchObject({ clauseId: 'sccl_instruments', version: 2, parameterValues: { instrument: { kind: 'enum', value: 'bank' } } });
  });

  it('κράτηση 8% στους όρους = αποδεκτή ⇒ περνά χωρίς έγκριση', () => {
    expect(judgeClauseSelections([retentionInput], LIBRARY, termsWithRetention(800), [], ENGINEER).issues).toEqual([]);
  });
});

describe('αποκλίσεις', () => {
  it('επιταγή (εκτός αποδεκτών) χωρίς λόγο ⇒ 422· με λόγο ⇒ εκκρεμής απόκλιση με την ΤΙΜΗ', () => {
    expect(codes(judgeClauseSelections([instrumentInput('cheque')], LIBRARY, plasteringTerms, [], ENGINEER))).toEqual(['deviationReasonRequired']);
    const result = judgeClauseSelections([instrumentInput('cheque', 'Ζήτησε επιταγή 4 μηνών')], LIBRARY, plasteringTerms, [], ENGINEER);
    expect(result.selections[0].deviations.instrument).toMatchObject({
      value: { kind: 'enum', value: 'cheque' }, reason: 'Ζήτησε επιταγή 4 μηνών', requestedBy: ENGINEER.uid, decision: 'pending',
    });
  });

  it('μετρητά = απαγορευμένα ⇒ 422, ακόμη και με λόγο', () => {
    expect(codes(judgeClauseSelections([instrumentInput('cash', 'πάντα έτσι')], LIBRARY, plasteringTerms, [], ENGINEER))).toEqual(['deviationForbidden']);
  });

  it('δεσμευμένη παράμετρος: κρίνεται από τους ΟΡΟΥΣ — 12% θέλει λόγο, 2% απαγορεύεται', () => {
    const outside = judgeClauseSelections([{ ...retentionInput, deviationReasons: { rate: 'μεγάλο έργο' } }], LIBRARY, termsWithRetention(1200), [], ENGINEER);
    expect(outside.selections[0].deviations.rate).toMatchObject({ value: { kind: 'percent', value: 1200 }, decision: 'pending' });
    expect(codes(judgeClauseSelections([retentionInput], LIBRARY, termsWithRetention(200), [], ENGINEER))).toEqual(['deviationForbidden']);
  });

  it('ο πελάτης ΔΕΝ στέλνει τιμή δεσμευμένης ή άγνωστης παραμέτρου', () => {
    const forged = { ...retentionInput, parameterValues: { rate: { kind: 'percent' as const, value: 500 }, ghost: { kind: 'days' as const, value: 1 } } };
    expect(codes(judgeClauseSelections([forged], LIBRARY, plasteringTerms, [], ENGINEER)).sort()).toEqual(['overrideOnBoundParameter', 'overrideUnknownParameter']);
  });
});

describe('η απόφαση ακολουθεί την τιμή', () => {
  const pending = judgeClauseSelections([instrumentInput('cheque', 'λόγος')], LIBRARY, plasteringTerms, [], ENGINEER).selections;
  const approved = pending.map((selection) => ({
    ...selection,
    deviations: { instrument: { ...selection.deviations.instrument, decision: 'approved' as const, decidedBy: 'u-admin' } },
  }));

  it('ίδια τιμή, χωρίς νέο λόγο ⇒ η έγκριση ΜΕΝΕΙ (και στο ξανακρίσιμο από αποθηκευμένο)', () => {
    const again = judgeClauseSelections(selectionInputsOf(approved), LIBRARY, plasteringTerms, approved, { uid: 'u-other' });
    expect(again.selections[0].deviations.instrument).toMatchObject({ decision: 'approved', decidedBy: 'u-admin' });
  });

  it('νέος λόγος για την ίδια τιμή ⇒ ξανά εκκρεμής (η έγκριση ήταν για άλλη αιτιολόγηση)', () => {
    const again = judgeClauseSelections([instrumentInput('cheque', 'άλλος λόγος')], LIBRARY, plasteringTerms, approved, ENGINEER);
    expect(again.selections[0].deviations.instrument.decision).toBe('pending');
  });

  it('🔴 εγκρίθηκε κράτηση 12% και ο όρος έγινε 13% ⇒ η έγκριση ΔΕΝ μεταφέρεται: εκκρεμής, με τη ΝΕΑ τιμή', () => {
    const input = { ...retentionInput, deviationReasons: { rate: 'μεγάλο έργο' } };
    const [asked] = judgeClauseSelections([input], LIBRARY, termsWithRetention(1200), [], ENGINEER).selections;
    const approvedRate = [{ ...asked, deviations: { rate: { ...asked.deviations.rate, decision: 'approved' as const, decidedBy: 'u-admin' } } }];
    const moved = judgeClauseSelections([input], LIBRARY, termsWithRetention(1300), approvedRate, ENGINEER);
    expect(moved.selections[0].deviations.rate).toMatchObject({ value: { kind: 'percent', value: 1300 }, decision: 'pending', decidedBy: null });
    const silent = judgeClauseSelections([retentionInput], LIBRARY, termsWithRetention(1300), approvedRate, ENGINEER);
    expect(silent.issues.map((issue) => issue.code)).toEqual(['deviationReasonRequired']);
  });

  it('τιμή πίσω στην προτιμώμενη ⇒ η απόκλιση ΣΒΗΝΕΤΑΙ', () => {
    expect(judgeClauseSelections([instrumentInput('bank')], LIBRARY, plasteringTerms, approved, ENGINEER).selections[0].deviations).toEqual({});
  });
});

describe('καρφωμένη έκδοση', () => {
  it('παλιά έκδοση ⇒ clauseVersionOutdated · άγνωστη · χωρίς εγκεκριμένη · διπλή', () => {
    const inputs = [
      { ...retentionInput, version: 0 },
      { ...retentionInput, clauseKey: 'ghost.clause' },
      { ...retentionInput, clauseKey: 'crew.composition' },
      instrumentInput('bank'),
      instrumentInput('bank'),
    ];
    expect(codes(judgeClauseSelections(inputs, LIBRARY, plasteringTerms, [], ENGINEER))).toEqual([
      'clauseVersionOutdated', 'clauseRefUnknown', 'clauseRefNotApproved', 'clauseRefDuplicate',
    ]);
  });
});
