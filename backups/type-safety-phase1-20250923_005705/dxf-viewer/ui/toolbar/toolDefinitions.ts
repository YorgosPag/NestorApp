'use client';
import { 
  MousePointer, Hand, ZoomIn, ZoomOut, Minus, Square, CircleDot, Circle, Pen,
  Move, Copy, Trash2, Ruler, Undo, Redo, Focus, Maximize2,
  Grid, Layers, Settings, Crop, Download, Plus, Wrench, Crosshair,
  Maximize, Calculator, Map, Edit, Hexagon
} from "lucide-react";
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
import type { ToolType, ActionDefinition } from './types';

export const toolGroups = [
  {
    name: 'Selection',
    tools: [
      { id: 'select' as ToolType, icon: MousePointer, label: 'Επιλογή', hotkey: 'S' },
      { id: 'pan' as ToolType, icon: Hand, label: 'Μετακίνηση', hotkey: 'P' },
    ]
  },
  {
    name: 'Drawing',
    tools: [
      { id: 'line' as ToolType, icon: Minus, label: 'Γραμμή', hotkey: 'L' },
      { id: 'rectangle' as ToolType, icon: Square, label: 'Ορθογώνιο', hotkey: 'R' },
      { 
        id: 'circle' as ToolType, 
        icon: CircleRadiusIcon, 
        label: 'Κύκλος (Ακτίνα)', 
        hotkey: 'C',
        dropdownOptions: [
          { id: 'circle' as ToolType, icon: CircleRadiusIcon, label: 'Κύκλος (Ακτίνα)' },
          { id: 'circle-diameter' as ToolType, icon: CircleDiameterIcon, label: 'Κύκλος (Διάμετρος)' },
          { id: 'circle-2p-diameter' as ToolType, icon: Circle2PDiameterIcon, label: '2P – Διάμετρος' },
          { id: 'circle-3p' as ToolType, icon: Circle3PIcon, label: '3P – Κύκλος' },
          { id: 'circle-chord-sagitta' as ToolType, icon: CircleChordSagittaIcon, label: 'Χορδή + Βέλος' },
          { id: 'circle-2p-radius' as ToolType, icon: Circle2PRadiusIcon, label: '2P + R' },
          { id: 'circle-best-fit' as ToolType, icon: CircleBestFitIcon, label: 'N Σημεία (Best-Fit)' }
        ]
      },
      { id: 'polyline' as ToolType, icon: Pen, label: 'Πολυγραμμή', hotkey: 'Y' },
      { id: 'polygon' as ToolType, icon: Hexagon, label: 'Πολύγωνο', hotkey: 'G' },
      { id: 'layering' as ToolType, icon: Map, label: 'Layering', hotkey: 'O' }
    ]
  },
  {
    name: 'Tools',
    tools: [
      { id: 'grip-edit' as ToolType, icon: Edit, label: 'Grip Edit', hotkey: 'G' },
      { id: 'move' as ToolType, icon: Move, label: 'Move', hotkey: 'M' },
      { id: 'copy' as ToolType, icon: Copy, label: 'Copy', hotkey: 'Ctrl+C' },
      { id: 'delete' as ToolType, icon: Trash2, label: 'Delete', hotkey: 'Del' },
    ]
  },
  {
    name: 'Measurements',
    tools: [
      { id: 'measure-distance' as ToolType, icon: Ruler, label: 'Μέτρηση Απόστασης', hotkey: 'D' },
      { id: 'measure-area' as ToolType, icon: Calculator, label: 'Μέτρηση Εμβαδού', hotkey: 'A' },
      { 
        id: 'measure-angle' as ToolType, 
        icon: AngleIcon, 
        label: 'Μέτρηση Γωνίας', 
        hotkey: 'T',
        dropdownOptions: [
          { id: 'measure-angle' as ToolType, icon: AngleIcon, label: 'Μέτρηση Γωνίας (Βασική)' },
          { id: 'measure-angle-line-arc' as ToolType, icon: AngleLineArcIcon, label: 'Γραμμή + Τόξο/Κύκλο' },
          { id: 'measure-angle-two-arcs' as ToolType, icon: AngleTwoArcsIcon, label: 'Δύο Τόξα/Κύκλοι' },
          { id: 'measure-angle-measuregeom' as ToolType, icon: AngleMeasureGeomIcon, label: 'Μετρητής MEASUREGEOM' },
          { id: 'measure-angle-constraint' as ToolType, icon: AngleConstraintIcon, label: 'Παραμετρικό Angle Constraint' }
        ]
      },
    ]
  },
  {
    name: 'Zoom',
    tools: [
      { id: 'zoom-in' as ToolType, icon: ZoomIn, label: 'Zoom In', hotkey: '+' },
      { id: 'zoom-out' as ToolType, icon: ZoomOut, label: 'Zoom Out', hotkey: '-' },
      { id: 'zoom-window' as ToolType, icon: Maximize2, label: 'Zoom Window', hotkey: 'W' },
      { id: 'zoom-extents' as ToolType, icon: Maximize, label: 'Zoom Extents', hotkey: 'F' },
    ]
  }
];

export const createActionButtons = (props: {
  canUndo: boolean;
  canRedo: boolean;
  snapEnabled: boolean;
  showGrid: boolean;
  showLayers: boolean;
  autoCrop: boolean;
  showCalibration?: boolean;
  showCursorSettings?: boolean;
  onAction: (action: string, data?: any) => void;
}): ActionDefinition[] => [
  { 
    id: 'undo', 
    icon: Undo, 
    label: 'Αναίρεση', 
    hotkey: 'Ctrl+Z',
    disabled: !props.canUndo,
    onClick: () => props.onAction('undo')
  },
  { 
    id: 'redo', 
    icon: Redo, 
    label: 'Επανάληψη', 
    hotkey: 'Ctrl+Y',
    disabled: !props.canRedo,
    onClick: () => props.onAction('redo')
  },
  { 
    id: 'calibration', 
    icon: Wrench, 
    label: props.showCalibration ? 'Κλείσιμο Βαθμονόμησης' : 'Βαθμονόμηση', 
    hotkey: 'B',
    active: props.showCalibration,
    onClick: () => props.onAction('toggle-calibration')
  },
  { 
    id: 'cursor-settings', 
    icon: Crosshair, 
    label: 'Ρυθμίσεις Cursor', 
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
    id: 'layers', 
    icon: Layers, 
    label: 'Layers Panel', 
    hotkey: 'Ctrl+L',
    active: props.showLayers,
    onClick: () => props.onAction('toggle-layers')
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
    label: 'Fit to View', 
    hotkey: 'F',
    onClick: () => props.onAction('fit')
  },
  { 
    id: 'export', 
    icon: Download, 
    label: 'Export', 
    hotkey: 'Ctrl+E',
    onClick: () => props.onAction('export')
  }
];
