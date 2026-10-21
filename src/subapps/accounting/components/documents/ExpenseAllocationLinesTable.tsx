'use client';

/**
 * ExpenseAllocationLinesTable — the draft lines of an expense document's cost allocation (ADR-917 Φ4).
 *
 * Every line says its project, its cost code (label + code, never a raw key), the order it bills against or
 * «direct cost», and its ORIGIN (proposal from the order · manual) — an edited proposal becomes manual.
 *
 * @module subapps/accounting/components/documents/ExpenseAllocationLinesTable
 */

import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { costCodeLabelKey, costCodeGroupOf } from '@/config/cost-taxonomy';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { AllocationDraftLine } from './expense-allocation-draft';

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface ExpenseAllocationLinesTableProps {
  lines: readonly AllocationDraftLine[];
  projectNames: ReadonlyMap<string, string>;
  purchaseOrderNumbers: Readonly<Record<string, string>>;
  disabled: boolean;
  onAmountChange: (index: number, amountText: string) => void;
  onRemove: (index: number) => void;
  t: Translate;
}

function codeText(costCode: string, t: Translate): string {
  return `${t(costCodeLabelKey(costCodeGroupOf(costCode)))} (${costCode})`;
}

function orderText(line: AllocationDraftLine, numbers: Readonly<Record<string, string>>, t: Translate): string {
  if (line.purchaseOrderId === null) return t('documents.allocation.lines.direct');
  return numbers[line.purchaseOrderId] ?? line.purchaseOrderId;
}

interface LineRowProps {
  line: AllocationDraftLine;
  index: number;
  projectName: string;
  orderLabel: string;
  disabled: boolean;
  onAmountChange: (index: number, amountText: string) => void;
  onRemove: (index: number) => void;
  t: Translate;
}

function AllocationLineRow({ line, index, projectName, orderLabel, disabled, onAmountChange, onRemove, t }: LineRowProps) {
  const iconSizes = useIconSizes();
  const code = codeText(line.costCode, t);
  return (
    <TableRow>
      <TableCell>{projectName}</TableCell>
      <TableCell>{code}</TableCell>
      <TableCell>{orderLabel}</TableCell>
      <TableCell className="w-36">
        <Input inputMode="decimal" className="text-right tabular-nums" value={line.amountText} disabled={disabled}
          aria-label={t('documents.allocation.lines.amountAria', { code })} onChange={(event) => onAmountChange(index, event.target.value)} />
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {t(line.origin === 'po_proposal' ? 'documents.allocation.lines.originProposal' : 'documents.allocation.lines.originManual')}
      </TableCell>
      <TableCell className="w-12 text-right">
        <Button variant="ghost" size="sm" disabled={disabled} onClick={() => onRemove(index)} aria-label={t('documents.allocation.lines.remove', { code })}>
          <Trash2 className={iconSizes.sm} aria-hidden="true" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function ExpenseAllocationLinesTable(props: ExpenseAllocationLinesTableProps) {
  const { lines, projectNames, purchaseOrderNumbers, t } = props;
  if (lines.length === 0) return <p className="text-sm text-muted-foreground">{t('documents.allocation.lines.empty')}</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('documents.allocation.lines.project')}</TableHead>
          <TableHead>{t('documents.allocation.lines.costCode')}</TableHead>
          <TableHead>{t('documents.allocation.lines.purchaseOrder')}</TableHead>
          <TableHead className="text-right">{t('documents.allocation.lines.amount')}</TableHead>
          <TableHead>{t('documents.allocation.lines.origin')}</TableHead>
          <TableHead><span className="sr-only">{t('documents.allocation.lines.remove', { code: '' })}</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line, index) => (
          <AllocationLineRow
            key={`${line.projectId}|${line.costCode}|${line.purchaseOrderId ?? ''}`}
            line={line}
            index={index}
            projectName={projectNames.get(line.projectId) ?? t('documents.allocation.lines.unknownProject')}
            orderLabel={orderText(line, purchaseOrderNumbers, t)}
            disabled={props.disabled}
            onAmountChange={props.onAmountChange}
            onRemove={props.onRemove}
            t={t}
          />
        ))}
      </TableBody>
    </Table>
  );
}
