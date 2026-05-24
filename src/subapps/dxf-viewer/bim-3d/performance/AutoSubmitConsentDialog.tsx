'use client';

/**
 * AutoSubmitConsentDialog — ADR-366 §C.7.Q4
 *
 * Renders the GDPR-compliant consent dialog when the auto-submit FSM
 * transitions to `prompted`. Three terminal choices:
 *   - accept           → triggers diagnostic submission (auto comment),
 *                        audit `auto_submit_accepted` recorded server-side
 *   - decline          → 30-min cooldown applied, audit `_declined` deferred
 *                        to Session 3b telemetry endpoint
 *   - permanentOptOut  → terminal, FSM never prompts again on this device
 *
 * Self-mounting micro-leaf — returns null until store.phase === 'prompted'.
 */

import { useSyncExternalStore, useState } from 'react';
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
import { autoSubmitStore } from './auto-submit-store';
import { usePerformanceHUDStore } from './PerformanceHUDStore';
import { sendDiagnostic } from './performance-snapshot-service';

interface AutoSubmitConsentDialogProps {
  canvas: HTMLCanvasElement | null;
  projectId: string | null;
  userId: string | null;
  companyId: string | null;
}

export function AutoSubmitConsentDialog({
  canvas,
  projectId,
  userId,
  companyId,
}: AutoSubmitConsentDialogProps) {
  const { t } = useTranslation('bim3d');

  const phase = useSyncExternalStore(
    autoSubmitStore.subscribe,
    () => autoSubmitStore.getState().phase,
    () => 'idle' as const,
  );
  const triggerFps = useSyncExternalStore(
    autoSubmitStore.subscribe,
    () => autoSubmitStore.getState().triggerFps,
    () => null,
  );

  const [submitting, setSubmitting] = useState(false);

  const open = phase === 'prompted';

  async function handleAccept() {
    if (!canvas || !userId || !companyId) {
      autoSubmitStore.getState().recordAccepted();
      return;
    }
    setSubmitting(true);
    try {
      const hud = usePerformanceHUDStore.getState();
      const metrics = hud.metrics;
      if (!metrics) {
        autoSubmitStore.getState().recordAccepted();
        return;
      }
      await sendDiagnostic({
        companyId,
        userId,
        projectId,
        metrics,
        renderMode: hud.renderMode,
        canvas,
        comment: t('performance.autoSubmit.autoComment'),
        source: 'auto_submit',
      });
      autoSubmitStore.getState().recordAccepted();
    } finally {
      setSubmitting(false);
    }
  }

  function handleDecline() {
    autoSubmitStore.getState().recordDeclined();
  }

  function handlePermanentOptOut() {
    autoSubmitStore.getState().setPermanentOptOut(true);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !submitting) handleDecline(); }}>
      <DialogContent className="max-w-md" hideCloseButton>
        <DialogHeader>
          <DialogTitle>{t('performance.autoSubmit.title')}</DialogTitle>
          <DialogDescription>
            {triggerFps !== null
              ? t('performance.autoSubmit.body', { fps: triggerFps })
              : t('performance.autoSubmit.bodyGeneric')}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={handlePermanentOptOut}
            disabled={submitting}
          >
            {t('performance.autoSubmit.permanentOptOutButton')}
          </Button>
          <Button variant="outline" onClick={handleDecline} disabled={submitting}>
            {t('performance.autoSubmit.declineButton')}
          </Button>
          <Button onClick={handleAccept} disabled={submitting}>
            {submitting
              ? t('performance.dialog.submitting')
              : t('performance.autoSubmit.acceptButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
