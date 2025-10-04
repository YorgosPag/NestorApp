# 🔍 ΑΝΑΦΟΡΑ UNUSED IMPORTS - DXF VIEWER

**Ημερομηνία Ανάλυσης:** 2025-10-03 21:45:57
**Συνολικά Unused Imports:** 653
**Αρχεία με Προβλήματα:** 215

---

## 📊 EXECUTIVE SUMMARY

### Top 10 Αρχεία με τα Περισσότερα Unused Imports

| # | Αρχείο | Unused Imports |
|---|--------|----------------|
| 1 | `app/DxfViewerContent.tsx` | **37** |
| 2 | `ui/components/ColorPalettePanel.tsx` | **25** |
| 3 | `components/dxf-layout/CanvasSection.tsx` | **17** |
| 4 | `systems/rulers-grid/RulersGridSystem.tsx` | **17** |
| 5 | `systems/dynamic-input/components/DynamicInputOverlay.tsx` | **14** |
| 6 | `rendering/entities/LineRenderer.ts` | **13** |
| 7 | `systems/ai-snapping/AISnappingEngine.ts` | **13** |
| 8 | `ui/components/dxf-settings/settings/special/EntitiesSettings.tsx` | **13** |
| 9 | `rendering/hitTesting/HitTester.ts` | **12** |
| 10 | `canvas-v2/layer-canvas/LayerCanvas.tsx` | **11** |

### Κατανομή ανά Κατηγορία

| Κατηγορία | Unused Imports |
|-----------|----------------|
| Other | 137 |
| UI Components | 129 |
| Systems | 110 |
| Rendering | 94 |
| Utilities | 55 |
| App Components | 37 |
| Canvas V2 | 33 |
| Debug/Testing | 22 |
| Hooks | 20 |
| External (outside dxf-viewer) | 16 |

---

## 📁 ΑΝΑΛΥΤΙΚΗ ΑΝΑΦΟΡΑ ΑΝΑ ΑΡΧΕΙΟ

### `app/DxfViewerContent.tsx`

**Σύνολο Unused Imports:** 37

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 4 | 7 | `DEBUG_DXF_VIEWER_CONTENT` |
| 33 | 1 | `useCursor` |
| 47 | 1 | `globalRulerStore` |
| 50 | 10 | `FloatingPanelContainer` |
| 51 | 1 | `EnhancedDXFToolbar` |
| 52 | 1 | `OverlayToolbar` |
| 53 | 1 | `ColorManager` |
| 54 | 1 | `ProSnapToolbar` |
| 55 | 1 | `CursorSettingsPanel` |
| 56 | 1 | `CoordinateCalibrationOverlay` |
| 57 | 1 | `AutoSaveStatus` |
| 58 | 1 | `CentralizedAutoSaveStatus` |
| 59 | 1 | `OverlayProperties` |
| 60 | 1 | `DraggableOverlayToolbar` |
| 61 | 1 | `DraggableOverlayProperties` |
| 62 | 1 | `ToolbarWithCursorCoordinates` |
| 65 | 1 | `DXFViewerLayout` |
| 66 | 1 | `getKindFromLabel` |
| 67 | 1 | `isFeatureEnabled` |
| 75 | 29 | `useTransform` |
| 80 | 1 | `TestResultsModal` |
| 84 | 1 | `DebugToolbar` |
| 87 | 1 | `LazyFullLayoutDebug` |
| 89 | 34 | `props` |
| 149 | 5 | `openColorMenu` |
| 151 | 5 | `colorMenuRef` |
| 162 | 5 | `toggleGrid` |
| 176 | 9 | `drawingState` |
| 177 | 5 | `onMeasurementPoint` |
| 178 | 5 | `onMeasurementHover` |
| 179 | 5 | `onMeasurementCancel` |
| 180 | 5 | `onDrawingPoint` |
| 181 | 5 | `onDrawingHover` |
| 182 | 5 | `onDrawingCancel` |
| 183 | 5 | `onDrawingDoubleClick` |
| 184 | 5 | `onEntityCreated` |
| 185 | 5 | `gripSettings` |

### `ui/components/ColorPalettePanel.tsx`

**Σύνολο Unused Imports:** 25

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 7 | 10 | `CursorColorPalette` |
| 84 | 10 | `activeSelectionTab` |
| 84 | 30 | `setActiveSelectionTab` |
| 120 | 10 | `rulerUnitsEnabled` |
| 159 | 10 | `cursorShape` |
| 160 | 10 | `cursorSize` |
| 161 | 10 | `cursorColor` |
| 162 | 10 | `cursorLineStyle` |
| 163 | 10 | `cursorOpacity` |
| 164 | 10 | `cursorEnabled` |
| 289 | 9 | `handleResetSelectionSettings` |
| 328 | 9 | `handleCursorShapeChange` |
| 349 | 9 | `handleCursorSizeChange` |
| 355 | 9 | `handleCursorColorChange` |
| 361 | 9 | `handleCursorLineStyleChange` |
| 367 | 9 | `handleCursorOpacityChange` |
| 373 | 9 | `handleCursorEnabledChange` |
| 394 | 9 | `handleGridColorChange` |
| 407 | 9 | `handleGridOpacityChange` |
| 449 | 9 | `handleRulersVisibilityChange` |
| 499 | 9 | `handleRulerColorChange` |
| 507 | 9 | `handleRulerTickColorChange` |
| 546 | 9 | `handleRulerThicknessChange` |
| 564 | 9 | `handleRulerTicksVisibilityChange` |
| 691 | 9 | `handleRulerTicksOpacityChange` |

### `components/dxf-layout/CanvasSection.tsx`

