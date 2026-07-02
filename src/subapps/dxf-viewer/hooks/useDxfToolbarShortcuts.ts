'use client';

import React from 'react';
import { matchesShortcut, DXF_GUIDE_CHORD_MAP, GUIDE_CHORD_TIMEOUT_MS } from '../config/keyboard-shortcuts';
import { DXF_TIMING } from '../config/dxf-timing';
import type { ToolType } from '../ui/toolbar/types';
import type { WallKind, WallCategory } from '../bim/types/wall-types';
import {
  MultiCharKeySequence,
  type ChordDefinition,
  type FallbackDefinition,
} from '../keyboard/MultiCharKeySequence';
import { EventBus } from '../systems/events/EventBus';

// ADR-363 Phase 7: BIM multi-char hotkeys — AutoCAD command-line pattern.
// Leader keys open a 350ms window; second key within window resolves to a tool.
// Leader key alone fires its fallback (e.g. S → select, C → circle, O → layering).
const BIM_CHORD_TIMEOUT_MS = DXF_TIMING.gesture.CHORD_TIMEOUT; // ADR-516

const BIM_CHORDS: readonly ChordDefinition[] = [
  { firstKey: 'S', secondKey: 'T', action: 'tool:stair' },       // S+T → stair     (ADR-358)
  { firstKey: 'S', secondKey: 'L', action: 'tool:slab' },        // S+L → slab      (ADR-363)
  { firstKey: 'O', secondKey: 'P', action: 'tool:opening' },     // O+P → opening   (ADR-363)
  { firstKey: 'C', secondKey: 'L', action: 'tool:column' },      // C+L → column    (ADR-363)
  { firstKey: 'C', secondKey: 'O', action: 'tool:bim-copy' },    // C+O → BIM copy  (ADR-466: frees Ctrl+C for clipboard)
  { firstKey: 'B', secondKey: 'M', action: 'tool:beam' },        // B+M → beam      (ADR-363)
  // ADR-363 Phase 7B — wall variant chords: W+n activates wall tool + sets kind
  { firstKey: 'W', secondKey: '1', action: 'tool:wall:straight' }, // W+1 → wall straight
  { firstKey: 'W', secondKey: '2', action: 'tool:wall:curved' },   // W+2 → wall curved
  { firstKey: 'W', secondKey: '3', action: 'tool:wall:polyline' }, // W+3 → wall polyline
  { firstKey: 'W', secondKey: '4', action: 'tool:wall:arc' },      // W+4 → wall arc (ADR-565)
  // ADR-363 Phase A — wall category chords: W+letter activates wall tool + sets category
  { firstKey: 'W', secondKey: 'E', action: 'wall:category:exterior' },  // W+E → exterior
  { firstKey: 'W', secondKey: 'I', action: 'wall:category:interior' },  // W+I → interior
  { firstKey: 'W', secondKey: 'P', action: 'wall:category:parapet' },   // W+P → parapet
  { firstKey: 'W', secondKey: 'F', action: 'wall:category:fence' },     // W+F → fence
  { firstKey: 'W', secondKey: 'T', action: 'wall:category:partition' }, // W+T → partition
];

const BIM_FALLBACKS: readonly FallbackDefinition[] = [
  { firstKey: 'S', action: 'tool:select' },   // S alone → select
  { firstKey: 'O', action: 'tool:layering' }, // O alone → layering
  { firstKey: 'C', action: 'tool:circle' },   // C alone → circle
  { firstKey: 'W', action: 'tool:wall' },     // W alone → wall (Phase 7B: W moved to BIM chord table)
  // B has no fallback (no existing single-B shortcut)
];

