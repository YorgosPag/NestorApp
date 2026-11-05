'use client';

/**
 * **Ο ορισμός μιας παραμέτρου** της ρήτρας (ADR-928 §5.2 · §5.22): ετικέτα · είδος · από πού παίρνει τιμή ·
 * προτιμώμενη · επιλογές/μέλη · ζώνες.
 *
 * 🔑 Κάθε πεδίο δείχνει τα ευρήματα του **ίδιου** κριτή (`validateParameterDefinitions`) στη διαδρομή του
 *    (`parameters.N.<πεδίο>`), όπως τα γράφει ο κριτής.
 * 🔑 Παράμετρος της βάσης (`locked`): κλειδί και είδος **δεν** αλλάζουν — οι τιμές των συμφωνητικών και οι μεταφράσεις που
 *    κληρονομεί η νέα έκδοση δείχνουν με αυτά. Η αιτία λέγεται, δεν κρύβεται.
 * 🔑 Η αφαίρεση προσφέρεται μόνο όταν η παράμετρος δεν τυπώνεται πουθενά: ο άνθρωπος σβήνει πρώτα το chip από το
 *    κείμενο, και βλέπει τι αφαιρεί.
 */

import { useState } from 'react';
import { Lock, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EnumSelect } from '@/components/ui/enum-select';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { HumanLanguage } from '@/i18n/languages';
import { issuesAt, issuesUnder } from '@/subapps/procurement/subcontracts/agreements/issue-paths';
import { joinPath, type SubcontractIssue } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import { bindingsForKind, withKind, withSource } from '@/subapps/procurement/subcontracts/clauses/parameter-definition-edits';
import { localizedIn } from '@/subapps/procurement/subcontracts/document/render-parameter-value';
import {
  CLAUSE_PARAMETER_KINDS,
  type ClauseParameterDefinition,
  type CommercialTermBindingKey,
} from '@/subapps/procurement/subcontracts/types/clause-parameter';
import { ClauseParameterInput } from '../../editor/ClauseParameterInput';
import { EditorField, issuesIdOf } from '../../editor/EditorField';
import { FieldIssues } from '../../editor/FieldIssues';
import { LocalizedTextFields } from '../../sections/LocalizedTextFields';
import { TERM_LABEL } from '../library-labels';
import { KeyedLabelsEditor, type KeyedLabel } from './KeyedLabelsEditor';
import { ToleranceEditor } from './ToleranceEditor';

export interface ParameterDefinitionCardProps {
  readonly definition: ClauseParameterDefinition;
  readonly index: number;
  readonly issues: readonly SubcontractIssue[];
  /** Υπάρχει στη βάση της πρότασης ⇒ κλειδί και είδος σταθερά. */
  readonly locked: boolean;
  readonly referenced: boolean;
  readonly language: HumanLanguage;
  readonly onChange: (next: ClauseParameterDefinition) => void;
  readonly onRename: (key: string) => void;
  readonly onRemove: () => void;
}

type SourceChoice = 'clause' | CommercialTermBindingKey;

/**
 * Το κλειδί αλλάζει με «επιβεβαίωση» (απώλεια εστίασης/Enter), ώστε η μετονομασία να μη γίνεται ανά πλήκτρο. Νέο κλειδί
 * ⇒ νέο στοιχείο (`key`), άρα το πεδίο ξεκινά από την τιμή του χωρίς effect.
 */
function KeyField({ id, value, onRename }: { readonly id: string; readonly value: string; readonly onRename: (key: string) => void }) {
  const [text, setText] = useState(value);
  const commit = () => {
    if (text.trim() !== value) onRename(text.trim());
    setText(value);
  };
  return <Input id={id} value={text} className="font-mono" onChange={(event) => setText(event.target.value)} onBlur={commit} onKeyDown={(event) => event.key === 'Enter' && (event.preventDefault(), commit())} />;
}

function withMembers(definition: ClauseParameterDefinition, terms: readonly KeyedLabel[]): ClauseParameterDefinition {
  if (definition.preferred.kind !== 'ratio') return { ...definition, terms };
  const parts = terms.map((_, index) => (definition.preferred.kind === 'ratio' ? definition.preferred.value[index] : undefined) ?? 1);
  return { ...definition, terms, preferred: { kind: 'ratio', value: parts } };
}

function IdentityFields({ definition, index, issues, locked, onChange, onRename }: ParameterDefinitionCardProps) {
  const { t } = useTranslation('procurement');
  const base = `param-${index}`;
  const path = joinPath('parameters', index);
  return (
    <span className="grid grid-cols-[repeat(auto-fill,minmax(min(12rem,100%),1fr))] gap-3">
      <EditorField id={`${base}-key`} label={t('subcontracts.library.authoring.parameter.key')} issues={issuesAt(issues, joinPath(path, 'key'))}>
        {locked
          ? <p className="m-0 flex items-center gap-1 font-mono text-sm"><Lock className="h-3 w-3" aria-hidden />{definition.key}</p>
          : <KeyField key={definition.key} id={`${base}-key`} value={definition.key} onRename={onRename} />}
      </EditorField>
      <EditorField id={`${base}-kind`} label={t('subcontracts.library.authoring.parameter.kind')}>
        <EnumSelect id={`${base}-kind`} value={definition.kind} values={CLAUSE_PARAMETER_KINDS} disabled={locked} onValueChange={(kind) => onChange(withKind(definition, kind))} getLabel={(kind) => t(`subcontracts.library.authoring.kinds.${kind}`)} />
      </EditorField>
      {locked && <p className="m-0 self-end text-xs text-muted-foreground">{t('subcontracts.library.authoring.parameter.lockedReason')}</p>}
    </span>
  );
}

