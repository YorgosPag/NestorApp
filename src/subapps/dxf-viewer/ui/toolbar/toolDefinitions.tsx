'use client';
import {
  MousePointer, Hand, ZoomIn, ZoomOut, Minus, Square, CircleDot, Circle, Pen,
  Move, Copy, Trash2, Ruler, Undo, Redo, Focus, Maximize2,
  Grid, Settings, Crop, Download, Plus, Crosshair,
  Maximize, Calculator, Map, Edit, Hexagon, FlaskConical,
  Activity, // 🏢 ENTERPRISE: Performance Monitor icon
  FileUp // 🏢 ENTERPRISE: PDF Background icon
} from "lucide-react";

// 🏢 ENTERPRISE: Import centralized DXF tool labels - ZERO HARDCODED VALUES
import {
  DXF_SELECTION_TOOL_LABELS,
  DXF_DRAWING_TOOL_LABELS,
  DXF_EDITING_TOOL_LABELS,
  DXF_MEASUREMENT_TOOL_LABELS,
  DXF_ZOOM_TOOL_LABELS,
  DXF_UTILITY_TOOL_LABELS
} from '../../../../constants/property-statuses-enterprise';
import { 
  CircleRadiusIcon, 
  CircleDiameterIcon, 
  Circle2PDiameterIcon, 
  Circle3PIcon, 
  CircleChordSagittaIcon, 
  Circle2PRadiusIcon, 
  CircleBestFitIcon 
} from './icons/CircleIcon';
import { AngleIcon } from './icons/AngleIcon';
import { AngleLineArcIcon } from './icons/AngleLineArcIcon';
import { AngleTwoArcsIcon } from './icons/AngleTwoArcsIcon';
import { AngleMeasureGeomIcon } from './icons/AngleMeasureGeomIcon';
import { AngleConstraintIcon } from './icons/AngleConstraintIcon';
import type { ToolType, ActionDefinition, ToolDefinition } from './types';
import * as React from 'react';

// ✅ ENTERPRISE FIX: Type adapters για custom icons με SVGProps compatibility
const AngleIconAdapter: React.ComponentType<React.SVGProps<SVGSVGElement>> = ({
  width = 16,
  height = 16,
  color = 'currentColor',
  strokeWidth = 1.5,
  ...props
}) => (
  <AngleIcon
    size={Number(width) || 16}
    color={color as string}
    strokeWidth={typeof strokeWidth === 'string' ? parseFloat(strokeWidth) : Number(strokeWidth) || 1.5}
  />
);

const AngleLineArcIconAdapter: React.ComponentType<React.SVGProps<SVGSVGElement>> = ({
  width = 16,
  height = 16,
  color = 'currentColor',
  strokeWidth = 1.5,
  ...props
}) => (
  <AngleLineArcIcon
    size={Number(width) || 16}
    color={color as string}
    strokeWidth={typeof strokeWidth === 'string' ? parseFloat(strokeWidth) : Number(strokeWidth) || 1.5}
  />
);

const AngleTwoArcsIconAdapter: React.ComponentType<React.SVGProps<SVGSVGElement>> = ({
  width = 16,
  height = 16,
  color = 'currentColor',
  strokeWidth = 1.5,
  ...props
}) => (
  <AngleTwoArcsIcon
    size={Number(width) || 16}
    color={color as string}
    strokeWidth={typeof strokeWidth === 'string' ? parseFloat(strokeWidth) : Number(strokeWidth) || 1.5}
  />
);

const AngleMeasureGeomIconAdapter: React.ComponentType<React.SVGProps<SVGSVGElement>> = ({
  width = 16,
  height = 16,
  color = 'currentColor',
  strokeWidth = 1.5,
  ...props
}) => (
  <AngleMeasureGeomIcon
    size={Number(width) || 16}
    color={color as string}
    strokeWidth={typeof strokeWidth === 'string' ? parseFloat(strokeWidth) : Number(strokeWidth) || 1.5}
  />
);

