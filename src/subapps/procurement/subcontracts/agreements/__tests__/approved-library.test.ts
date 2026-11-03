/**
 * ADR-928 Φ3α-2 — η μία προβολή της εγκεκριμένης βιβλιοθήκης (γραφέας + οθόνη) και η εκτιμώμενη αξία.
 */

import type { SubcontractClause, SubcontractClauseVersion } from '../../types/clause';
import { estimatedAgreementValue, estimatedLineAmount } from '../../lines/line-amount';
import { approvedLibraryFrom, approvedLibraryOf, pinnedClauseOf } from '../approved-library';
import { boundRetention, SAMPLE_LINE } from './agreement-fixtures';

const clause = (patch: Partial<SubcontractClause> = {}): SubcontractClause => ({
  id: 'sccl_retention', companyId: 'comp_1', clauseKey: 'retention.performance', title: { el: 'Κράτηση' },
  currentVersion: 2, latestVersion: 2, openProposal: null, isArchived: false, revision: 1,
  createdAt: '', updatedAt: '', createdBy: 'u', updatedBy: 'u', ...patch,
} as SubcontractClause);

const version = (number: number): SubcontractClauseVersion => ({
  id: `sccv_${number}`, clauseId: 'sccl_retention', version: number, parameters: [boundRetention],
} as SubcontractClauseVersion);

describe('approved-library — ίδια προβολή για γραφέα και οθόνη', () => {
  it('η έκδοση σε ισχύ γίνεται είσοδος του κριτή', () => {
    const library = approvedLibraryFrom([clause()], new Map([['sccl_retention', version(2)]]));
    expect(library.get('retention.performance')).toEqual({ clauseId: 'sccl_retention', version: 2, parameters: [boundRetention] });
  });

  it('έκδοση ΑΛΛΗ από το currentVersion (παλιά στη μνήμη) ⇒ ΔΕΝ είναι σε ισχύ (fail-closed)', () => {
    expect(pinnedClauseOf(clause(), new Map([['sccl_retention', version(1)]]))).toBeNull();
    expect(approvedLibraryFrom([clause()], new Map([['sccl_retention', version(1)]])).get('retention.performance')).toBeNull();
  });

  it('ρήτρα χωρίς εγκεκριμένη έκδοση ⇒ `null`· αρχειοθετημένη ⇒ εκτός χάρτη («άγνωστη»)', () => {
    const library = approvedLibraryFrom(
      [clause({ currentVersion: null }), clause({ id: 'sccl_old', clauseKey: 'old.clause', isArchived: true })],
      new Map(),
    );
    expect(library.get('retention.performance')).toBeNull();
    expect(library.has('old.clause')).toBe(false);
  });

  it('η προβολή του γραφέα δίνει το ίδιο αποτέλεσμα με της οθόνης για τα ίδια δεδομένα', () => {
    const pinned = new Map([['retention.performance', { clause: clause(), version: version(2) }]]);
    expect(approvedLibraryOf(pinned)).toEqual(approvedLibraryFrom([clause()], new Map([['sccl_retention', version(2)]])));
  });
});

describe('line-amount — ακέραια λεπτά, ειλικρινές άθροισμα', () => {
  it('τιμή μονάδας × ποσότητα σε χιλιοστά, στρογγύλευση μία φορά στο λεπτό', () => {
    expect(estimatedLineAmount({ ...SAMPLE_LINE, unitPrice: 333, estimatedMilliQuantity: 1500 })).toBe(500);
    expect(estimatedLineAmount({ ...SAMPLE_LINE, unitPrice: 900, estimatedMilliQuantity: 120_000 })).toBe(108_000);
  });

  it('κατ\' αποκοπή = η τιμή, με ή χωρίς ποσότητα· τιμή μονάδας χωρίς εκτίμηση ⇒ καμία αξία (όχι μηδέν)', () => {
    expect(estimatedLineAmount({ ...SAMPLE_LINE, pricing: 'lump_sum', unitPrice: 50_000, estimatedMilliQuantity: null })).toBe(50_000);
    expect(estimatedLineAmount({ ...SAMPLE_LINE, estimatedMilliQuantity: null })).toBeNull();
    expect(estimatedLineAmount({ ...SAMPLE_LINE, pricing: 'day_rate', estimatedMilliQuantity: null })).toBeNull();
  });

  it('το σύνολο λέει πόσες γραμμές λείπουν από τον αριθμό', () => {
    const value = estimatedAgreementValue([
      { ...SAMPLE_LINE, pricing: 'lump_sum', unitPrice: 50_000 },
      { ...SAMPLE_LINE, estimatedMilliQuantity: null },
    ]);
    expect(value).toEqual({ amount: 50_000, unpricedLines: 1 });
  });
});
