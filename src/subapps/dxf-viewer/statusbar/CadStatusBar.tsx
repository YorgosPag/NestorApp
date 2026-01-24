'use client';
import React, { useEffect } from 'react';
// Enterprise Canvas UI Migration - Phase B
import { canvasUI } from '@/styles/design-tokens/canvas';
// 🏢 ENTERPRISE: Shadcn Tooltip (replaces native title attribute)
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
// ⌨️ ENTERPRISE: Centralized keyboard shortcuts - Single source of truth
import { matchesShortcut, getShortcutDisplayLabel } from '../config/keyboard-shortcuts';

type Toggle = { on: boolean; toggle: () => void };

interface CadStatusBarProps {
  osnap: Toggle; 
  grid: Toggle; 
  snap: Toggle; 
  ortho: Toggle; 
  polar: Toggle; 
  dynInput: Toggle;
}

export default function CadStatusBar({
  osnap, grid, snap, ortho, polar, dynInput
}: CadStatusBarProps) {

  // ⌨️ ENTERPRISE: F-KEY SHORTCUTS using centralized keyboard-shortcuts.ts
  // Reference: AutoCAD F7-F12 standard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ✅ GUARD: Skip if typing in input fields
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

      // F7 - Grid Display toggle (AutoCAD standard)
      if (matchesShortcut(e, 'gridDisplay')) {
        e.preventDefault();
        grid.toggle();
        return;
      }

      // F8 - Ortho Mode (AutoCAD standard)
      if (matchesShortcut(e, 'orthoMode')) {
        e.preventDefault();
        ortho.toggle();
        return;
      }

      // F9 - Grid Snap toggle (AutoCAD standard)
      if (matchesShortcut(e, 'gridSnap')) {
        e.preventDefault();
        snap.toggle();
        return;
      }

      // F10 - Polar Tracking (AutoCAD standard)
      if (matchesShortcut(e, 'polarTracking')) {
        e.preventDefault();
        polar.toggle();
        return;
      }

      // F11 - Object Snap (OSNAP) (AutoCAD standard)
      if (matchesShortcut(e, 'objectSnap')) {
        e.preventDefault();
        osnap.toggle();
        return;
      }

      // F12 - Dynamic Input (AutoCAD standard)
      if (matchesShortcut(e, 'dynamicInput')) {
        e.preventDefault();
        dynInput.toggle();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [osnap, grid, snap, ortho, polar, dynInput]);

  const StatusButton = ({ label, toggle, fkey, description }: {
    label: string;
    toggle: Toggle;
    fkey: string;
    description: string;
  }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={toggle.toggle}
          style={{
            ...canvasUI.positioning.cadStatusBar.button,
            ...(toggle.on ? canvasUI.positioning.cadStatusBar.buttonActive : {})
          }}
        >
          <span style={canvasUI.positioning.cadStatusBar.label}>{label}</span>
          <span style={canvasUI.positioning.cadStatusBar.functionKey}>{fkey}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>{`${description} (${fkey})`}</TooltipContent>
    </Tooltip>
  );

  // ⌨️ ENTERPRISE: F-key display labels from centralized config
  return (
    <div style={canvasUI.positioning.cadStatusBar.container}>
      <StatusButton
        label="OSNAP"
        toggle={osnap}
        fkey={getShortcutDisplayLabel('objectSnap')}
        description="Object Snap - Snap to object points"
      />
      <StatusButton
        label="GRID"
        toggle={grid}
        fkey={getShortcutDisplayLabel('gridDisplay')}
        description="Grid Display - Show/hide grid"
      />
      <StatusButton
        label="SNAP"
        toggle={snap}
        fkey={getShortcutDisplayLabel('gridSnap')}
        description="Grid Snap - Snap to grid points"
      />
      <StatusButton
        label="ORTHO"
        toggle={ortho}
        fkey={getShortcutDisplayLabel('orthoMode')}
        description="Orthogonal Mode - Constrain to 0/90/180/270 degrees"
      />
      <StatusButton
        label="POLAR"
        toggle={polar}
        fkey={getShortcutDisplayLabel('polarTracking')}
        description="Polar Tracking - Track along polar angles"
      />
      <StatusButton
        label="DYN"
        toggle={dynInput}
        fkey={getShortcutDisplayLabel('dynamicInput')}
        description="Dynamic Input - Show coordinates near cursor"
      />

      {/* Status info */}
      <div style={canvasUI.positioning.cadStatusBar.statusInfo}>
        CAD Mode | Press F-keys for shortcuts
      </div>
    </div>
  );
}

