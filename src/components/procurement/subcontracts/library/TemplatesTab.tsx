'use client';

/**
 * **Τα πρότυπα ειδικότητας** (ADR-928 §5.3 · Φ3γ-0): τα γραμμένα πρότυπα **και** τα προτεινόμενα που περιμένουν — με
 * το **τι** περιμένουν, ζωντανά (`pendingSeedTemplatesOf`: ο ίδιος έλεγχος με τη σπορά).
 *
 * 🔑 Ένα προτεινόμενο πρότυπο γράφεται **μόνο** όταν όλες οι ρήτρες του έχουν έκδοση σε ισχύ. Όταν γίνει έτοιμο, η
 *    οθόνη το λέει και προσφέρει **μία** κίνηση: «Γράψε τα έτοιμα πρότυπα» (η ίδια ιδεμποτική σπορά — τίποτα δεν
 *    γράφεται δύο φορές). Καμία πόρτα γύρω από την επικύρωση.
 * 🔑 «Νέο πρότυπο» (αντίγραφο του επιλεγμένου) και «Επεξεργασία» οδηγούν στον επεξεργαστή (ADR-928 §5.22), με τον φύλακα
 *    του γραφέα (`templateAuthoringBlock`). Οι ρήτρες του προτύπου λέγονται με τον **τίτλο** τους, όχι τον κωδικό.
 * 🔑 Η επιλογή ζει στη διεύθυνση (`?template=<id>` · `?template=pending:<code>`).
 */

import { useMemo } from 'react';
import { Archive, ArchiveRestore, FilePlus2, Hourglass, LayoutTemplate, PencilLine } from 'lucide-react';
import { CatalogSplit } from '@/components/catalog/shared/CatalogSplit';
import { SelectableListItem, SelectableListSection } from '@/components/shared/lists/SelectableList';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage } from '@/i18n/languages';
import { getSubcontractTemplateEditUrl, getSubcontractTemplateNewUrl } from '@/lib/navigation/procurement-urls';
import { localizedIn } from '@/subapps/procurement/subcontracts/document/render-parameter-value';
import { templateAuthoringBlock } from '@/subapps/procurement/subcontracts/library/library-action-blocks';
import type { PendingSeedTemplate } from '@/subapps/procurement/subcontracts/library/seed-template-readiness';
import type { SubcontractTradeTemplate, SubcontractTradeTemplateDefinition } from '@/subapps/procurement/subcontracts/types/trade-template';
import type { SubcontractLibraryAuthorityView } from '@/hooks/procurement/subcontracts/useSubcontractAuthority';
import { useSubcontractIssueMessage } from '../subcontract-messages';
import { AuthoringDoor } from './AuthoringDoor';
import type { LibraryActions } from './useLibraryActions';
import type { LibraryScreen } from './useLibraryScreen';

const PENDING_PREFIX = 'pending:';

interface TemplatesTabProps {
  readonly screen: LibraryScreen;
  readonly authority: SubcontractLibraryAuthorityView;
  readonly actions: LibraryActions;
  readonly selected: string | null;
  readonly select: (value: string | null) => void;
}

function TemplateSummary({ definition, titleOf }: { readonly definition: SubcontractTradeTemplateDefinition; readonly titleOf: (clauseKey: string) => string }) {
  const { t } = useTranslation(['procurement', 'quotes']);
  return (
    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      <dt className="text-muted-foreground">{t('subcontracts.library.templates.trade')}</dt><dd className="m-0">{t(`quotes:trades.${definition.trade}`)}</dd>
      <dt className="text-muted-foreground">{t('subcontracts.library.templates.code')}</dt><dd className="m-0 font-mono text-xs">{definition.code}</dd>
      <dt className="text-muted-foreground">{t('subcontracts.library.templates.lines')}</dt><dd className="m-0">{definition.lines.length}</dd>
      <dt className="text-muted-foreground">{t('subcontracts.library.templates.clauses')}</dt>
      <dd className="m-0"><ul className="m-0 list-none p-0 text-sm">{definition.clauses.map((ref) => <li key={ref.clauseKey}>{titleOf(ref.clauseKey)}</li>)}</ul></dd>
    </dl>
  );
}

function PendingDetail({ pending, authority, actions, titleOf }: { readonly pending: PendingSeedTemplate; readonly titleOf: (clauseKey: string) => string } & Pick<TemplatesTabProps, 'authority' | 'actions'>) {
  const { t } = useTranslation('procurement');
  const issueMessage = useSubcontractIssueMessage(pending.issues.length > 0);
  const ready = pending.issues.length === 0;
  return (
    <article className="space-y-4 p-4">
      <p className="m-0 text-sm">{ready ? t('subcontracts.library.templates.ready') : t('subcontracts.library.templates.waiting')}</p>
      {pending.awaitingClauses.length > 0 && (
        <ul className="m-0 list-disc pl-5 font-mono text-xs">{pending.awaitingClauses.map((key) => <li key={key}>{key}</li>)}</ul>
      )}
      {!ready && pending.awaitingClauses.length === 0 && (
        <ul className="m-0 list-disc pl-5 text-sm">{pending.issues.map((issue) => <li key={`${issue.code}:${issue.path}`}>{issueMessage(issue)}</li>)}</ul>
      )}
      <TemplateSummary definition={pending.definition} titleOf={titleOf} />
      {ready && (
        <span className="flex flex-col gap-0.5">
          <Button type="button" size="sm" disabled={!authority.canSeed} onClick={() => void actions.seed()}>{t('subcontracts.library.templates.write')}</Button>
          {!authority.canSeed && !authority.pending && <span className="text-xs text-muted-foreground">{t('subcontracts.library.reasons.notAuthorized')}</span>}
        </span>
      )}
    </article>
  );
}

