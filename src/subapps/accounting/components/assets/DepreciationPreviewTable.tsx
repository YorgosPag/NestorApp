'use client';

/**
 * @fileoverview Πίνακας προεπισκόπησης αποσβέσεων χρήσης — σωστό / καταχωρημένο / διαφορά ανά πάγιο
 * @description Ό,τι θα μπει στο Βιβλίο Ε-Ε ΠΡΙΝ μπει (SAP AFAB test run). Μόνο προβολή: τα ποσά τα υπολογίζει ο διακομιστής.
 * @see ADR-ACC-010 §2.1.1 Φάση 5
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { DepreciationPreview } from '@/subapps/accounting/types';
import { formatAccountingCurrency } from '../../utils/format';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

interface DepreciationPreviewTableProps {
  readonly preview: DepreciationPreview;
}

export function DepreciationPreviewTable({ preview }: DepreciationPreviewTableProps) {
  const { t } = useTranslation(['accounting', 'accounting-tax-offices']);
  const colors = useSemanticColors();

  return (
    <Table>
      <caption className="sr-only">{t('assets.depreciationRun.tableCaption', { year: preview.fiscalYear })}</caption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">{t('assets.depreciationRun.columns.asset')}</TableHead>
          <TableHead scope="col" className="w-32">{t('assets.depreciationRun.columns.category')}</TableHead>
          <TableHead scope="col" className="w-20 text-right">{t('assets.depreciationRun.columns.rate')}</TableHead>
          <TableHead scope="col" className="w-20 text-right">{t('assets.depreciationRun.columns.months')}</TableHead>
          <TableHead scope="col" className="w-28 text-right">{t('assets.depreciationRun.columns.target')}</TableHead>
          <TableHead scope="col" className="w-28 text-right">{t('assets.depreciationRun.columns.booked')}</TableHead>
          <TableHead scope="col" className="w-28 text-right">{t('assets.depreciationRun.columns.delta')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {preview.lines.map((line) => (
          <TableRow key={line.assetId}>
            <TableCell className="font-medium max-w-[220px] truncate">{line.description}</TableCell>
            <TableCell className="text-sm">{t(`assets.categories.${line.category}`)}</TableCell>
            <TableCell className="text-right text-sm">{t('assets.depreciationRun.ratePercent', { rate: line.appliedRate })}</TableCell>
            <TableCell className="text-right text-sm">{line.monthsApplied}</TableCell>
            <TableCell className="text-right text-sm">{formatAccountingCurrency(line.target)}</TableCell>
            <TableCell className={cn('text-right text-sm', colors.text.muted)}>{formatAccountingCurrency(line.booked)}</TableCell>
            <TableCell className="text-right text-sm font-medium">{formatAccountingCurrency(line.delta)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableHead scope="row" colSpan={4}>{t('assets.depreciationRun.total')}</TableHead>
          <TableCell className="text-right font-medium">{formatAccountingCurrency(preview.totalTarget)}</TableCell>
          <TableCell className="text-right font-medium">{formatAccountingCurrency(preview.totalBooked)}</TableCell>
          <TableCell className="text-right font-semibold">{formatAccountingCurrency(preview.totalDelta)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
