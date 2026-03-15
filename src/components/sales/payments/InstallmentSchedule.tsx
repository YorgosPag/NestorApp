'use client';

/**
 * InstallmentSchedule — Table of installments with status and actions
 * @enterprise ADR-234 - Payment Plan & Installment Tracking
 */

import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, MinusCircle, CircleDashed } from 'lucide-react';
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
  pending: { icon: Clock, variant: 'outline', className: 'text-muted-foreground' },
  waived: { icon: MinusCircle, variant: 'secondary', className: 'text-muted-foreground' },
};

// ============================================================================
// COMPONENT
// ============================================================================

interface InstallmentScheduleProps {
  installments: Installment[];
  onPayInstallment?: (index: number) => void;
  planStatus: string;
}

export function InstallmentSchedule({
  installments,
  onPayInstallment,
  planStatus,
}: InstallmentScheduleProps) {
  const { t } = useTranslation('payments');

  const now = new Date().toISOString();

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
            <TableHead>{t('labels.dueDate', { defaultValue: 'Ετικέτα' })}</TableHead>
            <TableHead className="text-right">
              {t('labels.amount', { defaultValue: 'Ποσό' })}
            </TableHead>
            <TableHead className="text-right">
              {t('labels.paidAmount', { defaultValue: 'Πληρωμένο' })}
            </TableHead>
            <TableHead className="text-center">
              {t('installments.title', { defaultValue: 'Κατάσταση' })}
            </TableHead>
            <TableHead className="text-center">
              {t('labels.dueDate', { defaultValue: 'Ημ. Λήξης' })}
            </TableHead>
            {onPayInstallment && <TableHead className="w-20" />}
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
                <TableCell className="text-xs text-muted-foreground">
                  {inst.index + 1}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{inst.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {t(`installmentType.${inst.type}`, { defaultValue: inst.type })}
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
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={config.variant} className="gap-1 text-[10px]">
                    <Icon className={`h-3 w-3 ${config.className}`} />
                    {t(`installments.status.${effectiveStatus}`, { defaultValue: effectiveStatus })}
                  </Badge>
                </TableCell>
                <TableCell className="text-center text-xs">
                  {new Date(inst.dueDate).toLocaleDateString('el-GR')}
                </TableCell>
                {onPayInstallment && (
                  <TableCell>
                    {canPay && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => onPayInstallment(inst.index)}
                      >
                        {t('actions.payInstallment', { defaultValue: 'Πληρωμή' })}
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}