function TemplateDetail({ template, authority, actions, titleOf }: { readonly template: SubcontractTradeTemplate; readonly titleOf: (clauseKey: string) => string } & Pick<TemplatesTabProps, 'authority' | 'actions'>) {
  const { t } = useTranslation('procurement');
  const archiving = !template.isArchived;
  const Icon = archiving ? Archive : ArchiveRestore;
  return (
    <article className="space-y-4 p-4">
      {template.isArchived && <Badge variant="outline">{t('subcontracts.library.clauses.archived')}</Badge>}
      <AuthoringDoor href={getSubcontractTemplateEditUrl(template.id)} label={t('subcontracts.library.templateEditor.doors.edit')} icon={PencilLine} block={templateAuthoringBlock(template, authority)} />
      <TemplateSummary definition={template} titleOf={titleOf} />
      <span className="flex flex-col gap-0.5">
        <Button type="button" size="sm" variant="outline" disabled={!authority.canManageTemplates} onClick={() => void actions.setTemplateArchived(template, archiving)}>
          <Icon className="mr-1 h-4 w-4" aria-hidden />{t(`subcontracts.library.clauses.${archiving ? 'archive' : 'restore'}`)}
        </Button>
        {!authority.canManageTemplates && !authority.pending && <span className="text-xs text-muted-foreground">{t('subcontracts.library.reasons.notAuthorized')}</span>}
      </span>
    </article>
  );
}

function TemplateList({ screen, authority, selected, select }: Pick<TemplatesTabProps, 'screen' | 'authority' | 'selected' | 'select'>) {
  const { t, i18n } = useTranslation('procurement');
  const language = resolveHumanLanguage(i18n.language);
  return (
    <>
      <SelectableListSection title={t('subcontracts.library.tabs.templates')} count={screen.templates.length}>
        <span className="flex px-2 py-1">
          <AuthoringDoor href={getSubcontractTemplateNewUrl(screen.templates.some((template) => template.id === selected) ? selected : null)} label={t('subcontracts.library.templateEditor.doors.newTemplate')} icon={FilePlus2} block={templateAuthoringBlock(null, authority)} />
        </span>
        {screen.templates.map((template) => (
          <SelectableListItem key={template.id} primary={localizedIn(template.title, language)} secondary={template.code} icon={LayoutTemplate} selected={template.id === selected} onSelect={() => select(template.id)}
            badges={template.isArchived ? [{ label: t('subcontracts.library.clauses.archived'), variant: 'outline' }] : []} />
        ))}
      </SelectableListSection>
      {screen.pendingTemplates.length > 0 && (
        <SelectableListSection title={t('subcontracts.library.templates.pendingTitle')} count={screen.pendingTemplates.length}>
          {screen.pendingTemplates.map((pending) => (
            <SelectableListItem key={pending.definition.code} primary={localizedIn(pending.definition.title, language)} secondary={pending.definition.code} icon={Hourglass}
              selected={`${PENDING_PREFIX}${pending.definition.code}` === selected} onSelect={() => select(`${PENDING_PREFIX}${pending.definition.code}`)}
              badges={[pending.issues.length === 0
                ? { label: t('subcontracts.library.templates.readyBadge'), variant: 'success' }
                : { label: t('subcontracts.library.templates.waitingBadge', { count: pending.awaitingClauses.length }), variant: 'warning' }]} />
          ))}
        </SelectableListSection>
      )}
    </>
  );
}

export function TemplatesTab({ screen, authority, actions, selected, select }: TemplatesTabProps) {
  const { t, i18n } = useTranslation('procurement');
  const language = resolveHumanLanguage(i18n.language);
  const template = screen.templates.find((candidate) => candidate.id === selected) ?? null;
  const pending = useMemo(
    () => (selected?.startsWith(PENDING_PREFIX) ? screen.pendingTemplates.find((entry) => `${PENDING_PREFIX}${entry.definition.code}` === selected) ?? null : null),
    [screen.pendingTemplates, selected],
  );
  const title = template ? localizedIn(template.title, language) : pending ? localizedIn(pending.definition.title, language) : '';
  const titles = useMemo(() => new Map(screen.library.clauses.map((clause) => [clause.clauseKey, localizedIn(clause.title, language)])), [screen.library.clauses, language]);
  const titleOf = (clauseKey: string) => titles.get(clauseKey) ?? clauseKey;
  return (
    <CatalogSplit
      listLabel={t('subcontracts.library.tabs.templates')}
      list={<TemplateList screen={screen} authority={authority} selected={selected} select={select} />}
      open={template !== null || pending !== null}
      title={title}
      onClose={() => select(null)}
      empty={{ icon: LayoutTemplate, title: t('subcontracts.library.templates.chooseTitle'), description: t('subcontracts.library.templates.chooseDescription') }}
      details={template ? <TemplateDetail template={template} authority={authority} actions={actions} titleOf={titleOf} /> : pending ? <PendingDetail pending={pending} authority={authority} actions={actions} titleOf={titleOf} /> : null}
    />
  );
}
