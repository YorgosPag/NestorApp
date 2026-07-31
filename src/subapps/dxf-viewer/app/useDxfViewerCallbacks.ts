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
import { getDrawingAreaRect } from '../rendering/core/drawing-area';
// «Ποιος είναι ο κύριος καμβάς» — ΕΝΑ σημείο (2026-07-31: ήταν τρεις γραφές, η μία νεκρή).
import { getMainDxfCanvas } from '../rendering/utils/main-canvas-element';
import { createOriginIndicatorOverlay } from './origin-indicator-overlay';
import type { ViewTransform, Point2D } from '../rendering/types/Types';
import type { CircleEntity, ArcEntity, PolylineEntity, SceneModel } from '../types/scene';
import type { DxfSaveContext } from '../services/dxf-firestore.service';
import type { FloatingPanelHandle } from '../ui/FloatingPanelContainer';
import type { NotificationContextValue } from '@/types/notifications';
import type { LevelsHookReturn } from '../systems/levels/useLevels';
import type { Status, OverlayKind } from '../overlays/types';
// ADR-532 Stage B5 — read/mutate the selection set imperatively at event time
// (ADR-040 dual-access) instead of receiving it as a reactive prop.
import { SelectedEntitiesStore } from '../systems/selection';
import { useEventCallback } from '@/hooks/useEventCallback';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { nowISO } from '@/lib/date-local';
import { useAuth } from '@/auth/hooks/useAuth';
// ADR-547 Stage 4 — special-action dispatcher extracted to its own SRP module.
import { dispatchDxfSpecialAction } from './dxf-special-actions';
import type { DxfShellModalSetters } from './dxf-shell-modal-setters';

/** Structural overlay entry shape used by callbacks */
interface OverlayEntry {
  status?: Status;
  kind: OverlayKind;
  levelId?: string;
}

/** Params for useDxfViewerCallbacks */
export interface DxfViewerCallbacksParams extends DxfShellModalSetters {
  notifications: NotificationContextValue;
  copyToClipboard: (text: string) => Promise<boolean>;
  handleAction: (action: string, data?: string | number | Record<string, unknown>) => void;
  fullscreen: { toggle: () => void };
  setCanvasTransform: (t: { scale: number; offsetX: number; offsetY: number }) => void;
  currentScene: SceneModel | null;
  handleSceneChange: (scene: SceneModel) => void;
  handleFileImport: (file: File, encoding?: string, saveContext?: DxfSaveContext, targetLevelId?: string) => void;
  levelManager: LevelsHookReturn;
  overlayStore: {
    overlays: Record<string, OverlayEntry>;
    setCurrentLevel: (id: string | null) => void;
  };
  setOverlayStatus: (s: Status) => void;
  setOverlayKind: (k: OverlayKind) => void;
  showLayers: boolean;
  floatingRef: React.RefObject<FloatingPanelHandle | null>;
}

/** Return type of useDxfViewerCallbacks */
export interface DxfViewerCallbacksReturn {
  showCopyableNotification: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  wrappedHandleAction: (action: string, data?: string | number | Record<string, unknown>) => void;
  wrappedHandleTransformChange: (transform: ViewTransform) => void;
  panToWorldOrigin: () => void;
  handleFileImportWithEncoding: (file: File, encoding?: string, saveContext?: DxfSaveContext, targetLevelId?: string) => Promise<void>;
  handleRegionClick: (regionId: string) => void;
  nudgeSelection: (dx: number, dy: number) => void;
}

/**
 * Custom hook extracting all useCallback/useMemo definitions from DxfViewerContent.
 * ADR-065 SRP split.
 */
