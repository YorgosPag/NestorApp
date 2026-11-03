'use client';

/**
 * PerformanceDiagnosticDialog — ADR-366 §B.5 + §C.7.Q4
 *
 * The ONE review step before a diagnostic report leaves the device, for both
 * the manual HUD flow and the low-FPS prompt. The user sees exactly what will
 * be sent — the screenshot (`screenshotDataUrl`, captured once by the parent
 * via `captureDiagnosticScreenshot`, uploaded unchanged), the metrics and the
 * render mode — and may add a comment.
 *
 * Feedback is owned here: success toast + close; on failure an error toast and
 * the dialog STAYS OPEN, so the user's comment is not lost and they can retry.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
import type { PerformanceMetricsSnapshot } from './PerformanceHUDStore';
import type { DiagnosticSource } from './performance-snapshot-service';
import { formatCount, formatBytes, formatMs } from './metric-formatters';

const COMMENT_MAX_LENGTH = 280;

interface PerformanceDiagnosticDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metrics: PerformanceMetricsSnapshot;
  renderMode: string;
  screenshotDataUrl: string;
  variant: DiagnosticSource;
  /** Resolves when the report was recorded; rejects on failure. */
  onSubmit: (comment: string) => Promise<void>;
  /** Only for `variant: 'auto_submit'` — «Να μην ξαναρωτηθώ». */
  onPermanentOptOut?: () => void;
}

export function PerformanceDiagnosticDialog({
  open,
  onOpenChange,
  metrics,
  renderMode,
  screenshotDataUrl,
  variant,
  onSubmit,
  onPermanentOptOut,
}: PerformanceDiagnosticDialogProps) {
  const { t } = useTranslation('bim3d');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onSubmit(comment);
      toast.success(t('performance.dialog.successToast'));
      setComment('');
      onOpenChange(false);
    } catch {
      toast.error(t('performance.dialog.errorToast'));
    } finally {
      setSubmitting(false);
    }
  }

  const na = t('performance.notFound');
  const summaryMetrics = [
    { label: t('performance.metric.fps'),        value: `${formatCount(metrics.fps)} FPS` },
    { label: t('performance.metric.triangles'),  value: metrics.triangles !== null ? formatCount(metrics.triangles) : na },
    { label: t('performance.metric.drawCalls'),  value: metrics.drawCalls !== null ? formatCount(metrics.drawCalls) : na },
    { label: t('performance.metric.gpuMemory'),  value: metrics.gpuMemoryMb !== null ? formatBytes(metrics.gpuMemoryMb) : na },
    { label: t('performance.metric.frameTime'),  value: formatMs(metrics.frameTimeMs) },
  ];

  const isAuto = variant === 'auto_submit';

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!submitting) onOpenChange(next); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('performance.dialog.title')}</DialogTitle>
          <DialogDescription>
            {t(isAuto ? 'performance.dialog.autoDescription' : 'performance.dialog.description')}
          </DialogDescription>
        </DialogHeader>

        <section className="flex flex-col gap-3">
          <img
            src={screenshotDataUrl}
            alt={t('performance.dialog.screenshotAlt')}
            className="w-full rounded border border-border max-h-40 object-contain"
          />

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
            {summaryMetrics.map((m) => (
              <div key={m.label} className="contents">
                <dt className="text-muted-foreground">{m.label}</dt>
                <dd className="text-right">{m.value}</dd>
              </div>
            ))}
          </dl>

          <p className="text-xs text-muted-foreground">
            {t('performance.dialog.renderMode')}: <span className="font-mono">{renderMode}</span>
          </p>

          <Textarea
            aria-label={t('performance.dialog.commentLabel')}
            maxLength={COMMENT_MAX_LENGTH}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="resize-none text-sm"
            rows={3}
            placeholder={t('performance.dialog.commentPlaceholder')}
          />
        </section>

        <DialogFooter className="gap-2">
          {isAuto && onPermanentOptOut && (
            <Button variant="ghost" onClick={onPermanentOptOut} disabled={submitting}>
              {t('performance.autoSubmit.permanentOptOutButton')}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('performance.dialog.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? t('performance.dialog.submitting') : t('performance.dialog.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
