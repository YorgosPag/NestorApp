'use client';

import { useEffect, useId, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormActions } from '@/components/ui/form/FormActions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useFormSubmission } from '@/hooks/useFormSubmission';
import { useTranslation, type Translate } from '@/i18n/hooks/useTranslation';
import {
  RFQ_CANCELLATION_REASONS,
  type RfqCancellationReason,
  type RfqStatus,
} from '@/subapps/procurement/types/rfq';

interface RfqCancelDialogProps {
  open: boolean;
  rfqStatus: RfqStatus | null;
  hasInvitedVendors: boolean;
  onConfirm: (payload: {
    reason: RfqCancellationReason | null;
    detail: string | null;
    notifyVendors: boolean;
  }) => Promise<void>;
  onCancel: () => void;
}

interface RfqCancelReasonFieldProps {
  value: RfqCancellationReason | '';
  onChange: (value: RfqCancellationReason) => void;
  t: Translate;
}

function RfqCancelReasonField({ value, onChange, t }: RfqCancelReasonFieldProps) {
  return (
    <section className="space-y-2">
      <label className="text-sm font-medium" htmlFor="rfq-cancel-reason">
        {t('rfqs.cancelDialog.reasonLabel')}
        <span className="ml-1 text-destructive">*</span>
      </label>
      <Select value={value} onValueChange={(v) => onChange(v as RfqCancellationReason)}>
        <SelectTrigger id="rfq-cancel-reason">
          <SelectValue placeholder={t('rfqs.cancelDialog.reasonPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {RFQ_CANCELLATION_REASONS.map((r) => (
            <SelectItem key={r} value={r}>
              {t(`rfqs.cancelDialog.reasons.${r}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </section>
  );
}

interface RfqCancelFieldsProps {
  isActive: boolean;
  hasInvitedVendors: boolean;
  reason: RfqCancellationReason | '';
  onReasonChange: (value: RfqCancellationReason) => void;
  detail: string;
  onDetailChange: (value: string) => void;
  detailRequired: boolean;
  notifyVendors: boolean;
  onNotifyVendorsChange: (value: boolean) => void;
  t: Translate;
}

function RfqCancelFields(p: RfqCancelFieldsProps) {
  const { t } = p;
  return (
    <>
      {p.isActive && <RfqCancelReasonField value={p.reason} onChange={p.onReasonChange} t={t} />}

      <section className="space-y-2">
        <label className="text-sm font-medium" htmlFor="rfq-cancel-detail">
          {t('rfqs.cancelDialog.detailLabel')}
          {p.detailRequired && <span className="ml-1 text-destructive">*</span>}
        </label>
        <Textarea
          id="rfq-cancel-detail"
          value={p.detail}
          onChange={(e) => p.onDetailChange(e.target.value)}
          placeholder={t('rfqs.cancelDialog.detailPlaceholder')}
          rows={3}
          maxLength={500}
        />
      </section>

      {p.isActive && p.hasInvitedVendors && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={p.notifyVendors} onCheckedChange={(v) => p.onNotifyVendorsChange(v === true)} />
          {t('rfqs.cancelDialog.notifyVendorsLabel')}
        </label>
      )}
    </>
  );
}

/** Κατάσταση + υποβολή του διαλόγου — ένας δρόμος μέσω `useFormSubmission` (ADR-598 «(η)»). */
function useRfqCancelForm({ open, rfqStatus, onConfirm }: Pick<RfqCancelDialogProps, 'open' | 'rfqStatus' | 'onConfirm'>, t: Translate) {
  const [reason, setReason] = useState<RfqCancellationReason | ''>('');
  const [detail, setDetail] = useState('');
  const [notifyVendors, setNotifyVendors] = useState(false);

  const isActive = rfqStatus === 'active';
  const detailRequired = reason === 'other';

  useEffect(() => {
    if (!open) {
      setReason('');
      setDetail('');
      setNotifyVendors(false);
    }
  }, [open]);

  const isValid = (!isActive || !!reason) && (!detailRequired || detail.trim().length > 0);
  const { submitting, error, handleSubmit } = useFormSubmission({
    canSubmit: isValid,
    submit: () => onConfirm({
      reason: reason || null,
      detail: detail.trim() || null,
      notifyVendors: isActive ? notifyVendors : false,
    }),
    errorFallback: t('rfqs.detail.errors.cancelFailed'),
  });

  return {
    isActive, isValid, detailRequired, submitting, error, handleSubmit,
    reason, setReason, detail, setDetail, notifyVendors, setNotifyVendors,
  };
}

export function RfqCancelDialog({
  open,
  rfqStatus,
  hasInvitedVendors,
  onConfirm,
  onCancel,
}: RfqCancelDialogProps) {
  const { t } = useTranslation('quotes');
  const formId = useId();
  const f = useRfqCancelForm({ open, rfqStatus, onConfirm }, t);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('rfqs.cancelDialog.title')}</DialogTitle>
          <DialogDescription>
            {f.isActive ? t('rfqs.cancelDialog.descriptionActive') : t('rfqs.cancelDialog.descriptionDraft')}
          </DialogDescription>
        </DialogHeader>

        <form id={formId} onSubmit={f.handleSubmit} className="space-y-4 py-2">
          <RfqCancelFields
            isActive={f.isActive}
            hasInvitedVendors={hasInvitedVendors}
            reason={f.reason}
            onReasonChange={f.setReason}
            detail={f.detail}
            onDetailChange={f.setDetail}
            detailRequired={f.detailRequired}
            notifyVendors={f.notifyVendors}
            onNotifyVendorsChange={f.setNotifyVendors}
            t={t}
          />
        </form>

        <FormActions
          formId={formId}
          submitLabel={t('rfqs.cancelDialog.confirmCancel')}
          pendingLabel={t('rfqs.cancelDialog.submitting')}
          cancelLabel={t('rfqs.cancelDialog.keepRfq')}
          onCancel={onCancel}
          submitting={f.submitting}
          submitDisabled={!f.isValid}
          submitVariant="destructive"
          error={f.error}
        />
      </DialogContent>
    </Dialog>
  );
}
