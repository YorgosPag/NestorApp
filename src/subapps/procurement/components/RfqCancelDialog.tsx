'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useTranslation } from '@/i18n/hooks/useTranslation';
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

export function RfqCancelDialog({
  open,
  rfqStatus,
  hasInvitedVendors,
  onConfirm,
  onCancel,
}: RfqCancelDialogProps) {
  const { t } = useTranslation('quotes');
  const [reason, setReason] = useState<RfqCancellationReason | ''>('');
  const [detail, setDetail] = useState('');
  const [notifyVendors, setNotifyVendors] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isActive = rfqStatus === 'active';
  const reasonRequired = isActive;
  const detailRequired = reason === 'other';

  useEffect(() => {
    if (!open) {
      setReason('');
      setDetail('');
      setNotifyVendors(false);
      setSubmitting(false);
    }
  }, [open]);

  const isValid =
    (!reasonRequired || !!reason) &&
    (!detailRequired || detail.trim().length > 0);

  const handleConfirm = async () => {
    if (!isValid) return;
    setSubmitting(true);
    try {
      await onConfirm({
        reason: reason || null,
        detail: detail.trim() || null,
        notifyVendors: isActive ? notifyVendors : false,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('rfqs.cancelDialog.title')}</DialogTitle>
          <DialogDescription>
            {isActive
              ? t('rfqs.cancelDialog.descriptionActive')
              : t('rfqs.cancelDialog.descriptionDraft')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isActive && (
            <section className="space-y-2">
              <label className="text-sm font-medium">
                {t('rfqs.cancelDialog.reasonLabel')}
                <span className="ml-1 text-destructive">*</span>
              </label>
              <Select value={reason} onValueChange={(v) => setReason(v as RfqCancellationReason)}>
                <SelectTrigger>
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
          )}

          <section className="space-y-2">
            <label className="text-sm font-medium" htmlFor="rfq-cancel-detail">
              {t('rfqs.cancelDialog.detailLabel')}
              {detailRequired && <span className="ml-1 text-destructive">*</span>}
            </label>
            <Textarea
              id="rfq-cancel-detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder={t('rfqs.cancelDialog.detailPlaceholder')}
              rows={3}
              maxLength={500}
            />
          </section>

          {isActive && hasInvitedVendors && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={notifyVendors}
                onCheckedChange={(v) => setNotifyVendors(v === true)}
              />
              {t('rfqs.cancelDialog.notifyVendorsLabel')}
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            {t('rfqs.cancelDialog.keepRfq')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isValid || submitting}
          >
            {submitting ? t('rfqs.cancelDialog.submitting') : t('rfqs.cancelDialog.confirmCancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
