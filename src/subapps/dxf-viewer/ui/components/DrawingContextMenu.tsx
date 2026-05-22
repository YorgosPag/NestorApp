'use client';

/**
 * 🏢 ENTERPRISE: DrawingContextMenu Component
 * AutoCAD/BricsCAD-style right-click context menu for drawing tools
 *
 * Features:
 * - Enter: Finish current drawing (polyline/polygon/continuous measurement)
 * - Close: Close polygon (connect last to first point)
 * - Undo: Remove last point
 * - Cancel: Cancel current drawing (ESC)
 *
 * 🏢 PERF (2026-02-19): Imperative handle pattern — parent calls open(x,y)
 * instead of passing isOpen/position props. This prevents re-rendering the
 * entire CanvasLayerStack when the menu opens (saved ~94ms per right-click).
 *
 * @see ADR-047: Drawing Tool Keyboard Shortcuts & Context Menu
 * @see ADR-053 in docs/centralized-systems/reference/adr-index.md
 * @see DxfContextMenu — shared context menu SSoT
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2026-01-30
 * @version 3.0.0
 */

import React, { useCallback, useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import type { SnapOverrideMode } from '../../snapping/overrides/SnapOverrideOrchestrator';
import type { ToolType } from '../toolbar/types';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DxfMenuContent,
  DxfMenuSubContent,
  DxfMenuItem,
  DxfMenuSubTrigger,
  DxfMenuSeparator,
  DxfMenuHiddenTrigger,
  DxfMenuIcon,
  DxfMenuLabel,
  DxfMenuShortcut,
} from './dxf-context-menu';
import {
  EnterIcon,
  ClosePolygonIcon,
  UndoIcon,
  CancelIcon,
  FlipArcIcon,
} from '../icons/MenuIcons';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// ===== TYPES =====

/** Imperative handle exposed via ref — parent calls open() to show menu */
export interface DrawingContextMenuHandle {
  open: (x: number, y: number) => void;
  close: () => void;
}

interface DrawingContextMenuProps {
  /** Current active drawing tool */
  activeTool: ToolType;
  /** Number of points in current drawing */
  pointCount: number;
  /** Callback for Enter/Finish action */
  onFinish: () => void;
  /** Callback for Close polygon action */
  onClose?: () => void;
  /** Callback for Undo last point action */
  onUndoLastPoint?: () => void;
  /** Callback for Cancel action */
  onCancel: () => void;
  /** 🏢 ENTERPRISE (2026-01-31): Callback for Flip Arc direction */
  onFlipArc?: () => void;
  /** ADR-357 Phase 7: Snap Override — activates single-use engine override */
  onSnapOverride?: (mode: SnapOverrideMode) => void;
}

// ADR-357 Phase 7: Single-use engine overrides available in the Snap Override submenu.
const SNAP_OVERRIDE_ENGINES: ReadonlyArray<{ type: string; labelKey: string }> = [
  { type: 'endpoint',     labelKey: 'snapModes.labels.endpoint' },
  { type: 'midpoint',     labelKey: 'snapModes.labels.midpoint' },
  { type: 'center',       labelKey: 'snapModes.labels.center' },
  { type: 'intersection', labelKey: 'snapModes.labels.intersection' },
  { type: 'perpendicular',labelKey: 'snapModes.labels.perpendicular' },
  { type: 'tangent',      labelKey: 'snapModes.labels.tangent' },
  { type: 'quadrant',     labelKey: 'snapModes.labels.quadrant' },
  { type: 'nearest',      labelKey: 'snapModes.labels.nearest' },
] as const;

// ===== HELPERS =====

function supportsClose(tool: ToolType): boolean {
  return tool === 'polygon' || tool === 'measure-area';
}

function getMinPointsForFinish(tool: ToolType): number {
  if (tool === 'measure-distance-continuous') return 0;
  if (tool === 'polygon' || tool === 'measure-area') return 3;
  if (tool === 'measure-angle') return 3;
  if (tool === 'circle-best-fit') return 3;
  if (tool === 'line') return 1;
  return 2;
}

function isArcTool(tool: ToolType): boolean {
  return tool === 'arc-3p' || tool === 'arc-cse' || tool === 'arc-sce';
}

// ===== MAIN COMPONENT =====

