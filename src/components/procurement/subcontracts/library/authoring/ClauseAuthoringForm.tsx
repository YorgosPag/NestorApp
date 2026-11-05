'use client';

/**
 * **Η φόρμα της συγγραφής ρήτρας** (ADR-928 §5.22): ταυτότητα · σώμα με παραμέτρους · ορισμοί παραμέτρων.
 *
 * 🔑 Νέα ρήτρα: το κλειδί ακολουθεί τον τίτλο (λατινικά, ποτέ πιασμένο) **ώσπου** να το αγγίξει ο άνθρωπος.
 * 🔑 Πρόταση: τίτλος και κλειδί **δεν** αλλάζουν (ο γραφέας τα γράφει μόνο στη δημιουργία)· φαίνεται η βάση.
 * 🔑 Κάθε εύρημα στη διαδρομή του κριτή: `clauseKey` · `title` · `body.heading` · `body.blocks…` · `parameters.N…`.
 */

import { useId, useMemo, useState } from 'react';
import { Eraser } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage } from '@/i18n/languages';
import { issuesAt, issuesUnder } from '@/subapps/procurement/subcontracts/agreements/issue-paths';
import { clauseKeyFromTitle } from '@/subapps/procurement/subcontracts/clauses/clause-draft';
import { removeParameterFrom, renameParameter, unreferencedParameters, withoutUnreferenced } from '@/subapps/procurement/subcontracts/clauses/parameter-definition-edits';
import { localizedIn } from '@/subapps/procurement/subcontracts/document/render-parameter-value';
import type { LocalizedText } from '@/subapps/procurement/subcontracts/types/clause-parameter';
import { replaceAt } from '@/lib/array-utils';
import { EditorField, issuesIdOf } from '../../editor/EditorField';
import { FieldIssues } from '../../editor/FieldIssues';
import { LocalizedTextFields } from '../../sections/LocalizedTextFields';
import { LibrarySection } from '../LibrarySection';
import { ClauseBodyEditor } from './ClauseBodyEditor';
import { ParameterDefinitionCard } from './ParameterDefinitionCard';
import type { ClauseAuthoring } from './useClauseAuthoring';

interface ClauseAuthoringFormProps {
  readonly authoring: ClauseAuthoring;
  readonly takenKeys: ReadonlySet<string>;
}

function NewClauseIdentity({ authoring, takenKeys }: ClauseAuthoringFormProps) {
  const { t, i18n } = useTranslation('procurement');
  const { draft, update, issues } = authoring;
  const [keyTouched, setKeyTouched] = useState(false);
  const setTitle = (title: LocalizedText) =>
    update({ ...draft, title, clauseKey: keyTouched ? draft.clauseKey : clauseKeyFromTitle(title.el ?? '', takenKeys) });
  return (
    <LibrarySection id="authoring-identity" title={t('subcontracts.library.authoring.identity')}>
      <LocalizedTextFields id="clause-title" label={t('subcontracts.library.authoring.title')} value={draft.title} onChange={setTitle} path="title" issues={issues} language={resolveHumanLanguage(i18n.language)} secondaryLanguage="en" />
      <EditorField id="clause-key" label={t('subcontracts.library.authoring.clauseKey')} issues={issuesAt(issues, 'clauseKey')}>
        <Input id="clause-key" className="font-mono" value={draft.clauseKey} aria-describedby={issuesIdOf('clause-key')} onChange={(event) => { setKeyTouched(true); update({ ...draft, clauseKey: event.target.value }); }} />
      </EditorField>
      <p className="m-0 text-xs text-muted-foreground">{t('subcontracts.library.authoring.clauseKeyHint')}</p>
    </LibrarySection>
  );
}

function ProposalIdentity({ authoring }: Pick<ClauseAuthoringFormProps, 'authoring'>) {
  const { t, i18n } = useTranslation('procurement');
  const { draft, base } = authoring;
  return (
    <LibrarySection id="authoring-identity" title={t('subcontracts.library.authoring.identity')}>
      <p className="m-0 text-sm font-medium">{localizedIn(draft.title, resolveHumanLanguage(i18n.language))}</p>
      <p className="m-0 font-mono text-xs text-muted-foreground">{draft.clauseKey}</p>
      <p className="m-0 text-sm text-muted-foreground">
        {base ? t('subcontracts.library.authoring.basedOn', { version: base.version }) : t('subcontracts.library.authoring.noBase')}
      </p>
    </LibrarySection>
  );
}

