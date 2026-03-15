'use client';

/**
 * PaymentTabContent — Container for payment plan tab in Sales Sidebar
 * Mirrors LegalTabContent pattern.
 *
 * @enterprise ADR-234 - Payment Plan & Installment Tracking
 */

import React, { useState, useCallback } from 'react';
import { CreditCard, Plus, Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePaymentPlan } from '@/hooks/usePaymentPlan';
import { PaymentPlanOverview } from '@/components/sales/payments/PaymentPlanOverview';
import { InstallmentSchedule } from '@/components/sales/payments/InstallmentSchedule';
import { RecordPaymentDialog } from '@/components/sales/payments/RecordPaymentDialog';
import { LoanTrackingSection } from '@/components/sales/payments/LoanTrackingSection';
import { CreatePaymentPlanWizard } from '@/components/sales/payments/CreatePaymentPlanWizard';
import { Button } from '@/components/ui/button';
import type { Unit } from '@/types/unit';

// ============================================================================
// COMPONENT
// ============================================================================

interface PaymentTabContentProps {
  unit: Unit;
}

export function PaymentTabContent({ unit }: PaymentTabContentProps) {
  const { t } = useTranslation('payments');
  const {
    plan,
    isLoading,
    error,
    createPlan,
    recordPayment,
  } = usePaymentPlan(unit.id);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedInstallmentIdx, setSelectedInstallmentIdx] = useState(0);

  const handlePayInstallment = useCallback((index: number) => {
    setSelectedInstallmentIdx(index);
    setPayDialogOpen(true);
  }, []);

  // Loading
  if (isLoading) {
    return (
      <section className="flex items-center justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </section>
    );
  }

  // Error
  if (error) {
    return (
      <section className="p-4 text-center text-sm text-destructive">{error}</section>
    );
  }

  // projectId may exist in Firestore data even though Unit type only declares `project`
  const unitData = unit as Unit & { projectId?: string };
  const resolvedProjectId = unitData.projectId ?? unit.project ?? '';
  const buyerContactId = unit.commercial?.buyerContactId ?? '';
  const buyerName = unit.commercial?.buyerName ?? '';
  const suggestedAmount = unit.commercial?.finalPrice ?? unit.commercial?.askingPrice ?? 0;

  // No plan yet
  if (!plan) {
    return (
      <section className="space-y-4 p-3">
        <header className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">
            {t('title', { defaultValue: 'Πληρωμές' })}
          </h2>
        </header>

        <p className="text-xs text-muted-foreground text-center py-4">
          {t('paymentPlan.noPlan', { defaultValue: 'Δεν υπάρχει πρόγραμμα αποπληρωμής.' })}
        </p>

        <Button
          size="sm"
          variant="outline"
          className="w-full gap-1 text-xs"
          onClick={() => setWizardOpen(true)}
          disabled={!buyerContactId}
        >
          <Plus className="h-3 w-3" />
          {t('paymentPlan.createPlan', { defaultValue: 'Δημιουργία Προγράμματος' })}
        </Button>

        {!buyerContactId && (
          <p className="text-[10px] text-muted-foreground text-center">
            {t('errors.noBuyer', { defaultValue: 'Πρώτα ορίστε αγοραστή' })}
          </p>
        )}

        <CreatePaymentPlanWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          unitId={unit.id}
          buildingId={unit.buildingId}
          projectId={resolvedProjectId}
          buyerContactId={buyerContactId}
          buyerName={buyerName}
          suggestedAmount={suggestedAmount}
          onCreate={createPlan}
        />
      </section>
    );
  }

  // Plan exists
  const selectedInstallment = plan.installments[selectedInstallmentIdx];

  return (
    <section className="space-y-4 p-3">
      {/* Header */}
      <header className="flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">
          {t('title', { defaultValue: 'Πληρωμές' })}
        </h2>
      </header>

      {/* Overview */}
      <PaymentPlanOverview plan={plan} />

      {/* Installment Schedule */}
      <InstallmentSchedule
        installments={plan.installments}
        planStatus={plan.status}
        onPayInstallment={handlePayInstallment}
      />

      {/* Loan Tracking (Phase 2 — SPEC-234C) */}
      <LoanTrackingSection unitId={unit.id} />

      {/* Record Payment Dialog */}
      {selectedInstallment && (
        <RecordPaymentDialog
          open={payDialogOpen}
          onOpenChange={setPayDialogOpen}
          installment={selectedInstallment}
          paymentPlanId={plan.id}
          onRecord={recordPayment}
        />
      )}
    </section>
  );
}
