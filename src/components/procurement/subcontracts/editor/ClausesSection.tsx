'use client';

/**
 * Η ενότητα «Ρήτρες» του επεξεργαστή (ADR-928 §5.2 · Φ3γ): οι ρήτρες του πρόχειρου, η καθεμία με τις παραμέτρους της,
 * και προσθήκη ρήτρας από την **εγκεκριμένη** βιβλιοθήκη (μόνο όσες έχουν έκδοση σε ισχύ — ό,τι άλλο θα ήταν 422).
 * Κάθε αλλαγή περνά από τις καθαρές πράξεις `draft-clause-edits` — καμία εγγραφή «με το χέρι» στο σχήμα.
 */

import { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage } from '@/i18n/languages';
import { useSubcontractClauseLibrary } from '@/hooks/procurement/subcontracts/useSubcontractLibrary';
import {
  addClause,
  removeClause,
  resetClauseParameter,
  setClauseDeviationReason,
  setClauseParameterValue,
  upgradeClauseVersion,
} from '@/subapps/procurement/subcontracts/agreements/draft-clause-edits';
import { localizedIn } from '@/subapps/procurement/subcontracts/document/render-parameter-value';
import type { AgreementEditor } from './useAgreementEditor';
import { ClauseCard, type ClauseCardEdits } from './ClauseCard';

/**
 * Μολύβι σε ρήτρα του εγγράφου (§5.23) ⇒ η κάρτα της φαίνεται και παίρνει την εστίαση. Ένα καρέ μετά: η καρτέλα «Ρήτρες»
 * μόλις ενεργοποιήθηκε και η κάρτα πρέπει πρώτα να γίνει ορατή. Ο δείκτης `data-editor-clause` ζει στο `ClauseCard`.
 */
export function revealClauseCard(clauseKey: string) {
  requestAnimationFrame(() => {
    const card = Array.from(document.querySelectorAll<HTMLElement>('[data-editor-clause]')).find((element) => element.dataset.editorClause === clauseKey);
    card?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    card?.focus({ preventScroll: true });
  });
}

interface ClausesSectionProps {
  readonly editor: AgreementEditor;
}

function useEditsOf(editor: AgreementEditor, library: ReturnType<typeof useSubcontractClauseLibrary>['library']) {
  const { draft, update } = editor;
  return (index: number): ClauseCardEdits => {
    const inForce = library.get(draft.clauses[index].clauseKey);
    return {
      setValue: (key, value) => update(setClauseParameterValue(draft, index, key, value)),
      setReason: (key, reason) => update(setClauseDeviationReason(draft, index, key, reason)),
      reset: (key) => update(resetClauseParameter(draft, index, key)),
      remove: () => update(removeClause(draft, index)),
      upgrade: inForce && inForce.version !== draft.clauses[index].version ? () => update(upgradeClauseVersion(draft, index, inForce)) : null,
    };
  };
}

function AddClause({ editor }: ClausesSectionProps) {
  const { t, i18n } = useTranslation('procurement');
  const language = resolveHumanLanguage(i18n.language);
  const { clauses, library } = useSubcontractClauseLibrary();
  const present = new Set(editor.draft.clauses.map((clause) => clause.clauseKey));
  const addable = clauses.filter((clause) => !present.has(clause.clauseKey) && library.get(clause.clauseKey));
  if (addable.length === 0) return null;
  const add = (clauseKey: string) => {
    const inForce = library.get(clauseKey);
    if (inForce) editor.update(addClause(editor.draft, clauseKey, inForce));
  };
  return (
    <Select value="" onValueChange={add}>
      <SelectTrigger aria-label={t('subcontracts.editor.clauses.add')}><SelectValue placeholder={t('subcontracts.editor.clauses.add')} /></SelectTrigger>
      <SelectContent>
        {addable.map((clause) => <SelectItem key={clause.clauseKey} value={clause.clauseKey}>{localizedIn(clause.title, language)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function ClausesSection({ editor }: ClausesSectionProps) {
  const { t, i18n } = useTranslation('procurement');
  const language = resolveHumanLanguage(i18n.language);
  const { clauses, library, loading } = useSubcontractClauseLibrary();
  const titles = useMemo(() => new Map(clauses.map((clause) => [clause.clauseKey, clause.title])), [clauses]);
  const savedByKey = useMemo(() => new Map(editor.saved.clauses.map((selection) => [selection.clauseKey, selection])), [editor.saved.clauses]);
  const editsOf = useEditsOf(editor, library);
  const heading = <h3 id="editor-clauses" className="text-base font-semibold">{t('subcontracts.editor.sections.clauses')}</h3>;

  // Fail-closed: όσο η βιβλιοθήκη φτάνει, καμία ρήτρα δεν λέγεται «άγνωστη» ή «χωρίς έκδοση» — ελέγχεται.
  if (loading) {
    return <section aria-labelledby="editor-clauses" className="space-y-3">{heading}<p className="text-sm text-muted-foreground">{t('subcontracts.actions.checking')}</p></section>;
  }

  return (
    <section aria-labelledby="editor-clauses" className="space-y-3">
      {heading}
      {editor.draft.clauses.length === 0 && <p className="text-sm text-muted-foreground">{t('subcontracts.editor.clauses.empty')}</p>}
      {editor.draft.clauses.map((input, index) => (
        <ClauseCard
          key={input.clauseKey}
          index={index}
          input={input}
          title={titles.get(input.clauseKey) ?? null}
          inForce={library.get(input.clauseKey)}
          terms={editor.draft.terms}
          savedDeviations={savedByKey.get(input.clauseKey)?.deviations ?? {}}
          issues={editor.issues}
          language={language}
          edits={editsOf(index)}
        />
      ))}
      <AddClause editor={editor} />
    </section>
  );
}
