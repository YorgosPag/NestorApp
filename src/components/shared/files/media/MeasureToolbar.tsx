/**
 * ENTERPRISE: MeasureToolbar — 3 toggle buttons for transient measure tool.
 *
 * Drives `MeasureToolOverlay` mode (distance / area / angle / off). Pure
 * controlled component — parent owns the active mode.
 *
 * Bundle isolation: NO imports from `src/subapps/dxf-viewer/`. Reuses the
 * same Tooltip/Button primitives as `FloorplanGallery`.
 *
 * @module components/shared/files/media/MeasureToolbar
 * @enterprise ADR-340 §3.6 / Phase 9 STEP H
 */

'use client';

import React from 'react';
import { Ruler, Square, Triangle, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';

export type MeasureMode = 'distance' | 'area' | 'angle';

export interface MeasureToolbarProps {
  mode: MeasureMode | null;
  onModeChange: (next: MeasureMode | null) => void;
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

export function MeasureToolbar({ mode, onModeChange }: MeasureToolbarProps) {
  const { t } = useTranslation(['files-media']);
  const iconSizes = useIconSizes();

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
    </nav>
  );
}

export default MeasureToolbar;
