/**
 * @fileoverview Journal Entry Row — Single table row for a JournalEntry
 * @description Εμφανίζει μία γραμμή εγγραφής Βιβλίου Ε-Ε σε πίνακα — με την κατάσταση αντιλογισμού (ADR-ACC-010
 *   §2.1.1 Φ8): «Αντιλογίστηκε» στην αρχική, «Αντιλογισμός» στο storno, και την ενέργεια «Αντιλογισμός» μόνο όπου
 *   επιτρέπεται (`canReverseFromLedger`). Εγγραφή τιμολογίου / αποσβέσεων λέει ΑΠΟ ΠΟΥ διορθώνεται, αντί για κουμπί.
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.1.0
 * @see ADR-ACC-001 Chart of Accounts
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

'use client';

import { useTranslation } from 'react-i18next';
import { Undo2 } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { JournalEntry } from '@/subapps/accounting/types';
import { canReverseFromLedger, reversalRefusalOf } from '../../services/journal/journal-reversal-policy';
import { formatAccountingCurrency, formatAccountingDate } from '../../utils/format';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// ============================================================================
// TYPES
// ============================================================================

interface JournalEntryRowProps {
  entry: JournalEntry;
  /** Άνοιγμα του διαλόγου αντιλογισμού για αυτή την εγγραφή */
  onReverse: (entry: JournalEntry) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TYPE_BADGE_VARIANTS = {
  income: 'default',
  expense: 'destructive',
} as const satisfies Record<string, 'default' | 'destructive'>;

// ============================================================================
// COMPONENT
// ============================================================================

/** Η κατάσταση αντιλογισμού — ορατή χωρίς χρώμα (κείμενο στο σήμα). */
function ReversalBadge({ entry }: { readonly entry: JournalEntry }) {
  const { t } = useTranslation(['accounting', 'accounting-tax-offices']);
  if (entry.isReversal) return <Badge variant="outline">{t('journal.reversal.badges.reversal')}</Badge>;
  if (entry.status === 'REVERSED') return <Badge variant="secondary">{t('journal.reversal.badges.reversed')}</Badge>;
  return null;
}

/** Κουμπί όπου επιτρέπεται· αλλιώς ΑΠΟ ΠΟΥ διορθώνεται (τιμολόγιο / αποσβέσεις)· τίποτα σε αντιλογισμένη/storno. */
function ReversalAction({ entry, onReverse }: JournalEntryRowProps) {
  const { t } = useTranslation(['accounting', 'accounting-tax-offices']);
  const colors = useSemanticColors();
  if (canReverseFromLedger(entry)) {
    return (
      <Button variant="ghost" size="sm" onClick={() => onReverse(entry)}>
        <Undo2 className="mr-1 h-4 w-4" aria-hidden="true" />
        {t('journal.reversal.action')}
      </Button>
    );
  }
  const refusal = entry.status === 'ACTIVE' ? reversalRefusalOf(entry, 'manual') : null;
  if (refusal === 'INVOICE_LINKED' || refusal === 'SUBSYSTEM_OWNED') {
    return <span className={`text-xs ${colors.text.muted}`}>{t(`journal.reversal.origin.${refusal}`)}</span>;
  }
  return null;
}

export function JournalEntryRow({ entry, onReverse }: JournalEntryRowProps) {
  const { t } = useTranslation(['accounting', 'accounting-tax-offices']);
  const colors = useSemanticColors();
  const superseded = entry.status === 'REVERSED';

  return (
    <TableRow className={superseded ? colors.text.muted : undefined}>
      <TableCell>{formatAccountingDate(entry.date)}</TableCell>
      <TableCell>
        <Badge variant={TYPE_BADGE_VARIANTS[entry.type]}>
          {t(`journal.${entry.type}`)}
        </Badge>
      </TableCell>
      <TableCell className="text-sm">{entry.category}</TableCell>
      <TableCell className="max-w-[200px]">
        <span className="block truncate">{entry.description}</span>
        <ReversalBadge entry={entry} />
      </TableCell>
      <TableCell className="text-right font-medium">{formatAccountingCurrency(entry.netAmount)}</TableCell>
      <TableCell className="text-right">{formatAccountingCurrency(entry.vatAmount)}</TableCell>
      <TableCell className="text-right font-medium">{formatAccountingCurrency(entry.grossAmount)}</TableCell>
      <TableCell className="text-sm">{t(`common.paymentMethods.${entry.paymentMethod}`)}</TableCell>
      <TableCell className="text-right">
        <ReversalAction entry={entry} onReverse={onReverse} />
      </TableCell>
    </TableRow>
  );
}