function BodySection({ authoring }: Pick<ClauseAuthoringFormProps, 'authoring'>) {
  const { t } = useTranslation('procurement');
  const headingId = useId();
  const { draft, update, issues } = authoring;
  const blockIssues = [...issuesAt(issues, 'body'), ...issuesUnder(issues, 'body.blocks')];
  return (
    <LibrarySection id="authoring-body" title={t('subcontracts.library.authoring.body.title')}>
      <EditorField id={headingId} label={t('subcontracts.library.authoring.body.heading')} issues={issuesAt(issues, 'body.heading')}>
        <Input id={headingId} value={draft.body.heading} onChange={(event) => update({ ...draft, body: { ...draft.body, heading: event.target.value } })} />
      </EditorField>
      <ClauseBodyEditor
        id="clause-body"
        label={t('subcontracts.library.authoring.body.text')}
        describedBy={blockIssues.length > 0 ? 'clause-body-issues' : undefined}
        blocks={draft.body.blocks}
        parameters={draft.parameters}
        onChange={(blocks, added) => update({ ...draft, body: { ...draft.body, blocks }, parameters: added ? [...draft.parameters, added] : draft.parameters })}
      />
      <FieldIssues id="clause-body-issues" issues={blockIssues} />
      <p className="m-0 text-xs text-muted-foreground">{t('subcontracts.library.authoring.body.hint')}</p>
    </LibrarySection>
  );
}

function ParametersSection({ authoring }: Pick<ClauseAuthoringFormProps, 'authoring'>) {
  const { t, i18n } = useTranslation('procurement');
  const { draft, update, issues, locked } = authoring;
  const unreferenced = useMemo(() => new Set(unreferencedParameters(draft.body, draft.parameters)), [draft.body, draft.parameters]);
  return (
    <LibrarySection id="authoring-parameters" title={t('subcontracts.library.authoring.parametersTitle', { count: draft.parameters.length })}>
      {unreferenced.size > 0 && (
        <Button type="button" size="sm" variant="outline" onClick={() => update({ ...draft, parameters: withoutUnreferenced(draft.body, draft.parameters) })}>
          <Eraser className="mr-1 h-4 w-4" aria-hidden />{t('subcontracts.library.authoring.removeUnreferenced', { count: unreferenced.size })}
        </Button>
      )}
      {draft.parameters.length === 0 && <p className="m-0 text-sm text-muted-foreground">{t('subcontracts.library.authoring.noParameters')}</p>}
      {draft.parameters.map((definition, index) => (
        <ParameterDefinitionCard
          key={definition.key}
          definition={definition}
          index={index}
          issues={issues}
          locked={locked.has(definition.key)}
          referenced={!unreferenced.has(definition.key)}
          language={resolveHumanLanguage(i18n.language)}
          onChange={(next) => update({ ...draft, parameters: replaceAt(draft.parameters, index, next) })}
          onRename={(key) => update({ ...draft, ...renameParameter(draft.body, draft.parameters, definition.key, key) })}
          onRemove={() => update({ ...draft, parameters: removeParameterFrom(draft.body, draft.parameters, definition.key) })}
        />
      ))}
    </LibrarySection>
  );
}

export function ClauseAuthoringForm({ authoring, takenKeys }: ClauseAuthoringFormProps) {
  const { t } = useTranslation('procurement');
  return (
    <form aria-label={t('subcontracts.library.authoring.formLabel')} noValidate onSubmit={(event) => { event.preventDefault(); void authoring.save(); }} className="space-y-6 p-4">
      {authoring.mode === 'create' ? <NewClauseIdentity authoring={authoring} takenKeys={takenKeys} /> : <ProposalIdentity authoring={authoring} />}
      <BodySection authoring={authoring} />
      <ParametersSection authoring={authoring} />
    </form>
  );
}
