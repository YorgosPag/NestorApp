'use client';

/**
 * Η γέφυρα όρος ↔ ρήτρα **για τον επεξεργαστή συμφωνητικού** (ADR-928 Φ3γ-2 απόφαση 2): ζώνες από το καθαρό
 * `boundTermsOf` πάνω στο **πρόχειρο**, ο λόγος γράφεται με το ΕΝΑ `setClauseDeviationReason`, και οι τίτλοι ρητρών
 * έρχονται από τη βιβλιοθήκη (ποτέ ο κωδικός μπροστά στον άνθρωπο).
 */

import { useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage } from '@/i18n/languages';
import { useSubcontractClauseLibrary } from '@/hooks/procurement/subcontracts/useSubcontractLibrary';
import { boundTermsAt, boundTermsOf, type BoundTerm } from '@/subapps/procurement/subcontracts/agreements/bound-terms';
import { setClauseDeviationReason } from '@/subapps/procurement/subcontracts/agreements/draft-clause-edits';
import { localizedIn } from '@/subapps/procurement/subcontracts/document/render-parameter-value';
import type { BoundTermsView } from '../sections/section-types';
import type { AgreementEditor } from './useAgreementEditor';

/** Οι δύο προβολές: των όρων (πρόθεμα `''`) και του σχεδίου πληρωμών (πρόθεμα `paymentPlan`). */
export function useBoundTermsViews(editor: AgreementEditor): { readonly terms: BoundTermsView; readonly plan: BoundTermsView } {
  const { i18n } = useTranslation('procurement');
  const language = resolveHumanLanguage(i18n.language);
  const { clauses, library } = useSubcontractClauseLibrary();
  const { draft, update } = editor;
  const bound = useMemo(() => boundTermsOf(draft.clauses, library, draft.terms), [draft.clauses, library, draft.terms]);
  return useMemo(() => {
    const titles = new Map(clauses.map((clause) => [clause.clauseKey, localizedIn(clause.title, language)]));
    const shared = {
      setReason: (one: BoundTerm, reason: string) =>
        update(setClauseDeviationReason(draft, one.clauseIndex, one.definition.key, reason)),
      titleOf: (clauseKey: string) => titles.get(clauseKey) ?? clauseKey,
    };
    return { terms: { ...shared, at: boundTermsAt(bound, '') }, plan: { ...shared, at: boundTermsAt(bound, 'paymentPlan') } };
  }, [bound, clauses, language, draft, update]);
}
