'use client';

import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';
import { usePerformanceHUDStore } from '../performance/PerformanceHUDStore';
import { usePerformanceHistoryStore } from '../performance/PerformanceHistoryStore';

const RENDER_MODE_KEY: Record<string, string> = {
  '3d-raster': 'raster',
  '3d-preview': 'preview',
  '3d-final': 'final',
};

export function Quality3DPanelTab() {
  const { t } = useTranslation('bim3d');

  const { enabled, renderMode } = useSyncExternalStore(
    usePerformanceHUDStore.subscribe,
    usePerformanceHUDStore.getState,
    usePerformanceHUDStore.getState,
  );

  const historyEnabled = useSyncExternalStore(
    usePerformanceHistoryStore.subscribe,
    () => usePerformanceHistoryStore.getState().enabled,
    () => false,
  );

  const modeKey = RENDER_MODE_KEY[renderMode] ?? 'raster';

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
    </div>
  );
}
