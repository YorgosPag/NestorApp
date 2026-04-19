'use client';
import React from 'react';
import type { DXFViewerLayoutProps } from '../../integration/types';
import { ToolbarSection } from './ToolbarSection';
import { CanvasSection } from './CanvasSection';
import type { OverlayEditorMode } from '../../overlays/types';
// 🏢 ENTERPRISE: Centralized spacing tokens (ADR-013)
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// ⚠️ PANEL_COLORS REMOVED (2026-01-03): BG_SECONDARY → bg-muted caused canvas visibility issues

/**
 * Renders the DXF viewer in its normal, non-fullscreen layout.
 * Overlay toolbar removed — clicking "layering" activates draw mode directly.
 */
export const NormalView: React.FC<DXFViewerLayoutProps> = (props) => {
  // Derive overlay mode from active tool: layering = draw, anything else = select
  const overlayMode: OverlayEditorMode = props.activeTool === 'layering' ? 'draw' : 'select';

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
        setOverlayMode={() => {}}
        currentStatus="for-sale"
        setCurrentStatus={() => {}}
        currentKind="property"
        setCurrentKind={() => {}}
        showOverlayToolbar={false}
      />
      <div className={`flex-1 flex ${PANEL_LAYOUT.OVERFLOW.HIDDEN}`}>
        <CanvasSection
          {...props}
          overlayMode={overlayMode}
          currentStatus="for-sale"
          currentKind="property"
        />
      </div>

      {/* FloatingPanel μετακινήθηκε στο DXFViewerLayout */}
    </div>
  );
};
