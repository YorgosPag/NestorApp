'use client';

/**
 * PerformanceAlertsLeaf — ADR-366 §C.7.Q4 (+ mounts §C.7.Q5)
 *
 * Always-mounted micro-leaf (sibling of the HUD, NOT inside it: the HUD renders
 * null while hidden, and these alerts exist precisely for users who never open
 * it). One low-frequency subscription: `autoSubmitStore.phase`.
 *
 * Low-FPS prompt, non-modal by design (Figma memory banner, Firefox «page is
 * slowing down» bar, VS Code «Report Issue»): interrupting a user with a modal
 * at the very moment the app is struggling is the worst option.
 *   prompted  → persistent warning toast [Αναφορά…] [Όχι τώρα]
 *   reviewing → PerformanceDiagnosticDialog with the metrics FROZEN at detection
 *               time and a screenshot captured once — exactly what is sent
 *   decline   → 30-min cooldown (toast «Όχι τώρα»/close, or dialog «Άκυρο»)
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { autoSubmitStore, type AutoSubmitPhase } from './auto-submit-store';
import { usePerformanceHUDStore } from './PerformanceHUDStore';
import { PerformanceDiagnosticDialog } from './PerformanceDiagnosticDialog';
import { PerformanceRegressionNotifier } from './PerformanceRegressionNotifier';
import { captureDiagnosticScreenshot, sendDiagnostic } from './performance-snapshot-service';

/** Fixed id → re-showing is an update, never a duplicate toast. */
export const LOW_FPS_TOAST_ID = 'bim3d-low-fps-prompt';

interface PerformanceAlertsLeafProps {
  canvas: HTMLCanvasElement | null;
  projectId: string | null;
}

const selectPhase = (): AutoSubmitPhase => autoSubmitStore.getState().phase;
const serverPhase = (): AutoSubmitPhase => 'idle';

export function PerformanceAlertsLeaf({ canvas, projectId }: PerformanceAlertsLeafProps) {
  const { t } = useTranslation('bim3d');
  const phase = useSyncExternalStore(autoSubmitStore.subscribe, selectPhase, serverPhase);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);

  // Toast handlers outlive this render — read the live canvas at click time.
  const canvasRef = useRef(canvas);
  canvasRef.current = canvas;

  // Leaving the viewer withdraws the prompt — no orphan toast pointing at a
  // canvas that no longer exists. NOTE: sonner fires `onDismiss` on a
  // programmatic dismiss too; `recordDeclined('prompted')` makes that safe.
  useEffect(() => () => { toast.dismiss(LOW_FPS_TOAST_ID); }, []);

  useEffect(() => {
    if (phase !== 'prompted') {
      toast.dismiss(LOW_FPS_TOAST_ID);
      return;
    }
    const startReview = () => {
      const liveCanvas = canvasRef.current;
      if (!liveCanvas) {
        toast.error(t('performance.dialog.errorToast'));
        autoSubmitStore.getState().recordDeclined('prompted');
        return;
      }
      const mode = usePerformanceHUDStore.getState().renderMode;
      setScreenshotDataUrl(captureDiagnosticScreenshot(liveCanvas, mode));
      autoSubmitStore.getState().beginReview();
    };
    const decline = () => autoSubmitStore.getState().recordDeclined('prompted');

    toast.warning(t('performance.autoSubmit.toastTitle'), {
      id: LOW_FPS_TOAST_ID,
      description: t('performance.autoSubmit.toastBody', { fps: autoSubmitStore.getState().triggerFps ?? 0 }),
      duration: Number.POSITIVE_INFINITY,
      action: { label: t('performance.autoSubmit.reviewButton'), onClick: startReview },
      cancel: { label: t('performance.autoSubmit.notNowButton'), onClick: decline },
      onDismiss: decline,
    });
  }, [phase, t]);

  return (
    <>
      <PerformanceRegressionNotifier />
      {phase === 'reviewing' && screenshotDataUrl && (
        <AutoReportDialog projectId={projectId} screenshotDataUrl={screenshotDataUrl} />
      )}
    </>
  );
}

interface AutoReportDialogProps {
  projectId: string | null;
  screenshotDataUrl: string;
}

function AutoReportDialog({ projectId, screenshotDataUrl }: AutoReportDialogProps) {
  const { triggerSnapshot } = autoSubmitStore.getState();
  const renderMode = usePerformanceHUDStore.getState().renderMode;
  if (!triggerSnapshot) return null;

  return (
    <PerformanceDiagnosticDialog
      open
      onOpenChange={(open) => { if (!open) autoSubmitStore.getState().recordDeclined('reviewing'); }}
      metrics={triggerSnapshot}
      renderMode={renderMode}
      screenshotDataUrl={screenshotDataUrl}
      variant="auto_submit"
      onSubmit={async (comment) => {
        await sendDiagnostic({
          projectId,
          metrics: triggerSnapshot,
          renderMode,
          screenshotDataUrl,
          comment,
          source: 'auto_submit',
        });
        autoSubmitStore.getState().recordSubmitted();
      }}
      onPermanentOptOut={() => autoSubmitStore.getState().setPermanentOptOut(true)}
    />
  );
}