**Σύνολο Unused Imports:** 17

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 11 | 1 | `useCanvasOperations` |
| 15 | 1 | `FloatingPanelContainer` |
| 16 | 1 | `OverlayList` |
| 17 | 1 | `OverlayProperties` |
| 55 | 10 | `canvasRect` |
| 55 | 22 | `setCanvasRect` |
| 56 | 10 | `mouseCss` |
| 57 | 10 | `mouseWorld` |
| 210 | 8 | `restProps` |
| 441 | 32 | `handleOverlayEdit` |
| 441 | 51 | `handleOverlayDelete` |
| 441 | 72 | `handleOverlayUpdate` |
| 478 | 50 | `point` |
| 559 | 15 | `newOverlay` |
| 658 | 15 | `dxfCanvasEl` |
| 659 | 15 | `layerCanvasEl` |
| 770 | 40 | `worldPos` |

### `systems/rulers-grid/RulersGridSystem.tsx`

**Σύνολο Unused Imports:** 17

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 3 | 7 | `DEBUG_RULERS_GRID` |
| 12 | 3 | `RULERS_GRID_CONFIG` |
| 13 | 3 | `UnitType` |
| 14 | 3 | `GridBounds` |
| 15 | 3 | `SnapResult` |
| 16 | 3 | `RulerTick` |
| 17 | 3 | `GridLine` |
| 18 | 3 | `RulersLayoutInfo` |
| 21 | 3 | `RulerSettingsUpdate` |
| 22 | 3 | `GridSettingsUpdate` |
| 24 | 34 | `RulersGridRendering` |
| 24 | 55 | `RulersGridSnapping` |
| 36 | 3 | `initialOrigin` |
| 225 | 29 | `source` |
| 225 | 37 | `timestamp` |
| 231 | 30 | `source` |
| 231 | 38 | `timestamp` |

### `systems/dynamic-input/components/DynamicInputOverlay.tsx`

**Σύνολο Unused Imports:** 14

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 22 | 1 | `Point2D` |
| 30 | 3 | `className` |
| 33 | 3 | `viewport` |
| 35 | 3 | `canvasRect` |
| 46 | 19 | `hideAngleLengthFields` |
| 59 | 5 | `setCurrentFieldValue` |
| 62 | 5 | `fieldValueActions` |
| 63 | 5 | `fieldStateActions` |
| 64 | 5 | `coordinateActions` |
| 65 | 5 | `phaseActions` |
| 66 | 5 | `inputRefActions` |
| 96 | 9 | `validationActions` |
| 97 | 9 | `feedbackActions` |
| 102 | 9 | `resetActions` |

### `rendering/entities/LineRenderer.ts`

**Σύνολο Unused Imports:** 13

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 9 | 1 | `HoverManager` |
| 10 | 1 | `pointToLineDistance` |
| 11 | 10 | `hitTestLineSegments` |
| 11 | 65 | `renderLineWithTextCheck` |
| 68 | 64 | `entity` |
| 69 | 11 | `screenStart` |
| 70 | 11 | `screenEnd` |
| 73 | 11 | `dotRadius` |
| 115 | 11 | `renderSplitLineWithMeasurement` |
| 163 | 11 | `renderPreviewLineWithDistance` |
| 174 | 31 | `x` |
| 174 | 42 | `y` |
| 174 | 53 | `distance` |

### `systems/ai-snapping/AISnappingEngine.ts`

**Σύνολο Unused Imports:** 13

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 397 | 22 | `point` |
| 397 | 38 | `context` |
| 402 | 22 | `point` |
| 402 | 38 | `context` |
| 407 | 20 | `point` |
| 407 | 36 | `context` |
| 412 | 26 | `point` |
| 412 | 42 | `context` |
| 417 | 26 | `point` |
| 417 | 42 | `pattern` |
| 417 | 64 | `context` |
| 422 | 28 | `current` |
| 422 | 46 | `pattern` |

### `ui/components/dxf-settings/settings/special/EntitiesSettings.tsx`

**Σύνολο Unused Imports:** 13

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 15 | 1 | `LineSettings` |
| 16 | 1 | `TextSettings` |
| 17 | 1 | `GripSettings` |
| 19 | 1 | `CurrentSettingsDisplay` |
| 20 | 1 | `OverrideToggle` |
| 21 | 26 | `SubTabType` |
| 28 | 7 | `DEFAULT_GRIP_SETTINGS` |
| 72 | 49 | `computed` |
| 102 | 87 | `updateGripSettings` |
| 148 | 10 | `mockTextSettings` |
| 161 | 10 | `globalLineSettings` |
| 194 | 9 | `getTemplatesByCategory` |
| 217 | 9 | `resetToDefaults` |

### `rendering/hitTesting/HitTester.ts`

**Σύνολο Unused Imports:** 12

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 415 | 88 | `options` |
| 516 | 25 | `entity` |
| 516 | 46 | `point` |
| 516 | 62 | `maxDistance` |
| 521 | 23 | `entity` |
| 521 | 44 | `point` |
| 521 | 60 | `maxDistance` |
| 526 | 25 | `entity` |
| 526 | 46 | `point` |
| 526 | 62 | `maxDistance` |
| 531 | 23 | `point` |
| 531 | 39 | `tolerance` |

### `canvas-v2/layer-canvas/LayerCanvas.tsx`

**Σύνολο Unused Imports:** 11

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 38 | 10 | `canvasEventBus` |
| 38 | 26 | `CANVAS_EVENTS` |
| 148 | 45 | `scene` |
| 216 | 10 | `canvasManager` |
| 217 | 10 | `canvasInstance` |
| 219 | 10 | `canvasSettings` |
| 286 | 54 | `event` |
| 414 | 13 | `cs` |
| 540 | 23 | `e` |
| 588 | 22 | `e` |
| 597 | 17 | `e` |

### `canvas-v2/layer-canvas/LayerRenderer.ts`

