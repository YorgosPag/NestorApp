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
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import type { QuoteComparisonEntry } from '@/subapps/procurement/types/comparison';

// Per ADR-328 §5.X.3
const CATEGORIES = [
  'better_delivery',
  'better_quality',
  'existing_relationship',
  'certifications',
  'inclusions',
  'stock_availability',
  'past_consistency',
  'other',
] as const;
type AwardReasonCategory = (typeof CATEGORIES)[number];

const PLACEHOLDER_KEY: Record<AwardReasonCategory, string> = {
  better_delivery: 'delivery',
  better_quality: 'quality',
  existing_relationship: 'relationship',
  certifications: 'certifications',
  inclusions: 'inclusions',
  stock_availability: 'stock',
  past_consistency: 'consistency',
  other: 'other',
};

interface AwardReasonDialogProps {
  open: boolean;
  entry: QuoteComparisonEntry | null;
  cheapestEntry: QuoteComparisonEntry | null;
  onConfirm: (category: string, note: string) => Promise<void>;
  onCancel: () => void;
}

export function AwardReasonDialog({
  open,
  entry,
  cheapestEntry,
  onConfirm,
  onCancel,
}: AwardReasonDialogProps) {
  const { t } = useTranslation('quotes');
  const [category, setCategory] = useState<AwardReasonCategory | ''>('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setCategory('');
      setNote('');
      setSubmitting(false);
    }
  }, [open]);

  const requiresNote = category === 'other';
  const canConfirm = category !== '' && (!requiresNote || note.trim().length > 0);

  const handleConfirm = async () => {
    if (!canConfirm || submitting || !category) return;
    setSubmitting(true);
    await onConfirm(category, note);
    setSubmitting(false);
  };

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('rfqs.awardReason.dialog.title')}</DialogTitle>
          {cheapestEntry && cheapestEntry.quoteId !== entry.quoteId && (
            <DialogDescription>
              {t('rfqs.awardReason.dialog.body', {
                vendorName: entry.vendorName,
                selectedTotal: formatCurrency(entry.total),
                cheapestVendorName: cheapestEntry.vendorName,
                cheapestTotal: formatCurrency(cheapestEntry.total),
              })}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase text-muted-foreground">
              {t('rfqs.awardReason.label.category')}
            </label>
            <Select value={category} onValueChange={(v) => setCategory(v as AwardReasonCategory)}>
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {t(`rfqs.awardReason.category.${cat}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium uppercase text-muted-foreground">
              {requiresNote
                ? t('rfqs.awardReason.label.noteRequired')
                : t('rfqs.awardReason.label.note')}
            </label>
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                category
                  ? t(`rfqs.awardReason.placeholder.note.${PLACEHOLDER_KEY[category as AwardReasonCategory]}`)
                  : ''
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            {t('rfqs.awardReason.cancelButton')}
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm || submitting}>
            {submitting ? t('quotes.loading') : t('rfqs.awardReason.confirmButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
