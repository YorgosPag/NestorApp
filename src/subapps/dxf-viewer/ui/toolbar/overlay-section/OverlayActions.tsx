/**
 * ui/toolbar/overlay-section/OverlayActions.tsx
 * Action buttons (Duplicate/Delete) for overlay toolbar
 *
 * 🏢 ADR-050: UNIFIED TOOLBAR INTEGRATION (2027-01-27)
 * Duplicate/Delete actions με centralized OVERLAY_TOOLBAR_COLORS
 */

'use client';

import React from 'react';
import { Copy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { OVERLAY_TOOLBAR_COLORS } from '../../../config/toolbar-colors';

interface OverlayActionsProps {
  onDuplicate: () => void;
  onDelete: () => void;
  canDelete: boolean;
}

export const OverlayActions: React.FC<OverlayActionsProps> = ({
  onDuplicate,
  onDelete,
  canDelete
}) => {
  const iconSizes = useIconSizes();

  return (
    <div className={`flex ${PANEL_LAYOUT.GAP.XS}`}>
      {/* Duplicate */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onDuplicate}
              disabled={!canDelete}
            >
              <Copy className={`${iconSizes.sm} ${OVERLAY_TOOLBAR_COLORS.copy}`} />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Duplicate selected overlay</TooltipContent>
      </Tooltip>

      {/* Delete */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onDelete}
              disabled={!canDelete}
            >
              <X className={`${iconSizes.sm} ${OVERLAY_TOOLBAR_COLORS.delete}`} />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Delete selected overlay</TooltipContent>
      </Tooltip>
    </div>
  );
};
