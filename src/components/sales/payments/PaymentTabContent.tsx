'use client';

/**
 * PaymentTabContent — Container for payment plan tab in Sales Sidebar
 * Mirrors LegalTabContent pattern.
 *
 * @enterprise ADR-234 - Payment Plan & Installment Tracking
 */

import React, { useState, useCallback } from 'react';
import { CreditCard, Plus, Loader2, FileSpreadsheet } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ADR-241: Centralized fullscreen system
import { useFullscreen } from '@/hooks/useFullscreen';
import { FullscreenOverlay, FullscreenToggleButton } from '@/core/containers/FullscreenOverlay';
import { usePaymentPlan } from '@/hooks/usePaymentPlan';
import { PaymentPlanOverview } from '@/components/sales/payments/PaymentPlanOverview';
import { InstallmentSchedule } from '@/components/sales/payments/InstallmentSchedule';
import { RecordPaymentDialog } from '@/components/sales/payments/RecordPaymentDialog';
import { EditInstallmentDialog } from '@/components/sales/payments/EditInstallmentDialog';
import { LoanTrackingSection } from '@/components/sales/payments/LoanTrackingSection';
import { ChequeRegistrySection } from '@/components/sales/payments/ChequeRegistrySection';
import { InterestCostSection } from '@/components/sales/payments/InterestCostSection';
import { CreatePaymentPlanWizard } from '@/components/sales/payments/CreatePaymentPlanWizard';
import { PaymentReportDialog } from '@/components/sales/payments/PaymentReportDialog';
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
    addInstallment,
    updateInstallment,
    removeInstallment,
  } = usePaymentPlan(unit.id);

  // 🏢 ADR-241: Fullscreen state
  const fullscreen = useFullscreen();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDialogMode, setEditDialogMode] = useState<'add' | 'edit'>('edit');
  const [selectedInstallmentIdx, setSelectedInstallmentIdx] = useState(0);

  const handlePayInstallment = useCallback((index: number) => {
    setSelectedInstallmentIdx(index);
    setPayDialogOpen(true);
  }, []);

  const handleEditInstallment = useCallback((index: number) => {
    setSelectedInstallmentIdx(index);
    setEditDialogMode('edit');
    setEditDialogOpen(true);
  }, []);

  const handleAddInstallment = useCallback(() => {
    setEditDialogMode('add');
    setEditDialogOpen(true);
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
            {t('title')}
          </h2>
        </header>

        <p className="text-xs text-muted-foreground text-center py-4">
          {t('paymentPlan.noPlan')}
        </p>

        <Button
          size="sm"
          variant="outline"
          className="w-full gap-1 text-xs"
          onClick={() => setWizardOpen(true)}
          disabled={!buyerContactId}
        >
          <Plus className="h-3 w-3" />
          {t('paymentPlan.createPlan')}
        </Button>

        {!buyerContactId && (
          <p className="text-[10px] text-muted-foreground text-center">
            {t('errors.noBuyer')}
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
    <FullscreenOverlay
      isFullscreen={fullscreen.isFullscreen}
      onToggle={fullscreen.toggle}
      ariaLabel="Payment Plan"
      className="space-y-4 p-3"
      fullscreenClassName="p-4 overflow-auto"
    >
      {/* Header */}
      <header className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">
            {t('title')}
          </h2>
        </span>
        <nav className="flex items-center gap-1">
          {resolvedProjectId && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-xs h-7"
              onClick={() => setReportDialogOpen(true)}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {t('report.button')}
            </Button>
          )}
          {/* 🏢 ADR-241: Fullscreen toggle */}
          <FullscreenToggleButton isFullscreen={fullscreen.isFullscreen} onToggle={fullscreen.toggle} />
        </nav>
      </header>

      {/* Overview */}
      <PaymentPlanOverview plan={plan} />

      {/* Installment Schedule */}
      <InstallmentSchedule
        installments={plan.installments}
        planStatus={plan.status}
        onPayInstallment={handlePayInstallment}
        onEditInstallment={handleEditInstallment}
        onAddInstallment={handleAddInstallment}
      />

      {/* Loan Tracking (Phase 2 — SPEC-234C) */}
      <LoanTrackingSection unitId={unit.id} />

      {/* Interest Cost Calculator (Phase 4 — SPEC-234E) */}
      <InterestCostSection
        unitId={unit.id}
        planInstallments={plan.installments}
        salePrice={plan.totalAmount}
      />

      {/* Cheque Registry (Phase 3 — SPEC-234A) */}
      <ChequeRegistrySection
        unitId={unit.id}
        projectId={resolvedProjectId}
        paymentPlanId={plan.id}
        contactId={buyerContactId}
      />

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

      {/* Edit/Add Installment Dialog (SPEC-234D) */}
      <EditInstallmentDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        mode={editDialogMode}
        planStatus={plan.status}
        installment={editDialogMode === 'edit' ? plan.installments[selectedInstallmentIdx] : undefined}
        totalInstallments={plan.installments.length}
        onAdd={(input, insertAtIndex) => addInstallment(plan.id, input, insertAtIndex)}
        onUpdate={(index, updates) => updateInstallment(plan.id, index, updates)}
        onDelete={(index) => removeInstallment(plan.id, index)}
      />

      {/* Payment Report Dialog (Phase 5 — ADR-234) */}
      {resolvedProjectId && (
        <PaymentReportDialog
          open={reportDialogOpen}
          onOpenChange={setReportDialogOpen}
          projectId={resolvedProjectId}
        />
      )}
    </FullscreenOverlay>
  );
}
