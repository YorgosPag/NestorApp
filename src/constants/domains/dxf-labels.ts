/**
 * DXF VIEWER LABELS
 *
 * Tool labels, settings labels, and viewer configuration labels
 * for the DXF Viewer subapp (AutoCAD-style drawing interface).
 *
 * @domain DXF Viewer / CAD Tools
 * @consumers toolDefinitions.tsx, EntitiesSettings.tsx, LayersSettings.tsx, useLayerManagerState.ts
 */

// ============================================================================
// DXF LAYER CATEGORY LABELS
// ============================================================================

export const DXF_LAYER_CATEGORY_LABELS = {
  all: 'dxfViewer.layers.allCategories',
  electrical: 'dxfViewer.layers.electrical',
  plumbing: 'dxfViewer.layers.plumbing',
  hvac: 'dxfViewer.layers.hvac'
} as const;

// ============================================================================
// SELECTION TOOL LABELS
// ============================================================================

export const DXF_SELECTION_TOOL_LABELS = {
  SELECT: 'tools.select',
  PAN: 'tools.pan'
} as const;

// ============================================================================
// DRAWING TOOL LABELS
// ============================================================================

export const DXF_DRAWING_TOOL_LABELS = {
  LINE: 'tools.line',
  LINE_PERPENDICULAR: 'tools.linePerpendicular',
  LINE_PARALLEL: 'tools.lineParallel',
  RECTANGLE: 'tools.rectangle',
  CIRCLE_RADIUS: 'tools.circleRadius',
  CIRCLE_DIAMETER: 'tools.circleDiameter',
  CIRCLE_2P_DIAMETER: 'tools.circle2pDiameter',
  CIRCLE_3P: 'tools.circle3p',
  CIRCLE_CHORD_SAGITTA: 'tools.circleChordSagitta',
  CIRCLE_2P_RADIUS: 'tools.circle2pRadius',
  CIRCLE_BEST_FIT: 'tools.circleBestFit',
  CIRCLE_TTT: 'tools.circleTTT',
  POLYLINE: 'tools.polyline',
  POLYGON: 'tools.polygon',
  LAYERING: 'tools.layering',
  // Arc drawing tool variations (ADR-059)
  ARC: 'tools.arc',
  ARC_3P: 'tools.arc3p',
  ARC_CENTER_START_END: 'tools.arcCenterStartEnd',
  ARC_START_CENTER_END: 'tools.arcStartCenterEnd',
  // Construction guide tools (ADR-189)
  GUIDE_X: 'tools.guideX',
  GUIDE_Z: 'tools.guideZ',
  GUIDE_XZ: 'tools.guideXZ',
  GUIDE_PARALLEL: 'tools.guideParallel',
  GUIDE_PERPENDICULAR: 'tools.guidePerpendicular',
  GUIDE_SEGMENTS: 'tools.guideSegments',
  GUIDE_DISTANCE: 'tools.guideDistance',
  GUIDE_ADD_POINT: 'tools.guideAddPoint',
  GUIDE_DELETE_POINT: 'tools.guideDeletePoint',
  GUIDE_MOVE: 'tools.guideMove',
  GUIDE_DELETE: 'tools.guideDelete',
  // Arc/Circle guide tools (ADR-189)
  GUIDE_ARC_SEGMENTS: 'tools.guideArcSegments',
  GUIDE_ARC_DISTANCE: 'tools.guideArcDistance',
  GUIDE_ARC_LINE_INTERSECT: 'tools.guideArcLineIntersect',
  GUIDE_CIRCLE_INTERSECT: 'tools.guideCircleIntersect',
  GUIDE_RECT_CENTER: 'tools.guideRectCenter',
  GUIDE_LINE_MIDPOINT: 'tools.guideLineMidpoint',
  GUIDE_CIRCLE_CENTER: 'tools.guideCircleCenter',
  GUIDE_GRID: 'tools.guideGrid',
  GUIDE_ROTATE: 'tools.guideRotate',
  GUIDE_ROTATE_ALL: 'tools.guideRotateAll',
  GUIDE_ROTATE_GROUP: 'tools.guideRotateGroup',
  GUIDE_EQUALIZE: 'tools.guideEqualize',
  GUIDE_POLAR_ARRAY: 'tools.guidePolarArray',
  GUIDE_SCALE: 'tools.guideScale',
  GUIDE_ANGLE: 'tools.guideAngle',
  GUIDE_MIRROR: 'tools.guideMirror',
  GUIDE_FROM_ENTITY: 'tools.guideFromEntity',
  GUIDE_SELECT: 'tools.guideSelect',
  GUIDE_COPY_PATTERN: 'tools.guideCopyPattern',
  GUIDE_OFFSET_ENTITY: 'tools.guideOffsetEntity',
  GUIDE_PRESET_GRID: 'tools.guidePresetGrid',
  GUIDE_FROM_SELECTION: 'tools.guideFromSelection',
} as const;

