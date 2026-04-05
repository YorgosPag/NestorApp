'use client';

/**
 * LoanDetailDialog — Full loan details with tabs: Details, Disbursements, CommLog, Timeline
 *
 * @enterprise ADR-234 Phase 2 — SPEC-234C
 */

import React, { useState, useCallback } from 'react';
import { Loader2, Plus, ArrowRight } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoanStatusTimeline } from '@/components/sales/payments/LoanStatusTimeline';
import { useNotifications } from '@/providers/NotificationProvider';
import type {
  LoanTracking,
  UpdateLoanInput,
  LoanTransitionInput,
  RecordDisbursementInput,
  AddCommunicationLogInput,
  CommunicationEntryType,
} from '@/types/loan-tracking';
import { getValidNextStatuses } from '@/types/loan-tracking';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// ============================================================================
// TYPES
// ============================================================================

interface ActionResult {
  success: boolean;
  error?: string;
}

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

export function LoanDetailDialog({
  open,
  onOpenChange,
  loan,
  onUpdate,
  onTransition,
  onDisburse,
  onAddCommLog,
}: LoanDetailDialogProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation('payments');
  const { success, error: notifyError } = useNotifications();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Details Tab State ---
  const [editFields, setEditFields] = useState<UpdateLoanInput>({});

  // --- Transition State ---
  const nextStatuses = getValidNextStatuses(loan.status);

  // --- Disbursement State ---
  const [disbAmount, setDisbAmount] = useState('');
  const [disbMilestone, setDisbMilestone] = useState('');
  const [disbDate, setDisbDate] = useState(new Date().toISOString().split('T')[0]);

  // --- CommLog State ---
  const [commType, setCommType] = useState<CommunicationEntryType>('phone');
  const [commSummary, setCommSummary] = useState('');
  const [commNextAction, setCommNextAction] = useState('');

  const handleAction = useCallback(async (
    action: () => Promise<ActionResult>,
    successMsg: string
  ) => {
    setIsSubmitting(true);
    try {
      const result = await action();
      if (result.success) {
        success(successMsg);
        onOpenChange(false);
      } else {
        notifyError(result.error ?? 'Error');
      }
    } catch {
      notifyError('Unexpected error');
    } finally {
      setIsSubmitting(false);
    }
  }, [onOpenChange, success, notifyError]);

  // Save details
  const handleSaveDetails = useCallback(() => {
    if (Object.keys(editFields).length === 0) return;
    handleAction(
      () => onUpdate(editFields),
      t('loanTracking.actions.updateStatus')
    );
  }, [editFields, onUpdate, handleAction, t]);

  // Transition
  const handleTransition = useCallback((targetStatus: string) => {
    handleAction(
      () => onTransition({ targetStatus: targetStatus as LoanTransitionInput['targetStatus'] }),
      t('loanTracking.actions.updateStatus')
    );
  }, [onTransition, handleAction, t]);

  // Record disbursement
  const handleDisburse = useCallback(() => {
    const amount = parseFloat(disbAmount);
    if (!amount || amount <= 0 || !disbMilestone.trim()) return;
    handleAction(
      () => onDisburse({
        amount,
        milestone: disbMilestone.trim(),
        disbursementDate: new Date(disbDate).toISOString(),
      }),
      t('loanTracking.actions.recordDisbursement')
    );
  }, [disbAmount, disbMilestone, disbDate, onDisburse, handleAction, t]);

  // Add comm log
  const handleAddCommLog = useCallback(() => {
    if (!commSummary.trim()) return;
    handleAction(
      () => onAddCommLog({
        type: commType,
        summary: commSummary.trim(),
        nextAction: commNextAction.trim() || undefined,
      }),
      t('loanTracking.commLog.title')
    );
  }, [commType, commSummary, commNextAction, onAddCommLog, handleAction, t]);

  const updateField = (field: keyof UpdateLoanInput, value: string | number | null) => {
    setEditFields(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {loan.bankName}
            {loan.isPrimary && (
              <Badge variant="outline" className="text-[10px]">
                {t('loanTracking.primaryLoan')}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="details" className="text-xs">
              {t('actions.viewDetails')}
            </TabsTrigger>
            <TabsTrigger value="disbursements" className="text-xs">
              {t('loanTracking.fields.disbursedAmount')}
            </TabsTrigger>
            <TabsTrigger value="commlog" className="text-xs">
              {t('loanTracking.commLog.title')}
            </TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs">{t('loanTracking.timeline')}</TabsTrigger>
          </TabsList>

          {/* ============== DETAILS TAB ============== */}
          <TabsContent value="details" className="space-y-3 pt-2">
            {/* Status Transition */}
            {nextStatuses.length > 0 && (
              <fieldset className="space-y-2">
                <legend className={cn("text-xs font-semibold", colors.text.muted)}>
                  {t('loanTracking.actions.updateStatus')}
                </legend>
                <nav className="flex flex-wrap gap-1">
                  {nextStatuses.map((ns) => (
                    <Button
                      key={ns}
                      size="sm"
                      variant="outline"
                      className="text-[10px] h-6 gap-1"
                      disabled={isSubmitting}
                      onClick={() => handleTransition(ns)}
                    >
                      <ArrowRight className="h-2.5 w-2.5" />
                      {t(`loanTracking.status.${ns}`)}
                    </Button>
                  ))}
                </nav>
              </fieldset>
            )}

            {/* Editable Fields */}
            <fieldset className="grid grid-cols-2 gap-3">
              <span className="space-y-1">
                <Label className="text-xs">{t('loanTracking.fields.bankName')}</Label>
                <Input
                  defaultValue={loan.bankName}
                  className="h-8 text-xs"
                  onChange={(e) => updateField('bankName', e.target.value)}
                />
              </span>
              <span className="space-y-1">
                <Label className="text-xs">{t('loanTracking.fields.bankBranch')}</Label>
                <Input
                  defaultValue={loan.bankBranch ?? ''}
                  className="h-8 text-xs"
                  onChange={(e) => updateField('bankBranch', e.target.value || null)}
                />
              </span>
              <span className="space-y-1">
                <Label className="text-xs">{t('loanTracking.fields.requestedAmount')}</Label>
                <Input
                  type="number"
                  defaultValue={loan.requestedAmount ?? ''}
                  className="h-8 text-xs"
                  onChange={(e) => updateField('requestedAmount', e.target.value ? Number(e.target.value) : null)}
                />
              </span>
              <span className="space-y-1">
                <Label className="text-xs">{t('loanTracking.fields.approvedAmount')}</Label>
                <Input
                  type="number"
                  defaultValue={loan.approvedAmount ?? ''}
                  className="h-8 text-xs"
                  onChange={(e) => updateField('approvedAmount', e.target.value ? Number(e.target.value) : null)}
                />
              </span>
              <span className="space-y-1">
                <Label className="text-xs">{t('loanTracking.fields.interestRate')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  defaultValue={loan.interestRate ?? ''}
                  className="h-8 text-xs"
                  onChange={(e) => updateField('interestRate', e.target.value ? Number(e.target.value) : null)}
                />
              </span>
              <span className="space-y-1">
                <Label className="text-xs">{t('loanTracking.fields.termYears')}</Label>
                <Input
                  type="number"
                  defaultValue={loan.termYears ?? ''}
                  className="h-8 text-xs"
                  onChange={(e) => updateField('termYears', e.target.value ? Number(e.target.value) : null)}
                />
              </span>
              <span className="space-y-1">
                <Label className="text-xs">{t('loanTracking.fields.appraisalValue')}</Label>
                <Input
                  type="number"
                  defaultValue={loan.appraisalValue ?? ''}
                  className="h-8 text-xs"
                  onChange={(e) => updateField('appraisalValue', e.target.value ? Number(e.target.value) : null)}
                />
              </span>
              <span className="space-y-1">
                <Label className="text-xs">{t('loanTracking.fields.monthlyPayment')}</Label>
                <Input
                  type="number"
                  defaultValue={loan.monthlyPayment ?? ''}
                  className="h-8 text-xs"
                  onChange={(e) => updateField('monthlyPayment', e.target.value ? Number(e.target.value) : null)}
                />
              </span>
            </fieldset>

            <span className="space-y-1">
              <Label className="text-xs">{t('labels.notes')}</Label>
              <Textarea
                defaultValue={loan.notes ?? ''}
                className="text-xs min-h-[60px]"
                onChange={(e) => updateField('notes', e.target.value || null)}
              />
            </span>

            <Button
              size="sm"
              className="w-full"
              disabled={isSubmitting || Object.keys(editFields).length === 0}
              onClick={handleSaveDetails}
            >
              {isSubmitting && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              {t('dialog.confirm')}
            </Button>
          </TabsContent>

          {/* ============== DISBURSEMENTS TAB ============== */}
          <TabsContent value="disbursements" className="space-y-3 pt-2">
            {/* Existing disbursements */}
            {loan.disbursements.length > 0 ? (
              <ul className="space-y-1">
                {loan.disbursements.map((d, i) => (
                  <li key={i} className="flex items-center justify-between text-xs border-b pb-1">
                    <span>
                      <span className="font-medium">#{d.order}</span>{' '}
                      {d.milestone}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-medium">€{d.amount.toLocaleString('el-GR')}</span>
                      <Badge variant={d.status === 'disbursed' ? 'default' : 'secondary'} className="text-[10px]">
                        {d.status}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={cn("text-xs text-center py-2", colors.text.muted)}>
                {t('loanTracking.noDisbursements')}
              </p>
            )}

            {/* New disbursement form */}
            <fieldset className="space-y-2 border-t pt-2">
              <legend className="text-xs font-semibold">
                {t('loanTracking.actions.recordDisbursement')}
              </legend>
              <span className="grid grid-cols-2 gap-2">
                <span className="space-y-1">
                  <Label className="text-xs">{t('labels.amount')}</Label>
                  <Input
                    type="number"
                    value={disbAmount}
                    onChange={(e) => setDisbAmount(e.target.value)}
                    className="h-8 text-xs"
                    placeholder="€"
                  />
                </span>
                <span className="space-y-1">
                  <Label className="text-xs">{t('loanTracking.milestone')}</Label>
                  <Input
                    value={disbMilestone}
                    onChange={(e) => setDisbMilestone(e.target.value)}
                    className="h-8 text-xs"
                    placeholder={t('loanTracking.milestonePlaceholder')}
                  />
                </span>
              </span>
              <span className="space-y-1">
                <Label className="text-xs">{t('labels.paymentDate')}</Label>
                <Input
                  type="date"
                  value={disbDate}
                  onChange={(e) => setDisbDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </span>
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-1"
                disabled={isSubmitting || !disbAmount || !disbMilestone.trim()}
                onClick={handleDisburse}
              >
                {isSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
                <Plus className="h-3 w-3" />
                {t('loanTracking.actions.recordDisbursement')}
              </Button>
            </fieldset>
          </TabsContent>

          {/* ============== COMM LOG TAB ============== */}
          <TabsContent value="commlog" className="space-y-3 pt-2">
            {/* Existing entries */}
            {loan.communicationLog.length > 0 ? (
              <ul className="space-y-2 max-h-48 overflow-y-auto">
                {[...loan.communicationLog].reverse().map((entry, i) => (
                  <li key={i} className="text-xs border-b pb-1.5 space-y-0.5">
                    <span className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px]">
                        {t(`loanTracking.commLog.type.${entry.type}`)}
                      </Badge>
                      <time className={colors.text.muted}>
                        {new Date(entry.date).toLocaleDateString('el-GR')}
                      </time>
                    </span>
                    <p>{entry.summary}</p>
                    {entry.nextAction && (
                      <p className={colors.text.muted}>
                        → {entry.nextAction}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={cn("text-xs text-center py-2", colors.text.muted)}>
                {t('loanTracking.noCommLog')}
              </p>
            )}

            {/* New entry form */}
            <fieldset className="space-y-2 border-t pt-2">
              <legend className="text-xs font-semibold">
                {t('loanTracking.actions.addCommLog')}
              </legend>
              <span className="space-y-1">
                <Label className="text-xs">{t('loanTracking.commLog.typeLabel')}</Label>
                <Select value={commType} onValueChange={(v) => setCommType(v as CommunicationEntryType)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['phone', 'email', 'meeting', 'document', 'note'] as const).map(ct => (
                      <SelectItem key={ct} value={ct} className="text-xs">
                        {t(`loanTracking.commLog.type.${ct}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </span>
              <span className="space-y-1">
                <Label className="text-xs">{t('loanTracking.commLog.description')}</Label>
                <Textarea
                  value={commSummary}
                  onChange={(e) => setCommSummary(e.target.value)}
                  className="text-xs min-h-[50px]"
                  placeholder={t('loanTracking.commLog.descriptionPlaceholder')}
                />
              </span>
              <span className="space-y-1">
                <Label className="text-xs">{t('loanTracking.commLog.nextAction')}</Label>
                <Input
                  value={commNextAction}
                  onChange={(e) => setCommNextAction(e.target.value)}
                  className="h-8 text-xs"
                  placeholder={t('loanTracking.commLog.nextActionPlaceholder')}
                />
              </span>
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-1"
                disabled={isSubmitting || !commSummary.trim()}
                onClick={handleAddCommLog}
              >
                {isSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
                <Plus className="h-3 w-3" />
                {t('loanTracking.actions.addCommLog')}
              </Button>
            </fieldset>
          </TabsContent>

          {/* ============== TIMELINE TAB ============== */}
          <TabsContent value="timeline" className="pt-2">
            <LoanStatusTimeline status={loan.status} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