**Σύνολο Unused Imports:** 11

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 32 | 36 | `UICategory` |
| 42 | 11 | `debugged` |
| 43 | 11 | `renderDebugShown` |
| 44 | 11 | `lastDebugTime` |
| 45 | 11 | `debuggedCoords` |
| 295 | 5 | `crosshairSettings` |
| 296 | 5 | `cursorSettings` |
| 451 | 11 | `verticesInViewport` |
| 593 | 11 | `renderRulers` |
| 785 | 5 | `tolerance` |
| 787 | 11 | `worldPoint` |

### `rendering/entities/CircleRenderer.ts`

**Σύνολο Unused Imports:** 11

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 18 | 1 | `HoverManager` |
| 21 | 10 | `renderSplitLineWithGap` |
| 22 | 1 | `renderDistanceTextPhaseAware` |
| 23 | 1 | `UI_COLORS` |
| 118 | 13 | `label` |
| 166 | 11 | `renderPreviewCircleWithMeasurements` |
| 185 | 15 | `leftPoint` |
| 185 | 26 | `rightPoint` |
| 206 | 15 | `leftPoint` |
| 206 | 26 | `rightPoint` |
| 301 | 11 | `renderLabel` |

### `systems/rulers-grid/utils.ts`

**Σύνολο Unused Imports:** 11

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 7 | 7 | `DEBUG_RULERS_GRID` |
| 195 | 5 | `transform` |
| 211 | 13 | `isOrigin` |
| 266 | 5 | `bounds` |
| 295 | 11 | `baseSpacing` |
| 502 | 50 | `settings` |
| 581 | 67 | `type` |
| 799 | 5 | `point` |
| 800 | 5 | `gridSettings` |
| 801 | 5 | `rulerSettings` |
| 802 | 5 | `transform` |

### `ui/components/LevelPanel.tsx`

**Σύνολο Unused Imports:** 11

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 4 | 7 | `DEBUG_LEVEL_PANEL` |
| 7 | 41 | `MousePointer` |
| 7 | 55 | `Pen` |
| 7 | 60 | `Move` |
| 7 | 66 | `Info` |
| 7 | 72 | `Shapes` |
| 87 | 11 | `gripSettings` |
| 123 | 10 | `activeEditingMode` |
| 124 | 10 | `showToolbox` |
| 170 | 9 | `handleEditingModeChange` |
| 295 | 70 | `e` |

### `systems/phase-manager/PhaseManager.ts`

**Σύνολο Unused Imports:** 10

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 15 | 7 | `DEBUG_PHASE_MANAGER` |
| 18 | 28 | `renderStyledTextWithOverride` |
| 23 | 1 | `CAD_UI_COLORS` |
| 84 | 11 | `transform` |
| 86 | 11 | `gripSettings` |
| 220 | 22 | `entity` |
| 333 | 24 | `entity` |
| 421 | 61 | `gripIndex` |
| 423 | 11 | `originalRadius` |
| 523 | 13 | `nextEdge` |

### `ui/FloatingPanelContainer.tsx`

**Σύνολο Unused Imports:** 10

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 4 | 7 | `DEBUG_FLOATING_PANEL_CONTAINER` |
| 11 | 1 | `StorageStatus` |
| 13 | 1 | `AutoSaveStatus` |
| 14 | 1 | `CentralizedAutoSaveStatus` |
| 18 | 38 | `PanelType` |
| 20 | 39 | `SideTab` |
| 44 | 11 | `t` |
| 44 | 14 | `ready` |
| 50 | 9 | `selectedRegions` |
| 53 | 42 | `getLevelScene` |

### `rendering/entities/BaseEntityRenderer.ts`

**Σύνολο Unused Imports:** 9

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 163 | 11 | `stateForGrip` |
| 171 | 11 | `drawGripAtWorld` |
| 179 | 11 | `onScreen` |
| 522 | 30 | `vertices` |
| 522 | 51 | `dotRadius` |
| 548 | 5 | `prevScreen` |
| 549 | 5 | `currentScreen` |
| 550 | 5 | `nextScreen` |
| 552 | 5 | `labelOffset` |

### `systems/toolbars/ToolbarsSystem.tsx`

**Σύνολο Unused Imports:** 9

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 3 | 54 | `useCallback` |
| 3 | 67 | `useMemo` |
| 3 | 76 | `useEffect` |
| 56 | 10 | `hotkeys` |
| 56 | 19 | `setHotkeys` |
| 64 | 5 | `getActiveTool` |
| 65 | 5 | `isToolActive` |
| 66 | 5 | `isToolEnabled` |
| 67 | 5 | `isToolVisible` |

### `utils/geometry/SegmentChaining.ts`

**Σύνολο Unused Imports:** 9

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 26 | 48 | `originalEntities` |
| 53 | 15 | `tailToStart` |
| 54 | 15 | `tailToEnd` |
| 94 | 15 | `headToStart` |
| 95 | 15 | `headToEnd` |
| 144 | 16 | `seg` |
| 146 | 25 | `seg` |
| 156 | 15 | `distToStart` |
| 160 | 15 | `distToEnd` |

### `debug/loggers/SnapDebugLogger.ts`

**Σύνολο Unused Imports:** 8

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 63 | 46 | `entity` |
| 63 | 54 | `i` |
| 69 | 13 | `entityTypes` |
| 78 | 48 | `i` |
| 80 | 17 | `vertices` |
| 81 | 17 | `closed` |
| 100 | 13 | `settings` |
| 112 | 18 | `hasViewport` |

### `utils/hover/shape-renderers.ts`

