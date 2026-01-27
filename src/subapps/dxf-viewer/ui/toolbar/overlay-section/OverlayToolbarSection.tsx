/**
 * ui/toolbar/overlay-section/OverlayToolbarSection.tsx
 * Container component for overlay toolbar section (Row 2 in unified toolbar)
 *
 * 🏢 ADR-050: UNIFIED TOOLBAR INTEGRATION (2027-01-27)
 * Main container που συνθέτει όλα τα overlay sub-components σε μία collapsible section
 */

'use client';

import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useEventBus } from '../../../systems/events';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import {
  OverlayModeButtons,
  StatusPalette,
  KindSelector,
  PolygonControls,
  OverlayActions
} from './index';
import type { OverlayToolbarSectionProps } from './types';

export const OverlayToolbarSection: React.FC<OverlayToolbarSectionProps> = ({
  state,
  handlers,
  selectedOverlayId,
  canDelete,
  isCollapsed,
  onToggleCollapse
}) => {
  const iconSizes = useIconSizes();
  const eventBus = useEventBus();
  const { getStatusBorder } = useBorderTokens();

  // Local state for draft polygon info (updated via EventBus)
  const [draftPolygonInfo, setDraftPolygonInfo] = useState({
    pointCount: 0,
    canSave: false
  });

  // Listen for draft polygon updates from CanvasSection
  useEffect(() => {
    const cleanup = eventBus.on('overlay:draft-polygon-update', (payload) => {
      setDraftPolygonInfo(payload);
    });
    return cleanup;
  }, [eventBus]);

  // Show polygon controls only when:
  // 1. In draw mode
  // 2. Has at least 1 point
  const showPolygonControls = state.mode === 'draw' && draftPolygonInfo.pointCount > 0;

  return (
    <div
      className={`border-t ${getStatusBorder('muted')} bg-card`}
      data-testid="overlay-toolbar-section"
    >
      {/* Collapsible Header */}
      <div className={`flex items-center justify-between ${PANEL_LAYOUT.SPACING.XS} border-b ${getStatusBorder('muted')}`}>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="flex items-center gap-2"
        >
          {isCollapsed ? <ChevronDown className={iconSizes.sm} /> : <ChevronUp className={iconSizes.sm} />}
          <Activity className={iconSizes.sm} />
          <span className="font-medium">Εργαλεία Σχεδίασης</span>
        </Button>
      </div>

      {/* Content (hidden when collapsed) */}
      {!isCollapsed && (
        <div className={`flex flex-wrap items-center ${PANEL_LAYOUT.GAP.SM} ${PANEL_LAYOUT.SPACING.SM}`}>
          {/* Mode Buttons */}
          <OverlayModeButtons
            currentMode={state.mode}
            onModeChange={handlers.onModeChange}
          />

          <div className="w-px h-6 bg-border" />

          {/* Status Palette (8 colored buttons) */}
          <StatusPalette
            currentStatus={state.currentStatus}
            onStatusChange={handlers.onStatusChange}
          />

          <div className="w-px h-6 bg-border" />

          {/* Kind Selector (4 icon buttons) */}
          <KindSelector
            currentKind={state.currentKind}
            onKindChange={handlers.onKindChange}
          />

          {/* Polygon Controls (conditional - only in draw mode with points) */}
          {showPolygonControls && (
            <>
              <div className="w-px h-6 bg-border" />
              <PolygonControls
                pointCount={draftPolygonInfo.pointCount}
                canSave={draftPolygonInfo.canSave}
              />
            </>
          )}

          <div className="w-px h-6 bg-border" />

          {/* Actions (Duplicate/Delete) */}
          <OverlayActions
            onDuplicate={handlers.onDuplicate}
            onDelete={handlers.onDelete}
            canDelete={canDelete}
          />
        </div>
      )}
    </div>
  );
};