export function useDxfViewerCallbacks(params: DxfViewerCallbacksParams): DxfViewerCallbacksReturn {
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell', 'bim3d']);
  const { user } = useAuth();
  const {
    notifications, copyToClipboard, handleAction,
    fullscreen,
    setTestsModalOpen, setCreditsModalOpen, setPdfPanelOpen, setAiChatOpen,
    setShowEnhancedImport, setShowImportWizard, setShowLegacyImport,
    setCanvasTransform,
    currentScene, handleSceneChange,
    handleFileImport, levelManager, overlayStore,
    setOverlayStatus, setOverlayKind,
    showLayers, floatingRef,
  } = params;

  // ✅ PERFORMANCE: Memoize copyable notification
  const showCopyableNotification = React.useCallback((message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    const notifyMethod = notifications[type];
    notifyMethod(message, {
      duration: 5000,
      actions: [{
        label: t('callbacks.copy'),
        onClick: async () => {
          const success = await copyToClipboard(message);
          if (success) {
            notifications.success(t('callbacks.copiedToClipboard'), { duration: 2000 });
          } else {
            notifications.error(t('callbacks.copyFailed'));
          }
        }
      }]
    });
  }, [notifications, copyToClipboard, t]);

  // 🧪 WRAP handleAction to intercept special actions.
  // ADR-547 Stage 4 (ribbon/top-bar cascade) — stabilized via `useEventCallback`
  // so its identity NEVER changes across renders (reads latest deps at call time).
  // Previously a plain `useCallback` whose `fullscreen` dep (`useFullscreen()`
  // returns a FRESH object literal every render — not memoized) churned on EVERY
  // render → `arrayActionInterceptor` → `onAction` → `ribbonCommands` memo broke →
  // `RibbonRoot`'s `React.memo` was defeated → the whole Radix/Tooltip ribbon tree
  // (Tooltip ×63, Switch, SelectItem, DialogPortal…) re-rendered on every scene
  // edit/selection. Stable identity severs that path: the ribbon stays static
  // across document edits (Revit / Cinema4D command-bar doctrine). Reads the
  // latest `fullscreen`/`levelManager`/`user`/`t` at click time, so behavior is
  // unchanged. NEVER called during render (event-only) → safe for useEventCallback.
  const wrappedHandleAction = useEventCallback((action: string, data?: string | number | Record<string, unknown>) => {
    // ADR-547 Stage 4 — the special-action switch lives in `dispatchDxfSpecialAction`
    // (SRP split for file-size). It returns true when it fully handled the action;
    // otherwise we fall through to the base `handleAction`. ADR-532 Stage B5 — live
    // selection read at event time (no reactive prop).
    const handled = dispatchDxfSpecialAction(action, {
      selectedEntityIds: SelectedEntitiesStore.getSelectedEntityIds(),
      notifications, t, user, fullscreen, levelManager, floatingRef,
      setTestsModalOpen, setCreditsModalOpen, setPdfPanelOpen, setAiChatOpen,
      setShowEnhancedImport, setShowImportWizard, setShowLegacyImport,
    });
    if (!handled) handleAction(action, data);
  });

  // ADR-040 Phase XXII.C: TransformContext duplicate SSoT removed. Mutation writes
  // through TransformStore singleton (ImmediateTransformStore) only — no React
  // useState cascade, no duplicate EventBus.emit('dxf-zoom-changed') per notch.
  const wrappedHandleTransformChange = React.useCallback((transform: ViewTransform) => {
    setCanvasTransform({
      scale: transform.scale || 1,
      offsetX: transform.offsetX || 0,
      offsetY: transform.offsetY || 0,
    });
  }, [setCanvasTransform]);

  // 🏠 PAN TO WORLD ORIGIN (0,0) - Function for DebugToolbar
  const panToWorldOrigin = React.useCallback(() => {
    const canvasElement = getMainDxfCanvas();
    if (!canvasElement) {
      showCopyableNotification('Canvas not found', 'error');
      return;
    }

    // ✅ FIX: Use DISPLAY size (CSS pixels), not internal canvas resolution!
    const rect = canvasElement.getBoundingClientRect();
    const viewport = { width: rect.width, height: rect.height };

    // 🔑 SSoT — «πού είναι η περιοχή σχεδίασης». 🔴 ΙΔΙΟ ελάττωμα με το σύμπτωμα Β: έφερνε την
    // αρχή στο κέντρο του `<canvas>`, όχι στο κέντρο της ΟΡΑΤΗΣ περιοχής (τα 30 px αριστερά και
    // κάτω τα σκεπάζουν οι χάρακες).
    const area = getDrawingAreaRect(viewport);

    const newOffsetX = area.centerX - area.x;
    const newOffsetY = area.bottom - area.centerY;

    const newTransform: ViewTransform = { scale: 1, offsetX: newOffsetX, offsetY: newOffsetY };
    wrappedHandleTransformChange(newTransform);

    // 🎯 SHOW VISUAL INDICATOR: Pulsing crosshair at center
    const canvasX = area.x + newOffsetX;
    const canvasY = area.bottom - newOffsetY;
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

  // 🏢 ADR-240: Wrapper για handleFileImport with encoding + saveContext.
  // ADR-532 Stage 4a.1 — stabilized via useEventCallback: this is passed as
  // `onSceneImported` down to SidebarSection → FloatingPanelContainer. Its old
  // `[levelManager, overlayStore, handleFileImport]` deps changed reference on a
  // selection click → broke those memos → the whole left panel re-rendered. The
  // stable identity (reading latest at call time) lets both memos hold.
  const handleFileImportWithEncoding = useEventCallback(async (file: File, encoding?: string, saveContext?: DxfSaveContext, targetLevelId?: string) => {
    try {
      // ADR-420 — the wizard resolves the level that OWNS the selected floor and
      // passes it explicitly. Target THAT level (race-free) rather than whatever is
      // currently active, so importing onto floor B never overwrites floor A.
      const resolvedLevel = targetLevelId ?? levelManager.currentLevelId;

      if (resolvedLevel) {
        overlayStore.setCurrentLevel(resolvedLevel);
        handleFileImport(file, undefined, saveContext, resolvedLevel);
      } else {
        console.warn('⚠️ [Enhanced Import] No current level found, creating default level');
        const timestamp = nowISO().slice(0, 19).replace(/[-:]/g, '');
        const newLevelName = `${file.name.replace('.dxf', '')}_${timestamp}`;
        const newLevelId = await levelManager.addLevel(newLevelName, true);
        if (newLevelId) {
          overlayStore.setCurrentLevel(newLevelId);
          handleFileImport(file, undefined, saveContext, newLevelId);
        } else {
          console.error('❌ [Enhanced Import] Failed to create new level');
          return;
        }
      }
    } catch (error) {
      console.error('⛔ [Enhanced Import] Error in enhanced DXF import:', error);
      handleFileImport(file, undefined, saveContext, targetLevelId);
    }
  });

  // Handle overlay region click
  const handleRegionClick = React.useCallback((regionId: string) => {
    // ADR-532 Stage B5 — overlay select via the store (mirrors the old
    // universalSelection.handleOverlaySelect(regionId) for a non-null id).
    SelectedEntitiesStore.selectEntity({ id: regionId, type: 'overlay' });

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
      setOverlayStatus, setOverlayKind, floatingRef]);

  // ✅ PERFORMANCE: nudge reads the live selection set at event time (ADR-532
  // Stage B5) — no reactive prop, no per-render memoized set.
  const nudgeSelection = React.useCallback((dx: number, dy: number) => {
    const selectedEntityIds = SelectedEntitiesStore.getSelectedEntityIds();
    if (!currentScene || !selectedEntityIds.length) return;
    const selectionIdSet = new Set(selectedEntityIds);

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
  }, [currentScene, handleSceneChange]);

  return {
    showCopyableNotification,
    wrappedHandleAction,
    wrappedHandleTransformChange,
    panToWorldOrigin,
    handleFileImportWithEncoding,
    handleRegionClick,
    nudgeSelection,
  };
}