**Σύνολο Unused Imports:** 8

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 7 | 1 | `renderPolylineHover` |
| 8 | 1 | `renderGreenDots` |
| 9 | 1 | `renderRadiusWithMeasurement` |
| 24 | 9 | `screenCenter` |
| 25 | 9 | `screenRadius` |
| 128 | 68 | `options` |
| 151 | 62 | `options` |
| 184 | 66 | `options` |

### `debug/utils/devlog.ts`

**Σύνολο Unused Imports:** 7

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 26 | 25 | `args` |
| 52 | 26 | `label` |
| 52 | 44 | `args` |
| 60 | 28 | `label` |
| 60 | 46 | `args` |
| 69 | 25 | `label` |
| 69 | 43 | `args` |

### `ui/icons/iconRegistry.tsx`

**Σύνολο Unused Imports:** 7

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 7 | 31 | `Triangle` |
| 7 | 51 | `Hexagon` |
| 10 | 36 | `FileSpreadsheet` |
| 12 | 21 | `Lock` |
| 12 | 27 | `Unlock` |
| 13 | 27 | `Compass` |
| 13 | 42 | `Minus` |

### `debug/DebugToolbar.tsx`

**Σύνολο Unused Imports:** 6

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 32 | 3 | `currentScene` |
| 33 | 3 | `activeTool` |
| 34 | 3 | `handleToolChange` |
| 35 | 3 | `testModalOpen` |
| 37 | 3 | `testReport` |
| 39 | 3 | `formattedTestReport` |

### `rendering/passes/OverlayPass.ts`

**Σύνολο Unused Imports:** 6

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 7 | 1 | `EntityModel` |
| 135 | 62 | `options` |
| 195 | 69 | `options` |
| 258 | 57 | `options` |
| 296 | 49 | `options` |
| 375 | 60 | `options` |

### `snapping/engines/ExtensionSnapEngine.ts`

**Σύνολο Unused Imports:** 6

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 9 | 1 | `GeometricCalculations` |
| 13 | 10 | `getNearestPointOnLine` |
| 22 | 14 | `entities` |
| 83 | 11 | `distToStart` |
| 84 | 11 | `distToEnd` |
| 132 | 11 | `distance` |

### `ui/OverlayPanel.tsx`

**Σύνολο Unused Imports:** 6

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 4 | 23 | `EyeOff` |
| 4 | 40 | `MousePointer2` |
| 7 | 33 | `getStatusColors` |
| 31 | 5 | `toggleRegionVisibility` |
| 32 | 5 | `selectRegion` |
| 33 | 5 | `clearSelection` |

### `../../providers/NotificationProvider.tsx`

**Σύνολο Unused Imports:** 5

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 5 | 66 | `X` |
| 45 | 9 | `notificationQueue` |
| 120 | 7 | `ariaLabel` |
| 123 | 7 | `showProgress` |
| 159 | 11 | `toastId` |

### `grips/resolveTarget.ts`

**Σύνολο Unused Imports:** 5

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 2 | 1 | `useOverlayStore` |
| 22 | 19 | `i` |
| 22 | 30 | `p` |
| 36 | 17 | `i` |
| 36 | 28 | `p` |

### `rendering/entities/AngleMeasurementRenderer.ts`

**Σύνολο Unused Imports:** 5

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 9 | 1 | `pointToLineDistance` |
| 39 | 31 | `vertex` |
| 39 | 48 | `point1` |
| 39 | 65 | `point2` |
| 84 | 27 | `points` |

### `snapping/engines/NearSnapEngine.ts`

**Σύνολο Unused Imports:** 5

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 10 | 41 | `GenericSnapPoint` |
| 18 | 14 | `entities` |
| 37 | 41 | `cursorPoint` |
| 37 | 63 | `radius` |
| 96 | 53 | `index` |

### `systems/grip-interaction/GripInteractionManager.ts`

**Σύνολο Unused Imports:** 5

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 62 | 18 | `entity` |
| 62 | 39 | `mousePosition` |
| 62 | 63 | `tolerance` |
| 232 | 32 | `entity` |
| 232 | 53 | `currentPosition` |

### `test/visual/overlayRenderer.ts`

**Σύνολο Unused Imports:** 5

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 70 | 3 | `seed` |
| 96 | 3 | `seed` |
| 146 | 3 | `seed` |
| 202 | 3 | `opts` |
| 223 | 31 | `index` |

### `ui/OverlayToolbar.tsx`

**Σύνολο Unused Imports:** 5

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 5 | 22 | `orientation` |
| 8 | 10 | `MousePointer` |
| 37 | 3 | `snapEnabled` |
| 37 | 16 | `onSnapToggle` |
| 95 | 22 | `overlayId` |

### `components/SimpleProjectDialog.tsx`

**Σύνολο Unused Imports:** 4

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 9 | 1 | `useNotifications` |
| 193 | 17 | `allBuildingIds` |
| 234 | 11 | `targetId` |
| 236 | 11 | `targetType` |

### `contexts/ProjectHierarchyContext.tsx`

**Σύνολο Unused Imports:** 4

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 4 | 7 | `DEBUG_PROJECT_HIERARCHY` |
| 14 | 7 | `getBuildingsByProjectId` |
| 14 | 40 | `projectId` |
| 194 | 13 | `company` |

### `hooks/drawing/useDrawingHandlers.ts`

**Σύνολο Unused Imports:** 4

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 36 | 5 | `finishEntity` |
| 43 | 24 | `enabledModes` |
| 46 | 11 | `snapManager` |
| 48 | 19 | `point` |

### `providers/DxfSettingsProvider.tsx`

**Σύνολο Unused Imports:** 4

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 561 | 10 | `saveAllSettings` |
| 638 | 33 | `source` |
| 638 | 41 | `timestamp` |
| 898 | 11 | `isOverrideActive` |

### `rendering/core/EntityRendererComposite.ts`