const DrawingContextMenuInner = forwardRef<DrawingContextMenuHandle, DrawingContextMenuProps>(({
  activeTool,
  pointCount,
  onFinish,
  onClose,
  onUndoLastPoint,
  onCancel,
  onFlipArc,
  onSnapOverride,
}, ref) => {
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useImperativeHandle(ref, () => ({
    open: (x: number, y: number) => {
      if (triggerRef.current) {
        triggerRef.current.style.left = `${x}px`;
        triggerRef.current.style.top = `${y}px`;
      }
      setIsOpen(true);
    },
    close: () => setIsOpen(false),
  }), []);

  const handleOpenChange = useCallback((open: boolean) => { setIsOpen(open); }, []);
  const handleFinish = useCallback(() => { onFinish(); setIsOpen(false); }, [onFinish]);
  const handleClose = useCallback(() => { (onClose ?? onFinish)(); setIsOpen(false); }, [onClose, onFinish]);
  const handleUndo = useCallback(() => { onUndoLastPoint?.(); setIsOpen(false); }, [onUndoLastPoint]);
  const handleCancel = useCallback(() => { onCancel(); setIsOpen(false); }, [onCancel]);
  const handleFlipArc = useCallback(() => { onFlipArc?.(); setIsOpen(false); }, [onFlipArc]);
  const handleSnapOverride = useCallback((mode: SnapOverrideMode) => { onSnapOverride?.(mode); setIsOpen(false); }, [onSnapOverride]);

  const prevToolRef = useRef(activeTool);
  useEffect(() => {
    if (prevToolRef.current !== activeTool && isOpen) setIsOpen(false);
    prevToolRef.current = activeTool;
  }, [activeTool, isOpen]);

  const canFinish = pointCount >= getMinPointsForFinish(activeTool);
  const canClose = supportsClose(activeTool) && pointCount >= 3;
  const canUndo = pointCount > 0 && onUndoLastPoint !== undefined;
  const showCloseOption = supportsClose(activeTool);
  const showFlipArcOption = isArcTool(activeTool) && pointCount >= 2 && onFlipArc !== undefined;
  const showSnapOverride = activeTool === 'line' && pointCount >= 1 && onSnapOverride !== undefined;

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <DxfMenuHiddenTrigger ref={triggerRef} />
      </DropdownMenuTrigger>
      <DxfMenuContent>
        <DxfMenuItem onClick={handleFinish} disabled={!canFinish}>
          <DxfMenuIcon><EnterIcon /></DxfMenuIcon>
          <DxfMenuLabel>Enter</DxfMenuLabel>
          <DxfMenuShortcut>Enter</DxfMenuShortcut>
        </DxfMenuItem>

        {showCloseOption && (
          <DxfMenuItem onClick={handleClose} disabled={!canClose}>
            <DxfMenuIcon><ClosePolygonIcon /></DxfMenuIcon>
            <DxfMenuLabel>Close</DxfMenuLabel>
            <DxfMenuShortcut>C</DxfMenuShortcut>
          </DxfMenuItem>
        )}

        {showFlipArcOption && (
          <DxfMenuItem onClick={handleFlipArc}>
            <DxfMenuIcon><FlipArcIcon /></DxfMenuIcon>
            <DxfMenuLabel>{t('contextMenu.flipArc')}</DxfMenuLabel>
            <DxfMenuShortcut>X</DxfMenuShortcut>
          </DxfMenuItem>
        )}

        <DxfMenuSeparator />

        <DxfMenuItem onClick={handleUndo} disabled={!canUndo}>
          <DxfMenuIcon><UndoIcon /></DxfMenuIcon>
          <DxfMenuLabel>Undo</DxfMenuLabel>
          <DxfMenuShortcut>U</DxfMenuShortcut>
        </DxfMenuItem>

        {showSnapOverride && (
          <>
            <DxfMenuSeparator />
            <DropdownMenuSub>
              <DxfMenuSubTrigger>
                <DxfMenuLabel>{t('contextMenu.snapOverride.title')}</DxfMenuLabel>
                <DxfMenuShortcut>▶</DxfMenuShortcut>
              </DxfMenuSubTrigger>
              <DxfMenuSubContent>
                <DxfMenuItem onClick={() => handleSnapOverride('from')}>
                  <DxfMenuLabel>{t('contextMenu.snapOverride.from')}</DxfMenuLabel>
                </DxfMenuItem>
                <DxfMenuItem onClick={() => handleSnapOverride('m2p')}>
                  <DxfMenuLabel>{t('contextMenu.snapOverride.m2p')}</DxfMenuLabel>
                </DxfMenuItem>
                <DxfMenuItem onClick={() => handleSnapOverride('app')}>
                  <DxfMenuLabel>{t('contextMenu.snapOverride.app')}</DxfMenuLabel>
                </DxfMenuItem>
                <DxfMenuSeparator />
                {SNAP_OVERRIDE_ENGINES.map(engine => (
                  <DxfMenuItem key={engine.type} onClick={() => handleSnapOverride(engine.type)}>
                    <DxfMenuLabel>
                      {t(engine.labelKey)} ({t('contextMenu.snapOverride.once')})
                    </DxfMenuLabel>
                  </DxfMenuItem>
                ))}
              </DxfMenuSubContent>
            </DropdownMenuSub>
          </>
        )}

        <DxfMenuSeparator />

        <DxfMenuItem onClick={handleCancel}>
          <DxfMenuIcon><CancelIcon /></DxfMenuIcon>
          <DxfMenuLabel>Cancel</DxfMenuLabel>
          <DxfMenuShortcut>Esc</DxfMenuShortcut>
        </DxfMenuItem>
      </DxfMenuContent>
    </DropdownMenu>
  );
});

DrawingContextMenuInner.displayName = 'DrawingContextMenu';

export default DrawingContextMenuInner;
export { DrawingContextMenuInner as DrawingContextMenu };
export type { DrawingContextMenuProps };
