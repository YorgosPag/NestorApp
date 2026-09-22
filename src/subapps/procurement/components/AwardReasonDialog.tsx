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
import { useFormSubmission } from '@/hooks/useFormSubmission';
import { useTranslation, type Translate } from '@/i18n/hooks/useTranslation';
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


interface AwardReasonFieldsProps {
  idBase: string;
  category: AwardReasonCategory | '';
  onCategoryChange: (value: AwardReasonCategory) => void;
  note: string;
  onNoteChange: (value: string) => void;
  requiresNote: boolean;
  t: Translate;
}

function AwardReasonFields({ idBase, category, onCategoryChange, note, onNoteChange, requiresNote, t }: AwardReasonFieldsProps) {
  return (
    <>
      <div className="space-y-1">
        <label htmlFor={`${idBase}-category`} className="text-xs font-medium uppercase text-muted-foreground">
          {t('rfqs.awardReason.label.category')}
        </label>
        <Select value={category} onValueChange={(v) => onCategoryChange(v as AwardReasonCategory)}>
          <SelectTrigger id={`${idBase}-category`}>
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
        <label htmlFor={`${idBase}-note`} className="text-xs font-medium uppercase text-muted-foreground">
          {requiresNote ? t('rfqs.awardReason.label.noteRequired') : t('rfqs.awardReason.label.note')}
        </label>
        <Textarea
          id={`${idBase}-note`}
          rows={3}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder={category ? t(`rfqs.awardReason.placeholder.note.${PLACEHOLDER_KEY[category]}`) : ''}
        />
      </div>
    </>
  );
}

/** Κατάσταση + υποβολή του διαλόγου. */
function useAwardReasonForm(open: boolean, onConfirm: AwardReasonDialogProps['onConfirm'], t: Translate) {
  const [category, setCategory] = useState<AwardReasonCategory | ''>('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) {
      setCategory('');
      setNote('');
    }
  }, [open]);

  const requiresNote = category === 'other';
  const canConfirm = category !== '' && (!requiresNote || note.trim().length > 0);
  // ADR-598 «(η)»: ένας δρόμος (κλικ + Enter), κλείδωμα ref, και το κλείδωμα ανοίγει ΚΑΙ σε αποτυχία
  // (πριν: χωρίς `finally` ⇒ σφάλμα δικτύου άφηνε τον διάλογο μόνιμα σε «φόρτωση»).
  const { submitting, error, handleSubmit } = useFormSubmission({
    canSubmit: canConfirm,
    submit: () => onConfirm(category, note),
    errorFallback: t('rfqs.award.errorToast'),
  });

  return { category, setCategory, note, setNote, requiresNote, canConfirm, submitting, error, handleSubmit };
}

export function AwardReasonDialog({
  open,
  entry,
  cheapestEntry,
  onConfirm,
  onCancel,
}: AwardReasonDialogProps) {
  const { t } = useTranslation('quotes');
  const idBase = useId(); // `${idBase}-<πεδίο>`: η <Label> ονομάζει το πεδίο (ADR-598 G11)
  const formId = `${idBase}-form`;
  const f = useAwardReasonForm(open, onConfirm, t);

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

        <form id={formId} onSubmit={f.handleSubmit} className="space-y-4">
          <AwardReasonFields
            idBase={idBase}
            category={f.category}
            onCategoryChange={f.setCategory}
            note={f.note}
            onNoteChange={f.setNote}
            requiresNote={f.requiresNote}
            t={t}
          />
        </form>

        <FormActions
          formId={formId}
          submitLabel={t('rfqs.awardReason.confirmButton')}
          pendingLabel={t('quotes.loading')}
          cancelLabel={t('rfqs.awardReason.cancelButton')}
          onCancel={onCancel}
          submitting={f.submitting}
          submitDisabled={!f.canConfirm}
          error={f.error}
        />
      </DialogContent>
    </Dialog>
  );
}
