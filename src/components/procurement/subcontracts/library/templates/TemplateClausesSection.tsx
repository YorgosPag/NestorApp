'use client';

/**
 * **Οι ρήτρες του προτύπου** (ADR-928 §5.3 · §5.22): ποιες ρήτρες παίρνει κάθε νέο συμφωνητικό, με ποια σειρά, και με
 * ποιες τιμές όπου διαφέρουν από τη βιβλιοθήκη.
 *
 * 🔑 Προσθήκη **μόνο** από την **εγκεκριμένη** βιβλιοθήκη (ρήτρα χωρίς έκδοση σε ισχύ δεν προσφέρεται) — με τίτλους,
 *    ποτέ κωδικούς μπροστά στον άνθρωπο.
 * 🔑 «Όπως στη βιβλιοθήκη» = **απουσία** τιμής (`setOverride(…, null)`): όταν αλλάξει η προτιμώμενη της βιβλιοθήκης, το
 *    πρότυπο την ακολουθεί. Τιμή του προτύπου μόνο σε **ελεύθερη** ζώνη — το πρότυπο δεν δέχεται αποκλίσεις (ο κριτής λέει
 *    `overrideNeedsApproval`).
 * 🔑 Δεσμευμένη παράμετρος: η τιμή ζει στους όρους του προτύπου· εδώ μόνο ανάγνωση με ζώνη και «Αλλαγή στους όρους»
 *    (το **ίδιο** `BoundParameter` με τον επεξεργαστή συμφωνητικού).
 */

import { useId, type ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SortableList } from '@/components/ui/sortable/SortableList';
import { reorderByMove } from '@/components/ui/sortable/sortable-model';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { HumanLanguage } from '@/i18n/languages';
import { issuesAt } from '@/subapps/procurement/subcontracts/agreements/issue-paths';
import type { ApprovedLibrary } from '@/subapps/procurement/subcontracts/agreements/judge-deviations';
import { joinPath, type SubcontractIssue } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import { toleranceVerdict } from '@/subapps/procurement/subcontracts/clauses/tolerance-verdict';
import { validateParameterValue } from '@/subapps/procurement/subcontracts/clauses/validate-clause-parameter';
import { localizedIn } from '@/subapps/procurement/subcontracts/document/render-parameter-value';
import { addClauseRef, removeClauseRef, setOverride } from '@/subapps/procurement/subcontracts/templates/template-edits';
import type { ClauseParameterDefinition, ClauseParameterValue, LocalizedText } from '@/subapps/procurement/subcontracts/types/clause-parameter';
import type { SubcontractTradeTemplateDefinition, TemplateClauseRef } from '@/subapps/procurement/subcontracts/types/trade-template';
import { BoundParameter } from '../../editor/ClauseCard';
import { ClauseParameterInput } from '../../editor/ClauseParameterInput';
import { FieldIssues } from '../../editor/FieldIssues';
import { ParameterZoneBadge } from '../../editor/ParameterZoneBadge';

interface TemplateClausesSectionProps {
  readonly value: SubcontractTradeTemplateDefinition;
  readonly onChange: (next: SubcontractTradeTemplateDefinition) => void;
  readonly library: ApprovedLibrary;
  /** Κλειδί ρήτρας → τίτλος (όλες οι ρήτρες του χώρου). */
  readonly titles: ReadonlyMap<string, LocalizedText>;
  readonly issues: readonly SubcontractIssue[];
  readonly language: HumanLanguage;
}

interface OwnParameterProps {
  readonly index: number;
  readonly clauseRef: TemplateClauseRef;
  readonly definition: ClauseParameterDefinition;
  readonly onSet: (value: ClauseParameterValue | null) => void;
  readonly issues: readonly SubcontractIssue[];
  readonly language: HumanLanguage;
}

function OwnParameter({ index, clauseRef, definition, onSet, issues, language }: OwnParameterProps) {
  const { t } = useTranslation('procurement');
  const id = `template-clause-${index}-${definition.key}`;
  const path = joinPath('clauses', index, 'parameterOverrides', definition.key);
  const override = clauseRef.parameterOverrides[definition.key];
  const value = override ?? definition.preferred;
  const valid = validateParameterValue(definition, value, path).length === 0;
  return (
    <li className="space-y-1.5">
      <header className="flex flex-wrap items-center gap-2">
        <Label htmlFor={id}>{localizedIn(definition.label, language)}</Label>
        {valid && <ParameterZoneBadge verdict={toleranceVerdict(definition, value)} />}
        <span className="ml-auto flex items-center gap-2 text-xs">
          <Switch id={`${id}-library`} checked={override === undefined} onCheckedChange={(asLibrary) => onSet(asLibrary ? null : definition.preferred)} />
          <Label htmlFor={`${id}-library`} className="text-xs font-normal">{t('subcontracts.library.templateEditor.asLibrary')}</Label>
        </span>
      </header>
      <ClauseParameterInput id={id} definition={definition} value={value} language={language} disabled={override === undefined} describedBy={`${id}-issues`} onChange={onSet} />
      <FieldIssues id={`${id}-issues`} issues={issuesAt(issues, path)} />
    </li>
  );
}