**Σύνολο Unused Imports:** 4

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 26 | 11 | `gripSettings` |
| 27 | 11 | `gripInteraction` |
| 169 | 47 | `options` |
| 175 | 13 | `screenPos` |

### `rendering/entities/ArcRenderer.ts`

**Σύνολο Unused Imports:** 4

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 9 | 1 | `HoverManager` |
| 14 | 3 | `hitTestArcEntity` |
| 72 | 11 | `endRad` |
| 82 | 11 | `screenStartPoint` |

### `rendering/ui/crosshair/CrosshairRenderer.ts`

**Σύνολο Unused Imports:** 4

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 75 | 5 | `position` |
| 76 | 5 | `viewport` |
| 77 | 5 | `settings` |
| 78 | 5 | `gapSize` |

### `snapping/engines/NodeSnapEngine.ts`

**Σύνολο Unused Imports:** 4

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 9 | 1 | `SpatialFactory` |
| 11 | 1 | `GeometricCalculations` |
| 12 | 1 | `calculateDistance` |
| 122 | 53 | `index` |

### `systems/constraints/ConstraintsSystem.tsx`

**Σύνολο Unused Imports:** 4

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 2 | 32 | `useCallback` |
| 14 | 1 | `Point2D` |
| 71 | 5 | `lastAppliedResult` |
| 78 | 5 | `setActiveConstraints` |

### `test/setupTests.ts`

**Σύνολο Unused Imports:** 4

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 66 | 11 | `width` |
| 67 | 11 | `height` |
| 379 | 11 | `threshold` |
| 406 | 65 | `options` |

### `ui/toolbar/toolDefinitions.ts`

**Σύνολο Unused Imports:** 4

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 3 | 55 | `CircleDot` |
| 3 | 66 | `Circle` |
| 5 | 9 | `Settings` |
| 5 | 35 | `Plus` |

### `utils/overlay-drawing.ts`

**Σύνολο Unused Imports:** 4

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 10 | 7 | `DEBUG_OVERLAY_DRAWING` |
| 39 | 5 | `canvasHeight` |
| 124 | 5 | `canvasHeight` |
| 159 | 5 | `isEditing` |

### `utils/SmartBoundsManager.ts`

**Σύνολο Unused Imports:** 4

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 11 | 1 | `FitToViewService` |
| 12 | 1 | `DxfScene` |
| 13 | 1 | `ColorLayer` |
| 52 | 5 | `scene` |

### `canvas-v2/overlays/SnapIndicatorOverlay.tsx`

**Σύνολο Unused Imports:** 3

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 20 | 3 | `viewport` |
| 21 | 3 | `canvasRect` |
| 22 | 3 | `transform` |

### `core/spatial/GridSpatialIndex.ts`

**Σύνολο Unused Imports:** 3

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 230 | 48 | `snapType` |
| 236 | 27 | `result` |
| 357 | 11 | `pointToCell` |

### `grips/Grips.ts`

**Σύνολο Unused Imports:** 3

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 12 | 12 | `entityId` |
| 12 | 30 | `type` |
| 16 | 14 | `entityId` |

### `hooks/drawing/useUnifiedDrawing.ts`

**Σύνολο Unused Imports:** 3

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 89 | 1 | `useSnapContext` |
| 312 | 54 | `transform` |
| 418 | 59 | `transform` |

### `rendering/core/RenderPipeline.ts`

**Σύνολο Unused Imports:** 3

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 7 | 1 | `EntityModel` |
| 164 | 14 | `passName` |
| 168 | 15 | `passName` |

### `rendering/entities/PointRenderer.ts`

**Σύνολο Unused Imports:** 3

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 20 | 31 | `options` |
| 30 | 48 | `size` |
| 31 | 11 | `screenPos` |

### `rendering/passes/EntityPass.ts`

**Σύνολο Unused Imports:** 3

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 315 | 68 | `options` |
| 340 | 72 | `options` |
| 364 | 68 | `options` |

### `services/__tests__/ServiceRegistry.test.ts`

**Σύνολο Unused Imports:** 3

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 15 | 55 | `vi` |
| 126 | 13 | `service` |
| 137 | 13 | `service` |

### `snapping/engines/TangentSnapEngine.ts`

**Σύνολο Unused Imports:** 3

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 9 | 1 | `GeometricCalculations` |
| 18 | 14 | `entities` |
| 48 | 11 | `tangentDistance` |

### `snapping/hooks/useSnapManager.tsx`

**Σύνολο Unused Imports:** 3

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 37 | 35 | `onSnapPoint` |
| 120 | 15 | `entityTypes` |
| 126 | 50 | `i` |

### `snapping/shared/BaseSnapEngine.ts`

**Σύνολο Unused Imports:** 3

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 8 | 1 | `GeometricCalculations` |
| 69 | 5 | `cursorPoint` |
| 75 | 33 | `T` |

### `systems/dynamic-input/hooks/useDynamicInputKeyboard.ts`

**Σύνολο Unused Imports:** 3

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 4 | 7 | `DEBUG_DYNAMIC_INPUT_KEYBOARD` |
| 67 | 58 | `setRadiusValue` |
| 67 | 74 | `setDiameterValue` |

### `ui/components/layers/hooks/useLayersCallbacks.ts`

**Σύνολο Unused Imports:** 3

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 223 | 46 | `colorName` |
| 259 | 13 | `mergedEntityName` |
| 273 | 11 | `mergedEntityName` |

### `ui/CursorSettingsPanel.tsx`

**Σύνολο Unused Imports:** 3

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 56 | 10 | `SliderRow` |
| 87 | 10 | `ColorPicker` |
| 286 | 13 | `taskbarHeight` |

### `ui/hooks/useConsolidatedSettings.ts`

