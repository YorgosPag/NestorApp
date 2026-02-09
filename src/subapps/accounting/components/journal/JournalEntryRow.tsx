/**
 * @fileoverview Journal Entry Row — Single table row for a JournalEntry
 * @description Εμφανίζει μία γραμμή εγγραφής Βιβλίου Ε-Ε σε πίνακα
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-001 Chart of Accounts
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

'use client';

import { useTranslation } from 'react-i18next';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { JournalEntry } from '@/subapps/accounting/types';

// ============================================================================
// TYPES
// ============================================================================

interface JournalEntryRowProps {
  entry: JournalEntry;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TYPE_BADGE_VARIANTS = {
  income: 'default',
  expense: 'destructive',
} as const satisfies Record<string, 'default' | 'destructive'>;

// ============================================================================
// HELPERS
// ============================================================================

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(amount);

const formatDate = (iso: string): string =>
  new Intl.DateTimeFormat('el-GR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));

// ============================================================================
// COMPONENT
// ============================================================================

export function JournalEntryRow({ entry }: JournalEntryRowProps) {
  const { t } = useTranslation('accounting');

  return (
    <TableRow>
      <TableCell>{formatDate(entry.date)}</TableCell>
      <TableCell>
        <Badge variant={TYPE_BADGE_VARIANTS[entry.type]}>
          {t(`journal.${entry.type}`)}
        </Badge>
      </TableCell>
      <TableCell className="text-sm">{entry.category}</TableCell>
      <TableCell className="max-w-[200px] truncate">{entry.description}</TableCell>
      <TableCell className="text-right font-medium">{formatCurrency(entry.netAmount)}</TableCell>
      <TableCell className="text-right">{formatCurrency(entry.vatAmount)}</TableCell>
      <TableCell className="text-right font-medium">{formatCurrency(entry.grossAmount)}</TableCell>
      <TableCell className="text-sm">{t(`common.paymentMethods.${entry.paymentMethod}`)}</TableCell>
    </TableRow>
  );
}
