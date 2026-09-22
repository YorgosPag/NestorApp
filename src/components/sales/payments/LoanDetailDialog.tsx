'use client';

/**
 * LoanDetailDialog — Full loan details with tabs: Details, Disbursements, CommLog, Timeline
 *
 * @enterprise ADR-234 Phase 2 — SPEC-234C
 * @enterprise ADR-598 «(θ)» — κέλυφος καρτελών· κάθε καρτέλα-φόρμα ζει στο δικό της αρχείο
 *   πάνω στο SSoT υποβολής (`LoanDetailsTab`, `LoanActivityTabs`). Πριν: 483 γραμμές, ένας
 *   χειρόγραφος `handleAction` για τέσσερις ροές, ωμά `'Error'`/`'Unexpected error'` (N.11).
 */

import React, { useCallback } from 'react';
import { useTranslation, type Translate } from '@/i18n/hooks/useTranslation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { LoanStatusTimeline } from '@/components/sales/payments/LoanStatusTimeline';
import { useNotifications } from '@/providers/NotificationProvider';
import type { ActionResult } from '@/lib/mutations/gateway-action';
import type {
  LoanTracking,
  UpdateLoanInput,
  LoanTransitionInput,
  RecordDisbursementInput,
  AddCommunicationLogInput,
} from '@/types/loan-tracking';
import '@/lib/design-system';
import { LoanDetailsTab } from './LoanDetailsTab';
import { LoanCommLogTab, LoanDisbursementsTab } from './LoanActivityTabs';

// ============================================================================
// TYPES
// ============================================================================

interface LoanDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: LoanTracking;
  onUpdate: (input: UpdateLoanInput) => Promise<ActionResult>;
  onTransition: (input: LoanTransitionInput) => Promise<ActionResult>;
  onDisburse: (input: RecordDisbursementInput) => Promise<ActionResult>;
  onAddCommLog: (input: AddCommunicationLogInput) => Promise<ActionResult>;
}

// ============================================================================
// COMPONENT
// ============================================================================

type LoanTabsProps = Omit<LoanDetailDialogProps, 'open' | 'onOpenChange'> & { onDone: (message: string) => void; t: Translate };

function LoanTabs({ loan, onUpdate, onTransition, onDisburse, onAddCommLog, onDone, t }: LoanTabsProps) {
  return (
    <Tabs defaultValue="details">
      <TabsList className="grid grid-cols-4 w-full">
        <TabsTrigger value="details" className="text-xs">{t('actions.viewDetails')}</TabsTrigger>
        <TabsTrigger value="disbursements" className="text-xs">{t('loanTracking.fields.disbursedAmount')}</TabsTrigger>
        <TabsTrigger value="commlog" className="text-xs">{t('loanTracking.commLog.title')}</TabsTrigger>
        <TabsTrigger value="timeline" className="text-xs">{t('loanTracking.timeline')}</TabsTrigger>
      </TabsList>
      <TabsContent value="details" className="pt-2">
        <LoanDetailsTab loan={loan} onUpdate={onUpdate} onTransition={onTransition} onDone={onDone} t={t} />
      </TabsContent>
      <TabsContent value="disbursements" className="pt-2">
        <LoanDisbursementsTab loan={loan} onDisburse={onDisburse} onDone={onDone} t={t} />
      </TabsContent>
      <TabsContent value="commlog" className="pt-2">
        <LoanCommLogTab loan={loan} onAddCommLog={onAddCommLog} onDone={onDone} t={t} />
      </TabsContent>
      <TabsContent value="timeline" className="pt-2">
        <LoanStatusTimeline status={loan.status} />
      </TabsContent>
    </Tabs>
  );
}

export function LoanDetailDialog({ open, onOpenChange, ...writers }: LoanDetailDialogProps) {
  const { t } = useTranslation(['payments', 'payments-cost-calc', 'payments-loans']);
  const { success } = useNotifications();
  const { loan } = writers;

  /** Κάθε επιτυχής ενέργεια: μήνυμα + κλείσιμο (όπως πριν). */
  const onDone = useCallback((message: string) => {
    success(message);
    onOpenChange(false);
  }, [success, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {loan.bankName}
            {loan.isPrimary && <Badge variant="outline" className="text-[10px]">{t('loanTracking.primaryLoan')}</Badge>}
          </DialogTitle>
        </DialogHeader>
        <LoanTabs {...writers} onDone={onDone} t={t} />
      </DialogContent>
    </Dialog>
  );
}
