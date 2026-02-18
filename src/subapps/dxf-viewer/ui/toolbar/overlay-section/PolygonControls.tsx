/**
 * ui/toolbar/overlay-section/PolygonControls.tsx
 * Polygon drawing controls (Point counter + Save + Cancel) for overlay toolbar
 *
 * 🏢 ADR-050: UNIFIED TOOLBAR INTEGRATION (2027-01-27)
 * Save/Cancel buttons με point counter - εμφανίζονται μόνο κατά τη διάρκεια drawing
 */

'use client';

import React from 'react';
import { Save, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useEventBus } from '../../../systems/events';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { OVERLAY_TOOLBAR_COLORS } from '../../../config/toolbar-colors';

interface PolygonControlsProps {
  pointCount: number;
  canSave: boolean;
}

export const PolygonControls: React.FC<PolygonControlsProps> = ({
  pointCount,
  canSave
}) => {
  const iconSizes = useIconSizes();
  const eventBus = useEventBus();

  const handleSave = () => {
    eventBus.emit('overlay:save-polygon', undefined as unknown as void);
  };

  const handleCancel = () => {
    eventBus.emit('overlay:cancel-polygon', undefined as unknown as void);
  };

  return (
    <div className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`}>
      {/* Point Counter Badge */}
      <span
        className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} px-2 py-1 bg-muted rounded-md font-medium`}
        title="Number of points"
      >
        {pointCount}
      </span>

      {/* Save Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleSave}
            disabled={!canSave}
            aria-label={canSave ? 'Save polygon' : 'Need at least 3 points'}
            className={canSave ? `${OVERLAY_TOOLBAR_COLORS.save} hover:bg-green-100` : 'opacity-50'}
          >
            <Save className={iconSizes.sm} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {canSave ? 'Save polygon (≥3 points)' : 'Need at least 3 points'}
        </TooltipContent>
      </Tooltip>

      {/* Cancel Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleCancel}
            aria-label="Cancel drawing"
            className={`${OVERLAY_TOOLBAR_COLORS.cancel} hover:bg-red-100`}
          >
            <XCircle className={iconSizes.sm} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Cancel drawing</TooltipContent>
      </Tooltip>
    </div>
  );
};
