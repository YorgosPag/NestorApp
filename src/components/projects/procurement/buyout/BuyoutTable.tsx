'use client';

/**
 * Buyout table — counted BOQ lines grouped by ΑΤΟΕ category (ADR-330 §5.1 S3.2).
 *
 * Group header: «covered/total» + the € still uncovered, and ONE checkbox that selects the group's open work
 * (Procore Buyout groups by cost code the same way). Each line names what covers it, as links — traceability
 * from budget line to commitment in one click.
 */

import { Fragment } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Checkbox } from '@/components/ui/checkbox';
import { Link } from '@/lib/workspace/navigation';
import { formatCurrency } from '@/lib/intl-utils';
import { costCodeLabelParts } from '@/config/cost-taxonomy';
import { getPoDetailUrl, getRfqDetailUrl } from '@/lib/navigation/procurement-urls';
import { VISIBLE_LINK_CLASS } from '@/lib/ui/link-style';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/procurement/shared/procurement-table-parts';
import type { BuyoutItem } from '@/services/procurement/buyout/project-buyout';
import { BuyoutStatusBadge } from './BuyoutStatusBadge';
import { isSelectable, type BuyoutGroup } from './buyout-view';

interface BuyoutTableProps {
  projectId: string;
  groups: readonly BuyoutGroup[];
  selected: ReadonlySet<string>;
  onToggleItem: (id: string) => void;
  onToggleGroup: (group: BuyoutGroup) => void;
}

function CoveredBy({ projectId, item }: { projectId: string; item: BuyoutItem }) {
  const { t } = useTranslation('procurement');
  if (item.purchaseOrders.length === 0 && item.rfqs.length === 0) return <span aria-hidden>—</span>;
  return (
    <ul className="space-y-0.5">
      {item.purchaseOrders.map(po => (
        <li key={po.poId}>
          <Link href={getPoDetailUrl(projectId, po.poId)} className={VISIBLE_LINK_CLASS}>
            {t('buyout.table.purchaseOrder', { number: po.poNumber })}
          </Link>
        </li>
      ))}
      {item.rfqs.map(rfq => (
        <li key={rfq.rfqId}>
          <Link href={getRfqDetailUrl(projectId, rfq.rfqId)} className={VISIBLE_LINK_CLASS}>
            {t('buyout.table.rfq', { title: rfq.rfqTitle })}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ItemRow({ projectId, item, checked, onToggle }: { projectId: string; item: BuyoutItem; checked: boolean; onToggle: () => void }) {
  const { t } = useTranslation('procurement');
  return (
    <TableRow data-state={checked ? 'selected' : undefined}>
      <TableCell className="w-10">
        {isSelectable(item) && (
          <Checkbox checked={checked} onCheckedChange={onToggle} aria-label={t('buyout.table.selectItem', { title: item.title })} />
        )}
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">{item.costCode ?? item.categoryCode}</TableCell>
      <TableCell className="font-medium">{item.title}</TableCell>
      <TableCell className="text-right tabular-nums whitespace-nowrap">
        {item.priced ? formatCurrency(item.amount) : <span className="text-muted-foreground">{t('buyout.table.unpriced')}</span>}
      </TableCell>
      <TableCell><BuyoutStatusBadge status={item.status} /></TableCell>
      <TableCell className="text-sm"><CoveredBy projectId={projectId} item={item} /></TableCell>
    </TableRow>
  );
}

function GroupHeader({ group, selected, onToggle }: { group: BuyoutGroup; selected: ReadonlySet<string>; onToggle: () => void }) {
  const { t } = useTranslation('procurement');
  const label = t(costCodeLabelParts(group.categoryCode).groupLabelKey);
  const selectable = group.items.filter(isSelectable);
  const chosen = selectable.filter(item => selected.has(item.id)).length;
  const state = chosen === 0 ? false : chosen === selectable.length ? true : 'indeterminate';
  return (
    <TableRow className="bg-muted/40 hover:bg-muted/40">
      <TableCell className="w-10">
        {selectable.length > 0 && (
          <Checkbox checked={state} onCheckedChange={onToggle} aria-label={t('buyout.table.selectGroup', { category: label })} />
        )}
      </TableCell>
      <TableCell colSpan={5}>
        <span className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-semibold">
            <span className="mr-2 font-mono text-xs text-muted-foreground">{group.categoryCode}</span>
            {label}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {t('buyout.table.groupCoverage', { covered: group.coveredCount, total: group.items.length })}
            {group.openAmount > 0 && ` · ${t('buyout.table.groupOpenAmount', { amount: formatCurrency(group.openAmount) })}`}
          </span>
        </span>
      </TableCell>
    </TableRow>
  );
}

export function BuyoutTable({ projectId, groups, selected, onToggleItem, onToggleGroup }: BuyoutTableProps) {
  const { t } = useTranslation('procurement');
  return (
    <Table aria-label={t('buyout.table.ariaLabel')}>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10"><span className="sr-only">{t('buyout.table.select')}</span></TableHead>
          <TableHead>{t('buyout.table.code')}</TableHead>
          <TableHead>{t('buyout.table.work')}</TableHead>
          <TableHead className="text-right">{t('buyout.table.amount')}</TableHead>
          <TableHead>{t('buyout.table.status')}</TableHead>
          <TableHead>{t('buyout.table.coveredBy')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map(group => (
          <Fragment key={group.categoryCode}>
            <GroupHeader group={group} selected={selected} onToggle={() => onToggleGroup(group)} />
            {group.items.map(item => (
              <ItemRow key={item.id} projectId={projectId} item={item} checked={selected.has(item.id)} onToggle={() => onToggleItem(item.id)} />
            ))}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
}
