'use client';
import React from 'react';
import type { DXFViewerLayoutProps } from '../../integration/types';
import { CanvasSection } from './CanvasSection';
import CadStatusBar from '../../statusbar/CadStatusBar';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { StandaloneStatusBar } from '../../ui/toolbar/StandaloneStatusBar';
import { useDxfToolbarShortcuts } from '../../hooks/useDxfToolbarShortcuts';
import type { OverlayEditorMode } from '../../overlays/types';

export const NormalView: React.FC<DXFViewerLayoutProps> = (props) => {
  const overlayMode: OverlayEditorMode = props.activeTool === 'layering' ? 'draw' : 'select';
  useDxfToolbarShortcuts(props.activeTool, props.onToolChange, props.onAction);

  return (
    // ╔════════════════════════════════════════════════════════════════════════╗
    // ║ ⚠️ CRITICAL FIX (2026-01-03) - ΜΗΝ ΠΡΟΣΘΕΤΕΤΕ bg-muted Η BG_SECONDARY! ║
    // ║ Το PANEL_COLORS.BG_SECONDARY → bg-muted δημιουργεί "πέπλο" πάνω από    ║
    // ║ τον καμβά και εμποδίζει την εμφάνιση των χρωμάτων των DXF οντοτήτων.   ║
    // ║ Background πρέπει να είναι transparent για σωστή απεικόνιση canvas.    ║
    // ╚════════════════════════════════════════════════════════════════════════╝
    <div className="relative flex flex-col h-full">
      <StandaloneStatusBar
        activeTool={props.activeTool}
        onToolChange={props.onToolChange}
        onAction={props.onAction}
        onSidebarToggle={props.onSidebarToggle}
      />
      <div className={`flex-1 flex ${PANEL_LAYOUT.OVERFLOW.HIDDEN}`}>
        <CanvasSection
          {...props}
          overlayMode={overlayMode}
          currentStatus="for-sale"
          currentKind="property"
        />
      </div>
      <CadStatusBar />
    </div>
  );
};
