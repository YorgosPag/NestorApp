'use client';

/**
 * CostLedgerDrillDown — the documents behind ONE cost code of the ledger.
 *
 * Every bar of the budget-vs-actual card answers «from where?»: the BOQ lines
 * that make its budget and the purchase orders that make its cost, each order
 * linking to its own page.
 *
 * @see ADR-917 §4 Δ3 (β)
 */

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/workspace/navigation';
import { ENTITY_ROUTES } from '@/lib/routes/entityRoutes';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { CostLedgerViewRow } from '@/services/project-cost/cost-ledger-view';

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface CostLedgerDrillDownProps {
  row: CostLedgerViewRow;
  label: string;
  onClose: () => void;
  t: Translate;
}

function SourceList({ title, empty, children }: { title: string; empty: string; children: ReactNode[] }) {
  return (
    <section className="space-y-1">
      <h4 className="text-sm font-medium">{title}</h4>
      {children.length > 0 ? (
        <ul className="divide-y rounded-md border text-sm">{children}</ul>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

export function CostLedgerDrillDown({ row, label, onClose, t }: CostLedgerDrillDownProps) {
  const iconSizes = useIconSizes();
  const sources = row.sources ?? { boqItems: [], purchaseOrders: [] };
  const none = t('variance.drillDown.none');

  return (
    <section className="space-y-3 rounded-md border p-3" aria-label={t('variance.drillDown.title', { code: label })}>
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('variance.drillDown.title', { code: label })}</h3>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label={t('variance.drillDown.close')}>
          <X className={iconSizes.sm} aria-hidden="true" />
        </Button>
      </header>

      <SourceList title={t('variance.drillDown.boqItems')} empty={none}>
        {sources.boqItems.map((item) => (
          <li key={item.id} className="flex justify-between gap-4 px-3 py-1.5">
            <span className="truncate">
              {item.costCode && <span className="mr-2 font-mono text-muted-foreground">{item.costCode}</span>}
              {item.title}
            </span>
            <span className="tabular-nums">{formatCurrencyWhole(item.amount)}</span>
          </li>
        ))}
      </SourceList>

      <SourceList title={t('variance.drillDown.purchaseOrders')} empty={none}>
        {sources.purchaseOrders.map((order) => (
          <li key={order.id} className="flex justify-between gap-4 px-3 py-1.5">
            <Link href={ENTITY_ROUTES.procurement.purchaseOrder(order.id)} className="underline-offset-2 hover:underline">
              {order.poNumber}
            </Link>
            <span className="text-muted-foreground">{t(`procurement:status.${order.status}`)}</span>
            <span className="tabular-nums">{formatCurrencyWhole(order.amount)}</span>
          </li>
        ))}
      </SourceList>
    </section>
  );
}
