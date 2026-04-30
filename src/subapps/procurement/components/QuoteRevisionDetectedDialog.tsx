'use client';

/**
 * @fileoverview Modal for medium/low confidence duplicate detection.
 * Shows existing vs new quote with 3 decision options.
 * @adr ADR-328 §5.AA.3
 */

import { useState } from 'react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/intl-formatting';
import type { Quote } from '../types/quote';
import type { DuplicateDetectionResult } from '../utils/quote-duplicate-detection';

export type RevisionDecision = 'revision' | 'separate' | 'cancel_import';

export interface QuoteRevisionDetectedDialogProps {
  open: boolean;
  detection: DuplicateDetectionResult;
  existingQuote: Quote;
  newQuote: Quote;
  onConfirm: (decision: RevisionDecision) => void;
  onCancel: () => void;
}

function formatTs(ts: { seconds: number } | null | undefined): string {
  if (!ts?.seconds) return '—';
  return new Date(ts.seconds * 1000).toLocaleDateString('el-GR');
}

export function QuoteRevisionDetectedDialog({
  open,
  detection,
  existingQuote,
  newQuote,
  onConfirm,
  onCancel,
}: QuoteRevisionDetectedDialogProps) {
  const { t } = useTranslation('quotes');
  const [decision, setDecision] = useState<RevisionDecision>('revision');

  const existingVendor =
    existingQuote.extractedData?.vendorName?.value ?? existingQuote.vendorContactId;
  const signalLabels = detection.signals
    .map((s) => t(`rfqs.revisionDialog.signals.${s}`))
    .join(', ');
  const hasPO = !!existingQuote.linkedPoId;
  const isWinner = existingQuote.status === 'accepted';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('rfqs.revisionDialog.title')}</DialogTitle>
          <DialogDescription>{t('rfqs.revisionDialog.body')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border p-3 space-y-1.5 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium text-muted-foreground">{t('rfqs.revisionDialog.vendorLabel')}</span>
              <span>{existingVendor}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-muted-foreground">{t('rfqs.revisionDialog.matchingSignals')}</span>
              <Badge variant="secondary" className="text-xs">{signalLabels}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded border p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{t('rfqs.revisionDialog.existingQuote')}</p>
              <p className="font-semibold">{formatCurrency(existingQuote.totals.total)}</p>
              <p className="text-xs text-muted-foreground">
                {formatTs(existingQuote.submittedAt as { seconds: number } | null)}
              </p>
            </div>
            <div className="rounded border p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{t('rfqs.revisionDialog.newQuote')}</p>
              <p className="font-semibold">{formatCurrency(newQuote.totals.total)}</p>
            </div>
          </div>

          {isWinner && (
            <p className="text-sm text-yellow-700 dark:text-yellow-400 font-medium">
              {t('rfqs.revisionDialog.warning.isWinner')}
            </p>
          )}
          {hasPO && (
            <p className="text-sm text-destructive font-medium">
              {t('rfqs.revisionDialog.warning.hasPO')}
            </p>
          )}

          <RadioGroup value={decision} onValueChange={(v) => setDecision(v as RevisionDecision)}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="revision" id="opt-revision" disabled={hasPO} />
              <Label htmlFor="opt-revision" className={hasPO ? 'opacity-50 cursor-not-allowed' : ''}>
                {t('rfqs.revisionDialog.options.revision')}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="separate" id="opt-separate" />
              <Label htmlFor="opt-separate">{t('rfqs.revisionDialog.options.separate')}</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="cancel_import" id="opt-cancel" />
              <Label htmlFor="opt-cancel">{t('rfqs.revisionDialog.options.cancelImport')}</Label>
            </div>
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t('rfqs.awardReason.cancelButton')}
          </Button>
          <Button onClick={() => onConfirm(decision)}>
            {t('rfqs.revisionDialog.confirmButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
