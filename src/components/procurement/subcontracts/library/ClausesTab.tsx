'use client';

/**
 * **Οι ρήτρες της βιβλιοθήκης** (ADR-928 Φ3γ-0): λίστα | η ρήτρα. Οι αρχειοθετημένες κρύβονται εξ ορισμού και
 * φαίνονται με διακόπτη (για επαναφορά) — ποτέ δεν χάνονται.
 * 🔑 Η επιλογή ζει στη διεύθυνση (`?clause=`), κοινή με την ουρά ελέγχου.
 */

import { lazy, Suspense, useId, useMemo, useState } from 'react';
import { BookOpen, ScrollText } from 'lucide-react';
import { CatalogSplit } from '@/components/catalog/shared/CatalogSplit';
import { SelectableListItem, SelectableListSection, type SelectableListBadge } from '@/components/shared/lists/SelectableList';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage } from '@/i18n/languages';
import { localizedIn } from '@/subapps/procurement/subcontracts/document/render-parameter-value';
import type { LibraryActionContext } from '@/subapps/procurement/subcontracts/library/library-action-blocks';
import type { SubcontractClause } from '@/subapps/procurement/subcontracts/types/clause';
import type { LibraryActions } from './useLibraryActions';
import type { LibraryScreen } from './useLibraryScreen';

const ClauseDetail = lazy(() => import('./ClauseDetail'));

interface ClausesTabProps {
  readonly screen: LibraryScreen;
  readonly context: LibraryActionContext;
  readonly actions: LibraryActions;
  readonly selected: string | null;
  readonly select: (clauseId: string | null) => void;
  readonly onOpenReview: () => void;
}

function useBadges(): (clause: SubcontractClause) => SelectableListBadge[] {
  const { t } = useTranslation('procurement');
  return (clause) => [
    clause.currentVersion !== null
      ? { label: t('subcontracts.library.version.label', { version: clause.currentVersion }), variant: 'success' }
      : { label: t('subcontracts.library.clauses.noCurrent'), variant: 'outline' },
    ...(clause.openProposal !== null ? [{ label: t('subcontracts.library.clauses.inReview'), variant: 'warning' as const }] : []),
    ...(clause.isArchived ? [{ label: t('subcontracts.library.clauses.archived'), variant: 'outline' as const }] : []),
  ];
}

function ArchivedToggle({ value, onChange }: { readonly value: boolean; readonly onChange: (value: boolean) => void }) {
  const { t } = useTranslation('procurement');
  const id = useId();
  return (
    <span className="flex items-center gap-2 px-2 py-1">
      <Switch id={id} checked={value} onCheckedChange={onChange} />
      <Label htmlFor={id} className="text-xs font-normal">{t('subcontracts.library.clauses.showArchived')}</Label>
    </span>
  );
}

export function ClausesTab({ screen, context, actions, selected, select, onOpenReview }: ClausesTabProps) {
  const { t, i18n } = useTranslation('procurement');
  const language = resolveHumanLanguage(i18n.language);
  const badgesOf = useBadges();
  const [showArchived, setShowArchived] = useState(false);
  const clauses = useMemo(() => screen.library.clauses.filter((clause) => showArchived || !clause.isArchived), [screen.library.clauses, showArchived]);
  const clause = screen.library.clauses.find((candidate) => candidate.id === selected) ?? null;
  const list = (
    <SelectableListSection title={t('subcontracts.library.tabs.clauses')} count={clauses.length}>
      <ArchivedToggle value={showArchived} onChange={setShowArchived} />
      {clauses.map((item) => (
        <SelectableListItem key={item.id} primary={localizedIn(item.title, language)} secondary={item.clauseKey} icon={ScrollText} badges={badgesOf(item)} selected={item.id === selected} onSelect={() => select(item.id)} />
      ))}
    </SelectableListSection>
  );
  return (
    <CatalogSplit
      listLabel={t('subcontracts.library.tabs.clauses')}
      list={list}
      open={clause !== null}
      title={clause ? localizedIn(clause.title, language) : ''}
      onClose={() => select(null)}
      empty={{ icon: BookOpen, title: t('subcontracts.library.clauses.chooseTitle'), description: t('subcontracts.library.clauses.chooseDescription') }}
      details={clause && (
        <Suspense fallback={<p className="p-4 text-sm text-muted-foreground" role="status">{t('subcontracts.library.loading')}</p>}>
          <ClauseDetail clause={clause} current={screen.library.versions.get(clause.id) ?? null} context={context} actions={actions} onOpenReview={onOpenReview} />
        </Suspense>
      )}
    />
  );
}
