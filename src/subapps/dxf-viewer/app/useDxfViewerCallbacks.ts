'use client';

/**
 * useDxfViewerCallbacks — All useCallback/useMemo extracted from DxfViewerContent.
 * ADR-065 SRP split: callbacks module.
 *
 * Related files:
 * - DxfViewerContent.tsx (main orchestrator)
 * - useDxfViewerEffects.ts (useEffect subscriptions)
 */

import React from 'react';
import { UI_COLORS } from '../config/color-config';
import { PANEL_LAYOUT } from '../config/panel-tokens';
import { COORDINATE_LAYOUT } from '../rendering/core/CoordinateTransforms';
import type { ViewTransform, Point2D } from '../rendering/types/Types';
import type { CircleEntity, ArcEntity, PolylineEntity, SceneModel } from '../types/scene';
import type { DxfSaveContext } from '../services/dxf-firestore.service';
import type { FloatingPanelHandle } from '../ui/FloatingPanelContainer';
import type { NotificationContextValue } from '@/types/notifications';

/** Structural overlay entry shape used by callbacks */
interface OverlayEntry {
  status?: string;
  kind: string;
  levelId?: string;
}

/** Params for useDxfViewerCallbacks */
export interface DxfViewerCallbacksParams {
  notifications: NotificationContextValue;
  copyToClipboard: (text: string) => Promise<boolean>;
  handleAction: (action: string, data?: string | number | Record<string, unknown>) => void;
  togglePerfMonitor: () => void;
  perfMonitorEnabled: boolean;
  fullscreen: { toggle: () => void };
  setTestsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPdfPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setAiChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCanvasTransform: (t: { scale: number; offsetX: number; offsetY: number }) => void;
  contextSetTransformRef: React.MutableRefObject<((t: ViewTransform) => void) | null>;
  currentScene: SceneModel | undefined;
  selectedEntityIds: string[];
  handleSceneChange: (scene: SceneModel) => void;
  handleFileImport: (file: File, encoding?: string, saveContext?: DxfSaveContext) => void;
  levelManager: {
    currentLevelId: string | null;
    getLevelScene: (id: string) => SceneModel | undefined;
    setLevelScene: (id: string, scene: SceneModel) => void;
    addLevel: (name: string, setAsCurrent: boolean) => Promise<string | null>;
    setCurrentLevel: (id: string) => void;
  };
  overlayStore: {
    overlays: Record<string, OverlayEntry>;
    setCurrentLevel: (id: string | null) => void;
  };
  universalSelection: {
    select: (id: string, type: string) => void;
    clearByType: (type: string) => void;
  };
  setOverlayStatus: (s: string) => void;
  setOverlayKind: (k: string) => void;
  showLayers: boolean;
  floatingRef: React.RefObject<FloatingPanelHandle | null>;
}

/** Return type of useDxfViewerCallbacks */
export interface DxfViewerCallbacksReturn {
  showCopyableNotification: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  wrappedHandleAction: (action: string, data?: string | number | Record<string, unknown>) => void;
  handleTransformReady: (setTransform: (t: ViewTransform) => void) => void;
  wrappedHandleTransformChange: (transform: ViewTransform) => void;
  panToWorldOrigin: () => void;
  handleFileImportWithEncoding: (file: File, encoding?: string, saveContext?: DxfSaveContext) => Promise<void>;
  handleRegionClick: (regionId: string) => void;
  nudgeSelection: (dx: number, dy: number) => void;
  selectionIdSet: Set<string>;
}

/**
 * Custom hook extracting all useCallback/useMemo definitions from DxfViewerContent.
 * ADR-065 SRP split.
 */
