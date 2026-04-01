'use client';

/**
 * PaymentTabContent — Container for payment plan tab in Sales Sidebar
 * Mirrors LegalTabContent pattern.
 *
 * @enterprise ADR-234 - Payment Plan & Installment Tracking
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { CreditCard, Plus, Loader2, FileSpreadsheet, RefreshCw, Trash2 } from 'lucide-react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import type { Property } from '@/types/property';
import type { PropertyOwnerEntry } from '@/types/ownership-table';
import type { CreateInstallmentInput, CreatePaymentPlanInput } from '@/types/payment-plan';
import { formatOwnerNames, getPrimaryBuyerContactId } from '@/lib/ownership/owner-utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// ============================================================================
// COMPONENT
// ============================================================================

interface PaymentTabContentProps {
  unit: Property;
}

export function PaymentTabContent({ unit }: PaymentTabContentProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation('payments');
  const {
    plan,
    plans,
    planGroup: _planGroup,
    createSplitPlans,
    isLoading,
    error,
    refetch,
    createPlan,
    deletePlan,
    recordPayment,
    addInstallment,
    updateInstallment,
    removeInstallment,
  } = usePaymentPlan(unit.id);

  // ADR-244: Multi-owner support
  const owners = (unit.commercial?.owners ?? null) as PropertyOwnerEntry[] | null;
  const resolvedProjectId = (unit as Property & { projectId?: string }).projectId ?? unit.project ?? '';

  // ADR-244: Create split plans — delegates to hook (SSoT for API calls)
  const handleCreateSplit = useCallback(async (
    splitOwners: PropertyOwnerEntry[],
    baseInput: Omit<CreatePaymentPlanInput, 'propertyId' | 'ownerContactId' | 'ownerName' | 'totalAmount' | 'installments'>,
    totalPrice: number,
    baseInstallments: CreateInstallmentInput[],
  ): Promise<{ success: boolean; error?: string }> => {
    return createSplitPlans({
      owners: splitOwners.map(o => ({ contactId: o.contactId, name: o.name, ownershipPct: o.ownershipPct })),
      ownerContactId: getPrimaryBuyerContactId(splitOwners) ?? '',
      ownerName: formatOwnerNames(splitOwners) ?? '',
      buildingId: unit.buildingId,
      projectId: resolvedProjectId,
      totalAmount: totalPrice,
      installments: baseInstallments,
      taxRegime: baseInput.taxRegime as string | undefined,
      taxRate: baseInput.taxRate as number | undefined,
      planType: 'individual',
    });
  }, [createSplitPlans, unit.buildingId, resolvedProjectId]);

  // 🏢 ADR-241: Fullscreen state
  const fullscreen = useFullscreen();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDialogMode, setEditDialogMode] = useState<'add' | 'edit'>('edit');
  const [selectedInstallmentIdx, setSelectedInstallmentIdx] = useState(0);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ── Auto-refetch when sale price changes ──
  const prevPriceRef = useRef(unit.commercial?.askingPrice ?? unit.commercial?.finalPrice ?? 0);
  useEffect(() => {
    const currentPrice = unit.commercial?.askingPrice ?? unit.commercial?.finalPrice ?? 0;
    if (currentPrice !== prevPriceRef.current && currentPrice > 0) {
      prevPriceRef.current = currentPrice;
      // Delay slightly so the server-side resync has time to complete
      const timer = setTimeout(() => refetch(), 800);
      return () => clearTimeout(timer);
    }
  }, [unit.commercial?.askingPrice, unit.commercial?.finalPrice, refetch]);

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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    refetch();
    // Small delay to show the animation
    setTimeout(() => setRefreshing(false), 600);
  }, [refetch]);

  const handleDeletePlan = useCallback(async () => {
    if (!plan) return;
    const result = await deletePlan(plan.id);
    setDeleteConfirmOpen(false);
    if (result.success) {
      toast.success(t('paymentPlan.deleteSuccess'));
    } else {
      toast.error(result.error ?? 'Error');
    }
  }, [plan, deletePlan, t]);

  // Loading
  if (isLoading) {
    return (
      <section className="flex items-center justify-center p-8">
        <Loader2 className={cn("h-5 w-5 animate-spin", colors.text.muted)} />
      </section>
    );
  }

  // Error
  if (error) {
    return (
      <section className="p-4 text-center text-sm text-destructive">{error}</section>
    );
  }

  // ADR-244: Derive buyer from owners[] SSoT
  const allOwners = (unit.commercial?.owners as PropertyOwnerEntry[] | null) ?? [];
  const buyerContactId = getPrimaryBuyerContactId(allOwners) ?? '';
  const buyerName = formatOwnerNames(allOwners) ?? '';
  const suggestedAmount = unit.commercial?.finalPrice ?? unit.commercial?.askingPrice ?? 0;

  // No plan yet
  if (!plan) {
    return (
      <section className="space-y-4 p-3">
        <header className="flex items-center gap-2">
          <CreditCard className={cn("h-4 w-4", colors.text.muted)} />
          <h2 className="text-sm font-semibold">
            {t('title')}
          </h2>
        </header>

        <p className={cn("text-xs text-center py-4", colors.text.muted)}>
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
          <p className={cn("text-[10px] text-center", colors.text.muted)}>
            {t('errors.noBuyer')}
          </p>
        )}

        <CreatePaymentPlanWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          propertyId={unit.id}
          buildingId={unit.buildingId}
          projectId={resolvedProjectId}
          ownerContactId={buyerContactId}
          ownerName={buyerName}
          suggestedAmount={suggestedAmount}
          onCreate={createPlan}
          owners={owners ?? undefined}
          onCreateSplit={handleCreateSplit}
        />
      </section>
    );
  }

  // Plan exists — ADR-244: handle multi-plan (accordion per owner)
  const isMultiPlan = plans.length > 1;
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
          <CreditCard className={cn("h-4 w-4", colors.text.muted)} />
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
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label={t('paymentPlan.refresh')}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          {(plan.status === 'negotiation' || plan.status === 'draft') && plan.paidAmount === 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={() => setDeleteConfirmOpen(true)}
              aria-label={t('paymentPlan.deletePlan')}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {/* 🏢 ADR-241: Fullscreen toggle */}
          <FullscreenToggleButton isFullscreen={fullscreen.isFullscreen} onToggle={fullscreen.toggle} />
        </nav>
      </header>

      {/* ADR-244: Multi-plan accordion (individual plans per owner) */}
      {isMultiPlan ? (
        <Accordion type="single" collapsible defaultValue={plans[0].id}>
          {plans.map((p) => (
            <AccordionItem key={p.id} value={p.id}>
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  {p.ownerName}
                  {p.ownershipPct != null && (
                    <Badge variant="secondary" className="tabular-nums text-xs">
                      {p.ownershipPct}%
                    </Badge>
                  )}
                  <Badge variant="outline" className="tabular-nums text-xs">
                    €{p.totalAmount.toLocaleString('el-GR')}
                  </Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                <PaymentPlanOverview plan={p} />
                <InstallmentSchedule
                  installments={p.installments}
                  planStatus={p.status}
                  onPayInstallment={handlePayInstallment}
                  onEditInstallment={handleEditInstallment}
                  onAddInstallment={handleAddInstallment}
                />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <>
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
        </>
      )}

      {/* Loan Tracking (Phase 2 — SPEC-234C) */}
      <LoanTrackingSection propertyId={unit.id} />

      {/* Interest Cost Calculator (Phase 4 — SPEC-234E) */}
      <InterestCostSection
        propertyId={unit.id}
        planInstallments={plan.installments}
        salePrice={plan.totalAmount}
      />

      {/* Cheque Registry (Phase 3 — SPEC-234A) */}
      <ChequeRegistrySection
        propertyId={unit.id}
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
        maxAmount={Math.round(
          plan.installments
            .filter((inst) => inst.paidAmount < inst.amount)
            .reduce((s, inst) => s + (inst.amount - inst.paidAmount), 0) * 0.95 * 100
        ) / 100}
        planTotalAmount={plan.totalAmount}
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
      {/* Delete Plan Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('paymentPlan.deletePlan')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('paymentPlan.deleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('paymentPlan.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePlan}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('paymentPlan.confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FullscreenOverlay>
  );
}