// ============================================================================
// EDITING TOOL LABELS
// ============================================================================

export const DXF_EDITING_TOOL_LABELS = {
  GRIP_EDIT: 'tools.gripEdit',
  MOVE: 'tools.move',
  ROTATE: 'tools.rotate',
  COPY: 'tools.copy',
  DELETE: 'tools.delete'
} as const;

// ============================================================================
// MEASUREMENT TOOL LABELS
// ============================================================================

export const DXF_MEASUREMENT_TOOL_LABELS = {
  MEASURE_DISTANCE: 'tools.measureDistance',
  MEASURE_DISTANCE_2P: 'tools.measureDistance2P',
  MEASURE_DISTANCE_CONTINUOUS: 'tools.measureDistanceContinuous',
  MEASURE_AREA: 'tools.measureArea',
  MEASURE_ANGLE: 'tools.measureAngle',
  MEASURE_ANGLE_BASIC: 'tools.measureAngleBasic',
  MEASURE_ANGLE_LINE_ARC: 'tools.measureAngleLineArc',
  MEASURE_ANGLE_TWO_ARCS: 'tools.measureAngleTwoArcs',
  MEASURE_ANGLE_MEASUREGEOM: 'tools.measureAngleMeasuregeom',
  MEASURE_ANGLE_CONSTRAINT: 'tools.measureAngleConstraint'
} as const;

// ============================================================================
// ZOOM TOOL LABELS
// ============================================================================

export const DXF_ZOOM_TOOL_LABELS = {
  ZOOM_IN: 'tools.zoomIn',
  ZOOM_OUT: 'tools.zoomOut',
  ZOOM_WINDOW: 'tools.zoomWindow',
  ZOOM_EXTENTS: 'tools.zoomExtents'
} as const;

// ============================================================================
// UTILITY TOOL LABELS
// ============================================================================

export const DXF_UTILITY_TOOL_LABELS = {
  UNDO: 'tools.undo',
  REDO: 'tools.redo',
  CURSOR_SETTINGS: 'tools.cursorSettings',
  FIT_TO_VIEW: 'tools.fitToView',
  EXPORT: 'tools.export',
  RUN_TESTS: 'tools.runTests',
  TOGGLE_PERF: 'tools.togglePerf',
  PDF_BACKGROUND: 'tools.pdfBackground',
  AI_ASSISTANT: 'tools.aiAssistant',
  GUIDE_ANALYSIS: 'tools.guideAnalysis'
} as const;

// ============================================================================
// DXF SETTINGS LABELS
// ============================================================================

export const DXF_SETTINGS_TAB_LABELS = {
  DRAWING: 'dxfViewer.settings.tabs.drawing',
  MEASUREMENTS: 'dxfViewer.settings.tabs.measurements',
  DRAFT: 'dxfViewer.settings.tabs.draft',
  COMPLETION: 'dxfViewer.settings.tabs.completion',
  HOVER: 'dxfViewer.settings.tabs.hover',
  SELECTION: 'dxfViewer.settings.tabs.selection'
} as const;

// ============================================================================
// DXF SIMPLE TOOL LABELS (without context)
// ============================================================================

export const DXF_DRAWING_SIMPLE_LABELS = {
  LINE: 'dxfViewer.tools.line',
  RECTANGLE: 'dxfViewer.tools.rectangle',
  CIRCLE: 'dxfViewer.tools.circle',
  POLYLINE: 'dxfViewer.tools.polyline',
  POLYGON: 'dxfViewer.tools.polygon'
} as const;

export const DXF_MEASUREMENT_SIMPLE_LABELS = {
  DISTANCE: 'dxfViewer.measurements.distance',
  AREA: 'dxfViewer.measurements.area',
  ANGLE: 'dxfViewer.measurements.angle'
} as const;

