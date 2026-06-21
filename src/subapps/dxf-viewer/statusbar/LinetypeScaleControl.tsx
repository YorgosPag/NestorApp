'use client';

/**
 * LinetypeScaleControl — global LTSCALE knob for the CAD status bar (ADR-510 Φ2E #2).
 *
 * Always-visible numeric input that drives the drawing-wide linetype scale
 * (AutoCAD `LTSCALE`). Reuses the shared `StatusBarNumericField` live-apply control
 * (local text buffer + range guard) — same SSoT as the snap-step field.
 *
 * SSoT: `stores/LinetypeScaleStore.ts` (zero React state, localStorage-persisted).
 * The canvas dash renderer (`rendering/linetype-dash-resolver.ts`) multiplies this
 * factor into every dash pattern: final step = zoom × LTSCALE × CELTSCALE.
 *
 * Extracted to its own file (not inlined into CadStatusBar) to keep that file
 * under the 500-line Google limit (N.7.1).
 */

import React, { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  getLinetypeScale,
  setLinetypeScale,
  subscribeLinetypeScale,
} from '../stores/LinetypeScaleStore';
import { StatusBarNumericField } from './StatusBarNumericField';

const LTSCALE_INPUT_ID = 'cad-ltscale-input';

export function LinetypeScaleControl() {
  const { t } = useTranslation('dxf-viewer-panels');
  const scale = useSyncExternalStore(
    subscribeLinetypeScale,
    getLinetypeScale,
    getLinetypeScale,
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 shrink-0">
          <label
            htmlFor={LTSCALE_INPUT_ID}
            className="text-xs leading-none font-semibold text-muted-foreground cursor-pointer select-none"
          >
            {t('cadDock.statusBar.ltscale')}
          </label>
          {/* AutoCAD rejects LTSCALE <= 0 → minExclusive (store guards again too). */}
          <StatusBarNumericField
            id={LTSCALE_INPUT_ID}
            value={scale}
            onCommit={setLinetypeScale}
            ariaLabel={t('cadDock.statusBar.ltscaleDesc')}
            min={0}
            minExclusive
            step={0.25}
            widthClass="w-16"
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">{t('cadDock.statusBar.ltscaleDesc')}</TooltipContent>
    </Tooltip>
  );
}
