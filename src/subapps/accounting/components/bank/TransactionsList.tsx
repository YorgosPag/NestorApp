'use client';

/**
 * @fileoverview Accounting Subapp — Bank Transactions List
 * @description Table displaying bank transactions with status badges
 * @author Claude Code (Anthropic AI) + Georgios Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-008 Bank Reconciliation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { BankTransaction, MatchStatus } from '@/subapps/accounting/types';

// ============================================================================
// TYPES
// ============================================================================

interface TransactionsListProps {
  transactions: BankTransaction[];
  onRefresh: () => Promise<void>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MATCH_STATUS_VARIANTS: Record<MatchStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  unmatched: 'destructive',
  auto_matched: 'default',
  manual_matched: 'secondary',
  excluded: 'outline',
};

// ============================================================================
// HELPERS
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(amount);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('el-GR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

// ============================================================================
// COMPONENT
// ============================================================================

export function TransactionsList({ transactions }: TransactionsListProps) {
  const { t } = useTranslation('accounting');
  const colors = useSemanticColors();

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-lg font-medium text-foreground mb-1">
          {t('bank.noTransactions')}
        </p>
        <p className="text-muted-foreground">
          {t('bank.noTransactionsDescription')}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">{t('bank.date')}</TableHead>
            <TableHead>{t('bank.bankDescription')}</TableHead>
            <TableHead className="w-36 text-right">{t('bank.amount')}</TableHead>
            <TableHead className="w-36">{t('bank.matchStatus')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.transactionId}>
              <TableCell className="text-sm">
                {formatDate(tx.valueDate)}
              </TableCell>
              <TableCell className="max-w-[300px] truncate text-sm">
                {tx.bankDescription}
              </TableCell>
              <TableCell
                className={`text-right font-medium ${
                  tx.direction === 'credit'
                    ? colors.text.success
                    : colors.text.error
                }`}
              >
                {tx.direction === 'credit' ? '+' : '-'}
                {formatCurrency(tx.amount)}
              </TableCell>
              <TableCell>
                <Badge variant={MATCH_STATUS_VARIANTS[tx.matchStatus]}>
                  {t(`bank.matchStatuses.${tx.matchStatus}`)}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

