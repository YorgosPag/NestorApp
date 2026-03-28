'use client';

/**
 * LoanTrackingSection — Container for multi-bank loan tracking
 * Displays loan cards + add button. Uses useLoanTracking hook.
 *
 * @enterprise ADR-234 Phase 2 — SPEC-234C
 */

import React, { useState } from 'react';
import { Landmark, Plus, Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useLoanTracking } from '@/hooks/useLoanTracking';
import { LoanCard } from '@/components/sales/payments/LoanCard';
import { AddLoanDialog } from '@/components/sales/payments/AddLoanDialog';
import { LoanDetailDialog } from '@/components/sales/payments/LoanDetailDialog';
import { Button } from '@/components/ui/button';
import type { LoanTracking } from '@/types/loan-tracking';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// ============================================================================
// COMPONENT
// ============================================================================

interface LoanTrackingSectionProps {
  unitId: string;
}

const MAX_LOANS = 3;

export function LoanTrackingSection({ unitId }: LoanTrackingSectionProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation('payments');
  const {
    loans,
    isLoading,
    error,
    addLoan,
    updateLoan,
    transitionStatus,
    recordDisbursement,
    addCommLog,
  } = useLoanTracking(unitId);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [detailLoan, setDetailLoan] = useState<LoanTracking | null>(null);

  if (isLoading) {
    return (
      <section className="flex items-center justify-center p-4">
        <Loader2 className={cn("h-4 w-4 animate-spin", colors.text.muted)} />
      </section>
    );
  }

  if (error) {
    return (
      <section className="p-3 text-center text-xs text-destructive">{error}</section>
    );
  }

  // No loans — show nothing (not_applicable state)
  if (loans.length === 0) {
    return (
      <section className="rounded-lg border p-3 space-y-2">
        <header className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Landmark className={cn("h-4 w-4", colors.text.muted)} />
            <h3 className="text-sm font-semibold">
              {t('loanTracking.title')}
            </h3>
          </span>
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs h-7"
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus className="h-3 w-3" />
            {t('loanTracking.addLoan')}
          </Button>
        </header>

        <p className={cn("text-xs text-center py-2", colors.text.muted)}>
          {t('loanTracking.noLoans')}
        </p>

        <AddLoanDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          onAdd={addLoan}
          existingCount={0}
        />
      </section>
    );
  }

  return (
    <section className="rounded-lg border p-3 space-y-3">
      <header className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <Landmark className={cn("h-4 w-4", colors.text.muted)} />
          <h3 className="text-sm font-semibold">
            {t('loanTracking.title')}
          </h3>
        </span>
        {loans.length < MAX_LOANS && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs h-7"
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus className="h-3 w-3" />
            {t('loanTracking.addLoan')}
          </Button>
        )}
      </header>

      {loans.map((loan) => (
        <LoanCard
          key={loan.loanId}
          loan={loan}
          onViewDetails={() => setDetailLoan(loan)}
        />
      ))}

      <AddLoanDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={addLoan}
        existingCount={loans.length}
      />

      {detailLoan && (
        <LoanDetailDialog
          open={!!detailLoan}
          onOpenChange={(open) => { if (!open) setDetailLoan(null); }}
          loan={detailLoan}
          onUpdate={(input) => updateLoan(detailLoan.loanId, input)}
          onTransition={(input) => transitionStatus(detailLoan.loanId, input)}
          onDisburse={(input) => recordDisbursement(detailLoan.loanId, input)}
          onAddCommLog={(input) => addCommLog(detailLoan.loanId, input)}
        />
      )}
    </section>
  );
}