**Σύνολο Unused Imports:** 3

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 1 | 33 | `useEffect` |
| 40 | 69 | `entityId` |
| 43 | 9 | `zustandStore` |

### `ui/toolbar/EnhancedDXFToolbar.tsx`

**Σύνολο Unused Imports:** 3

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 4 | 7 | `DEBUG_ENHANCED_DXF_TOOLBAR` |
| 12 | 1 | `ScaleControls` |
| 18 | 1 | `SceneModel` |

### `utils/dxf-entity-parser.ts`

**Σύνολο Unused Imports:** 3

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 239 | 58 | `match` |
| 278 | 11 | `rawBytes` |
| 336 | 11 | `codes` |

### `utils/geometry/GeometryUtils.ts`

**Σύνολο Unused Imports:** 3

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 192 | 48 | `label` |
| 194 | 17 | `seg` |
| 194 | 22 | `i` |

### `../../types/contacts/helpers.ts`

**Σύνολο Unused Imports:** 3

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 1 | 19 | `IndividualContact` |
| 1 | 38 | `CompanyContact` |
| 1 | 54 | `ServiceContact` |

### `../../lib/firestore/utils.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 3 | 15 | `getFirestore` |
| 3 | 62 | `QueryConstraint` |

### `../../services/projects/services/ProjectsService.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 4 | 1 | `Contact` |
| 15 | 11 | `mockRepo` |

### `canvas-v2/dxf-canvas/DxfCanvas.tsx`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 142 | 23 | `scene` |
| 162 | 9 | `snapResults` |

### `canvas-v2/dxf-canvas/DxfRenderer.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 10 | 32 | `COORDINATE_LAYOUT` |
| 24 | 11 | `renderContext` |

### `components/dxf-layout/ToolbarSection.tsx`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 30 | 9 | `handleOverlayDuplicate` |
| 36 | 9 | `handleOverlayDelete` |

### `core/spatial/QuadTreeSpatialIndex.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 181 | 48 | `snapType` |
| 185 | 27 | `result` |

### `debug/loggers/OptimizedLogger.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 89 | 14 | `args` |
| 104 | 14 | `args` |

### `hooks/common/useEffectOnceDevSafe.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 56 | 3 | `debugName` |
| 96 | 3 | `debugName` |

### `hooks/interfaces/useCanvasOperations.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 11 | 1 | `FitToViewService` |
| 13 | 1 | `ZoomManager` |

### `io/dxf-import.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 445 | 34 | `reject` |
| 543 | 15 | `garbledCount` |

### `providers/StyleManagerProvider.tsx`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 4 | 7 | `DEBUG_STYLE_MANAGER_PROVIDER` |
| 6 | 44 | `useEffect` |

### `rendering/cache/PathCache.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 275 | 28 | `path` |
| 366 | 10 | `data` |

### `rendering/canvas/core/CanvasSettings.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 191 | 13 | `oldSettings` |
| 337 | 19 | `canvasType` |

### `rendering/canvas/utils/CanvasUtils.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 229 | 11 | `imageData` |
| 232 | 11 | `rect` |

### `rendering/entities/EllipseRenderer.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 9 | 1 | `HoverManager` |
| 13 | 1 | `applyRenderingTransform` |

### `rendering/entities/RectangleRenderer.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 9 | 1 | `pointToLineDistance` |
| 10 | 10 | `hitTestLineSegments` |

### `rendering/index.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 95 | 1 | `createHitTester` |
| 97 | 1 | `EntityModel` |

### `rendering/passes/BackgroundPass.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 75 | 53 | `options` |
| 207 | 11 | `transform` |

### `rendering/ui/cursor/CursorRenderer.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 78 | 5 | `viewport` |
| 197 | 5 | `settings` |

### `rendering/ui/grid/GridRenderer.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 19 | 1 | `COORDINATE_LAYOUT` |
| 78 | 5 | `mode` |

### `rendering/ui/ruler/RulerRenderer.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 77 | 5 | `mode` |
| 130 | 5 | `orientation` |

### `services/__benchmarks__/CanvasBoundsService.benchmark.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 54 | 11 | `rect` |
| 99 | 11 | `rect` |

### `services/LayerOperationsService.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 12 | 27 | `ImportedLayerOperationResult` |
| 287 | 5 | `colorGroupName` |

### `settings-core/__tests__/validation.test.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 18 | 3 | `DEFAULT_TEXT_SETTINGS` |
| 19 | 3 | `DEFAULT_GRIP_SETTINGS` |

### `snapping/engines/CenterSnapEngine.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 9 | 1 | `SpatialFactory` |
| 13 | 10 | `findStandardSnapCandidates` |

### `snapping/engines/InsertionSnapEngine.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 9 | 1 | `GeometricCalculations` |
| 56 | 14 | `entities` |

### `snapping/engines/MidpointSnapEngine.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 7 | 7 | `DEBUG_MIDPOINT_SNAP_ENGINE` |
| 12 | 1 | `SpatialFactory` |

### `snapping/engines/NearestSnapEngine.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 9 | 1 | `GeometricCalculations` |
| 19 | 14 | `entities` |

### `snapping/engines/ParallelSnapEngine.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 14 | 11 | `referenceLine` |
| 20 | 14 | `entities` |

### `snapping/engines/PerpendicularSnapEngine.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 11 | 41 | `GenericSnapPoint` |
| 20 | 14 | `entities` |

### `snapping/engines/QuadrantSnapEngine.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 9 | 1 | `GeometricCalculations` |
| 18 | 14 | `entities` |

### `snapping/SnapEngineCore.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 7 | 7 | `DEBUG_SNAP_ENGINE_CORE` |
| 38 | 11 | `entitiesCount` |

### `stores/DxfSettingsStore.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 48 | 3 | `diffSettings` |
| 49 | 3 | `extractOverrides` |

