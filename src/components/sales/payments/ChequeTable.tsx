'use client';

/**
 * ChequeTable — Semantic table of cheques with row click → detail
 * @enterprise ADR-234 Phase 3 — SPEC-234A
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ChequeStatusBadge } from './ChequeStatusBadge';
import type { ChequeRecord } from '@/types/cheque-registry';
import '@/lib/design-system';

interface ChequeTableProps {
  cheques: ChequeRecord[];
  onSelectCheque: (cheque: ChequeRecord) => void;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('el-GR');
  } catch {
    return iso;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function ChequeTable({ cheques, onSelectCheque }: ChequeTableProps) {
  const { t } = useTranslation(['payments', 'payments-cost-calc', 'payments-loans']);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">
            {t('chequeRegistry.fields.chequeNumber')}
          </TableHead>
          <TableHead className="text-xs">
            {t('chequeRegistry.fields.chequeType')}
          </TableHead>
          <TableHead className="text-xs text-right">
            {t('chequeRegistry.fields.amount')}
          </TableHead>
          <TableHead className="text-xs">
            {t('chequeRegistry.fields.drawerName')}
          </TableHead>
          <TableHead className="text-xs">
            {t('chequeRegistry.fields.bankName')}
          </TableHead>
          <TableHead className="text-xs">
            {t('chequeRegistry.fields.maturityDate')}
          </TableHead>
          <TableHead className="text-xs">
            {t('chequeRegistry.fields.status')}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cheques.map((cheque) => (
          <TableRow
            key={cheque.chequeId}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => onSelectCheque(cheque)}
          >
            <TableCell className="text-xs font-mono">{cheque.chequeNumber}</TableCell>
            <TableCell className="text-xs">
              {t(`paymentMethod.${cheque.chequeType}`)}
            </TableCell>
            <TableCell className="text-xs text-right font-medium">
              {formatCurrency(cheque.amount)}
            </TableCell>
            <TableCell className="text-xs">{cheque.drawerName}</TableCell>
            <TableCell className="text-xs">{cheque.bankName}</TableCell>
            <TableCell className="text-xs">{formatDate(cheque.maturityDate)}</TableCell>
            <TableCell>
              <ChequeStatusBadge status={cheque.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
