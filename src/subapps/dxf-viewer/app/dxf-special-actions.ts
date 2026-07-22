'use client';

/**
 * dxf-special-actions — Ribbon/top-bar special-action dispatcher extracted from
 * useDxfViewerCallbacks (ADR-065 SRP split; ADR-547 Stage 4 file-size split).
 *
 * `dispatchDxfSpecialAction` returns true when it has fully handled the action
 * (the caller then returns early); false means "not special" → fall through to
 * the base `handleAction`. Pure dispatch — no React state, no hooks: it reads the
 * latest deps handed in by the event-time caller (`useEventCallback` identity),
 * so behavior is identical to the previous inline switch.
 *
 * Related files:
 * - useDxfViewerCallbacks.ts (wraps this in `wrappedHandleAction`)
 */

import type React from 'react';
import type { TFunction } from 'i18next';
import type { NotificationContextValue } from '@/types/notifications';
import type { LevelsHookReturn } from '../systems/levels/useLevels';
import type { FloatingPanelHandle } from '../ui/FloatingPanelContainer';
import type { FirebaseAuthUser } from '@/auth/types/auth.types';
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
// ADR-366 §B.5.U — unified Performance HUD store (one toggle source for 2D + 3D).
import { usePerformanceHUDStore } from '../bim-3d/performance/PerformanceHUDStore';
// ADR-391 — open AdminLayerManager dialog via store SSoT
import { AdminLayerManagerDialogStore } from '../stores/AdminLayerManagerDialogStore';
import { ImportedMeshBoqDialogStore } from '../stores/ImportedMeshBoqDialogStore';
import { ImportedMeshMaterialMapDialogStore } from '../stores/ImportedMeshMaterialMapDialogStore';
import {
  IMPORTED_MESH_ASSIGN_BOQ_ACTION,
  IMPORTED_MESH_ASSIGN_MATERIALS_ACTION,
} from '../ui/ribbon/data/contextual-imported-mesh-tab';
// ADR-563 — auto-dimension command flow (dialog → engine → batch commit)
import { runAutoDimensionFlow } from '../systems/dimensions/auto/run-auto-dimension-flow';
// ADR-362 §7 — «Ιδιότητες…»: open the F11/Ctrl+1 Full Properties Palette (self-follows selection).
import { PropertiesPaletteStore } from '../systems/properties/PropertiesPaletteStore';

