'use client';

/**
 * ADR-366 Phase 9 / C.3.Q1 + C.3.Q3 — Ribbon Dim3D Contextual Tab.
 *
 * Mirrors ADR-345 ribbon contextual tab pattern. Surfaces:
 *  - Tool toggle (activate/deactivate the 3D dim tool)
 *  - 4 mode sub-buttons: Aligned / Linear / Radial / Angular
 *  - Snap toggles (endpoint/midpoint/faceCenter/guide)
 *
 * Single source of state: BimDimensions3DStore. Routing through
 * useDim3DToolRouting so the same UI works in 2D mode (dispatches the
 * `dim:*-2d` window events consumed by the 2D ribbon).
 */

import { useTranslation } from 'react-i18next';
import {
  selectDim3DToolActive,
  selectDim3DToolMode,
  useBimDimensions3DStore,
} from '../stores/BimDimensions3DStore';
import { useDim3DToolRouting } from './useDim3DToolRouting';
import type { Dim3DMode } from './dim3d-types';
import type { Dim3DSnapToggleState } from './dim3d-snap-engine-adapter';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const MODES: readonly Dim3DMode[] = ['aligned', 'linear', 'radial', 'angular'];
const SNAP_KEYS: readonly (keyof Dim3DSnapToggleState)[] = [
  'endpoint',
  'midpoint',
  'faceCenter',
  'guide',
];

export function RibbonDim3DContextualTab() {
  const { t } = useTranslation('bim3d');
  const routing = useDim3DToolRouting();
  const toolActive = useBimDimensions3DStore(selectDim3DToolActive);
  const toolMode = useBimDimensions3DStore(selectDim3DToolMode);
  const setToolMode = useBimDimensions3DStore((s) => s.setToolMode);
  const snapToggles = useBimDimensions3DStore((s) => s.snapToggles);
  const setSnapToggle = useBimDimensions3DStore((s) => s.setSnapToggle);

  return (
    <section
      aria-label={t('dimensions.title')}
      className="flex flex-col gap-3 p-3 text-sm"
    >
      <header className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('dimensions.title')}
        </h3>
        <button
          type="button"
          onClick={() => (toolActive ? routing.deactivate() : routing.activate(toolMode))}
          className={[
            'rounded px-3 py-1 text-xs font-medium transition-colors',
            toolActive
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground hover:bg-muted/70',
          ].join(' ')}
          aria-pressed={toolActive}
        >
          {toolActive ? t('dimensions.toolbar.cancel') : t('dimensions.toolbar.commit')}
        </button>
      </header>

      <nav aria-label={t('dimensions.title')} className="grid grid-cols-2 gap-1">
        {MODES.map((mode) => {
          const isActive = toolMode === mode;
          return (
            <Tooltip key={mode}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setToolMode(mode)}
                  aria-pressed={isActive}
                  className={[
                    'flex flex-col items-start gap-0.5 rounded border px-2 py-1.5 text-left text-xs transition-colors',
                    isActive
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted/40',
                  ].join(' ')}
                >
                  <span className="font-medium">{t(`dimensions.mode.${mode}.label`)}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {t(`dimensions.toolbar.${mode}`)}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent>{t(`dimensions.mode.${mode}.tooltip`)}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      <section aria-label={t('dimensions.snap.endpoint')}>
        <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('dimensions.snap.endpoint')}
        </h4>
        <ul className="grid grid-cols-2 gap-1">
          {SNAP_KEYS.map((key) => {
            const checked = snapToggles[key];
            return (
              <li key={key}>
                <label className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setSnapToggle(key, e.target.checked)}
                    className="h-3 w-3"
                  />
                  <span>{t(`dimensions.snap.${key}`)}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>
    </section>
  );
}
