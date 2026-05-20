'use client';

import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';
import { usePerformanceHUDStore } from '../performance/PerformanceHUDStore';

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

  const modeKey = RENDER_MODE_KEY[renderMode] ?? 'raster';

  return (
    <div className="p-3 text-xs text-white/80">
      <div className="flex items-center justify-between gap-2">
        <span>{t('performance.toggleLabel')}</span>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => usePerformanceHUDStore.getState().setEnabled(v)}
        />
      </div>
      <p className="mt-2 text-white/40">
        {t(`performance.mode.${modeKey}`)}
      </p>
    </div>
  );
}