const AngleConstraintIconAdapter: React.ComponentType<React.SVGProps<SVGSVGElement>> = ({
  width = 16,
  height = 16,
  color = 'currentColor',
  strokeWidth = 1.5,
  ...props
}) => (
  <AngleConstraintIcon
    size={Number(width) || 16}
    color={color as string}
    strokeWidth={typeof strokeWidth === 'string' ? parseFloat(strokeWidth) : Number(strokeWidth) || 1.5}
  />
);

// 🏢 ENTERPRISE: Tool group i18n keys for dynamic translation
export const DXF_TOOL_GROUP_KEYS = {
  SELECTION: 'toolGroups.selection',
  DRAWING: 'toolGroups.drawing',
  TOOLS: 'toolGroups.tools',
  MEASUREMENTS: 'toolGroups.measurements',
  ZOOM: 'toolGroups.zoom'
} as const;

export const toolGroups: { name: string; tools: ToolDefinition[] }[] = [
  {
    name: DXF_TOOL_GROUP_KEYS.SELECTION,
    tools: [
      // ✅ CENTRALIZED: Using DXF_SELECTION_TOOL_LABELS from central system - ZERO HARDCODED VALUES
      { id: 'select' as ToolType, icon: MousePointer, label: DXF_SELECTION_TOOL_LABELS.SELECT, hotkey: 'S' },
      { id: 'pan' as ToolType, icon: Hand, label: DXF_SELECTION_TOOL_LABELS.PAN, hotkey: 'P' },
    ]
  },
  {
    name: DXF_TOOL_GROUP_KEYS.DRAWING,
    tools: [
      // ✅ CENTRALIZED: Using DXF_DRAWING_TOOL_LABELS from central system - ZERO HARDCODED VALUES
      { id: 'line' as ToolType, icon: Minus, label: DXF_DRAWING_TOOL_LABELS.LINE, hotkey: 'L' },
      { id: 'rectangle' as ToolType, icon: Square, label: DXF_DRAWING_TOOL_LABELS.RECTANGLE, hotkey: 'R' },
      { 
        id: 'circle' as ToolType, 
        icon: CircleRadiusIcon, 
        label: DXF_DRAWING_TOOL_LABELS.CIRCLE_RADIUS,
        hotkey: 'C',
        dropdownOptions: [
          // ✅ CENTRALIZED: Circle tool variations - ZERO HARDCODED VALUES
          { id: 'circle' as ToolType, icon: CircleRadiusIcon, label: DXF_DRAWING_TOOL_LABELS.CIRCLE_RADIUS },
          { id: 'circle-diameter' as ToolType, icon: CircleDiameterIcon, label: DXF_DRAWING_TOOL_LABELS.CIRCLE_DIAMETER },
          { id: 'circle-2p-diameter' as ToolType, icon: Circle2PDiameterIcon, label: DXF_DRAWING_TOOL_LABELS.CIRCLE_2P_DIAMETER },
          { id: 'circle-3p' as ToolType, icon: Circle3PIcon, label: DXF_DRAWING_TOOL_LABELS.CIRCLE_3P },
          { id: 'circle-chord-sagitta' as ToolType, icon: CircleChordSagittaIcon, label: DXF_DRAWING_TOOL_LABELS.CIRCLE_CHORD_SAGITTA },
          { id: 'circle-2p-radius' as ToolType, icon: Circle2PRadiusIcon, label: DXF_DRAWING_TOOL_LABELS.CIRCLE_2P_RADIUS },
          { id: 'circle-best-fit' as ToolType, icon: CircleBestFitIcon, label: DXF_DRAWING_TOOL_LABELS.CIRCLE_BEST_FIT }
        ]
      },
      { id: 'polyline' as ToolType, icon: Pen, label: DXF_DRAWING_TOOL_LABELS.POLYLINE, hotkey: 'Y' },
      { id: 'polygon' as ToolType, icon: Hexagon, label: DXF_DRAWING_TOOL_LABELS.POLYGON, hotkey: 'G' },
      { id: 'layering' as ToolType, icon: Map, label: DXF_DRAWING_TOOL_LABELS.LAYERING, hotkey: 'O' }
    ]
  },
  {
    name: DXF_TOOL_GROUP_KEYS.TOOLS,
    tools: [
      // ✅ CENTRALIZED: Using DXF_EDITING_TOOL_LABELS from central system - ZERO HARDCODED VALUES
      { id: 'grip-edit' as ToolType, icon: Edit, label: DXF_EDITING_TOOL_LABELS.GRIP_EDIT, hotkey: 'G' },
      { id: 'move' as ToolType, icon: Move, label: DXF_EDITING_TOOL_LABELS.MOVE, hotkey: 'M' },
      { id: 'copy' as ToolType, icon: Copy, label: DXF_EDITING_TOOL_LABELS.COPY, hotkey: 'Ctrl+C' },
      { id: 'delete' as ToolType, icon: Trash2, label: DXF_EDITING_TOOL_LABELS.DELETE, hotkey: 'Del' },
    ]
  },
  {
    name: DXF_TOOL_GROUP_KEYS.MEASUREMENTS,
    tools: [
      // ✅ CENTRALIZED: Using DXF_MEASUREMENT_TOOL_LABELS from central system - ZERO HARDCODED VALUES
      { id: 'measure-distance' as ToolType, icon: Ruler, label: DXF_MEASUREMENT_TOOL_LABELS.MEASURE_DISTANCE, hotkey: 'D' },
      { id: 'measure-area' as ToolType, icon: Calculator, label: DXF_MEASUREMENT_TOOL_LABELS.MEASURE_AREA, hotkey: 'A' },
      {
        id: 'measure-angle' as ToolType,
        icon: AngleIconAdapter,
        label: DXF_MEASUREMENT_TOOL_LABELS.MEASURE_ANGLE,
        hotkey: 'T',
        dropdownOptions: [
          // ✅ CENTRALIZED: Angle measurement variations - ZERO HARDCODED VALUES
          { id: 'measure-angle' as ToolType, icon: AngleIconAdapter, label: DXF_MEASUREMENT_TOOL_LABELS.MEASURE_ANGLE_BASIC },
          { id: 'measure-angle-line-arc' as ToolType, icon: AngleLineArcIconAdapter, label: DXF_MEASUREMENT_TOOL_LABELS.MEASURE_ANGLE_LINE_ARC },
          { id: 'measure-angle-two-arcs' as ToolType, icon: AngleTwoArcsIconAdapter, label: DXF_MEASUREMENT_TOOL_LABELS.MEASURE_ANGLE_TWO_ARCS },
          { id: 'measure-angle-measuregeom' as ToolType, icon: AngleMeasureGeomIconAdapter, label: DXF_MEASUREMENT_TOOL_LABELS.MEASURE_ANGLE_MEASUREGEOM },
          { id: 'measure-angle-constraint' as ToolType, icon: AngleConstraintIconAdapter, label: DXF_MEASUREMENT_TOOL_LABELS.MEASURE_ANGLE_CONSTRAINT }
        ]
      },
    ]
  },
  {
    name: DXF_TOOL_GROUP_KEYS.ZOOM,
    tools: [
      // ✅ CENTRALIZED: Using DXF_ZOOM_TOOL_LABELS from central system - ZERO HARDCODED VALUES
      { id: 'zoom-in' as ToolType, icon: ZoomIn, label: DXF_ZOOM_TOOL_LABELS.ZOOM_IN, hotkey: '+' },
      { id: 'zoom-out' as ToolType, icon: ZoomOut, label: DXF_ZOOM_TOOL_LABELS.ZOOM_OUT, hotkey: '-' },
      { id: 'zoom-window' as ToolType, icon: Maximize2, label: DXF_ZOOM_TOOL_LABELS.ZOOM_WINDOW, hotkey: 'W' },
      { id: 'zoom-extents' as ToolType, icon: Maximize, label: DXF_ZOOM_TOOL_LABELS.ZOOM_EXTENTS, hotkey: 'F' },
    ]
  }
];