### `systems/cursor/config.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 173 | 33 | `source` |
| 173 | 41 | `timestamp` |

### `systems/cursor/CursorSystem.tsx`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 3 | 56 | `useCallback` |
| 13 | 36 | `throttleMouseEvents` |

### `systems/cursor/useCentralizedMouseHandlers.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 11 | 32 | `COORDINATE_LAYOUT` |
| 311 | 38 | `e` |

### `systems/rulers-grid/useSnapManagement.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 21 | 3 | `rulers` |
| 23 | 3 | `grid` |

### `ui/components/AdminLayerManager.tsx`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 32 | 30 | `layerId` |
| 32 | 47 | `action` |

### `ui/components/dxf-settings/settings/core/TextSettings.tsx`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 156 | 10 | `isPreviewOpen` |
| 156 | 25 | `setIsPreviewOpen` |

### `utils/dxf-loader.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 81 | 3 | `dxfText` |
| 82 | 3 | `opts` |

### `utils/entity-renderer.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 39 | 11 | `ctx` |
| 99 | 38 | `entityId` |

### `utils/hover/line-renderer.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 6 | 1 | `HOVER_CONFIG` |
| 10 | 63 | `options` |

### `utils/hover/text-spline-renderers.ts`

**Σύνολο Unused Imports:** 2

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 11 | 63 | `options` |
| 41 | 75 | `options` |

### `../../services/floorplans/BuildingFloorplanService.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 3 | 10 | `collection` |

### `../../services/floorplans/FloorplanService.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 3 | 10 | `collection` |

### `../../services/floorplans/UnitFloorplanService.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 3 | 10 | `collection` |

### `../../services/projects/repositories/MockProjectsRepository.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 5 | 1 | `Building` |

### `__tests__/visual-regression.test.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 9 | 1 | `fs` |

### `adapters/ZustandToConsolidatedAdapter.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 72 | 3 | `settingsKey` |

### `canvas-v2/layer-canvas/layer-types.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 9 | 1 | `CoreRulerSettings` |

### `canvas-v2/layer-canvas/selection/SelectionRenderer.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 63 | 5 | `viewport` |

### `canvas-v2/overlays/CursorTooltipOverlay.tsx`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 17 | 3 | `canvasRect` |

### `canvas-v2/overlays/SnapModeIndicator.tsx`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 20 | 3 | `enabledModes` |

### `collaboration/CollaborationOverlay.tsx`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 103 | 29 | `entityId` |

### `components/DestinationWizard.tsx`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 117 | 9 | `getDestinationColor` |

### `components/HierarchicalDestinationSelector.tsx`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 6 | 1 | `CompanyContact` |

### `components/StorageStatus.tsx`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 16 | 24 | `checkStorage` |

### `config/color-config.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 83 | 11 | `hex` |

### `contexts/CanvasContext.tsx`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 6 | 1 | `ZoomConfig` |

### `core/spatial/SpatialIndexFactory.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 191 | 11 | `createPlaceholder` |

### `debug/CalibrationGridRenderer.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 10 | 1 | `COORDINATE_LAYOUT` |

### `debug/core/DebugManager.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 44 | 26 | `args` |

### `debug/grid-workflow-test.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 56 | 10 | `getElementSafe` |

### `debug/layout-debug/CoordinateDebugOverlay.tsx`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 119 | 10 | `viewport` |

### `debug/panels/HierarchyDebugPanel.tsx`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 23 | 5 | `loadProjects` |

### `debug/unified-test-runner.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 11 | 1 | `Point2D` |

### `events/selection-bus.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 2 | 7 | `DEBUG_SELECTION_BUS` |

### `hooks/common/useProSnapIntegration.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 7 | 1 | `getGridSettings` |

### `hooks/common/useToolbarState.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 9 | 7 | `DEBUG_TOOLBAR_STATE` |

### `hooks/scene/useSceneState.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 11 | 1 | `UI_COLORS` |

### `hooks/useDxfViewerState.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 11 | 1 | `DrawingTool` |

### `hooks/useKeyboardShortcuts.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 32 | 3 | `currentScene` |

### `hooks/useOverlayDrawing.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 7 | 8 | `React` |

### `integration/DXFViewerLayout.tsx`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 4 | 22 | `FullscreenView` |

### `integration/types.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 6 | 1 | `DrawingState` |

### `layout/CadDock.tsx`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 2 | 17 | `useEffect` |

### `managers/SceneUpdateManager.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 87 | 13 | `oldScene` |

### `overlays/snap-adapter.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 7 | 7 | `DEBUG_SNAP_ADAPTER` |

### `overlays/types.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 5 | 1 | `Point2D` |

### `pipeline/useDxfPipeline.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 56 | 44 | `levelId` |

### `providers/GripProvider.tsx`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 9 | 10 | `useDxfSettings` |

### `providers/StableFirestoreProvider.tsx`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 158 | 38 | `key` |

### `rendering/cache/TextMetricsCache.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 99 | 37 | `font` |

### `rendering/canvas/core/CanvasManager.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 50 | 11 | `settings` |

### `rendering/core/CoordinateTransforms.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 83 | 5 | `viewport` |

### `rendering/entities/PolylineRenderer.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 11 | 10 | `hitTestLineSegments` |

### `rendering/entities/shared/line-rendering-utils.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 30 | 9 | `halfGap` |

### `rendering/entities/shared/phase-text-utils.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 20 | 3 | `entity` |

### `rendering/entities/SplineRenderer.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 10 | 1 | `pointToLineDistance` |

### `rendering/ui/core/UIRenderContext.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 55 | 3 | `viewport` |

### `rendering/ui/core/UIRendererComposite.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 206 | 27 | `viewport` |

