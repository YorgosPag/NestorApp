'use client';

/**
 * Modal shown before the §5.F award flow when the selected quote has expired.
 * Three options: request renewal (pause award), award anyway, cancel.
 * @see ADR-328 §5.BB.5
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export type ExpiredAwardAction = 'request_renewal' | 'award_anyway' | 'cancel';

export interface ExpiredAwardWarningDialogProps {
  open: boolean;
  vendorName: string;
  validUntilDate: string;
  daysAgo: number;
  onAction: (action: ExpiredAwardAction) => void;
}

export function ExpiredAwardWarningDialog({
  open,
  vendorName,
  validUntilDate,
  daysAgo,
  onAction,
}: ExpiredAwardWarningDialogProps) {
  const { t } = useTranslation('quotes');

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onAction('cancel'); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('rfqs.expiry.warningModal.title')}</DialogTitle>
          <DialogDescription>
            {t('rfqs.expiry.warningModal.body', { vendor: vendorName, date: validUntilDate, daysAgo })}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => onAction('request_renewal')}
          >
            📧 {t('rfqs.expiry.warningModal.requestRenewal')}
          </Button>
          <Button
            variant="default"
            className="w-full"
            onClick={() => onAction('award_anyway')}
          >
            ✅ {t('rfqs.expiry.warningModal.awardAnyway')}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => onAction('cancel')}
          >
            {t('rfqs.expiry.warningModal.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