export function useDxfToolbarShortcuts(
  activeTool: ToolType,
  onToolChange: (tool: ToolType) => void,
  onAction: (action: string, data?: number | string | Record<string, unknown>) => void,
): void {
  const chordRef = React.useRef<{ timer: ReturnType<typeof setTimeout> } | null>(null);

  // Stable ref so MultiCharKeySequence timeout callbacks always read latest functions
  const callbacksRef = React.useRef({ onToolChange, activeTool });
  callbacksRef.current = { onToolChange, activeTool };

  // BIM multi-char dispatcher — created once, outlives re-renders
  const bimDispatcherRef = React.useRef<MultiCharKeySequence | null>(null);
  if (!bimDispatcherRef.current) {
    bimDispatcherRef.current = new MultiCharKeySequence(
      BIM_CHORDS, BIM_FALLBACKS, BIM_CHORD_TIMEOUT_MS,
      (action) => {
        if (!action) return;
        const { onToolChange: otc, activeTool: at } = callbacksRef.current;
        if (action === 'tool:layering') {
          otc(at === 'layering' ? 'select' : 'layering');
        } else if (action.startsWith('tool:')) {
          otc(action.slice(5) as ToolType);
        }
      },
    );
  }

  React.useEffect(() => {
    return () => {
      if (chordRef.current) {
        clearTimeout(chordRef.current.timer);
        chordRef.current = null;
      }
      bimDispatcherRef.current?.destroy();
      bimDispatcherRef.current = null;
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

      // ADR-189: Guide chord resolution (G → X/Z/P/D/V/...)
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

      // ADR-363 Phase 7: BIM multi-char dispatcher — only intercepts unmodified keys.
      // Handles: S→select/stair/slab, O→layering/opening, C→circle/column, B→beam.
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const bimResult = bimDispatcherRef.current!.feed(e.key.toUpperCase());

        if (bimResult.kind === 'chord-started') {
          e.preventDefault();
          return;
        }

        if (bimResult.kind === 'chord-completed') {
          e.preventDefault();
          const action = bimResult.action;
          // ADR-565: W+4 → circular-arc wall. The arc IS the `curved` kind (the
          // `arc` bulge field), so it maps to kind 'curved' — a dedicated,
          // discoverable chord distinct from W+2.
          if (action === 'tool:wall:arc') {
            handleToolChange('wall');
            EventBus.emit('bim:set-wall-kind', { kind: 'curved' });
          // ADR-363 Phase 7B: wall variant chords emit EventBus kind change + activate tool.
          } else if (action === 'tool:wall:straight' || action === 'tool:wall:curved' || action === 'tool:wall:polyline') {
            const wallKind = action.slice('tool:wall:'.length) as WallKind;
            handleToolChange('wall');
            EventBus.emit('bim:set-wall-kind', { kind: wallKind });
          // ADR-363 Phase A: wall category chords emit EventBus category change + activate tool.
          } else if (action.startsWith('wall:category:')) {
            const category = action.slice('wall:category:'.length) as WallCategory;
            handleToolChange('wall');
            EventBus.emit('bim:set-wall-category', { category });
          } else if (action.startsWith('tool:')) {
            handleToolChange(action.slice(5) as ToolType);
          }
          return;
        }

        if (bimResult.kind === 'fallback-fired') {
          const { fallbackAction } = bimResult;
          if (fallbackAction?.startsWith('tool:')) {
            handleToolChange(fallbackAction.slice(5) as ToolType);
          }
          // DO NOT return — fall through to process the current key via other shortcuts
        }
        // 'miss' falls through to normal shortcut checks below
      }

      if (matchesShortcut(e, 'undo')) { e.preventDefault(); onAction('undo'); return; }
      if (matchesShortcut(e, 'redo')) { e.preventDefault(); onAction('redo'); return; }
      if (matchesShortcut(e, 'redoAlt')) { e.preventDefault(); onAction('redo'); return; }
      // ADR-466 — Ctrl+C / Ctrl+V clipboard (works in selection-capable tools).
      if (matchesShortcut(e, 'copy') && (activeTool === 'select' || activeTool === 'grip-edit')) { e.preventDefault(); onAction('clipboard-copy'); return; }
      if (matchesShortcut(e, 'paste')) { e.preventDefault(); onAction('clipboard-paste'); return; }
      if (matchesShortcut(e, 'selectAll')) { e.preventDefault(); onAction('select-all'); return; }
      if (matchesShortcut(e, 'toggleLayers')) { e.preventDefault(); onAction('toggle-layers'); return; }
      if (matchesShortcut(e, 'toggleProperties')) { e.preventDefault(); onAction('toggle-properties'); return; }
      if (matchesShortcut(e, 'export')) { e.preventDefault(); onAction('export'); return; }
      // Note: S (select), C (circle), O (layering), W (wall) are now via bimDispatcher above.
      if (matchesShortcut(e, 'pan')) { e.preventDefault(); handleToolChange('pan'); return; }
      if (matchesShortcut(e, 'line')) { e.preventDefault(); handleToolChange('line'); return; }
      if (matchesShortcut(e, 'rectangle')) { e.preventDefault(); handleToolChange('rectangle'); return; }
      if (matchesShortcut(e, 'polyline')) { e.preventDefault(); handleToolChange('polyline'); return; }
      if (matchesShortcut(e, 'polygon')) { e.preventDefault(); handleToolChange('polygon'); return; }
      if (matchesShortcut(e, 'hatch')) { e.preventDefault(); handleToolChange('hatch'); return; }
      if (matchesShortcut(e, 'move')) { e.preventDefault(); handleToolChange('move'); return; }
      // ADR-363 Phase 7B: D key = door kind when opening tool active; falls through to
      // measureDistance otherwise — no conflict in any other tool context.
      if (!e.ctrlKey && !e.metaKey && !e.altKey && activeTool === 'opening' && e.key.toUpperCase() === 'D') {
        e.preventDefault();
        EventBus.emit('bim:set-opening-kind', { kind: 'door' });
        return;
      }
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
