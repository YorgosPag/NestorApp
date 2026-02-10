/**
 * @fileoverview Journal Entries Table — Πίνακας εγγραφών Βιβλίου Ε-Ε
 * @description Table component που εμφανίζει εγγραφές journal entries με columns
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-001 Chart of Accounts
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

'use client';

import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { JournalEntry } from '@/subapps/accounting/types';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { JournalEntryRow } from './JournalEntryRow';
import { formatCurrency } from '../../utils/format';

// ============================================================================
// TYPES
// ============================================================================

interface JournalEntriesTableProps {
  entries: JournalEntry[];
}

// ============================================================================
// HELPERS
// ============================================================================

// ============================================================================
// COMPONENT
// ============================================================================

export function JournalEntriesTable({ entries }: JournalEntriesTableProps) {
  const { t } = useTranslation('accounting');
  const colors = useSemanticColors();

  const totalIncome = entries
    .filter((e) => e.type === 'income')
    .reduce((sum, e) => sum + e.grossAmount, 0);

  const totalExpenses = entries
    .filter((e) => e.type === 'expense')
    .reduce((sum, e) => sum + e.grossAmount, 0);

  const netResult = totalIncome - totalExpenses;

  return (
    <section>
      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">{t('journal.date')}</TableHead>
              <TableHead className="w-24">{t('journal.type')}</TableHead>
              <TableHead className="w-36">{t('journal.category')}</TableHead>
              <TableHead>{t('journal.description_label')}</TableHead>
              <TableHead className="w-28 text-right">{t('journal.netAmount')}</TableHead>
              <TableHead className="w-24 text-right">{t('journal.vatAmount')}</TableHead>
              <TableHead className="w-28 text-right">{t('journal.grossAmount')}</TableHead>
              <TableHead className="w-32">{t('journal.paymentMethod')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <JournalEntryRow key={entry.entryId} entry={entry} />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Totals Summary */}
      <footer className="mt-4 flex flex-wrap gap-6 text-sm">
        <dl className="flex items-center gap-2">
          <dt className="text-muted-foreground">{t('journal.totalIncome')}:</dt>
          <dd className={`font-semibold ${colors.text.success}`}>{formatCurrency(totalIncome)}</dd>
        </dl>
        <dl className="flex items-center gap-2">
          <dt className="text-muted-foreground">{t('journal.totalExpenses')}:</dt>
          <dd className={`font-semibold ${colors.text.error}`}>{formatCurrency(totalExpenses)}</dd>
        </dl>
        <dl className="flex items-center gap-2">
          <dt className="text-muted-foreground">{t('journal.netResult')}:</dt>
          <dd className={`font-bold ${netResult >= 0 ? colors.text.success : colors.text.error}`}>
            {formatCurrency(netResult)}
          </dd>
        </dl>
      </footer>
    </section>
  );
}