export function useDxfViewerCallbacks(params: DxfViewerCallbacksParams): DxfViewerCallbacksReturn {
  const {
    notifications, copyToClipboard, handleAction,
    togglePerfMonitor, perfMonitorEnabled, fullscreen,
    setTestsModalOpen, setPdfPanelOpen, setAiChatOpen,
    setCanvasTransform, contextSetTransformRef,
    currentScene, selectedEntityIds, handleSceneChange,
    handleFileImport, levelManager, overlayStore,
    universalSelection, setOverlayStatus, setOverlayKind,
    showLayers, floatingRef,
  } = params;

  // ✅ PERFORMANCE: Memoize copyable notification
  const showCopyableNotification = React.useCallback((message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    const notifyMethod = notifications[type];
    notifyMethod(message, {
      duration: 5000,
      actions: [{
        label: 'Αντιγραφή',
        onClick: async () => {
          const success = await copyToClipboard(message);
          if (success) {
            notifications.success('Αντιγράφηκε στο πρόχειρο!', { duration: 2000 });
          } else {
            notifications.error('Αποτυχία αντιγραφής');
          }
        }
      }]
    });
  }, [notifications, copyToClipboard]);

  // 🧪 WRAP handleAction to intercept special actions
  const wrappedHandleAction = React.useCallback((action: string, data?: string | number | Record<string, unknown>) => {
    if (action === 'run-tests') {
      setTestsModalOpen(true);
      return;
    }
    // 🏢 ENTERPRISE: Performance Monitor Toggle (Bentley/Autodesk pattern)
    if (action === 'toggle-perf') {
      togglePerfMonitor();
      const newState = !perfMonitorEnabled;
      notifications.success(
        `Performance Monitor: ${newState ? 'ON ✅' : 'OFF ❌'}`,
        { content: newState ? 'Μετρήσεις FPS, Memory, Rendering ενεργές' : 'Καλύτερη απόδοση - παρακολούθηση απενεργοποιημένη' }
      );
      return;
    }
    // 🏢 PDF BACKGROUND: Toggle PDF controls panel
    if (action === 'toggle-pdf-background') {
      setPdfPanelOpen(prev => !prev);
      return;
    }
    // 🤖 ADR-185: Toggle AI Drawing Assistant
    if (action === 'toggle-ai-assistant') {
      setAiChatOpen(prev => !prev);
      return;
    }
    // 🏢 ADR-241: Fullscreen toggle (Portal-based, zero remount)
    if (action === 'toggle-fullscreen') {
      fullscreen.toggle();
      return;
    }
    // Pass all other actions to original handleAction
    handleAction(action, data);
  }, [handleAction, togglePerfMonitor, perfMonitorEnabled, notifications, fullscreen,
      setTestsModalOpen, setPdfPanelOpen, setAiChatOpen]);

  // ✅ STABLE CALLBACK: handleTransformReady
  const handleTransformReady = React.useCallback((setTransform: (t: ViewTransform) => void) => {
    contextSetTransformRef.current = setTransform;
  }, [contextSetTransformRef]);

  // Wrap handleTransformChange to also update canvasTransform state
  const wrappedHandleTransformChange = React.useCallback((transform: ViewTransform) => {
    const normalizedTransform = {
      scale: transform.scale || 1,
      offsetX: transform.offsetX || 0,
      offsetY: transform.offsetY || 0,
    };
    // Update the canvas transform state for OverlayLayer
    setCanvasTransform(normalizedTransform);
    // ✅ UPDATE CONTEXT: Ενημέρωση του Transform Context (Single Source of Truth)
    if (contextSetTransformRef.current) {
      contextSetTransformRef.current(normalizedTransform);
    }
  }, [setCanvasTransform, contextSetTransformRef]);

  // 🏠 PAN TO WORLD ORIGIN (0,0) - Function for DebugToolbar
  const panToWorldOrigin = React.useCallback(() => {
    const canvasElement = document.querySelector('[data-canvas-type="dxf"]') as HTMLCanvasElement;
    if (!canvasElement) {
      showCopyableNotification('Canvas not found', 'error');
      return;
    }

    // ✅ FIX: Use DISPLAY size (CSS pixels), not internal canvas resolution!
    const rect = canvasElement.getBoundingClientRect();
    const viewport = { width: rect.width, height: rect.height };

    // 🏢 ENTERPRISE FIX (2026-01-27): ADR-045 - Use CENTRALIZED margins
    const MARGIN_LEFT = COORDINATE_LAYOUT.MARGINS.left;
    const MARGIN_TOP = COORDINATE_LAYOUT.MARGINS.top;

    const screenCenterX = viewport.width / 2;
    const screenCenterY = viewport.height / 2;
    const newOffsetX = screenCenterX - MARGIN_LEFT;
    const newOffsetY = (viewport.height - MARGIN_TOP) - screenCenterY;

    const newTransform: ViewTransform = { scale: 1, offsetX: newOffsetX, offsetY: newOffsetY };
    wrappedHandleTransformChange(newTransform);

    // 🎯 SHOW VISUAL INDICATOR: Pulsing crosshair at center
    const canvasX = MARGIN_LEFT + newOffsetX;
    const canvasY = (viewport.height - MARGIN_TOP) - newOffsetY;
    const finalScreenX = rect.left + canvasX;
    const finalScreenY = rect.top + canvasY;

    createOriginIndicatorOverlay(finalScreenX, finalScreenY);

    showCopyableNotification(
      `Panned to World Origin (0,0)\n\n` +
      `🎯 World (0,0) is now at screen center\n` +
      `📐 Screen Position: (${finalScreenX.toFixed(1)}, ${finalScreenY.toFixed(1)})\n` +
      `🔍 Transform: offset=(${newOffsetX.toFixed(1)}, ${newOffsetY.toFixed(1)})`,
      'success'
    );
  }, [wrappedHandleTransformChange, showCopyableNotification]);

  // 🏢 ADR-240: Wrapper για handleFileImport with encoding + saveContext
  const handleFileImportWithEncoding = React.useCallback(async (file: File, encoding?: string, saveContext?: DxfSaveContext) => {
    try {
      // 🔺 USE EXISTING LEVEL instead of creating new one
      const currentLevel = levelManager.currentLevelId;

      if (currentLevel) {
        overlayStore.setCurrentLevel(currentLevel);
        handleFileImport(file, undefined, saveContext);
      } else {
        console.warn('⚠️ [Enhanced Import] No current level found, creating default level');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '');
        const newLevelName = `${file.name.replace('.dxf', '')}_${timestamp}`;
        const newLevelId = await levelManager.addLevel(newLevelName, true);
        if (newLevelId) {
          overlayStore.setCurrentLevel(newLevelId);
          handleFileImport(file, undefined, saveContext);
        } else {
          console.error('❌ [Enhanced Import] Failed to create new level');
          return;
        }
      }
    } catch (error) {
      console.error('⛔ [Enhanced Import] Error in enhanced DXF import:', error);
      handleFileImport(file, undefined, saveContext);
    }
  }, [levelManager, overlayStore, handleFileImport]);

  // Handle overlay region click
  const handleRegionClick = React.useCallback((regionId: string) => {
    // 🏢 ENTERPRISE (2026-01-25): Use universal selection system - ADR-030
    universalSelection.select(regionId, 'overlay');

    // Auto-open levels tab when clicking on overlay in canvas
    floatingRef.current?.showTab('levels');

    // Update toolbar with selected overlay's status and kind
    const selectedOverlay = overlayStore.overlays[regionId];
    if (selectedOverlay) {
      setOverlayStatus(selectedOverlay.status || 'for-sale');
      setOverlayKind(selectedOverlay.kind);
    }

    if (!showLayers) {
      handleAction('toggle-layers');
    }

    // Auto-expand the project level that contains this overlay
    if (selectedOverlay && selectedOverlay.levelId && selectedOverlay.levelId !== levelManager.currentLevelId) {
      levelManager.setCurrentLevel(selectedOverlay.levelId);
    }
  }, [overlayStore, showLayers, handleAction, levelManager,
      universalSelection, setOverlayStatus, setOverlayKind, floatingRef]);

  // ✅ PERFORMANCE: Memoize selection set to avoid recreating on every call
  const selectionIdSet = React.useMemo(() =>
    new Set(selectedEntityIds || []),
    [selectedEntityIds]
  );

  // ✅ PERFORMANCE: Optimize nudgeSelection with memoized selection set
  const nudgeSelection = React.useCallback((dx: number, dy: number) => {
    if (!currentScene || !selectedEntityIds?.length) return;

    const moved = currentScene.entities.map(e => {
      if (!selectionIdSet.has(e.id)) return e;

      if (e.type === 'line' && e.start && e.end) {
        return {
          ...e,
          start: { x: e.start.x + dx, y: e.start.y + dy },
          end:   { x: e.end.x   + dx, y: e.end.y   + dy }
        };
      }
      if ((e.type === 'circle' || e.type === 'arc') && (e as CircleEntity | ArcEntity).center) {
        const circleOrArc = e as CircleEntity | ArcEntity;
        return { ...e, center: { x: circleOrArc.center.x + dx, y: circleOrArc.center.y + dy } };
      }
      if (e.type === 'polyline' && Array.isArray((e as PolylineEntity).vertices)) {
        const polyline = e as PolylineEntity;
        const pts = polyline.vertices?.map((p: Point2D) => ({ x: p.x + dx, y: p.y + dy })) || [];
        return { ...e, vertices: pts };
      }
      return e;
    });

    const updated = { ...currentScene, entities: moved };
    handleSceneChange(updated);
  }, [currentScene, selectionIdSet, handleSceneChange, selectedEntityIds]);

  return {
    showCopyableNotification,
    wrappedHandleAction,
    handleTransformReady,
    wrappedHandleTransformChange,
    panToWorldOrigin,
    handleFileImportWithEncoding,
    handleRegionClick,
    nudgeSelection,
    selectionIdSet,
  };
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/** Creates a pulsing SVG crosshair overlay at the given screen coordinates */
function createOriginIndicatorOverlay(finalScreenX: number, finalScreenY: number): void {
  const overlay = document.createElement('div');
  overlay.id = 'origin-indicator-overlay';
  overlay.style.cssText = `
    position: fixed;
    left: ${finalScreenX}px;
    top: ${finalScreenY}px;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 10000;
  `;

  overlay.innerHTML = `
    <svg width="200" height="200" style="overflow: visible;">
      <!-- Outer pulsing circle -->
      <circle cx="100" cy="100" r="60" fill="none" stroke={UI_COLORS.BRIGHT_YELLOW} stroke-width="3" opacity="0.8">
        <animate attributeName="r" values="60;80;60" dur="2s" repeatCount="3" />
        <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="3" />
      </circle>

      <!-- Inner pulsing circle -->
      <circle cx="100" cy="100" r="30" fill="none" stroke="${UI_COLORS.BRIGHT_GREEN}" stroke-width="2" opacity="0.9">
        <animate attributeName="r" values="30;50;30" dur="2s" repeatCount="3" />
        <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2s" repeatCount="3" />
      </circle>

      <!-- Crosshair lines -->
      <line x1="100" y1="50" x2="100" y2="150" stroke="${UI_COLORS.SELECTED_RED}" stroke-width="2" opacity="0.9" />
      <line x1="50" y1="100" x2="150" y2="100" stroke="${UI_COLORS.SELECTED_RED}" stroke-width="2" opacity="0.9" />

      <!-- Center dot -->
      <circle cx="100" cy="100" r="5" fill="${UI_COLORS.BRIGHT_YELLOW}" stroke="${UI_COLORS.SELECTED_RED}" stroke-width="1">
        <animate attributeName="r" values="5;8;5" dur="1s" repeatCount="6" />
      </circle>

      <!-- Arrows pointing to center -->
      <path d="M 100 20 L 95 35 L 105 35 Z" fill="${UI_COLORS.BRIGHT_GREEN}" opacity="0.8">
        <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" />
        <animateTransform attributeName="transform" type="translate" values="0 0; 0 10; 0 0" dur="1.5s" repeatCount="indefinite" />
      </path>

      <path d="M 180 100 L 165 95 L 165 105 Z" fill="${UI_COLORS.BRIGHT_GREEN}" opacity="0.8">
        <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" begin="0.375s" />
        <animateTransform attributeName="transform" type="translate" values="0 0; -10 0; 0 0" dur="1.5s" repeatCount="indefinite" begin="0.375s" />
      </path>

      <path d="M 100 180 L 95 165 L 105 165 Z" fill="${UI_COLORS.BRIGHT_GREEN}" opacity="0.8">
        <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" begin="0.75s" />
        <animateTransform attributeName="transform" type="translate" values="0 0; 0 -10; 0 0" dur="1.5s" repeatCount="indefinite" begin="0.75s" />
      </path>

      <path d="M 20 100 L 35 95 L 35 105 Z" fill="${UI_COLORS.BRIGHT_GREEN}" opacity="0.8">
        <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" begin="1.125s" />
        <animateTransform attributeName="transform" type="translate" values="0 0; 10 0; 0 0" dur="1.5s" repeatCount="indefinite" begin="1.125s" />
      </path>

      <!-- Label -->
      <text x="100" y="210" text-anchor="middle" fill="${UI_COLORS.WHITE}" font-size="14" font-weight="bold"
            stroke="${UI_COLORS.BLACK}" stroke-width="3" paint-order="stroke">
        WORLD (0,0)
      </text>
      <text x="100" y="210" text-anchor="middle" fill="${UI_COLORS.BRIGHT_GREEN}" font-size="14" font-weight="bold">
        WORLD (0,0)
      </text>
    </svg>
  `;

  document.body.appendChild(overlay);

  // Remove overlay after 6 seconds
  setTimeout(() => {
    const elem = document.getElementById('origin-indicator-overlay');
    if (elem) {
      elem.style.transition = 'opacity 0.5s';
      elem.style.opacity = '0';
      setTimeout(() => elem.remove(), PANEL_LAYOUT.TIMING.ELEMENT_REMOVE);
    }
  }, 6000);
}
