'use client';

/**
 * CostLedgerDrillDown — the documents behind ONE cost code of the ledger.
 *
 * Every bar of the budget-vs-actual card answers «from where?»: the BOQ lines
 * and project budget lines that make its budget and the purchase orders that make
 * its cost, each order linking to its own page. An unpriced BOQ line says so —
 * it is never shown as «0 €» (Ζ7). Φ4: the expense documents allocated to the code
 * (direct cost or against an order; a document in review is listed, not counted).
 *
 * @see ADR-917 §4 Δ3 (β) · Ζ7
 */

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/workspace/navigation';
import { ENTITY_ROUTES } from '@/lib/routes/entityRoutes';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { CostLedgerViewRow } from '@/services/project-cost/cost-ledger-view';
import type { LedgerExpenseDocumentSource } from '@/services/project-cost/cost-ledger';

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface CostLedgerDrillDownProps {
  row: CostLedgerViewRow;
  label: string;
  /** Where the row's budget comes from, already in words («allowance (estimate)» · «no source») */
  source: string;
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

function expenseKindText(document: LedgerExpenseDocumentSource, t: Translate): string {
  if (!document.counted) return t('variance.drillDown.expenseInReview');
  return t(document.purchaseOrderId === null ? 'variance.drillDown.expenseDirect' : 'variance.drillDown.expenseAgainstPo');
}

interface ExpenseDocumentListProps {
  documents: readonly LedgerExpenseDocumentSource[];
  overbilled: number;
  t: Translate;
}

/** ADR-917 Φ4 — what makes «invoiced»: direct cost or against an order; in review = listed, not counted */
function ExpenseDocumentList({ documents, overbilled, t }: ExpenseDocumentListProps) {
  // ONE array — `SourceList` decides «none» by its length, so a conditional sibling would always count
  const items = documents.map((document) => (
    <li key={`${document.id}|${document.purchaseOrderId ?? ''}`} className="flex justify-between gap-4 px-3 py-1.5">
      <span className="truncate">{document.label}</span>
      <span className="text-muted-foreground">{expenseKindText(document, t)}</span>
      <span className="tabular-nums">{formatCurrencyWhole(document.amount)}</span>
    </li>
  ));
  if (overbilled > 0) {
    items.push(
      <li key="overbilled" className="px-3 py-1.5 font-medium">
        {t('variance.drillDown.overbilled', { amount: formatCurrencyWhole(overbilled) })}
      </li>,
    );
  }
  return (
    <SourceList title={t('variance.drillDown.expenseDocuments')} empty={t('variance.drillDown.none')}>
      {items}
    </SourceList>
  );
}

export function CostLedgerDrillDown({ row, label, source, onClose, t }: CostLedgerDrillDownProps) {
  const iconSizes = useIconSizes();
  const sources = row.sources ?? { boqItems: [], purchaseOrders: [], budgetLines: [], excludedSummaries: [], expenseDocuments: [] };
  const none = t('variance.drillDown.none');

  return (
    <section className="space-y-3 rounded-md border p-3" aria-label={t('variance.drillDown.title', { code: label })}>
      <header className="flex items-center justify-between">
        <hgroup>
          <h3 className="text-sm font-semibold">{t('variance.drillDown.title', { code: label })}</h3>
          <p className="text-xs text-muted-foreground">{t('variance.drillDown.source', { source })}</p>
        </hgroup>
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
            {item.priced ? (
              <span className="tabular-nums">{formatCurrencyWhole(item.amount)}</span>
            ) : (
              <span className="text-muted-foreground">{t('variance.drillDown.unpriced')}</span>
            )}
          </li>
        ))}
      </SourceList>

      {sources.excludedSummaries.length > 0 ? (
        // ADR-917 Λ7 — ορατή, όχι κρυμμένη: η σύνοψη τοίχου DNA δεν αθροίζεται, μετρούν οι στρώσεις
        <SourceList title={t('variance.drillDown.excludedSummaries')} empty={none}>
          {sources.excludedSummaries.map((summary) => (
            <li key={summary.id} className="flex justify-between gap-4 px-3 py-1.5 text-muted-foreground">
              <span className="truncate">
                {summary.costCode && <span className="mr-2 font-mono">{summary.costCode}</span>}
                {summary.title}
              </span>
              <span>{t('variance.drillDown.excludedSummaryNote', { count: summary.childCount })}</span>
            </li>
          ))}
        </SourceList>
      ) : null}

      {sources.budgetLines.length > 0 ? (
        <SourceList title={t('variance.drillDown.budgetLines')} empty={none}>
          {sources.budgetLines.map((line) => (
            <li key={line.id} className="flex justify-between gap-4 px-3 py-1.5">
              <span className="truncate">
                <span className="mr-2 font-mono text-muted-foreground">{line.costCode}</span>
                {line.note}
              </span>
              <span className="tabular-nums">{formatCurrencyWhole(line.amount)}</span>
            </li>
          ))}
        </SourceList>
      ) : null}

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

      <ExpenseDocumentList documents={sources.expenseDocuments} overbilled={row.overbilled} t={t} />
    </section>
  );
}
