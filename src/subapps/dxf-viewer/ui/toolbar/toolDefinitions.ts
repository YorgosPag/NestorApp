'use client';
import {
  MousePointer, Hand, ZoomIn, ZoomOut, Minus, Square, CircleDot, Circle, Pen,
  Move, Copy, Trash2, Ruler, Undo, Redo, Focus, Maximize2,
  Grid, Settings, Crop, Download, Plus, Crosshair,
  Maximize, Calculator, Map, Edit, Hexagon, FlaskConical
} from "lucide-react";

// 🏢 ENTERPRISE: Import centralized DXF tool labels - ZERO HARDCODED VALUES
import {
  DXF_SELECTION_TOOL_LABELS,
  DXF_DRAWING_TOOL_LABELS,
  DXF_EDITING_TOOL_LABELS,
  DXF_MEASUREMENT_TOOL_LABELS,
  DXF_ZOOM_TOOL_LABELS,
  DXF_UTILITY_TOOL_LABELS
} from '@/constants/property-statuses-enterprise';
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

export const toolGroups: { name: string; tools: ToolDefinition[] }[] = [
  {
    name: 'Επιλογή',
    tools: [
      // ✅ CENTRALIZED: Using DXF_SELECTION_TOOL_LABELS from central system - ZERO HARDCODED VALUES
      { id: 'select' as ToolType, icon: MousePointer, label: DXF_SELECTION_TOOL_LABELS.SELECT, hotkey: 'S' },
      { id: 'pan' as ToolType, icon: Hand, label: DXF_SELECTION_TOOL_LABELS.PAN, hotkey: 'P' },
    ]
  },
  {
    name: 'Σχεδίαση',
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
    name: 'Εργαλεία',
    tools: [
      // ✅ CENTRALIZED: Using DXF_EDITING_TOOL_LABELS from central system - ZERO HARDCODED VALUES
      { id: 'grip-edit' as ToolType, icon: Edit, label: DXF_EDITING_TOOL_LABELS.GRIP_EDIT, hotkey: 'G' },
      { id: 'move' as ToolType, icon: Move, label: DXF_EDITING_TOOL_LABELS.MOVE, hotkey: 'M' },
      { id: 'copy' as ToolType, icon: Copy, label: DXF_EDITING_TOOL_LABELS.COPY, hotkey: 'Ctrl+C' },
      { id: 'delete' as ToolType, icon: Trash2, label: DXF_EDITING_TOOL_LABELS.DELETE, hotkey: 'Del' },
    ]
  },
  {
    name: 'Μετρήσεις',
    tools: [
      // ✅ CENTRALIZED: Using DXF_MEASUREMENT_TOOL_LABELS from central system - ZERO HARDCODED VALUES
      { id: 'measure-distance' as ToolType, icon: Ruler, label: DXF_MEASUREMENT_TOOL_LABELS.MEASURE_DISTANCE, hotkey: 'D' },
      { id: 'measure-area' as ToolType, icon: Calculator, label: DXF_MEASUREMENT_TOOL_LABELS.MEASURE_AREA, hotkey: 'A' },
      { 
        id: 'measure-angle' as ToolType, 
        icon: AngleIcon, 
        label: DXF_MEASUREMENT_TOOL_LABELS.MEASURE_ANGLE,
        hotkey: 'T',
        dropdownOptions: [
          // ✅ CENTRALIZED: Angle measurement variations - ZERO HARDCODED VALUES
          { id: 'measure-angle' as ToolType, icon: AngleIcon, label: DXF_MEASUREMENT_TOOL_LABELS.MEASURE_ANGLE_BASIC },
          { id: 'measure-angle-line-arc' as ToolType, icon: AngleLineArcIcon, label: DXF_MEASUREMENT_TOOL_LABELS.MEASURE_ANGLE_LINE_ARC },
          { id: 'measure-angle-two-arcs' as ToolType, icon: AngleTwoArcsIcon, label: DXF_MEASUREMENT_TOOL_LABELS.MEASURE_ANGLE_TWO_ARCS },
          { id: 'measure-angle-measuregeom' as ToolType, icon: AngleMeasureGeomIcon, label: DXF_MEASUREMENT_TOOL_LABELS.MEASURE_ANGLE_MEASUREGEOM },
          { id: 'measure-angle-constraint' as ToolType, icon: AngleConstraintIcon, label: DXF_MEASUREMENT_TOOL_LABELS.MEASURE_ANGLE_CONSTRAINT }
        ]
      },
    ]
  },
  {
    name: 'Εστίαση',
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
    label: props.showGrid ? 'Απόκρυψη Πλέγματος' : 'Εμφάνιση Πλέγματος', 
    hotkey: 'G',
    active: props.showGrid,
    onClick: () => props.onAction('grid')
  },
  {
    id: 'autocrop', 
    icon: Crop, 
    label: props.autoCrop ? 'Auto-Crop ON' : 'Auto-Crop OFF', 
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
  }
];
