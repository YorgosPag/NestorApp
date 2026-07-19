/**
 * ENTERPRISE: MeasureToolbar — mode toggles + «clear all» for the transient
 * measure tool.
 *
 * Drives `MeasureToolOverlay` mode (distance / area / angle / off). Pure
 * controlled component for the mode — parent owns the active mode. The
 * clear-all action + count read the shared `useLocalMeasurements` scope
 * (in-memory only — NEVER Firestore), so the button appears once the viewer
 * has accumulated at least one measurement.
 *
 * Bundle isolation: NO imports from `src/subapps/dxf-viewer/`. Reuses the
 * same Tooltip/Button primitives as `FloorplanGallery`.
 *
 * @module components/shared/files/media/MeasureToolbar
 * @enterprise ADR-340 §3.6 / Phase 9 STEP J
 */

'use client';

import React from 'react';
import { Ruler, Square, Triangle, Eraser, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useLocalMeasurements } from '@/components/shared/files/media/useLocalMeasurements';

export type MeasureMode = 'distance' | 'area' | 'angle';

export interface MeasureToolbarProps {
  mode: MeasureMode | null;
  onModeChange: (next: MeasureMode | null) => void;
  /** Floorplan scope key for the accumulating local measurements (clear-all + count). */
  scopeKey?: string | null;
}

interface ToolDef {
  mode: MeasureMode;
  Icon: LucideIcon;
  labelKey: string;
}

const TOOLS: ReadonlyArray<ToolDef> = [
  { mode: 'distance', Icon: Ruler,    labelKey: 'floorplan.measure.distance' },
  { mode: 'area',     Icon: Square,   labelKey: 'floorplan.measure.area' },
  { mode: 'angle',    Icon: Triangle, labelKey: 'floorplan.measure.angle' },
];

export function MeasureToolbar({ mode, onModeChange, scopeKey }: MeasureToolbarProps) {
  const { t } = useTranslation(['files-media']);
  const iconSizes = useIconSizes();
  const { count, clearAll } = useLocalMeasurements(scopeKey ?? null);

  return (
    <nav className="flex items-center gap-1" aria-label={t('floorplan.measure.toolbar')}>
      {TOOLS.map(({ mode: m, Icon, labelKey }) => {
        const active = mode === m;
        const label = t(labelKey);
        return (
          <Tooltip key={m}>
            <TooltipTrigger asChild>
              <Button
                variant={active ? 'default' : 'ghost'}
                size="sm"
                aria-label={label}
                aria-pressed={active}
                onClick={() => onModeChange(active ? null : m)}
              >
                <Icon className={iconSizes.sm} aria-hidden={true} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        );
      })}
      {count > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              aria-label={t('floorplan.measure.clearAll')}
            >
              <Eraser className={iconSizes.sm} aria-hidden={true} />
              <span className="ml-1 text-xs tabular-nums">{count}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('floorplan.measure.clearAll')}</TooltipContent>
        </Tooltip>
      )}
    </nav>
  );
}

export default MeasureToolbar;
