'use client';

/**
 * LinetypeScaleControl — global LTSCALE knob for the CAD status bar (ADR-510 Φ2E #2).
 *
 * Always-visible numeric input that drives the drawing-wide linetype scale
 * (AutoCAD `LTSCALE`). Mirrors the `SnapToggleWithStep` numeric-input pattern in
 * `CadStatusBar.tsx`: a local text buffer so mid-typing never snaps back, with a
 * positive-number guard applying live on every keystroke.
 *
 * SSoT: `stores/LinetypeScaleStore.ts` (zero React state, localStorage-persisted).
 * The canvas dash renderer (`rendering/linetype-dash-resolver.ts`) multiplies this
 * factor into every dash pattern: final step = zoom × LTSCALE × CELTSCALE.
 *
 * Extracted to its own file (not inlined into CadStatusBar) to keep that file
 * under the 500-line Google limit (N.7.1).
 */

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  getLinetypeScale,
  setLinetypeScale,
  subscribeLinetypeScale,
} from '../stores/LinetypeScaleStore';

const LTSCALE_INPUT_ID = 'cad-ltscale-input';

export function LinetypeScaleControl() {
  const { t } = useTranslation('dxf-viewer-panels');
  const scale = useSyncExternalStore(
    subscribeLinetypeScale,
    getLinetypeScale,
    getLinetypeScale,
  );
  // Local text buffer — partial/empty drafts (e.g. "0.") never snap back; a valid
  // positive number applies live. AutoCAD rejects LTSCALE <= 0 (store guards too).
  const [text, setText] = useState(String(scale));
  useEffect(() => { setText(String(scale)); }, [scale]);

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
          <input
            id={LTSCALE_INPUT_ID}
            type="number"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              const n = parseFloat(e.target.value);
              if (!isNaN(n) && n > 0) setLinetypeScale(n);
            }}
            aria-label={t('cadDock.statusBar.ltscaleDesc')}
            className="h-6 w-16 text-xs px-2 rounded border border-border bg-background"
            min={0}
            step={0.25}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">{t('cadDock.statusBar.ltscaleDesc')}</TooltipContent>
    </Tooltip>
  );
}