function ValueFields({ definition, index, issues, language, onChange }: ParameterDefinitionCardProps) {
  const { t } = useTranslation('procurement');
  const base = `param-${index}`;
  const path = joinPath('parameters', index);
  const source: SourceChoice = definition.source.kind === 'term' ? definition.source.term : 'clause';
  const sources: readonly SourceChoice[] = ['clause', ...bindingsForKind(definition.kind)];
  const sourceLabel = (choice: SourceChoice) => (choice === 'clause' ? t('subcontracts.library.parameters.ownValue') : t(`subcontracts.library.terms.${TERM_LABEL[choice]}`));
  const preferredIssues = issuesUnder(issues, joinPath(path, 'preferred'));
  return (
    <span className="grid grid-cols-[repeat(auto-fill,minmax(min(12rem,100%),1fr))] gap-3">
      <EditorField id={`${base}-source`} label={t('subcontracts.library.parameters.source')} issues={issuesAt(issues, joinPath(path, 'source'))}>
        <EnumSelect id={`${base}-source`} value={source} values={sources} disabled={sources.length === 1} onValueChange={(choice) => onChange(withSource(definition, choice === 'clause' ? null : choice))} getLabel={sourceLabel} />
      </EditorField>
      <EditorField id={`${base}-preferred`} label={t('subcontracts.library.parameters.preferred')} issues={preferredIssues}>
        <ClauseParameterInput id={`${base}-preferred`} definition={definition} value={definition.preferred} onChange={(preferred) => onChange({ ...definition, preferred })} language={language} describedBy={preferredIssues.length > 0 ? issuesIdOf(`${base}-preferred`) : undefined} />
      </EditorField>
      {definition.source.kind === 'term' && <p className="m-0 self-end text-xs text-muted-foreground">{t('subcontracts.library.authoring.parameter.boundHint')}</p>}
    </span>
  );
}

function ChoiceFields({ definition, index, issues, onChange }: ParameterDefinitionCardProps) {
  const { t } = useTranslation('procurement');
  const path = joinPath('parameters', index);
  if (definition.kind === 'enum') {
    return (
      <>
        <KeyedLabelsEditor id={`param-${index}-options`} legend={t('subcontracts.library.authoring.parameter.options')} keyPrefix="option" items={definition.options ?? []} fixedKeys={definition.source.kind === 'term'} onChange={(options) => onChange({ ...definition, options })} />
        <FieldIssues issues={issuesUnder(issues, joinPath(path, 'options'))} />
      </>
    );
  }
  if (definition.kind !== 'ratio') return null;
  return (
    <>
      <KeyedLabelsEditor id={`param-${index}-terms`} legend={t('subcontracts.library.authoring.parameter.members')} keyPrefix="member" items={definition.terms ?? []} fixedKeys={false} onChange={(terms) => onChange(withMembers(definition, terms))} />
      <FieldIssues issues={issuesUnder(issues, joinPath(path, 'terms'))} />
    </>
  );
}

export function ParameterDefinitionCard(props: ParameterDefinitionCardProps) {
  const { t } = useTranslation('procurement');
  const { definition, index, issues, referenced, language, onChange, onRemove } = props;
  const path = joinPath('parameters', index);
  const title = localizedIn(definition.label, 'el') || t('subcontracts.library.authoring.parameter.untitled');
  return (
    <article id={`editor-param-${definition.key}`} className="space-y-3 rounded-lg border bg-card p-3">
      <header className="flex flex-wrap items-center gap-2">
        <h4 className="m-0 flex-1 text-sm font-semibold">{title}</h4>
        {!referenced && <Badge variant="warning">{t('subcontracts.library.authoring.parameter.unreferenced')}</Badge>}
        {!referenced && (
          <Button type="button" size="sm" variant="ghost" onClick={onRemove}><Trash2 className="mr-1 h-4 w-4" aria-hidden />{t('subcontracts.library.authoring.parameter.remove')}</Button>
        )}
      </header>
      <LocalizedTextFields id={`param-${index}-label`} label={t('subcontracts.library.authoring.parameter.label')} value={definition.label} onChange={(label) => onChange({ ...definition, label })} path={joinPath(path, 'label')} issues={issues} language={language} secondaryLanguage="en" />
      <IdentityFields {...props} />
      <ValueFields {...props} />
      <ChoiceFields {...props} />
      <ToleranceEditor id={`param-${index}-tolerance`} definition={definition} onChange={onChange} issues={issuesUnder(issues, joinPath(path, 'tolerance'))} />
      <FieldIssues issues={issuesAt(issues, path)} />
    </article>
  );
}
