'use client';
/* eslint-disable custom/no-hardcoded-strings */
/* eslint-disable design-system/enforce-semantic-colors */

/**
 * InstallmentSchedule — Table of installments with status and actions
 * @enterprise ADR-234 - Payment Plan & Installment Tracking
 */

import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, MinusCircle, CircleDashed, Pencil, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Installment, InstallmentStatus } from '@/types/payment-plan';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { nowISO } from '@/lib/date-local';

// ============================================================================
// STATUS DISPLAY CONFIG
// ============================================================================

const STATUS_CONFIG: Record<InstallmentStatus, {
  icon: React.ElementType;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className: string;
}> = {
  paid: { icon: CheckCircle2, variant: 'default', className: 'text-green-600' },
  partial: { icon: CircleDashed, variant: 'secondary', className: 'text-blue-600' },
  due: { icon: AlertTriangle, variant: 'destructive', className: 'text-red-600' },
  pending: { icon: Clock, variant: 'outline', className: '' },
  waived: { icon: MinusCircle, variant: 'secondary', className: '' },
};

// ============================================================================
// COMPONENT
// ============================================================================

interface InstallmentScheduleProps {
  installments: Installment[];
  onPayInstallment?: (index: number) => void;
  onEditInstallment?: (index: number) => void;
  onAddInstallment?: () => void;
  planStatus: string;
}

export function InstallmentSchedule({
  installments,
  onPayInstallment,
  onEditInstallment,
  onAddInstallment,
  planStatus,
}: InstallmentScheduleProps) {
  const colors = useSemanticColors();
  const canEdit = planStatus === 'negotiation' || planStatus === 'draft' || planStatus === 'active';
  const canAdd = planStatus === 'negotiation' || planStatus === 'draft';
  const { t } = useTranslation(['payments', 'payments-cost-calc', 'payments-loans']);

  const now = nowISO();

  // Compute effective status (pending → due if overdue)
  function getEffectiveStatus(inst: Installment): InstallmentStatus {
    if (inst.status === 'paid' || inst.status === 'waived') return inst.status;
    if (inst.status === 'partial') return 'partial';
    if (inst.dueDate < now && inst.paidAmount < inst.amount) return 'due';
    return 'pending';
  }

  return (
    <section className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">#</TableHead>
            <TableHead>{t('labels.dueDate')}</TableHead>
            <TableHead className="text-right">
              {t('labels.amount')}
            </TableHead>
            <TableHead className="text-right">
              {t('labels.paidAmount')}
            </TableHead>
            <TableHead className="text-center">
              {t('installments.title')}
            </TableHead>
            <TableHead className="text-center">
              {t('labels.dueDate')}
            </TableHead>
            {(onPayInstallment || onEditInstallment) && <TableHead className="w-24" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {installments.map((inst) => {
            const effectiveStatus = getEffectiveStatus(inst);
            const config = STATUS_CONFIG[effectiveStatus];
            const Icon = config.icon;
            const canPay =
              planStatus !== 'completed' &&
              planStatus !== 'cancelled' &&
              inst.status !== 'paid' &&
              inst.status !== 'waived';

            return (
              <TableRow key={inst.index}>
                <TableCell className={cn("text-xs", colors.text.muted)}>
                  {inst.index + 1}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{inst.label}</span>
                    <span className={cn("text-[10px]", colors.text.muted)}>
                      {t(`installmentType.${inst.type}`)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm">
                  €{inst.amount.toLocaleString('el-GR')}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {inst.paidAmount > 0 ? (
                    <span className="text-green-600">
                      €{inst.paidAmount.toLocaleString('el-GR')}
                    </span>
                  ) : (
                    <span className={colors.text.muted}>—</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={config.variant} className="gap-1 text-[10px]">
                    <Icon className={cn('h-3 w-3', config.className || colors.text.muted)} />
                    {t(`installments.status.${effectiveStatus}`)}
                  </Badge>
                </TableCell>
                <TableCell className="text-center text-xs">
                  {new Date(inst.dueDate).toLocaleDateString('el-GR')}
                </TableCell>
                {(onPayInstallment || onEditInstallment) && (
                  <TableCell>
                    <span className="flex gap-1">
                      {canPay && onPayInstallment && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7"
                          onClick={() => onPayInstallment(inst.index)}
                        >
                          {t('actions.payInstallment')}
                        </Button>
                      )}
                      {canEdit && onEditInstallment && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => onEditInstallment(inst.index)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </span>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {canAdd && onAddInstallment && (
        <footer className="flex justify-center border-t p-2">
          <Button
            size="sm"
            variant="ghost"
            className="gap-1 text-xs"
            onClick={onAddInstallment}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('installments.addInstallment')}
          </Button>
        </footer>
      )}
    </section>
  );
}
