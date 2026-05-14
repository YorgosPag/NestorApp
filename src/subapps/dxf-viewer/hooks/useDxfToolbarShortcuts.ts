'use client';

import React from 'react';
import { matchesShortcut, DXF_GUIDE_CHORD_MAP, GUIDE_CHORD_TIMEOUT_MS } from '../config/keyboard-shortcuts';
import type { ToolType } from '../ui/toolbar/types';

export function useDxfToolbarShortcuts(
  activeTool: ToolType,
  onToolChange: (tool: ToolType) => void,
  onAction: (action: string, data?: number | string | Record<string, unknown>) => void,
): void {
  const chordRef = React.useRef<{ timer: ReturnType<typeof setTimeout> } | null>(null);

  React.useEffect(() => {
    return () => {
      if (chordRef.current) {
        clearTimeout(chordRef.current.timer);
        chordRef.current = null;
      }
    };
  }, []);

  const handleToolChange = React.useCallback((tool: ToolType) => {
    if (tool === 'zoom-in') { onAction('zoom-in'); return; }
    if (tool === 'zoom-out') { onAction('zoom-out'); return; }
    if (tool === 'zoom-window') { onAction('zoom-window'); return; }
    if (tool === 'zoom-extents') { onAction('fit-to-view'); return; }
    if (tool === 'layering') {
      if (activeTool === 'layering') { onToolChange('select'); } else { onToolChange(tool); }
      return;
    }
    if (tool === 'grip-edit') { onToolChange(tool); onAction('grip-edit'); return; }
    onToolChange(tool);
  }, [activeTool, onToolChange, onAction]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

      // ADR-189: Guide chord resolution (G → X/Z/P/D/V)
      if (chordRef.current) {
        clearTimeout(chordRef.current.timer);
        chordRef.current = null;
        const secondKey = e.key.toUpperCase();
        const chordEntry = DXF_GUIDE_CHORD_MAP[secondKey];
        if (chordEntry) {
          e.preventDefault();
          if (chordEntry.toolType) {
            handleToolChange(chordEntry.toolType);
          } else {
            onAction(chordEntry.action.replace('action:', ''));
          }
          return;
        }
        handleToolChange('grip-edit');
      }

      if (matchesShortcut(e, 'undo')) { e.preventDefault(); onAction('undo'); return; }
      if (matchesShortcut(e, 'redo')) { e.preventDefault(); onAction('redo'); return; }
      if (matchesShortcut(e, 'redoAlt')) { e.preventDefault(); onAction('redo'); return; }
      if (matchesShortcut(e, 'copy') && activeTool === 'select') { e.preventDefault(); onAction('copy-selected'); return; }
      if (matchesShortcut(e, 'selectAll')) { e.preventDefault(); onAction('select-all'); return; }
      if (matchesShortcut(e, 'toggleLayers')) { e.preventDefault(); onAction('toggle-layers'); return; }
      if (matchesShortcut(e, 'toggleProperties')) { e.preventDefault(); onAction('toggle-properties'); return; }
      if (matchesShortcut(e, 'export')) { e.preventDefault(); onAction('export'); return; }
      if (matchesShortcut(e, 'select')) { e.preventDefault(); handleToolChange('select'); return; }
      if (matchesShortcut(e, 'pan')) { e.preventDefault(); handleToolChange('pan'); return; }
      if (matchesShortcut(e, 'line')) { e.preventDefault(); handleToolChange('line'); return; }
      if (matchesShortcut(e, 'rectangle')) { e.preventDefault(); handleToolChange('rectangle'); return; }
      if (matchesShortcut(e, 'circle')) { e.preventDefault(); handleToolChange('circle'); return; }
      if (matchesShortcut(e, 'polyline')) { e.preventDefault(); handleToolChange('polyline'); return; }
      if (matchesShortcut(e, 'polygon')) { e.preventDefault(); handleToolChange('polygon'); return; }
      if (matchesShortcut(e, 'move')) { e.preventDefault(); handleToolChange('move'); return; }
      if (matchesShortcut(e, 'measureDistance')) { e.preventDefault(); handleToolChange('measure-distance'); return; }
      if (matchesShortcut(e, 'measureArea')) { e.preventDefault(); handleToolChange('measure-area'); return; }
      if (matchesShortcut(e, 'measureAngle')) { e.preventDefault(); handleToolChange('measure-angle'); return; }
      if (matchesShortcut(e, 'zoomWindow')) { e.preventDefault(); handleToolChange('zoom-window' as ToolType); return; }

      // ADR-189: G key starts chord window, fallback to grip-edit after timeout
      if (matchesShortcut(e, 'gripEdit')) {
        e.preventDefault();
        chordRef.current = {
          timer: setTimeout(() => {
            if (chordRef.current) {
              chordRef.current = null;
              handleToolChange('grip-edit');
            }
          }, GUIDE_CHORD_TIMEOUT_MS),
        };
        return;
      }
      if (matchesShortcut(e, 'layering')) { e.preventDefault(); handleToolChange('layering'); return; }
      if (matchesShortcut(e, 'grid')) { e.preventDefault(); onAction('grid'); return; }
      if (matchesShortcut(e, 'fit')) { e.preventDefault(); onAction('fit'); return; }
      if (matchesShortcut(e, 'autocrop')) { e.preventDefault(); onAction('autocrop'); return; }
      if (matchesShortcut(e, 'escape')) {
        e.preventDefault();
        handleToolChange('select');
        onAction('clear-selection');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, handleToolChange, onAction]);
}
