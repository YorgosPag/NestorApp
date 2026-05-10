'use client';
import React, { useEffect } from 'react';
import { canvasUI } from '@/styles/design-tokens/canvas';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { matchesShortcut, getShortcutDisplayLabel } from '../config/keyboard-shortcuts';
import { useCadToggles } from '../hooks/common/useCadToggles';
import type { CadToggle } from '../hooks/common/useCadToggles';

export default function CadStatusBar() {
  const { osnap, grid, snap, ortho, polar, dynInput } = useCadToggles();

  // F7–F12 keyboard shortcuts (AutoCAD standard)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }
      if (matchesShortcut(e, 'gridDisplay'))   { e.preventDefault(); grid.toggle();     return; }
      if (matchesShortcut(e, 'orthoMode'))     { e.preventDefault(); ortho.toggle();    return; }
      if (matchesShortcut(e, 'gridSnap'))      { e.preventDefault(); snap.toggle();     return; }
      if (matchesShortcut(e, 'polarTracking')) { e.preventDefault(); polar.toggle();    return; }
      if (matchesShortcut(e, 'objectSnap'))    { e.preventDefault(); osnap.toggle();    return; }
      if (matchesShortcut(e, 'dynamicInput'))  { e.preventDefault(); dynInput.toggle(); return; }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [osnap, grid, snap, ortho, polar, dynInput]);

  return (
    <TooltipProvider>
      <div data-testid="cad-status-bar" style={canvasUI.positioning.cadStatusBar.container}>
        <StatusButton label="OSNAP" toggle={osnap}    fkey={getShortcutDisplayLabel('objectSnap')}    description="Object Snap" />
        <StatusButton label="GRID"  toggle={grid}     fkey={getShortcutDisplayLabel('gridDisplay')}   description="Grid Display" />
        <StatusButton label="SNAP"  toggle={snap}     fkey={getShortcutDisplayLabel('gridSnap')}      description="Grid Snap" />
        <StatusButton label="ORTHO" toggle={ortho}    fkey={getShortcutDisplayLabel('orthoMode')}     description="Orthogonal Mode" />
        <StatusButton label="POLAR" toggle={polar}    fkey={getShortcutDisplayLabel('polarTracking')} description="Polar Tracking" />
        <StatusButton label="DYN"   toggle={dynInput} fkey={getShortcutDisplayLabel('dynamicInput')}  description="Dynamic Input" />
        <div style={canvasUI.positioning.cadStatusBar.statusInfo}>
          CAD Mode | F-keys
        </div>
      </div>
    </TooltipProvider>
  );
}

function StatusButton({ label, toggle, fkey, description }: {
  label: string;
  toggle: CadToggle;
  fkey: string;
  description: string;
}) {
  return (
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
}
