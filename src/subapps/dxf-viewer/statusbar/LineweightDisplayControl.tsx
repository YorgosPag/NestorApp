'use client';

/**
 * LineweightDisplayControl — global "Show Lineweight" toggle for the CAD status bar
 * (AutoCAD LWDISPLAY parity, ADR-510 Φ2G).
 *
 * ON  → committed entities stroke at their resolved lineweight (mm → fixed screen px,
 *       zoom-INDEPENDENT LWT — like AutoCAD/Revit).
 * OFF → every stroke collapses to a 1px hairline for fast drafting.
 *
 * SSoT: `stores/LineweightDisplayStore.ts` (zero React state, localStorage-persisted).
 * The gate is applied once in `dxf-renderer-style-resolve.ts`; the canvas renderer
 * subscribes to this store and invalidates the normal-state bitmap on flip.
 *
 * Extracted to its own file (not inlined into CadStatusBar) to keep that file under
 * the 500-line Google limit (N.7.1). Mirrors the AutoAlign status-bar toggle.
 */

import React, { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  getShowLineweight,
  toggleShowLineweight,
  subscribeLineweightDisplay,
} from '../stores/LineweightDisplayStore';

const LWDISPLAY_TOGGLE_ID = 'cad-toggle-lineweight';

export function LineweightDisplayControl() {
  const { t } = useTranslation('dxf-viewer-panels');
  const on = useSyncExternalStore(
    subscribeLineweightDisplay,
    getShowLineweight,
    getShowLineweight,
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 shrink-0">
          <label
            htmlFor={LWDISPLAY_TOGGLE_ID}
            className="flex items-center gap-1 cursor-pointer select-none"
          >
            <span className={`text-xs leading-none font-semibold ${on ? 'text-[hsl(var(--text-success))]' : 'text-muted-foreground'}`}>
              {t('cadDock.statusBar.lineweight')}
            </span>
          </label>
          <Switch
            id={LWDISPLAY_TOGGLE_ID}
            checked={on}
            onCheckedChange={() => toggleShowLineweight()}
            className="scale-75 origin-left data-[state=checked]:bg-[hsl(var(--text-success))]"
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">{t('cadDock.statusBar.lineweightDesc')}</TooltipContent>
    </Tooltip>
  );
}
