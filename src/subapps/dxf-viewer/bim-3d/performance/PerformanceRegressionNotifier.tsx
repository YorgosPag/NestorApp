'use client';

/**
 * PerformanceRegressionNotifier — ADR-366 §C.7.Q5
 *
 * Always-mounted micro-leaf inside BimViewport3D. Bridges the non-React
 * regression-alert-bus to sonner toast + auto-opens the HUD when the
 * alert fires while the HUD is currently hidden.
 *
 * Renders nothing — pure side-effect component.
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { regressionAlertBus } from './regression-alert-bus';
import { usePerformanceHUDStore } from './PerformanceHUDStore';

const RENDER_MODE_KEY: Record<string, string> = {
  '3d-raster':  'raster',
  '3d-preview': 'preview',
  '3d-final':   'final',
};

export function PerformanceRegressionNotifier() {
  const { t } = useTranslation('bim3d');

  useEffect(() => {
    return regressionAlertBus.subscribe((payload) => {
      const modeLabel = t(`performance.mode.${RENDER_MODE_KEY[payload.mode] ?? 'raster'}`);
      const fps = Math.round(payload.fps);
      const median = Math.round(payload.baseline.median);

      toast.warning(t('performance.regression.toastTitle'), {
        description: t('performance.regression.toastBody', { mode: modeLabel, fps, median }),
        action: {
          label: t('performance.regression.openHud'),
          onClick: () => {
            const hud = usePerformanceHUDStore.getState();
            if (!hud.enabled) hud.setEnabled(true);
            if (!hud.expanded) hud.toggleExpanded();
          },
        },
      });

      const hud = usePerformanceHUDStore.getState();
      if (!hud.enabled) hud.setEnabled(true);
    });
  }, [t]);

  return null;
}
