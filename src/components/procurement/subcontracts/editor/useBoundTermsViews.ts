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
import { boundTermsAt, boundTermsOf, templateBoundTermsOf, type BoundTerm } from '@/subapps/procurement/subcontracts/agreements/bound-terms';
import type { ApprovedLibrary } from '@/subapps/procurement/subcontracts/agreements/judge-deviations';
import type { LocalizedText } from '@/subapps/procurement/subcontracts/types/clause-parameter';
import type { SubcontractTradeTemplateDefinition } from '@/subapps/procurement/subcontracts/types/trade-template';
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

/**
 * Η **ίδια** γέφυρα για τον επεξεργαστή προτύπου (ADR-928 §5.22): `templateBoundTermsOf` (ευρήματα στο
 * `clauses.N.bound.<key>`, όπως ο κριτής του προτύπου) · `setReason: null` — το πρότυπο δεν δέχεται αποκλίσεις, θέλει
 * ελεύθερη ζώνη.
 */
export function useTemplateBoundTermsViews(
  draft: Pick<SubcontractTradeTemplateDefinition, 'clauses' | 'defaultTerms'>,
  library: ApprovedLibrary,
  titles: ReadonlyMap<string, LocalizedText>,
): { readonly terms: BoundTermsView; readonly plan: BoundTermsView } {
  const { i18n } = useTranslation('procurement');
  const language = resolveHumanLanguage(i18n.language);
  const bound = useMemo(() => templateBoundTermsOf(draft.clauses, library, draft.defaultTerms), [draft.clauses, library, draft.defaultTerms]);
  return useMemo(() => {
    const titleOf = (clauseKey: string) => {
      const title = titles.get(clauseKey);
      return title ? localizedIn(title, language) : clauseKey;
    };
    const shared = { setReason: null, titleOf };
    return { terms: { ...shared, at: boundTermsAt(bound, '') }, plan: { ...shared, at: boundTermsAt(bound, 'paymentPlan') } };
  }, [bound, titles, language]);
}
