'use client';
import React, { useEffect } from 'react';
// Enterprise Canvas UI Migration - Phase B
import { canvasUI } from '@/styles/design-tokens/canvas';

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

  // 🎹 F-KEY SHORTCUTS (AutoCAD standard)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if no input/textarea is focused
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

      switch (e.key) {
        case 'F8':
          e.preventDefault();
          ortho.toggle();

          break;
        case 'F9':
          e.preventDefault();
          snap.toggle();

          break;
        case 'F10':
          e.preventDefault();
          polar.toggle();

          break;
        case 'F11':
          e.preventDefault();
          osnap.toggle();

          break;
        case 'F7':
          e.preventDefault();
          grid.toggle();

          break;
        case 'F12':
          e.preventDefault();
          dynInput.toggle();

          break;
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
    <button 
      onClick={toggle.toggle} 
      style={{
        ...canvasUI.positioning.cadStatusBar.button,
        ...(toggle.on ? canvasUI.positioning.cadStatusBar.buttonActive : {})
      }}
      title={`${description} (${fkey})`}
    >
      <span style={canvasUI.positioning.cadStatusBar.label}>{label}</span>
      <span style={canvasUI.positioning.cadStatusBar.functionKey}>{fkey}</span>
    </button>
  );

  return (
    <div style={canvasUI.positioning.cadStatusBar.container}>
      <StatusButton 
        label="OSNAP" 
        toggle={osnap} 
        fkey="F11"
        description="Object Snap - Snap to object points"
      />
      <StatusButton 
        label="GRID" 
        toggle={grid} 
        fkey="F7"
        description="Grid Display - Show/hide grid"
      />
      <StatusButton 
        label="SNAP" 
        toggle={snap} 
        fkey="F9"
        description="Grid Snap - Snap to grid points"
      />
      <StatusButton 
        label="ORTHO" 
        toggle={ortho} 
        fkey="F8"
        description="Orthogonal Mode - Constrain to 0/90/180/270 degrees"
      />
      <StatusButton 
        label="POLAR" 
        toggle={polar} 
        fkey="F10"
        description="Polar Tracking - Track along polar angles"
      />
      <StatusButton 
        label="DYN" 
        toggle={dynInput} 
        fkey="F12"
        description="Dynamic Input - Show coordinates near cursor"
      />

      {/* Status info */}
      <div style={canvasUI.positioning.cadStatusBar.statusInfo}>
        CAD Mode | Press F-keys for shortcuts
      </div>
    </div>
  );
}

