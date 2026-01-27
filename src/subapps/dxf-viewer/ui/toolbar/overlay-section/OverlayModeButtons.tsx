/**
 * ui/toolbar/overlay-section/OverlayModeButtons.tsx
 * Mode selection buttons (Draw/Edit) for overlay toolbar
 *
 * 🏢 ADR-050: UNIFIED TOOLBAR INTEGRATION (2027-01-27)
 * Draw/Edit mode toggle buttons με enterprise patterns
 */

'use client';

import React from 'react';
import { Pen, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { OVERLAY_TOOLBAR_COLORS } from '../../../config/toolbar-colors';
import type { OverlayEditorMode } from '../../../overlays/types';

interface OverlayModeButtonsProps {
  currentMode: OverlayEditorMode;
  onModeChange: (mode: OverlayEditorMode) => void;
}

export const OverlayModeButtons: React.FC<OverlayModeButtonsProps> = ({
  currentMode,
  onModeChange
}) => {
  const iconSizes = useIconSizes();

  return (
    <div className={`flex ${PANEL_LAYOUT.GAP.XS}`}>
      {/* Draw Mode */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={currentMode === 'draw' ? 'default' : 'ghost'}
            size="icon-sm"
            onClick={() => onModeChange('draw')}
          >
            <Pen className={`${iconSizes.sm} ${currentMode !== 'draw' ? OVERLAY_TOOLBAR_COLORS.draw : ''}`} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Draw Mode (Create new polygons)</TooltipContent>
      </Tooltip>

      {/* Edit Mode */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={currentMode === 'edit' ? 'default' : 'ghost'}
            size="icon-sm"
            onClick={() => onModeChange('edit')}
          >
            <Edit className={`${iconSizes.sm} ${currentMode !== 'edit' ? OVERLAY_TOOLBAR_COLORS.edit : ''}`} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Edit Mode (Modify existing polygons)</TooltipContent>
      </Tooltip>
    </div>
  );
};
