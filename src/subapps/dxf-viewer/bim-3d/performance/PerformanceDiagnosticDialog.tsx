'use client';

/**
 * PerformanceDiagnosticDialog — ADR-366 §B.5
 * "Send to support" dialog. onSubmit wired by parent (Phase 4 performance-snapshot-service).
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { PerformanceMetricsSnapshot } from './PerformanceHUDStore';
import { formatCount, formatBytes, formatMs } from './metric-formatters';

interface PerformanceDiagnosticDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metrics: PerformanceMetricsSnapshot;
  renderMode: string;
  canvas: HTMLCanvasElement;
  onSubmit: (comment: string) => Promise<void>;
}

export function PerformanceDiagnosticDialog({
  open,
  onOpenChange,
  metrics,
  renderMode,
  canvas,
  onSubmit,
}: PerformanceDiagnosticDialogProps) {
  const { t } = useTranslation('bim3d');

  const [comment,       setComment]       = useState('');
  const [submitting,    setSubmitting]    = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setScreenshotUrl(canvas.toDataURL('image/png', 0.92));
  }, [open, canvas]);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onSubmit(comment);
      setComment('');
      onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('performance.dialog.title')}</DialogTitle>
          <DialogDescription>{t('performance.dialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {screenshotUrl && (
            <img
              src={screenshotUrl}
              alt={t('performance.dialog.screenshotAlt')}
              className="w-full rounded border border-border max-h-40 object-contain"
            />
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
            {summaryMetrics.map((m) => (
              <div key={m.label} className="contents">
                <dt className="text-muted-foreground">{m.label}</dt>
                <dd className="text-right">{m.value}</dd>
              </div>
            ))}
          </dl>

          <div className="text-xs text-muted-foreground">
            {t('performance.dialog.renderMode')}: <span className="font-mono">{renderMode}</span>
          </div>

          <textarea
            maxLength={280}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full resize-none text-sm border border-border rounded p-2 bg-background"
            rows={3}
            placeholder={t('performance.dialog.commentPlaceholder')}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
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
