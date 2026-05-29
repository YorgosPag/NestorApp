'use client';

import { useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { usePerformanceHUDStore } from '../performance/PerformanceHUDStore';
import { usePerformanceHistoryStore } from '../performance/PerformanceHistoryStore';
import { autoSubmitStore } from '../performance/auto-submit-store';
import { telemetryStore } from '../telemetry/telemetry-store';
import { telemetryBatcher } from '../telemetry/telemetry-batcher';
import {
  computeAnonymousSessionId,
  clearStoredSalt,
} from '../telemetry/session-id-generator';
import { eraseTelemetryHistory } from '../telemetry/telemetry-uploader';
import { TelemetryConsentDialog } from '../telemetry/TelemetryConsentDialog';

const RENDER_MODE_KEY: Record<string, string> = {
  '3d-raster': 'raster',
  '3d-preview': 'preview',
  '3d-final': 'final',
};

type EraseStatus = 'idle' | 'erasing' | 'success' | 'error';

export function Quality3DPanelTab() {
  const { t, i18n } = useTranslation('bim3d');
  const { user } = useAuth();
  const userId = user?.uid ?? null;

  const { enabled, renderMode, regressionAlertsEnabled } = useSyncExternalStore(
    usePerformanceHUDStore.subscribe,
    usePerformanceHUDStore.getState,
    usePerformanceHUDStore.getState,
  );

  const historyEnabled = useSyncExternalStore(
    usePerformanceHistoryStore.subscribe,
    () => usePerformanceHistoryStore.getState().enabled,
    () => false,
  );

  const autoSubmitOptOut = useSyncExternalStore(
    autoSubmitStore.subscribe,
    () => autoSubmitStore.getState().permanentOptOut,
    () => false,
  );

  const telemetryOptIn = useSyncExternalStore(
    telemetryStore.subscribe,
    () => telemetryStore.getState().optIn,
    () => false,
  );

  const telemetryLastErasedAt = useSyncExternalStore(
    telemetryStore.subscribe,
    () => telemetryStore.getState().lastErasedAt,
    () => null,
  );

  const [consentOpen, setConsentOpen] = useState(false);
  const [eraseStatus, setEraseStatus] = useState<EraseStatus>('idle');

  const modeKey = RENDER_MODE_KEY[renderMode] ?? 'raster';

  function handleTelemetryToggle(next: boolean): void {
    if (next) {
      setConsentOpen(true);
    } else {
      telemetryStore.getState().setOptIn(false);
      telemetryStore.getState().setUserContext(null);
      telemetryBatcher.reset();
    }
  }

  function handleConsentAccept(): void {
    setConsentOpen(false);
    telemetryStore.getState().setOptIn(true);
    if (userId) telemetryStore.getState().setUserContext(userId);
  }

  function handleConsentDecline(): void {
    setConsentOpen(false);
  }

  async function handleErase(): Promise<void> {
    if (!userId) return;
    setEraseStatus('erasing');
    try {
      const sessionId = await computeAnonymousSessionId(userId);
      const ok = await eraseTelemetryHistory(sessionId);
      if (!ok) {
        setEraseStatus('error');
        return;
      }
      telemetryStore.getState().setOptIn(false);
      telemetryStore.getState().setUserContext(null);
      telemetryBatcher.reset();
      clearStoredSalt();
      telemetryStore.getState().recordErasure();
      setEraseStatus('success');
    } catch {
      setEraseStatus('error');
    }
  }

  const lastErasedLabel = telemetryLastErasedAt
    ? new Date(telemetryLastErasedAt).toLocaleString(i18n.language)
    : null;

  return (
    <div className="space-y-3 p-3 text-xs text-white/80">
      <div className="flex items-center justify-between gap-2">
        <span>{t('performance.toggleLabel')}</span>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => usePerformanceHUDStore.getState().setEnabled(v)}
        />
      </div>
      <p className="text-white/40">
        {t(`performance.mode.${modeKey}`)}
      </p>

      <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-3">
        <span className={enabled ? '' : 'text-white/40'}>{t('performance.history.toggleLabel')}</span>
        <Switch
          checked={historyEnabled}
          disabled={!enabled}
          onCheckedChange={(v) => usePerformanceHistoryStore.getState().setEnabled(v)}
        />
      </div>
      {enabled && historyEnabled && (
        <button
          type="button"
          onClick={() => usePerformanceHistoryStore.getState().clearHistory()}
          className="rounded border border-white/20 px-2 py-1 text-white/70 hover:bg-white/5"
        >
          {t('performance.history.clearButton')}
        </button>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-3">
        <span>{t('performance.regression.toggle')}</span>
        <Switch
          checked={regressionAlertsEnabled}
          onCheckedChange={(v) => usePerformanceHUDStore.getState().setRegressionAlertsEnabled(v)}
        />
      </div>

      <div className="space-y-2 border-t border-white/10 pt-3">
        <div className="flex items-center justify-between gap-2">
          <span>{t('performance.autoSubmit.toggle')}</span>
          <Switch
            checked={!autoSubmitOptOut}
            onCheckedChange={(v) => autoSubmitStore.getState().setPermanentOptOut(!v)}
          />
        </div>
        <p className="text-white/40">{t('performance.autoSubmit.toggleDescription')}</p>
      </div>

      <section
        aria-label={t('performance.telemetry.title')}
        className="space-y-2 border-t border-white/10 pt-3"
      >
        <div className="flex items-center justify-between gap-2">
          <span>{t('performance.telemetry.toggle')}</span>
          <Switch
            checked={telemetryOptIn}
            disabled={!userId}
            onCheckedChange={handleTelemetryToggle}
          />
        </div>
        <p className="text-white/40">{t('performance.telemetry.description')}</p>

        {telemetryOptIn && (
          <div className="flex flex-col gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleErase}
              disabled={eraseStatus === 'erasing' || !userId}
            >
              {eraseStatus === 'erasing'
                ? t('performance.telemetry.erasing')
                : t('performance.telemetry.eraseButton')}
            </Button>
            {eraseStatus === 'success' && (
              <span className="text-[hsl(var(--text-success))]">{t('performance.telemetry.eraseSuccess')}</span>
            )}
            {eraseStatus === 'error' && (
              <span className="text-destructive">{t('performance.telemetry.eraseError')}</span>
            )}
          </div>
        )}

        {lastErasedLabel && (
          <p className="text-white/40">
            {t('performance.telemetry.lastErasedAt', { date: lastErasedLabel })}
          </p>
        )}
      </section>

      <TelemetryConsentDialog
        open={consentOpen}
        onAccept={handleConsentAccept}
        onDecline={handleConsentDecline}
      />
    </div>
  );
}