export const createActionButtons = (props: {
  canUndo: boolean;
  canRedo: boolean;
  snapEnabled: boolean;
  showGrid: boolean;
  autoCrop: boolean;
  showCursorSettings?: boolean;
  onAction: (action: string, data?: number | string | boolean) => void;
}): ActionDefinition[] => [
  { 
    id: 'undo', 
    icon: Undo, 
    // ✅ CENTRALIZED: Using DXF_UTILITY_TOOL_LABELS from central system - ZERO HARDCODED VALUES
    label: DXF_UTILITY_TOOL_LABELS.UNDO,
    hotkey: 'Ctrl+Z',
    disabled: !props.canUndo,
    onClick: () => props.onAction('undo')
  },
  {
    id: 'redo',
    icon: Redo,
    label: DXF_UTILITY_TOOL_LABELS.REDO,
    hotkey: 'Ctrl+Y',
    disabled: !props.canRedo,
    onClick: () => props.onAction('redo')
  },
  {
    id: 'cursor-settings',
    icon: Crosshair,
    label: DXF_UTILITY_TOOL_LABELS.CURSOR_SETTINGS,
    hotkey: 'Ctrl+Shift+C',
    active: props.showCursorSettings,
    onClick: () => props.onAction('toggle-cursor-settings')
  },
  {
    id: 'grid',
    icon: Grid,
    // 🏢 ENTERPRISE: i18n key - translated in ActionButton component
    label: props.showGrid ? 'actionButtons.hideGrid' : 'actionButtons.showGrid',
    hotkey: 'G',
    active: props.showGrid,
    onClick: () => props.onAction('grid')
  },
  {
    id: 'autocrop',
    icon: Crop,
    // 🏢 ENTERPRISE: i18n key - translated in ActionButton component
    label: props.autoCrop ? 'actionButtons.autoCropOn' : 'actionButtons.autoCropOff',
    hotkey: 'A',
    active: props.autoCrop,
    onClick: () => props.onAction('autocrop')
  },
  {
    id: 'fit',
    icon: Focus,
    label: DXF_UTILITY_TOOL_LABELS.FIT_TO_VIEW,
    hotkey: 'F',
    active: false, // 🔥 Add active state - στιγμιαίο action, όχι toggle
    disabled: false, // 🔥 Ensure it's not disabled
    onClick: () => props.onAction('fit-to-view')
  },
  {
    id: 'export',
    icon: Download,
    label: DXF_UTILITY_TOOL_LABELS.EXPORT,
    hotkey: 'Ctrl+E',
    onClick: () => props.onAction('export')
  },
  {
    id: 'tests',
    icon: FlaskConical,
    label: DXF_UTILITY_TOOL_LABELS.RUN_TESTS,
    hotkey: 'Ctrl+Shift+T',
    onClick: () => props.onAction('run-tests')
  },
  // 🏢 ENTERPRISE: Performance Monitor Toggle (Bentley/Autodesk pattern)
  {
    id: 'toggle-perf',
    icon: Activity,
    label: DXF_UTILITY_TOOL_LABELS.TOGGLE_PERF,
    hotkey: 'Ctrl+Shift+P',
    onClick: () => props.onAction('toggle-perf')
  },
  // 🏢 ENTERPRISE: PDF Background Controls (Independent pan/zoom/rotation)
  // Note: Ctrl+Shift+B is reserved by browser (bookmarks bar)
  {
    id: 'toggle-pdf-background',
    icon: FileUp,
    label: DXF_UTILITY_TOOL_LABELS.PDF_BACKGROUND,
    hotkey: 'Ctrl+Alt+P',
    onClick: () => props.onAction('toggle-pdf-background')
  }
];
