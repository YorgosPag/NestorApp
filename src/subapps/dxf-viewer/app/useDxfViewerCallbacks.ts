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
import { COORDINATE_LAYOUT } from '../rendering/core/CoordinateTransforms';
import { createOriginIndicatorOverlay } from './origin-indicator-overlay';
import type { ViewTransform, Point2D } from '../rendering/types/Types';
import type { CircleEntity, ArcEntity, PolylineEntity, SceneModel } from '../types/scene';
import type { DxfSaveContext } from '../services/dxf-firestore.service';
import type { FloatingPanelHandle } from '../ui/FloatingPanelContainer';
import type { NotificationContextValue } from '@/types/notifications';
import type { LevelsHookReturn } from '../systems/levels/useLevels';
import type { UniversalSelectionHook } from '../systems/selection/SelectionSystem';
import type { Status, OverlayKind } from '../overlays/types';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { nowISO } from '@/lib/date-local';
import { openDimTextOverride } from '../ui/panels/dimensions/DimTextOverrideStore';
import { EventBus } from '../systems/events/EventBus';
import { useAnalysisDiagramViewStore } from '../state/analysis-diagram-view-store';
import { useAnimationStore } from '../bim-3d/animation/AnimationStore';
import { useCameraTargetStore } from '../bim-3d/stores/CameraTargetStore';
import { buildTurntablePath } from '../bim-3d/animation/core/TurntablePathBuilder';
import { TURNTABLE_DEFAULTS } from '../bim-3d/animation/presets/animation-presets';
import { resolveTurntableBbox } from './turntable-bbox';
import {
  handleAnimationExport,
  handleAnimationSave,
  type AnimationActionDeps,
} from '../bim-3d/animation/animation-action-handlers';
import { useAuth } from '@/auth/hooks/useAuth';
// ADR-391 — open AdminLayerManager dialog via store SSoT
import { AdminLayerManagerDialogStore } from '../stores/AdminLayerManagerDialogStore';

/** Structural overlay entry shape used by callbacks */
interface OverlayEntry {
  status?: Status;
  kind: OverlayKind;
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
  setCreditsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPdfPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setAiChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShowEnhancedImport: React.Dispatch<React.SetStateAction<boolean>>;
  setShowImportWizard: React.Dispatch<React.SetStateAction<boolean>>;
  setShowLegacyImport: React.Dispatch<React.SetStateAction<boolean>>;
  setCanvasTransform: (t: { scale: number; offsetX: number; offsetY: number }) => void;
  currentScene: SceneModel | null;
  selectedEntityIds: string[];
  handleSceneChange: (scene: SceneModel) => void;
  handleFileImport: (file: File, encoding?: string, saveContext?: DxfSaveContext, targetLevelId?: string) => void;
  levelManager: LevelsHookReturn;
  overlayStore: {
    overlays: Record<string, OverlayEntry>;
    setCurrentLevel: (id: string | null) => void;
  };
  universalSelection: UniversalSelectionHook;
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
  selectionIdSet: Set<string>;
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
    togglePerfMonitor, perfMonitorEnabled, fullscreen,
    setTestsModalOpen, setCreditsModalOpen, setPdfPanelOpen, setAiChatOpen,
    setShowEnhancedImport, setShowImportWizard, setShowLegacyImport,
    setCanvasTransform,
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

