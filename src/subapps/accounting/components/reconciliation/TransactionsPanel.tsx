/**
 * @fileoverview TransactionsPanel Component (Phase 2d)
 * @description Left panel: filterable bank transactions table with multi-select
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md Q11 (Split view — left panel)
 * @compliance CLAUDE.md Enterprise Standards — semantic HTML, no inline styles
 */

'use client';

import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Spinner } from '@/components/ui/spinner';
import type { BankTransaction, MatchStatus } from '@/subapps/accounting/types';
import { formatAccountingCurrency } from '../../utils/format';

// ============================================================================
// TYPES
// ============================================================================

type StatusFilter = MatchStatus | 'all';

interface TransactionsPanelProps {
  transactions: BankTransaction[];
  selectedTransactionId: string | null;
  checkedIds: Set<string>;
  statusFilter: StatusFilter;
  loading: boolean;
  onSelect: (id: string) => void;
  onCheckToggle: (id: string) => void;
  onCheckAll: () => void;
  onStatusFilterChange: (status: StatusFilter) => void;
}

// ============================================================================
// STATUS BADGE MAPPING
// ============================================================================

const STATUS_VARIANT: Record<MatchStatus, 'success' | 'warning' | 'muted' | 'info'> = {
  auto_matched: 'success',
  manual_matched: 'info',
  unmatched: 'warning',
  excluded: 'muted',
  reconciled: 'success',
};

// ============================================================================
// COMPONENT
// ============================================================================

export function TransactionsPanel({
  transactions,
  selectedTransactionId,
  checkedIds,
  statusFilter,
  loading,
  onSelect,
  onCheckToggle,
  onCheckAll,
  onStatusFilterChange,
}: TransactionsPanelProps) {
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);

  const filtered = statusFilter === 'all'
    ? transactions
    : transactions.filter((txn) => txn.matchStatus === statusFilter);

  const unmatchedCount = transactions.filter((t) => t.matchStatus === 'unmatched').length;
  const allChecked = filtered.length > 0 && filtered.every((t) => checkedIds.has(t.transactionId));

  return (
    <section className="flex flex-col h-full">
      {/* Header with filter and stats */}
      <header className="flex items-center justify-between gap-3 p-3 border-b">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">
            {t('reconciliation.transactions')}
          </h3>
          <Badge variant="outline">{unmatchedCount} {t('reconciliation.unmatched')}</Badge>
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => onStatusFilterChange(v as StatusFilter)}
        >
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('reconciliation.filterAll')}</SelectItem>
            <SelectItem value="unmatched">{t('reconciliation.filterUnmatched')}</SelectItem>
            <SelectItem value="auto_matched">{t('reconciliation.filterAutoMatched')}</SelectItem>
            <SelectItem value="manual_matched">{t('reconciliation.filterManualMatched')}</SelectItem>
            <SelectItem value="excluded">{t('reconciliation.filterExcluded')}</SelectItem>
          </SelectContent>
        </Select>
      </header>

      {/* Transaction table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center p-6">
            {t('reconciliation.noTransactions')}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox
                    checked={allChecked}
                    onCheckedChange={onCheckAll}
                    aria-label={t('reconciliation.selectAll')}
                  />
                </TableHead>
                <TableHead className="text-xs">{t('reconciliation.date')}</TableHead>
                <TableHead className="text-xs">{t('reconciliation.description')}</TableHead>
                <TableHead className="text-xs text-right">{t('reconciliation.amount')}</TableHead>
                <TableHead className="text-xs">{t('reconciliation.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((txn) => (
                <TransactionRow
                  key={txn.transactionId}
                  txn={txn}
                  selected={txn.transactionId === selectedTransactionId}
                  checked={checkedIds.has(txn.transactionId)}
                  onSelect={onSelect}
                  onCheck={onCheckToggle}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </section>
  );
}

// ============================================================================
// ROW SUBCOMPONENT
// ============================================================================

interface TransactionRowProps {
  txn: BankTransaction;
  selected: boolean;
  checked: boolean;
  onSelect: (id: string) => void;
  onCheck: (id: string) => void;
}

function TransactionRow({ txn, selected, checked, onSelect, onCheck }: TransactionRowProps) {
  const rowClasses = [
    'cursor-pointer transition-colors',
    selected ? 'bg-accent' : 'hover:bg-muted/50',
  ].join(' ');

  return (
    <TableRow className={rowClasses} onClick={() => onSelect(txn.transactionId)}>
      <TableCell>
        <Checkbox
          checked={checked}
          onCheckedChange={() => onCheck(txn.transactionId)}
          onClick={(e) => e.stopPropagation()}
        />
      </TableCell>
      <TableCell className="text-xs whitespace-nowrap">
        {txn.transactionDate}
      </TableCell>
      <TableCell className="text-xs max-w-[200px] truncate">
        {txn.bankDescription}
      </TableCell>
      <TableCell className={`text-xs text-right font-mono ${txn.direction === 'credit' ? 'text-emerald-600' : 'text-red-600'}`}>
        {txn.direction === 'credit' ? '+' : '-'}{formatAccountingCurrency(txn.amount)}
      </TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANT[txn.matchStatus]} className="text-[10px]">
          {txn.matchStatus.replace('_', ' ')}
        </Badge>
      </TableCell>
    </TableRow>
  );
}
