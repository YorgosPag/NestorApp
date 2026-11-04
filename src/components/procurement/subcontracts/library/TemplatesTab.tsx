'use client';

/**
 * **Τα πρότυπα ειδικότητας** (ADR-928 §5.3 · Φ3γ-0): τα γραμμένα πρότυπα **και** τα προτεινόμενα που περιμένουν — με
 * το **τι** περιμένουν, ζωντανά (`pendingSeedTemplatesOf`: ο ίδιος έλεγχος με τη σπορά).
 *
 * 🔑 Ένα προτεινόμενο πρότυπο γράφεται **μόνο** όταν όλες οι ρήτρες του έχουν έκδοση σε ισχύ. Όταν γίνει έτοιμο, η
 *    οθόνη το λέει και προσφέρει **μία** κίνηση: «Γράψε τα έτοιμα πρότυπα» (η ίδια ιδεμποτική σπορά — τίποτα δεν
 *    γράφεται δύο φορές). Καμία πόρτα γύρω από την επικύρωση.
 * 🔑 Η επεξεργασία προτύπου έρχεται στη Φ3γ-0b· εδώ ανάγνωση και αρχειοθέτηση.
 * 🔑 Η επιλογή ζει στη διεύθυνση (`?template=<id>` · `?template=pending:<code>`).
 */

import { useMemo } from 'react';
import { Archive, ArchiveRestore, Hourglass, LayoutTemplate } from 'lucide-react';
import { CatalogSplit } from '@/components/catalog/shared/CatalogSplit';
import { SelectableListItem, SelectableListSection } from '@/components/shared/lists/SelectableList';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage } from '@/i18n/languages';
import { localizedIn } from '@/subapps/procurement/subcontracts/document/render-parameter-value';
import type { PendingSeedTemplate } from '@/subapps/procurement/subcontracts/library/seed-template-readiness';
import type { SubcontractTradeTemplate, SubcontractTradeTemplateDefinition } from '@/subapps/procurement/subcontracts/types/trade-template';
import type { SubcontractLibraryAuthorityView } from '@/hooks/procurement/subcontracts/useSubcontractAuthority';
import { useSubcontractIssueMessage } from '../subcontract-messages';
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

function TemplateSummary({ definition }: { readonly definition: SubcontractTradeTemplateDefinition }) {
  const { t } = useTranslation(['procurement', 'quotes']);
  return (
    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      <dt className="text-muted-foreground">{t('subcontracts.library.templates.trade')}</dt><dd className="m-0">{t(`quotes:trades.${definition.trade}`)}</dd>
      <dt className="text-muted-foreground">{t('subcontracts.library.templates.code')}</dt><dd className="m-0 font-mono text-xs">{definition.code}</dd>
      <dt className="text-muted-foreground">{t('subcontracts.library.templates.lines')}</dt><dd className="m-0">{definition.lines.length}</dd>
      <dt className="text-muted-foreground">{t('subcontracts.library.templates.clauses')}</dt>
      <dd className="m-0"><ul className="m-0 list-none p-0 font-mono text-xs">{definition.clauses.map((ref) => <li key={ref.clauseKey}>{ref.clauseKey}</li>)}</ul></dd>
    </dl>
  );
}

function PendingDetail({ pending, authority, actions }: { readonly pending: PendingSeedTemplate } & Pick<TemplatesTabProps, 'authority' | 'actions'>) {
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
      <TemplateSummary definition={pending.definition} />
      {ready && (
        <span className="flex flex-col gap-0.5">
          <Button type="button" size="sm" disabled={!authority.canSeed} onClick={() => void actions.seed()}>{t('subcontracts.library.templates.write')}</Button>
          {!authority.canSeed && <span className="text-xs text-muted-foreground">{t('subcontracts.library.reasons.notAuthorized')}</span>}
        </span>
      )}
    </article>
  );
}

function TemplateDetail({ template, authority, actions }: { readonly template: SubcontractTradeTemplate } & Pick<TemplatesTabProps, 'authority' | 'actions'>) {
  const { t } = useTranslation('procurement');
  const archiving = !template.isArchived;
  const Icon = archiving ? Archive : ArchiveRestore;
  return (
    <article className="space-y-4 p-4">
      {template.isArchived && <Badge variant="outline">{t('subcontracts.library.clauses.archived')}</Badge>}
      <TemplateSummary definition={template} />
      <span className="flex flex-col gap-0.5">
        <Button type="button" size="sm" variant="outline" disabled={!authority.canManageTemplates} onClick={() => void actions.setTemplateArchived(template, archiving)}>
          <Icon className="mr-1 h-4 w-4" aria-hidden />{t(`subcontracts.library.clauses.${archiving ? 'archive' : 'restore'}`)}
        </Button>
        {!authority.canManageTemplates && <span className="text-xs text-muted-foreground">{t('subcontracts.library.reasons.notAuthorized')}</span>}
      </span>
    </article>
  );
}

function TemplateList({ screen, selected, select }: Pick<TemplatesTabProps, 'screen' | 'selected' | 'select'>) {
  const { t, i18n } = useTranslation('procurement');
  const language = resolveHumanLanguage(i18n.language);
  return (
    <>
      <SelectableListSection title={t('subcontracts.library.tabs.templates')} count={screen.templates.length}>
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
  return (
    <CatalogSplit
      listLabel={t('subcontracts.library.tabs.templates')}
      list={<TemplateList screen={screen} selected={selected} select={select} />}
      open={template !== null || pending !== null}
      title={title}
      onClose={() => select(null)}
      empty={{ icon: LayoutTemplate, title: t('subcontracts.library.templates.chooseTitle'), description: t('subcontracts.library.templates.chooseDescription') }}
      details={template ? <TemplateDetail template={template} authority={authority} actions={actions} /> : pending ? <PendingDetail pending={pending} authority={authority} actions={actions} /> : null}
    />
  );
}