  // 🧪 WRAP handleAction to intercept special actions
  const wrappedHandleAction = React.useCallback((action: string, data?: string | number | Record<string, unknown>) => {
    if (action === 'run-tests') {
      setTestsModalOpen(true);
      return;
    }
    // ADR-409 §B-θετικό.2 — open the third-party asset credits / licences screen.
    if (action === 'open-credits') {
      setCreditsModalOpen(true);
      return;
    }
    // 🏢 ENTERPRISE: Performance Monitor Toggle (Bentley/Autodesk pattern)
    if (action === 'toggle-perf') {
      togglePerfMonitor();
      const newState = !perfMonitorEnabled;
      notifications.success(
        `Performance Monitor: ${newState ? 'ON ✅' : 'OFF ❌'}`,
        { content: newState ? t('callbacks.perfMonitorOn') : t('callbacks.perfMonitorOff') }
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
    // ADR-391: Open AdminLayerManager modal dialog (Revit View > Layer Manager pattern)
    if (action === 'open-layer-manager') {
      AdminLayerManagerDialogStore.open();
      return;
    }
    // ADR-396 P6: Open Thermal Envelope (ETICS) authoring dialog (ThermalEnvelopeHost listens)
    if (action === 'thermal-envelope.open') {
      EventBus.emit('bim:thermal-envelope-requested', {});
      return;
    }
    // ADR-363 §6 Phase 8: Open BIM Schedule («Πίνακας BIM») dialog (BimScheduleHost listens)
    if (action === 'open-schedule-dialog') {
      EventBus.emit('bim:schedule-dialog-requested', {});
      return;
    }
    // ADR-453: Open Print/Export («Εκτύπωση») dialog (PrintHost listens)
    if (action === 'open-print-dialog') {
      EventBus.emit('dxf:print-dialog-requested', {});
      return;
    }
    // ADR-505: Open Export («Εξαγωγή») dialog (ExportHost listens)
    if (action === 'open-export-dialog') {
      EventBus.emit('dxf:export-dialog-requested', {});
      return;
    }
    // ADR-459 Φ4d: «Αυτόματος Οπλισμός» — auto-apply code-suggested reinforcement.
    // Scope = τρέχουσα επιλογή (κενή → όλος ο οργανισμός ορόφου· το αποφασίζει ο
    // useStructuralAutoReinforce hook που εκτελεί το undoable command).
    if (action === 'organism.auto-reinforce') {
      EventBus.emit('bim:auto-reinforce-requested', { entityIds: [...params.selectedEntityIds] });
      return;
    }
    // ADR-464 Slice 4: «Υπολογισμός Φορτίων» — tributary load takedown σε όλα τα
    // εγγράψιμα πέδιλα του ορόφου (ο useStructuralLoadTakedown hook εκτελεί το command).
    if (action === 'organism.compute-loads') {
      EventBus.emit('bim:compute-loads-requested', {});
      return;
    }
    // ADR-500 (ADR-487 §7): «Αυτόματη Μελέτη» — ντετερμινιστικός βρόχος σύγκλισης που
    // μελετά όλον τον όροφο μόνος του (φορτία→size→reinforce→footing→diagnostics) μέχρι
    // μηδέν κόκκινο. Ο useStructuralAutoStudy hook εκτελεί τον loop + report toast.
    if (action === 'organism.auto-study') {
      EventBus.emit('bim:auto-study-requested', {});
      return;
    }
    // ADR-482 (T3-UI): «Ανάλυση» — explicit trigger του στατικού FEM solver (ADR-481).
    // Ο dormant `useProactiveStructuralAnalysis` ξυπνά → K·u=F → AnalysisResultsStore.
    // ADR-488: το πάτημα οπλίζει το engaged latch → ο solver μένει ΖΩΝΤΑΝΟΣ (proactive
    // re-solve σε κάθε επόμενη κίνηση), ώστε το διάγραμμα να ακολουθεί την τοπολογία.
    if (action === 'organism.run-analysis') {
      useAnalysisDiagramViewStore.getState().setAnalysisLive(true);
      EventBus.emit('bim:run-structural-analysis', {});
      return;
    }
    // ADR-459 Φ4f: manual κολόνα↔πέδιλο connectivity (selection-driven· ο
    // useStructuralFootingConnect hook αναλύει την επιλογή + εκτελεί το command).
    if (action === 'organism.footing-attach') {
      EventBus.emit('bim:column-footing-attach-requested', { entityIds: [...params.selectedEntityIds] });
      return;
    }
    if (action === 'organism.footing-detach') {
      EventBus.emit('bim:column-footing-detach-requested', { entityIds: [...params.selectedEntityIds] });
      return;
    }
    // ADR-345 Fase 6: Import/export dialog actions (migrated from toolbar)
    if (action === 'import-dxf-enhanced') {
      setShowEnhancedImport(true);
      return;
    }
    if (action === 'import-floorplan-wizard') {
      setShowImportWizard(true);
      floatingRef.current?.showTab('levels');
      return;
    }
    if (action === 'import-dxf-legacy') {
      setShowLegacyImport(true);
      return;
    }
    // ADR-362 Phase G1: open dimension text-override dialog
    if (action === 'dim.text.override') {
      const entityId = params.selectedEntityIds[0];
      if (entityId) openDimTextOverride(entityId);
      return;
    }
    // ADR-366 §C.1.b — Animation actions. Read/write AnimationStore + CameraTargetStore via getState().
    if (action === 'animation.tool-toggle') {
      const state = useAnimationStore.getState();
      state.setToolActive(!state.toolActive);
      return;
    }
    if (action === 'animation.turntable') {
      const waypoints = buildTurntablePath(resolveTurntableBbox(), TURNTABLE_DEFAULTS);
      useAnimationStore.getState().setWaypoints(waypoints);
      return;
    }
    if (action === 'animation.add-waypoint') {
      const cam = useCameraTargetStore.getState();
      useAnimationStore.getState().addWaypoint({
        position: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
        target: { x: cam.target.x, y: cam.target.y, z: cam.target.z },
        fov: cam.fov > 0 ? cam.fov : 50,
        easingToNext: 'linear',
      });
      return;
    }
    if (action === 'animation.delete-waypoint') {
      const state = useAnimationStore.getState();
      if (state.activeWaypointIndex !== null) state.removeWaypoint(state.activeWaypointIndex);
      return;
    }
    if (action === 'animation.reverse') {
      const state = useAnimationStore.getState();
      state.setWaypoints([...state.waypoints].reverse());
      return;
    }
    if (action === 'animation.snap-toggle') {
      const state = useAnimationStore.getState();
      state.setSnapEnabled(!state.snapEnabled);
      return;
    }
    // ADR-366 §C.1.c — Animation save + export to MP4 via render queue.
    if (action === 'animation.save' || action === 'animation.export') {
      const userId = user?.uid;
      const companyId = user?.companyId ?? levelManager.saveContext?.companyId ?? '';
      const projectId = levelManager.saveContext?.projectId ?? '';
      if (!userId || !companyId || !projectId) {
        notifications.error(t('animation.notification.exportContextMissing'));
        return;
      }
      const animationDeps: AnimationActionDeps = {
        userId, companyId, projectId,
        notifications: { success: notifications.success, error: notifications.error },
        t,
      };
      if (action === 'animation.save') void handleAnimationSave(animationDeps);
      else void handleAnimationExport(animationDeps);
      return;
    }
    // ADR-369 §Q8.3 — IFC4 export trigger. IfcExportHost subscribes to the
    // EventBus and performs the export+download lifecycle.
    if (action === 'export-ifc') {
      EventBus.emit('bim:ifc-export-requested', {
        projectId: levelManager.saveContext?.projectId,
        buildingIds: levelManager.saveContext?.buildingId
          ? [levelManager.saveContext.buildingId]
          : undefined,
        includePsets: true,
      });
      return;
    }
    // Pass all other actions to original handleAction
    handleAction(action, data);
  }, [handleAction, togglePerfMonitor, perfMonitorEnabled, notifications, fullscreen,
      setTestsModalOpen, setCreditsModalOpen, setPdfPanelOpen, setAiChatOpen,
      setShowEnhancedImport, setShowImportWizard, setShowLegacyImport,
      levelManager.saveContext, params.selectedEntityIds, user, t]);

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
  const handleFileImportWithEncoding = React.useCallback(async (file: File, encoding?: string, saveContext?: DxfSaveContext, targetLevelId?: string) => {
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
  }, [levelManager, overlayStore, handleFileImport]);

  // Handle overlay region click
  const handleRegionClick = React.useCallback((regionId: string) => {
    universalSelection.handleOverlaySelect(regionId);

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
    wrappedHandleTransformChange,
    panToWorldOrigin,
    handleFileImportWithEncoding,
    handleRegionClick,
    nudgeSelection,
    selectionIdSet,
  };
}

