'use client';

/**
 * BudgetLineGroupTable — one family of budget lines (allowances on ΑΤΟΕ · soft cost) with its total
 * (ADR-917 Φ3γ). The family follows from the code (Ζ8) — no stored kind to disagree with.
 *
 * @module components/projects/tabs/project-budget/BudgetLineGroupTable
 */

import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/intl-utils';
import type { ProjectCostLedgerView } from '@/services/project-cost/cost-ledger-view';
import type { BudgetLineDisplay, BudgetLineValues } from '@/services/project-cost/budget-lines-optimistic';
import { budgetLineEffect, type BudgetLineFamily } from './budget-line-presentation';
import { BudgetLineRow } from './BudgetLineRow';

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface BudgetLineGroupTableProps {
  family: BudgetLineFamily;
  lines: readonly BudgetLineDisplay[];
  ledger: ProjectCostLedgerView | null;
  readOnly: boolean;
  onSet: (costCode: string, values: BudgetLineValues) => void;
  onArchive: (line: BudgetLineDisplay) => void;
  t: Translate;
}

export function BudgetLineGroupTable({ family, lines, ledger, readOnly, onSet, onArchive, t }: BudgetLineGroupTableProps) {
  if (lines.length === 0) return null;
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  const headingId = `budget-group-${family}`;

  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <header>
        <h3 id={headingId} className="text-sm font-semibold">{t(`budgetEditor.groups.${family}`)}</h3>
        <p className="text-xs text-muted-foreground">{t(`budgetEditor.groups.${family}Hint`)}</p>
      </header>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('budgetEditor.columns.code')}</TableHead>
            <TableHead className="text-right">{t('budgetEditor.columns.amount')}</TableHead>
            <TableHead>{t('budgetEditor.columns.note')}</TableHead>
            <TableHead>{t('budgetEditor.columns.effect')}</TableHead>
            <TableHead className="sr-only">{t('budgetEditor.columns.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => (
            <BudgetLineRow
              key={line.costCode}
              line={line}
              effect={budgetLineEffect(line.costCode, ledger)}
              readOnly={readOnly}
              onSet={onSet}
              onArchive={onArchive}
              t={t}
            />
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="font-semibold">{t('budgetEditor.total')}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(total)}</TableCell>
            <TableCell colSpan={3} />
          </TableRow>
        </TableFooter>
      </Table>
    </section>
  );
}
