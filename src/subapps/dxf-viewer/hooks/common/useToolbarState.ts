/**
 * useToolbarState
 * Manages toolbar tool selection and UI state
 */

'use client';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_TOOLBAR_STATE = false;

import { useState, useCallback } from 'react';
import type { ToolType } from '../../ui/toolbar/types';

export function useToolbarState() {
  // UI State - activeTool removed, now managed by parent
  const [showGrid, setShowGrid] = useState(true);
  const [showLayers, setShowLayers] = useState(true); // ✅ DEFAULT: Show colored layers by default
  const [showCalibration, setShowCalibration] = useState(false);
  const [showCursorSettings, setShowCursorSettings] = useState(false);
  // ADR-189 §4.13: Guide Panel visibility
  const [showGuidePanel, setShowGuidePanel] = useState(false);
  // ADR-189: Guide Analysis Panel visibility
  const [showGuideAnalysisPanel, setShowGuideAnalysisPanel] = useState(false);
  // Block Library M1: «Τα Blocks μου» palette visibility
  const [showBlockLibraryPanel, setShowBlockLibraryPanel] = useState(false);
  // ADR-654: «Έπιπλα Κάτοψης» palette visibility (mirror of Block Library panel)
  const [showFurniturePlanPanel, setShowFurniturePlanPanel] = useState(false);
  // ADR-654 M6/M7: «Άνθρωποι/Οχήματα/Φυτά Κάτοψης» entourage palettes visibility
  const [showPeoplePlanPanel, setShowPeoplePlanPanel] = useState(false);
  const [showVehiclesPlanPanel, setShowVehiclesPlanPanel] = useState(false);
  const [showPlantsPlanPanel, setShowPlantsPlanPanel] = useState(false);

  // Tool change handler
  /**
   * ADR-032 §1 — **αυτή η συνάρτηση ΔΕΝ οπλίζει πια εργαλεία.**
   * Κάνει δύο πράγματα, και τα δύο ανήκουν εδώ: (α) ακυρώνει ό,τι τρέχει (`^C^C`),
   * (β) δρομολογεί τα zoom, που είναι **ενέργειες**, όχι εργαλεία με κατάσταση.
   * Ο οπλισμός ζει στον έναν κριτή — βλ. `systems/tools/drawing-tool-arming`.
   */
  const handleToolChange = useCallback((
    tool: ToolType,
    onZoomAction: (action: string) => void,
    onCancel: () => void
  ) => {

    onCancel(); // Cancel any ongoing operations
    
    // Handle zoom tools directly
    if (tool === 'zoom-in') {
      onZoomAction('zoom-in');
      return;
    } else if (tool === 'zoom-out') {
      onZoomAction('zoom-out');
      return;
    } else if (tool === 'zoom-extents') {
      onZoomAction('zoom-extents');
      return;
    } else if (tool === 'zoom-window') {
      // zoom-window handled by parent - no local setActiveTool
      return;
    }
    
    // activeTool is now managed by parent - no local setActiveTool

    // ── ΟΠΛΙΣΜΟΣ: ΔΕΝ ΑΠΟΦΑΣΙΖΕΤΑΙ ΕΔΩ (ADR-032 §1) ─────────────────────────────
    // 🔴 Εδώ ζούσε **πέμπτος** κατάλογος εργαλείων: μια χειρόγραφη 8άδα
    // `['line','rectangle','circle','circle-diameter','circle-2p-diameter','polyline',
    // 'polygon','hatch']` που καλούσε `onDrawingStart`. Είχε **αποκλίνει** από το
    // `TOOL_DEFINITIONS` (`category: 'drawing'`): το `table`, το `opening-info-tag`, το
    // `scale-bar`, τα `arc-*`, τα `circle-3p/best-fit/...` **δεν ήταν μέσα**.
    //
    // Το θανατηφόρο ήταν ο **συνδυασμός** με το `onCancel()` δύο δεκάδες γραμμές πιο πάνω:
    // ο αφοπλισμός ήταν **καθολικός**, ο οπλισμός **8 εργαλεία**. Ό,τι έπεφτε στη διαφορά
    // αφοπλιζόταν και δεν ξαναοπλιζόταν ποτέ — «το εργαλείο που δείχνει ενεργό και είναι
    // νεκρό». Το `onCancel()` **μένει** (είναι το `^C^C` της κορδέλας του AutoCAD, σωστό)·
    // ο οπλισμός έφυγε στον έναν κριτή (`resolveDrawingArming`) που ρωτούν **και** ο δεσμός
    // **και** το κλικ. Ένας αφοπλιστής, ένας οπλιστής, μηδέν κατάλογοι εδώ.
  }, []);

  // UI toggle handlers
  const toggleGrid = useCallback(() => setShowGrid(p => !p), []);
  const toggleLayers = useCallback(() => setShowLayers(p => !p), []);
  const toggleCalibration = useCallback(() => setShowCalibration(p => !p), []);
  const toggleCursorSettings = useCallback(() => setShowCursorSettings(p => !p), []);
  const toggleGuidePanel = useCallback(() => setShowGuidePanel(p => !p), []);
  // ADR-189: Open only (idempotent — won't close if already open)
  const openGuidePanel = useCallback(() => setShowGuidePanel(true), []);
  // Block Library M1: «Τα Blocks μου» palette toggle + idempotent open (mirror guide panel).
  const toggleBlockLibraryPanel = useCallback(() => setShowBlockLibraryPanel(p => !p), []);
  const openBlockLibraryPanel = useCallback(() => setShowBlockLibraryPanel(true), []);
  // ADR-654: «Έπιπλα Κάτοψης» palette toggle (mirror of Block Library toggle).
  const toggleFurniturePlanPanel = useCallback(() => setShowFurniturePlanPanel(p => !p), []);
  // ADR-654 M6: «Άνθρωποι/Οχήματα Κάτοψης» palette toggles (mirror του furniture toggle).
  const togglePeoplePlanPanel = useCallback(() => setShowPeoplePlanPanel(p => !p), []);
  const toggleVehiclesPlanPanel = useCallback(() => setShowVehiclesPlanPanel(p => !p), []);
  const togglePlantsPlanPanel = useCallback(() => setShowPlantsPlanPanel(p => !p), []);
  const toggleGuideAnalysisPanel = useCallback(() => setShowGuideAnalysisPanel(p => !p), []);

  return {
    // State - activeTool removed, now managed by parent
    showGrid,
    showLayers,
    showCalibration,
    showCursorSettings,
    showGuidePanel,
    showGuideAnalysisPanel,
    showBlockLibraryPanel,
    showFurniturePlanPanel,
    showPeoplePlanPanel,
    showVehiclesPlanPanel,
    showPlantsPlanPanel,

    // Actions - setActiveTool removed, now managed by parent
    handleToolChange,
    toggleGrid,
    toggleLayers,
    toggleCalibration,
    toggleCursorSettings,
    toggleGuidePanel,
    openGuidePanel,
    toggleGuideAnalysisPanel,
    toggleBlockLibraryPanel,
    openBlockLibraryPanel,
    toggleFurniturePlanPanel,
    togglePeoplePlanPanel,
    toggleVehiclesPlanPanel,
    togglePlantsPlanPanel
  };
}