/** Deps for the special-action dispatcher (read at event time). */
export interface DxfSpecialActionDeps {
  selectedEntityIds: readonly string[];
  notifications: NotificationContextValue;
  t: TFunction;
  user: FirebaseAuthUser | null;
  fullscreen: { toggle: () => void };
  levelManager: LevelsHookReturn;
  floatingRef: React.RefObject<FloatingPanelHandle | null>;
  setTestsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCreditsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPdfPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setAiChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShowEnhancedImport: React.Dispatch<React.SetStateAction<boolean>>;
  setShowImportWizard: React.Dispatch<React.SetStateAction<boolean>>;
  setShowLegacyImport: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Intercept ribbon/top-bar "special" actions. Returns true when handled (caller
 * returns early), false to fall through to the base handleAction.
 */
export function dispatchDxfSpecialAction(action: string, deps: DxfSpecialActionDeps): boolean {
  const {
    selectedEntityIds, notifications, t, user, fullscreen, levelManager, floatingRef,
    setTestsModalOpen, setCreditsModalOpen, setPdfPanelOpen, setAiChatOpen,
    setShowEnhancedImport, setShowImportWizard, setShowLegacyImport,
  } = deps;

  // ADR-662 Φάση 1 — «Τοπογραφικό» ribbon commands. One thin emit forwards the raw
  // `topo.*` action to `TopoRibbonHost`, which mounts the existing topo hooks/stores and
  // routes it to the ready call (μηδέν νέα λογική — ο host είναι thin trigger). Kept as a
  // prefix check so this dispatcher stays a pure emitter (mirror schedule/print/export).
  if (action.startsWith('topo.')) {
    EventBus.emit('topo:ribbon-action', { action });
    return true;
  }

  if (action === 'run-tests') {
    setTestsModalOpen(true);
    return true;
  }
  // ADR-409 §B-θετικό.2 — open the third-party asset credits / licences screen.
  if (action === 'open-credits') {
    setCreditsModalOpen(true);
    return true;
  }
  // 🏢 ENTERPRISE: Unified Performance HUD toggle (ADR-366 §B.5.U) — one store.
  if (action === 'toggle-perf') {
    const newState = !usePerformanceHUDStore.getState().enabled;
    usePerformanceHUDStore.getState().setEnabled(newState);
    notifications.success(
      `Performance Monitor: ${newState ? 'ON ✅' : 'OFF ❌'}`,
      { content: newState ? t('callbacks.perfMonitorOn') : t('callbacks.perfMonitorOff') }
    );
    return true;
  }
  // 🏢 PDF BACKGROUND: Toggle PDF controls panel
  if (action === 'toggle-pdf-background') {
    setPdfPanelOpen(prev => !prev);
    return true;
  }
  // 🤖 ADR-185: Toggle AI Drawing Assistant
  if (action === 'toggle-ai-assistant') {
    setAiChatOpen(prev => !prev);
    return true;
  }
  // 🏢 ADR-241: Fullscreen toggle (Portal-based, zero remount)
  if (action === 'toggle-fullscreen') {
    fullscreen.toggle();
    return true;
  }
  // ADR-683 Φ3.1β: «Ανάθεση προμέτρησης» για το επιλεγμένο εισαγόμενο πλέγμα. Το tab είναι ήδη
  // per-selection (φαίνεται μόνο όταν ΕΝΑ imported-mesh είναι επιλεγμένο), αλλά το id διαβάζεται
  // εδώ, τη στιγμή του κλικ — ποτέ από snapshot: το store κρατά ΤΟ αντικείμενο όσο είναι ανοιχτό.
  if (action === IMPORTED_MESH_ASSIGN_BOQ_ACTION) {
    const [importedMeshId] = selectedEntityIds;
    if (importedMeshId) ImportedMeshBoqDialogStore.open(importedMeshId);
    return true;
  }
  // ADR-686 Φ5: «Αντιστοίχιση Υλικών» για το επιλεγμένο εισαγόμενο μοντέλο. Το id διαβάζεται εδώ,
  // τη στιγμή του κλικ — το store κρατά την άγκυρα (όλα τα κομμάτια του uploadId) όσο είναι ανοιχτό.
  if (action === IMPORTED_MESH_ASSIGN_MATERIALS_ACTION) {
    const [importedMeshId] = selectedEntityIds;
    if (importedMeshId) ImportedMeshMaterialMapDialogStore.open(importedMeshId);
    return true;
  }
  // ADR-391: Open AdminLayerManager modal dialog (Revit View > Layer Manager pattern)
  if (action === 'open-layer-manager') {
    AdminLayerManagerDialogStore.open();
    return true;
  }
  // ADR-563: «Αυτόματη Διαστασιολόγηση» — open options dialog, then auto-place
  // perimeter dimensions over the selection (or whole plan). Selection-driven;
  // levelManager satisfies SceneAppendAccessor (scene read + undoable batch commit).
  if (action === 'auto-dimension') {
    void runAutoDimensionFlow(levelManager, selectedEntityIds);
    return true;
  }
  // ADR-396 P6: Open Thermal Envelope (ETICS) authoring dialog (ThermalEnvelopeHost listens)
  if (action === 'thermal-envelope.open') {
    EventBus.emit('bim:thermal-envelope-requested', {});
    return true;
  }
  // ADR-363 §6 Phase 8: Open BIM Schedule («Πίνακας BIM») dialog (BimScheduleHost listens)
  if (action === 'open-schedule-dialog') {
    EventBus.emit('bim:schedule-dialog-requested', {});
    return true;
  }
  // ADR-453: Open Print/Export («Εκτύπωση») dialog (PrintHost listens)
  if (action === 'open-print-dialog') {
    EventBus.emit('dxf:print-dialog-requested', {});
    return true;
  }
  // ADR-505: Open Export («Εξαγωγή») dialog (ExportHost listens)
  if (action === 'open-export-dialog') {
    EventBus.emit('dxf:export-dialog-requested', {});
    return true;
  }
  // ADR-651 Φάση Ε: Open engineer-stamp dialog (StampHost listens)
  if (action === 'open-stamp-dialog') {
    EventBus.emit('dxf:stamp-dialog-requested', {});
    return true;
  }
  // ADR-651 Φάση Δ: Open AI title-block dialog (AiTitleBlockHost listens)
  if (action === 'open-ai-title-block-dialog') {
    EventBus.emit('dxf:ai-title-block-dialog-requested', {});
    return true;
  }
  // ADR-651 Φάση Η: Open revisions dialog (RevisionsHost listens)
  if (action === 'open-revisions-dialog') {
    EventBus.emit('dxf:revisions-dialog-requested', {});
    return true;
  }
  // ADR-651 Φάση Θ: Open title-block library dialog (TitleBlockLibraryDialogHost listens)
  if (action === 'open-title-block-library-dialog') {
    EventBus.emit('dxf:title-block-library-dialog-requested', {});
    return true;
  }
  // ADR-459 Φ4d: «Αυτόματος Οπλισμός» — auto-apply code-suggested reinforcement.
  // Scope = τρέχουσα επιλογή (κενή → όλος ο οργανισμός ορόφου· το αποφασίζει ο
  // useStructuralAutoReinforce hook που εκτελεί το undoable command).
  if (action === 'organism.auto-reinforce') {
    EventBus.emit('bim:auto-reinforce-requested', { entityIds: [...selectedEntityIds] });
    return true;
  }
  // ADR-464 Slice 4: «Υπολογισμός Φορτίων» — tributary load takedown σε όλα τα
  // εγγράψιμα πέδιλα του ορόφου (ο useStructuralLoadTakedown hook εκτελεί το command).
  if (action === 'organism.compute-loads') {
    EventBus.emit('bim:compute-loads-requested', {});
    return true;
  }
  // ADR-500 (ADR-487 §7): «Αυτόματη Μελέτη» — ντετερμινιστικός βρόχος σύγκλισης που
  // μελετά όλον τον όροφο μόνος του (φορτία→size→reinforce→footing→diagnostics) μέχρι
  // μηδέν κόκκινο. Ο useStructuralAutoStudy hook εκτελεί τον loop + report toast.
  if (action === 'organism.auto-study') {
    EventBus.emit('bim:auto-study-requested', {});
    return true;
  }
  // ADR-482 (T3-UI): «Ανάλυση» — explicit trigger του στατικού FEM solver (ADR-481).
  // Ο dormant `useProactiveStructuralAnalysis` ξυπνά → K·u=F → AnalysisResultsStore.
  // ADR-488: το πάτημα οπλίζει το engaged latch → ο solver μένει ΖΩΝΤΑΝΟΣ (proactive
  // re-solve σε κάθε επόμενη κίνηση), ώστε το διάγραμμα να ακολουθεί την τοπολογία.
  if (action === 'organism.run-analysis') {
    useAnalysisDiagramViewStore.getState().setAnalysisLive(true);
    EventBus.emit('bim:run-structural-analysis', {});
    return true;
  }
  // ADR-459 Φ4f: manual κολόνα↔πέδιλο connectivity (selection-driven· ο
  // useStructuralFootingConnect hook αναλύει την επιλογή + εκτελεί το command).
  if (action === 'organism.footing-attach') {
    EventBus.emit('bim:column-footing-attach-requested', { entityIds: [...selectedEntityIds] });
    return true;
  }
  if (action === 'organism.footing-detach') {
    EventBus.emit('bim:column-footing-detach-requested', { entityIds: [...selectedEntityIds] });
    return true;
  }
  // ADR-345 Fase 6: Import/export dialog actions (migrated from toolbar)
  if (action === 'import-dxf-enhanced') {
    setShowEnhancedImport(true);
    return true;
  }
  if (action === 'import-floorplan-wizard') {
    setShowImportWizard(true);
    floatingRef.current?.showTab('levels');
    return true;
  }
  if (action === 'import-dxf-legacy') {
    setShowLegacyImport(true);
    return true;
  }
  // ADR-526 — Tekton .tek import: DxfViewerDialogs opens the native file picker.
  if (action === 'import-tek') {
    EventBus.emit('dxf:import-tek-requested', {});
    return true;
  }
  // ADR-362 Phase G1 (2026-07-06 fix): request the text-override dialog. The
  // `useDimensionModify` host owns the level-scene SSoT — it reads the dim's current
  // `userText` and opens the dialog pre-filled. Emitting (not opening directly) is what
  // lets the dialog resolve the entity from the REAL scene instead of the dead
  // `SceneUpdateManager` singleton (root cause of «Δεν επιλέχθηκε διάσταση»).
  if (action === 'dim.text.override') {
    const entityId = selectedEntityIds[0];
    if (entityId) EventBus.emit('dim:text-override-open-requested', { entityId });
    return true;
  }
  // ADR-362 Phase K: DIMBREAK / DIMSPACE — selection-driven, the
  // `useDimensionModify` host runs the undoable command (mirrors organism.*).
  if (action === 'dim.modify.dimBreak') {
    EventBus.emit('dim:break-requested', { entityIds: [...selectedEntityIds] });
    return true;
  }
  if (action === 'dim.modify.dimSpace') {
    EventBus.emit('dim:space-requested', { entityIds: [...selectedEntityIds] });
    return true;
  }
  // ADR-562 Φ5 — «Εφαρμογή Στυλ»: propagate the primary dim's DIMSTYLE to every
  // selected dimension (the `useDimensionModify` host runs the undoable command).
  if (action === 'dim.style.apply') {
    EventBus.emit('dim:apply-style-requested', { entityIds: [...selectedEntityIds] });
    return true;
  }
  // ADR-362 — «Επιλογή σειράς»: grow the primary dim selection to its whole
  // collinear row (the `useDimensionModify` host replaces the selection).
  if (action === 'dim.select.row') {
    EventBus.emit('dim:select-row-requested', { entityIds: [...selectedEntityIds] });
    return true;
  }
  // ADR-362 §7 — «Επαναφορά Παρακάμψεων»: strip every selected dim's per-entity
  // overrides (back to its pure DIMSTYLE). Undoable — no confirm (AutoCAD «reset»).
  if (action === 'dim.override.reset') {
    EventBus.emit('dim:reset-overrides-requested', { entityIds: [...selectedEntityIds] });
    return true;
  }
  // ADR-362 §7 — «Επαναφορά Θέσης»: clear the manual text placement so the dim's
  // text returns to its computed default (AutoCAD DIMTEDIT «Home»). Undoable.
  if (action === 'dim.text.resetPosition') {
    EventBus.emit('dim:reset-text-position-requested', { entityIds: [...selectedEntityIds] });
    return true;
  }
  // ADR-362 §7 — «Επεξεργασία Στυλ…»: open the Dimension Style Manager focused on the
  // selected dim's DIMSTYLE. The panel-open lives here (floatingRef); the host resolves
  // entity→styleId (level-scene SSoT) and drives the DimStyleEditorStore.
  if (action === 'dim.style.edit') {
    const entityId = selectedEntityIds[0];
    if (!entityId) return true;
    floatingRef.current?.showTab('dimensions');
    EventBus.emit('dim:edit-style-requested', { entityId });
    return true;
  }
  // ADR-362 §7 — «Ιδιότητες…»: open the Full Properties Palette (F11/Ctrl+1). It
  // self-subscribes to the selection, so the already-selected dimension appears.
  if (action === 'dim.properties.openPanel') {
    PropertiesPaletteStore.open();
    return true;
  }
  // 2026-07-04 — «Διαγραφή» (edit tab «Ενέργειες»): confirm (mirror of the column
  // editor) then delete the selected dimension(s) through the canonical undoable
  // path (`useDimensionModify` → `deleteEntitiesById`).
  if (action === 'dim.actions.delete') {
    if (selectedEntityIds.length === 0) return true;
    if (window.confirm(t('ribbon.commands.dimContextual.deleteConfirm'))) {
      EventBus.emit('dim:delete-requested', { entityIds: [...selectedEntityIds] });
    }
    return true;
  }
  // ADR-366 §C.1.b — Animation actions. Read/write AnimationStore + CameraTargetStore via getState().
  if (action === 'animation.tool-toggle') {
    const state = useAnimationStore.getState();
    state.setToolActive(!state.toolActive);
    return true;
  }
  if (action === 'animation.turntable') {
    const waypoints = buildTurntablePath(resolveTurntableBbox(), TURNTABLE_DEFAULTS);
    useAnimationStore.getState().setWaypoints(waypoints);
    return true;
  }
  if (action === 'animation.add-waypoint') {
    const cam = useCameraTargetStore.getState();
    useAnimationStore.getState().addWaypoint({
      position: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
      target: { x: cam.target.x, y: cam.target.y, z: cam.target.z },
      fov: cam.fov > 0 ? cam.fov : 50,
      easingToNext: 'linear',
    });
    return true;
  }
  if (action === 'animation.delete-waypoint') {
    const state = useAnimationStore.getState();
    if (state.activeWaypointIndex !== null) state.removeWaypoint(state.activeWaypointIndex);
    return true;
  }
  if (action === 'animation.reverse') {
    const state = useAnimationStore.getState();
    state.setWaypoints([...state.waypoints].reverse());
    return true;
  }
  if (action === 'animation.snap-toggle') {
    const state = useAnimationStore.getState();
    state.setSnapEnabled(!state.snapEnabled);
    return true;
  }
  // ADR-366 §C.1.c — Animation save + export to MP4 via render queue.
  if (action === 'animation.save' || action === 'animation.export') {
    const userId = user?.uid;
    const companyId = user?.companyId ?? levelManager.saveContext?.companyId ?? '';
    const projectId = levelManager.saveContext?.projectId ?? '';
    if (!userId || !companyId || !projectId) {
      notifications.error(t('animation.notification.exportContextMissing'));
      return true;
    }
    const animationDeps: AnimationActionDeps = {
      userId, companyId, projectId,
      notifications: { success: notifications.success, error: notifications.error },
      t,
    };
    if (action === 'animation.save') void handleAnimationSave(animationDeps);
    else void handleAnimationExport(animationDeps);
    return true;
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
    return true;
  }

  return false;
}
