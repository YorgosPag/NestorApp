'use client';
import React, { useState } from 'react';
import type { DXFViewerLayoutProps } from '../../integration/types';
import { ToolbarSection } from './ToolbarSection';
import { CanvasSection } from './CanvasSection';
import type { OverlayEditorMode, Status, OverlayKind } from '../../overlays/types';
// 🏢 ENTERPRISE: Centralized spacing tokens (ADR-013)
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// ⚠️ PANEL_COLORS REMOVED (2026-01-03): BG_SECONDARY → bg-muted caused canvas visibility issues

/**
 * Renders the DXF viewer in its normal, non-fullscreen layout.
 */
export const NormalView: React.FC<DXFViewerLayoutProps> = (props) => {
  // Shared overlay state between toolbar and canvas
  const [overlayMode, setOverlayMode] = useState<OverlayEditorMode>('select');
  const [currentStatus, setCurrentStatus] = useState<Status>('for-sale');
  const [currentKind, setCurrentKind] = useState<OverlayKind>('unit');

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
      />
      <div className={`flex-1 flex ${PANEL_LAYOUT.OVERFLOW.HIDDEN}`}>
        <CanvasSection 
          {...props} 
          overlayMode={overlayMode}
          currentStatus={currentStatus}
          currentKind={currentKind}
        />
      </div>

      {/* FloatingPanel μετακινήθηκε στο DXFViewerLayout */}
    </div>
  );
};