function ClauseRefCard({ index, clauseRef, props, handle }: { readonly index: number; readonly clauseRef: TemplateClauseRef; readonly props: TemplateClausesSectionProps; readonly handle: ReactNode }) {
  const { t } = useTranslation('procurement');
  const { value, onChange, library, titles, issues, language } = props;
  const inForce = library.get(clauseRef.clauseKey);
  const title = titles.get(clauseRef.clauseKey);
  const heading = title ? localizedIn(title, language) : clauseRef.clauseKey;
  return (
    <article aria-label={heading} className="space-y-3 rounded-lg border p-3">
      <header className="flex items-start gap-2">
        {handle}
        <h4 className="m-0 flex-1 text-sm font-semibold">{heading}</h4>
        <Button type="button" variant="ghost" size="icon" aria-label={t('subcontracts.editor.clauses.remove', { clause: heading })} onClick={() => onChange(removeClauseRef(value, index))}>
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </header>
      <FieldIssues issues={[...issuesAt(issues, joinPath('clauses', index)), ...issuesAt(issues, joinPath('clauses', index, 'clauseKey'))]} />
      {inForce && (
        <ul className="m-0 list-none space-y-3 p-0">
          {inForce.parameters.map((definition) => (definition.source.kind === 'term'
            ? <BoundParameter key={definition.key} definition={definition} terms={value.defaultTerms} reason={undefined} issuesPath={joinPath('clauses', index, 'bound', definition.key)} issues={issues} language={language} />
            : <OwnParameter key={definition.key} index={index} clauseRef={clauseRef} definition={definition} issues={issues} language={language} onSet={(next) => onChange(setOverride(value, index, definition.key, next))} />))}
        </ul>
      )}
    </article>
  );
}

function AddClause({ props }: { readonly props: TemplateClausesSectionProps }) {
  const { t } = useTranslation('procurement');
  const id = useId();
  const { value, onChange, library, titles, language } = props;
  const used = new Set(value.clauses.map((clauseRef) => clauseRef.clauseKey));
  const options = [...library].filter(([key, inForce]) => inForce !== null && !used.has(key))
    .map(([key]) => ({ key, label: localizedIn(titles.get(key) ?? { el: key }, language) }))
    .sort((a, b) => a.label.localeCompare(b.label, language));
  if (options.length === 0) return <p className="m-0 text-sm text-muted-foreground">{t('subcontracts.library.templateEditor.noMoreClauses')}</p>;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Label htmlFor={id} className="flex items-center gap-1"><Plus className="h-4 w-4" aria-hidden />{t('subcontracts.library.templateEditor.addClause')}</Label>
      <Select value="" onValueChange={(key) => onChange(addClauseRef(value, key))}>
        <SelectTrigger id={id} className="w-auto min-w-[16rem]"><SelectValue placeholder={t('subcontracts.library.templateEditor.chooseClause')} /></SelectTrigger>
        <SelectContent>{options.map((option) => <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>)}</SelectContent>
      </Select>
    </span>
  );
}

export function TemplateClausesSection(props: TemplateClausesSectionProps) {
  const { t } = useTranslation('procurement');
  const { value, onChange, titles, language } = props;
  const indexOf = new Map(value.clauses.map((clauseRef, index) => [clauseRef.clauseKey, index]));
  return (
    <section aria-labelledby="editor-clauses" className="space-y-3">
      <h3 id="editor-clauses" className="text-base font-semibold">{t('subcontracts.library.templateEditor.clausesTitle')}</h3>
      <p className="m-0 text-xs text-muted-foreground">{t('subcontracts.library.templateEditor.clausesHint')}</p>
      <SortableList
        items={value.clauses} getId={(clauseRef) => clauseRef.clauseKey} ariaLabel={t('subcontracts.library.templateEditor.clausesTitle')}
        getLabel={(clauseRef) => localizedIn(titles.get(clauseRef.clauseKey) ?? { el: clauseRef.clauseKey }, language)}
        onMove={(move) => onChange({ ...value, clauses: reorderByMove(value.clauses, (clauseRef) => clauseRef.clauseKey, move) })}
        className="space-y-3"
        renderItem={(clauseRef, handle) => <ClauseRefCard index={indexOf.get(clauseRef.clauseKey) ?? 0} clauseRef={clauseRef} props={props} handle={handle} />}
      />
      <AddClause props={props} />
    </section>
  );
}
