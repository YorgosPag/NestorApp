'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import type { QuoteComparisonEntry } from '@/subapps/procurement/types/comparison';

const MIN_OVERRIDE_LEN = 20;

interface AwardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: QuoteComparisonEntry | null;
  recommended: QuoteComparisonEntry | null;
  onConfirm: (winnerQuoteId: string, overrideReason: string | null) => Promise<void>;
}

export function AwardModal({ open, onOpenChange, selected, recommended, onConfirm }: AwardModalProps) {
  const { t } = useTranslation('quotes');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setReason('');
      setSubmitting(false);
      setErrorMessage(null);
    }
  }, [open]);

  const isOverride = useMemo(() => {
    if (!selected || !recommended) return false;
    return recommended.quoteId !== selected.quoteId;
  }, [selected, recommended]);

  const requiresReason = (isOverride || (selected?.hasRiskFlags ?? false));
  const reasonValid = !requiresReason || reason.trim().length >= MIN_OVERRIDE_LEN;

  const handleSubmit = async () => {
    if (!selected || !reasonValid || submitting) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await onConfirm(selected.quoteId, requiresReason ? reason.trim() : null);
      onOpenChange(false);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  if (!selected) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('comparison.award.title')}</DialogTitle>
          <DialogDescription>
            {t('comparison.award.description', { vendor: selected.vendorName, total: formatCurrency(selected.total) })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {isOverride && recommended && (
            <div className="flex items-start gap-2 rounded-md border border-amber-400/50 bg-amber-50/60 p-2 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                {t('comparison.award.overrideWarning', {
                  recommended: recommended.vendorName,
                  recommendedTotal: formatCurrency(recommended.total),
                })}
              </span>
            </div>
          )}

          {selected.hasRiskFlags && (
            <div className="flex items-start gap-2 rounded-md border border-red-400/50 bg-red-50/60 p-2 text-red-900 dark:bg-red-950/30 dark:text-red-200">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{t('comparison.award.riskWarning')}</span>
            </div>
          )}

          {requiresReason && (
            <div className="space-y-1">
              <label htmlFor="override-reason" className="text-xs font-medium uppercase text-muted-foreground">
                {t('comparison.award.reasonLabel')}
              </label>
              <Textarea
                id="override-reason"
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('comparison.award.reasonPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">
                {t('comparison.award.minCharsHint', { count: MIN_OVERRIDE_LEN, current: reason.trim().length })}
              </p>
            </div>
          )}

          {errorMessage && (
            <p className="text-sm text-red-600">{errorMessage}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('quotes.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!reasonValid || submitting}>
            {submitting ? t('comparison.award.submitting') : t('comparison.award.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
