'use client';

/**
 * PerformanceHUD — ADR-366 §B.5
 *
 * ADR-040 micro-leaf: 1 useSyncExternalStore → PerformanceHUDStore.
 * Renders mini pill or expanded panel depending on store state + viewport width.
 * Absolute-positioned inside viewport: bottom-[66px] right-4 z-[55].
 */

import { useSyncExternalStore, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { usePerformanceHUDStore } from './PerformanceHUDStore';
import { PerformanceHUDMini } from './PerformanceHUDMini';
import { PerformanceHUDExpanded } from './PerformanceHUDExpanded';
import { PerformanceDiagnosticDialog } from './PerformanceDiagnosticDialog';
import { copyStatsToClipboard } from './clipboard-stats-writer';
import { downloadStatsAndScreenshot } from './file-download-writer';
import { sendDiagnostic } from './performance-snapshot-service';

interface PerformanceHUDProps {
  canvas: HTMLCanvasElement | null;
  projectId: string | null;
  userId: string | null;
  companyId: string | null;
}

export function PerformanceHUD({ canvas, projectId, userId, companyId }: PerformanceHUDProps) {
  const { t } = useTranslation('bim3d');

  const { enabled, expanded, metrics, renderMode } = useSyncExternalStore(
    usePerformanceHUDStore.subscribe,
    usePerformanceHUDStore.getState,
    usePerformanceHUDStore.getState,
  );

  const [dialogOpen, setDialogOpen] = useState(false);

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
    setDialogOpen(true);
  }, []);

  if (!enabled) return null;

  return (
    <div className="absolute bottom-[66px] right-4 z-[55]">
      {/* ≥1024px: mini or expanded */}
      <div className="hidden lg:block">
        {expanded ? (
          <PerformanceHUDExpanded
            metrics={metrics}
            renderMode={renderMode}
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

      {canvas && dialogOpen && metrics && (
        <PerformanceDiagnosticDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          metrics={metrics}
          renderMode={renderMode}
          canvas={canvas}
          onSubmit={async (comment) => {
            if (!metrics || !canvas || !companyId || !userId) return;
            await sendDiagnostic({
              companyId,
              userId,
              projectId,
              metrics,
              renderMode,
              canvas,
              comment,
            });
          }}
        />
      )}
    </div>
  );
}