### `rendering/ui/origin/OriginMarkersRenderer.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 10 | 1 | `COORDINATE_LAYOUT` |

### `rendering/ui/snap/SnapRenderer.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 102 | 5 | `viewport` |

### `services/__tests__/ServiceRegistry.v2.enterprise.test.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 11 | 42 | `ServiceName` |

### `services/EntityMergeService.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 7 | 1 | `Point2D` |

### `services/ServiceRegistry.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 25 | 36 | `CanvasBoundsCache` |

### `snapping/context/SnapContext.tsx`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 115 | 18 | `prev` |

### `snapping/engines/EndpointSnapEngine.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 9 | 1 | `SpatialFactory` |

### `snapping/engines/IntersectionSnapEngine.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 36 | 14 | `entities` |

### `snapping/engines/OrthoSnapEngine.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 19 | 14 | `entities` |

### `snapping/orchestrator/SnapContextManager.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 30 | 5 | `cursorPoint` |

### `snapping/orchestrator/SnapEngineRegistry.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 20 | 7 | `DEBUG_SNAP_ENGINE_REGISTRY` |

### `snapping/orchestrator/SnapOrchestrator.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 143 | 11 | `settings` |

### `snapping/shared/GeometricCalculations.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 7 | 18 | `ExtendedSnapType` |

### `snapping/SnapPresets.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 6 | 33 | `ProSnapSettings` |

### `systems/collaboration/CollaborationEngine.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 90 | 11 | `reconnectTimer` |

### `systems/constraints/useConstraintsSystemState.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 1 | 31 | `useCallback` |

### `systems/constraints/utils.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 306 | 11 | `angle` |

### `systems/drawing-orchestrator/DrawingOrchestrator.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 30 | 9 | `dynamicInputHandler` |

### `systems/dynamic-input/hooks/useDynamicInputRealtime.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 6 | 7 | `DEBUG_DYNAMIC_INPUT` |

### `systems/entity-creation/EntityCreationSystem.tsx`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 3 | 44 | `useRef` |

### `systems/levels/LevelsSystem.tsx`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 3 | 1 | `useMemo` |

### `systems/rulers-grid/useGridManagement.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 5 | 7 | `DEBUG_RULERS_GRID` |

### `systems/rulers-grid/useRenderingCalculations.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 64 | 5 | `layout` |

### `systems/rulers-grid/useRulerManagement.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 13 | 3 | `rulers` |

### `systems/selection/UniversalMarqueeSelection.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 93 | 7 | `entityLayers` |

### `systems/selection/useSelectionSystemState.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 9 | 61 | `SelectionAction` |

### `systems/selection/utils.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 14 | 1 | `calculateVerticesBounds` |

### `systems/toolbars/hooks/useToolbarsContextValue.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 13 | 1 | `ToolbarSystemUtils` |

### `systems/toolbars/utils.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 265 | 36 | `layout` |

### `systems/tools/ToolStateManager.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 8 | 1 | `DrawingTool` |

### `types/overlay.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 2 | 26 | `PROPERTY_STATUS_COLORS` |

### `ui/components/ColorManager.tsx`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 37 | 9 | `name` |

### `ui/components/dxf-settings/settings/core/GripSettings.tsx`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 3 | 17 | `useState` |

### `ui/components/dxf-settings/settings/core/LineSettings.tsx`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 183 | 9 | `currentDashPattern` |

### `ui/components/dxf-settings/settings/shared/CurrentSettingsDisplay.tsx`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 55 | 10 | `forceUpdate` |

### `ui/components/dxf-settings/settings/shared/LinePreview.tsx`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 63 | 73 | `activeTab` |

### `ui/components/dxf-settings/settings/special/CursorSettings.tsx`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 3 | 17 | `useState` |

### `ui/components/dxf-settings/settings/special/LayersSettings.tsx`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 40 | 40 | `index` |

### `ui/components/layers/components/EntityCard.tsx`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 48 | 3 | `onEntityColorChange` |

### `ui/components/layers/hooks/useKeyboardNavigation.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 15 | 3 | `selectedEntityIds` |

### `ui/components/layers/hooks/useLayersState.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 1 | 20 | `useMemo` |

### `ui/components/PerformanceMonitor.tsx`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 8 | 20 | `Cpu` |

### `ui/components/SceneInfoSection.tsx`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 4 | 10 | `Info` |

### `ui/components/shared/SubTabRenderer.tsx`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 68 | 3 | `onTabChange` |

### `ui/hooks/useFloatingPanelHandle.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 56 | 13 | `colorKey` |

### `ui/hooks/useUnifiedSpecificSettings.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 222 | 22 | `updates` |

### `ui/OverlayList.tsx`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 26 | 3 | `onToggleLayers` |

### `ui/wizard/CalibrationStep.tsx`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 4 | 17 | `AlertCircle` |

### `ui/wizard/LevelSelectionStep.tsx`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 3 | 27 | `useEffect` |

### `utils/dxf-scene-builder.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 2 | 32 | `EntityData` |

### `utils/dynamicSystemImports.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 7 | 17 | `ComponentType` |

### `utils/entity-validation-utils.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 7 | 1 | `ArcEntity` |

### `utils/feedback-utils.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 6 | 1 | `createFeedbackMessage` |

### `utils/hover/edge-utils.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 8 | 10 | `renderEdgeDistanceLabel` |

### `utils/hover/polyline-renderer.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 13 | 67 | `options` |

### `utils/hover/radius-utils.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 11 | 3 | `worldCenter` |

### `utils/hover/render-utils.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 25 | 64 | `points` |

### `utils/storage-utils.ts`

**Σύνολο Unused Imports:** 1

| Γραμμή | Στήλη | Μεταβλητή/Import |
|--------|--------|------------------|
| 186 | 13 | `usage` |
