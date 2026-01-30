'use client';
import React, { useState } from 'react';
import type { DXFViewerLayoutProps } from '../../integration/types';
import { ToolbarSection } from './ToolbarSection';
import { CanvasSection } from './CanvasSection';
import type { OverlayEditorMode, Status, OverlayKind } from '../../overlays/types';
import type { Point2D } from '../../rendering/types/Types';
// 🏢 ENTERPRISE: Centralized spacing tokens (ADR-013)
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// ⚠️ PANEL_COLORS REMOVED (2026-01-03): BG_SECONDARY → bg-muted caused canvas visibility issues

/**
 * Renders the DXF viewer in its normal, non-fullscreen layout.
 *
 * 🔧 FIX (2026-01-24): Uses props.overlayMode/setOverlayMode from parent when available
 * to ensure Single Source of Truth with FloatingPanelsSection's DraggableOverlayToolbar.
 * Falls back to local state only if props are not provided.
 */
export const NormalView: React.FC<DXFViewerLayoutProps> = (props) => {
  // 🔧 FIX: Local state as FALLBACK only - prefer props from parent for Single Source of Truth
  const [localOverlayMode, setLocalOverlayMode] = useState<OverlayEditorMode>('select');
  const [localCurrentStatus, setLocalCurrentStatus] = useState<Status>('for-sale');
  const [localCurrentKind, setLocalCurrentKind] = useState<OverlayKind>('unit');

  // 🏢 ADR-050: Overlay section collapse state
  const [isOverlaySectionCollapsed, setIsOverlaySectionCollapsed] = useState(false);

  // 🏢 ENTERPRISE (2027-01-27): Mouse coordinates for status bar real-time updates
  const [mouseCoordinates, setMouseCoordinates] = useState<Point2D | null>(null);

  // 🎯 ENTERPRISE: Use props when available, fallback to local state
  // This ensures NormalView and FloatingPanelsSection share the same state
  const overlayMode = props.overlayMode ?? localOverlayMode;
  const setOverlayMode = props.setOverlayMode ?? setLocalOverlayMode;
  const currentStatus = (props.overlayStatus ?? localCurrentStatus) as Status;
  const setCurrentStatus = props.setOverlayStatus ?? setLocalCurrentStatus;
  const currentKind = props.currentKind ?? localCurrentKind;
  const setCurrentKind = props.setOverlayKind ?? setLocalCurrentKind;

  // 🏢 ADR-050: Detect if overlay toolbar should be shown (layering tool + feature flag)
  const showOverlayToolbar = props.activeTool === 'layering';

  return (
    // ╔════════════════════════════════════════════════════════════════════════╗
    // ║ ⚠️ CRITICAL FIX (2026-01-03) - ΜΗΝ ΠΡΟΣΘΕΤΕΤΕ bg-muted Η BG_SECONDARY! ║
    // ║ Το PANEL_COLORS.BG_SECONDARY → bg-muted δημιουργεί "πέπλο" πάνω από    ║
    // ║ τον καμβά και εμποδίζει την εμφάνιση των χρωμάτων των DXF οντοτήτων.   ║
    // ║ Background πρέπει να είναι transparent για σωστή απεικόνιση canvas.    ║
    // ╚════════════════════════════════════════════════════════════════════════╝
    <div className="relative flex flex-col h-full">
      <ToolbarSection
        {...props}
        overlayMode={overlayMode}
        setOverlayMode={setOverlayMode}
        currentStatus={currentStatus}
        setCurrentStatus={setCurrentStatus}
        currentKind={currentKind}
        setCurrentKind={setCurrentKind}
        showOverlayToolbar={showOverlayToolbar}
        isOverlaySectionCollapsed={isOverlaySectionCollapsed}
        onToggleOverlaySection={() => setIsOverlaySectionCollapsed(prev => !prev)}
        mouseCoordinates={mouseCoordinates}
      />
      <div className={`flex-1 flex ${PANEL_LAYOUT.OVERFLOW.HIDDEN}`}>
        <CanvasSection
          {...props}
          overlayMode={overlayMode}
          currentStatus={currentStatus}
          currentKind={currentKind}
          onMouseCoordinatesChange={setMouseCoordinates}
        />
      </div>

      {/* FloatingPanel μετακινήθηκε στο DXFViewerLayout */}
    </div>
  );
};
