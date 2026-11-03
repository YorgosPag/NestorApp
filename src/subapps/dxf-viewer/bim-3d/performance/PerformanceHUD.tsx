'use client';

/**
 * PerformanceHUD — ADR-366 §B.5
 *
 * ADR-040 micro-leaf: 1 useSyncExternalStore → PerformanceHUDStore.
 * Renders mini pill or expanded panel depending on store state + viewport width.
 * Absolute-positioned inside viewport: bottom-[66px] right-4 + `PANEL_LAYOUT.Z_INDEX['55']`.
 * Το 55 είναι SSoT token (ADR-782 Φ2): «πάνω από το BimViewport3D (z-50)», δηλαδή HUD που ζει
 * και στις δύο προβολές. Ήταν ωμό `z-[55]` εδώ και ξαναγράφτηκε ωμό στην απόδοση υποβάθρου —
 * δύο σημεία με τον ίδιο αριθμό και κανένα να λέει γιατί.
 */

import { useSyncExternalStore, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { usePerformanceHUDStore } from './PerformanceHUDStore';
import { usePerformanceHistoryStore } from './PerformanceHistoryStore';
import { PerformanceHUDMini } from './PerformanceHUDMini';
import { PerformanceHUDExpanded } from './PerformanceHUDExpanded';
import { PerformanceDiagnosticDialog } from './PerformanceDiagnosticDialog';
import { copyStatsToClipboard } from './clipboard-stats-writer';
import { downloadStatsAndScreenshot } from './file-download-writer';
import { captureDiagnosticScreenshot, sendDiagnostic } from './performance-snapshot-service';
import type { PerformanceMetricsSnapshot } from './PerformanceHUDStore';

interface PerformanceHUDProps {
  canvas: HTMLCanvasElement | null;
  projectId: string | null;
}

/** What the review dialog shows — frozen when it opens, sent unchanged. */
interface ManualReport {
  metrics: PerformanceMetricsSnapshot;
  screenshotDataUrl: string;
}

export function PerformanceHUD({ canvas, projectId }: PerformanceHUDProps) {
  const { t } = useTranslation('bim3d');

  const { enabled, expanded, metrics, renderMode } = useSyncExternalStore(
    usePerformanceHUDStore.subscribe,
    usePerformanceHUDStore.getState,
    usePerformanceHUDStore.getState,
  );

  const historyEnabled = useSyncExternalStore(
    usePerformanceHistoryStore.subscribe,
    () => usePerformanceHistoryStore.getState().enabled,
    () => false,
  );

  const [report, setReport] = useState<ManualReport | null>(null);

  const onExpand = useCallback(() => {
    if (!expanded) usePerformanceHUDStore.getState().toggleExpanded();
  }, [expanded]);

  const onCollapse = useCallback(() => {
    if (expanded) usePerformanceHUDStore.getState().toggleExpanded();
  }, [expanded]);

  const onCopyStats = useCallback(async () => {
    if (!metrics) return;
    try {
      await copyStatsToClipboard(metrics, renderMode);
      toast.success(t('performance.copyStatsToast'));
    } catch {
      toast.error(t('performance.toast.copyFailed'));
    }
  }, [metrics, renderMode, t]);

  const onDownload = useCallback(async () => {
    if (!metrics || !canvas) return;
    try {
      await downloadStatsAndScreenshot(metrics, renderMode, canvas);
    } catch {
      toast.error(t('performance.toast.downloadFailed'));
    }
  }, [metrics, renderMode, canvas, t]);

  const onSendToSupport = useCallback(() => {
    if (!metrics || !canvas) {
      toast.error(t('performance.dialog.errorToast'));
      return;
    }
    setReport({ metrics, screenshotDataUrl: captureDiagnosticScreenshot(canvas, renderMode) });
  }, [metrics, canvas, renderMode, t]);

  const onSubmitReport = useCallback(async (comment: string) => {
    if (!report) return;
    await sendDiagnostic({
      projectId,
      metrics: report.metrics,
      renderMode,
      screenshotDataUrl: report.screenshotDataUrl,
      comment,
      source: 'manual',
    });
  }, [report, projectId, renderMode]);

  if (!enabled) return null;

  return (
    <div className={`absolute bottom-[66px] right-4 ${PANEL_LAYOUT.Z_INDEX['55']}`}>
      {/* ≥1024px: mini or expanded */}
      <div className="hidden lg:block">
        {expanded ? (
          <PerformanceHUDExpanded
            metrics={metrics}
            renderMode={renderMode}
            historyEnabled={historyEnabled}
            onCollapse={onCollapse}
            onCopyStats={onCopyStats}
            onDownload={onDownload}
            onSendToSupport={onSendToSupport}
          />
        ) : (
          <PerformanceHUDMini
            metrics={metrics}
            renderMode={renderMode}
            onExpand={onExpand}
          />
        )}
      </div>

      {/* <1024px: forced mini */}
      <div className="block lg:hidden">
        <PerformanceHUDMini
          metrics={metrics}
          renderMode={renderMode}
          onExpand={onExpand}
        />
      </div>

      {report && (
        <PerformanceDiagnosticDialog
          open
          onOpenChange={(open) => { if (!open) setReport(null); }}
          metrics={report.metrics}
          renderMode={renderMode}
          screenshotDataUrl={report.screenshotDataUrl}
          variant="manual"
          onSubmit={onSubmitReport}
        />
      )}
    </div>
  );
}
