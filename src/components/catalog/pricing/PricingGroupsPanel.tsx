'use client';

/**
 * @fileoverview **Ομάδες έκπτωσης και ομάδες πελατών** — λίστα + ο ένας επεξεργαστής, και τα μέλη της ομάδας πελατών
 *   (ADR-923 §5.11 «3δ» Τμήμα 2).
 * @related PricingGroupEditor.tsx · CustomerGroupMembers.tsx · pricing-group-draft.ts (επιλογή `είδος:κωδικός`)
 * @module components/catalog/pricing/PricingGroupsPanel
 *
 * 🔑 Κάθε γραμμή λέει **πόσο χρησιμοποιείται** (συνθήκες · μέλη) — ο άνθρωπος ξέρει τι αγγίζει πριν τη διαγράψει.
 * 🔑 Τα μέλη εμφανίζονται μόνο σε **αποθηκευμένη** ομάδα: η ανάθεση δείχνει σε id, και η νέα ομάδα δεν έχει ακόμη.
 */

import React, { useMemo } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PRICING_GROUP_KINDS, type PricingGroupKind } from '@/subapps/catalog/vocabulary/pricing';
import { CatalogListItem, CatalogListSection } from '../shared/CatalogList';
import { CatalogSplit } from '../shared/CatalogSplit';
import { useCatalogAccess, useCatalogText } from '../shared/catalog-ui-hooks';
import { NEW_SELECTION, type CatalogSelection } from '../shared/use-catalog-selection';
import type { UnsavedGuard } from '../shared/use-unsaved-guard';
import { CustomerGroupMembers } from './CustomerGroupMembers';
import { groupSelectionOf, parseGroupSelection, type PricingGroupWire } from './pricing-group-draft';
import { PricingGroupEditor } from './PricingGroupEditor';
import { DISCOUNT_ICON, PRICING_GROUP_ICONS, PRICING_GROUP_KIND_KEYS, PRICING_GROUP_NEW_KEYS } from './pricing-labels';
import type { DiscountsWorkspace } from './use-discounts-workspace';

interface PricingGroupsPanelProps {
  readonly workspace: DiscountsWorkspace;
  readonly selection: CatalogSelection;
  readonly unsaved: UnsavedGuard;
}

/** Πόσες ζωντανές εγγραφές δείχνουν σε κάθε ομάδα — συνθήκες (ομάδα έκπτωσης · κοινό) και μέλη (ομάδα πελατών). */
function useUsageCounts(workspace: DiscountsWorkspace): ReadonlyMap<string, number> {
  const { conditions, assignments } = workspace;
  return useMemo(() => {
    const counts = new Map<string, number>();
    const bump = (id: string | null) => { if (id) counts.set(id, (counts.get(id) ?? 0) + 1); };
    for (const condition of conditions.view) {
      bump(condition.discountGroupId);
      bump(condition.audience.kind === 'customerGroup' ? condition.audience.customerGroupId : null);
    }
    for (const assignment of assignments.view) bump(assignment.customerGroupId);
    return counts;
  }, [conditions.view, assignments.view]);
}

function GroupList({ workspace, selection, choose }: PricingGroupsPanelProps & { readonly choose: (value: string | null) => void }) {
  const { t, text } = useCatalogText();
  const canManage = useCatalogAccess('pricing') === 'granted';
  const usage = useUsageCounts(workspace);
  const listOf: Readonly<Record<PricingGroupKind, readonly PricingGroupWire[]>> = { discountGroup: workspace.discountGroups.view, customerGroup: workspace.customerGroups.view };
  const pendingOf: Readonly<Record<PricingGroupKind, ReadonlySet<string>>> = { discountGroup: workspace.discountGroups.pendingKeys, customerGroup: workspace.customerGroups.pendingKeys };
  return (
    <>
      {PRICING_GROUP_KINDS.map((kind) => (
        <CatalogListSection key={kind} title={t(PRICING_GROUP_KIND_KEYS[kind])} count={listOf[kind].length}
          actions={canManage ? (
            <Button type="button" size="icon" variant="ghost" aria-label={t(PRICING_GROUP_NEW_KEYS[kind])} onClick={() => choose(groupSelectionOf(kind, NEW_SELECTION))}>
              <Plus className="h-4 w-4" aria-hidden />
            </Button>
          ) : null}>
          {[...listOf[kind]].sort((a, b) => a.code.localeCompare(b.code)).map((group) => {
            const used = usage.get(group.id) ?? 0;
            return (
              <CatalogListItem key={group.id} primary={text(group.labels, group.code)} secondary={group.code} icon={PRICING_GROUP_ICONS[kind]}
                badges={used > 0 ? [{ label: t('pricing.discounts.groups.usage', { count: used }), variant: 'outline' }] : []}
                selected={selection.selected === groupSelectionOf(kind, group.code)} pending={pendingOf[kind].has(group.id)}
                onSelect={() => choose(groupSelectionOf(kind, group.code))} />
            );
          })}
        </CatalogListSection>
      ))}
    </>
  );
}

export function PricingGroupsPanel(props: PricingGroupsPanelProps) {
  const { workspace, selection, unsaved } = props;
  const { t, text } = useCatalogText();
  const canManage = useCatalogAccess('pricing') === 'granted';
  const choose = (value: string | null) => unsaved.guard(() => selection.select(value));
  const parsed = parseGroupSelection(selection.selected);
  const isNew = parsed?.code === NEW_SELECTION && canManage;
  const siblings: readonly PricingGroupWire[] = parsed?.kind === 'customerGroup' ? workspace.customerGroups.settled : workspace.discountGroups.settled;
  const record = parsed && !isNew ? siblings.find((group) => group.code === parsed.code) ?? null : null;
  const customer = parsed?.kind === 'customerGroup' && record ? workspace.customerGroups.settled.find((group) => group.id === record.id) ?? null : null;
  const title = isNew && parsed ? t(PRICING_GROUP_NEW_KEYS[parsed.kind]) : record ? text(record.labels, record.code) : '';
  return (
    <CatalogSplit
      listLabel={t('pricing.discounts.tabs.groups')}
      list={<GroupList {...props} choose={choose} />}
      open={parsed !== null && (isNew || record !== null)}
      title={title}
      onClose={() => choose(null)}
      empty={{ icon: DISCOUNT_ICON, title: t('pricing.discounts.groups.emptyTitle'), description: t('pricing.discounts.groups.emptyDescription') }}
      details={parsed && (isNew || record) ? (
        <>
          <PricingGroupEditor key={selection.key} kind={parsed.kind} record={record} siblings={siblings} queues={workspace}
            onCreated={(code) => selection.selectIfCurrent(selection.key, groupSelectionOf(parsed.kind, code))}
            onDeleted={() => selection.select(null)} reportDirty={unsaved.reportDirty} />
          {customer ? <CustomerGroupMembers group={customer} workspace={workspace} /> : null}
        </>
      ) : null}
    />
  );
}
