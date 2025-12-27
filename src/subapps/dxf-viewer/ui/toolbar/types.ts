import React from 'react';

// Επεκτεταμένοι τύποι για measurement system
export type ToolType = 
  | 'select' 
  | 'pan' 
  | 'zoom-in' 
  | 'zoom-out'
  | 'zoom-window'
  | 'zoom-extents'
  | 'line' 
  | 'rectangle' 
  | 'circle' 
  | 'circle-diameter'
  | 'circle-2p-diameter'
  | 'circle-3p'
  | 'circle-chord-sagitta'
  | 'circle-2p-radius'
  | 'circle-best-fit'
  | 'polyline'
  | 'polygon'
  | 'move' 
  | 'copy' 
  | 'delete' 
  | 'measure'
  | 'measure-distance' 
  | 'measure-area' 
  | 'measure-angle' 
  | 'measure-angle-line-arc'
  | 'measure-angle-two-arcs'
  | 'measure-angle-measuregeom'
  | 'measure-angle-constraint'
  | 'measure-radius' 
  | 'measure-perimeter'
  | 'layering'
  | 'grip-edit';


export interface ToolDefinition {
  id: ToolType;
  icon: React.ComponentType<React.ComponentProps<'svg'>> | string;
  label: string;
  hotkey: string;
  dropdownOptions?: { id: ToolType; icon: React.ComponentType<React.ComponentProps<'svg'>> | string; label: string; }[];
}

export interface ActionDefinition {
  id: string;
  icon: React.ComponentType<React.ComponentProps<'svg'>> | string;
  label: string;
  hotkey?: string;  // ✅ ENTERPRISE: Fix type inconsistency - hotkey can be undefined
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export interface ToolbarState {
    activeTool: ToolType;
    showGrid: boolean;
    autoCrop: boolean;
    canUndo: boolean;
    canRedo: boolean;
    snapEnabled: boolean;
    showLayers: boolean;
    showCalibration?: boolean;
    currentZoom: number;
    commandCount?: number;
}

// MEASUREMENT TOOLS - Προσθήκη νέων εργαλείων
export type MeasurementTool = 
  | 'measure-distance' 
  | 'measure-area' 
  | 'measure-angle' 
  | 'measure-angle-line-arc'
  | 'measure-angle-two-arcs'
  | 'measure-angle-measuregeom'
  | 'measure-angle-constraint'
  | 'measure-radius' 
  | 'measure-perimeter';

// Επέκταση υπάρχοντος ToolType (αν δεν υπάρχει ήδη)
export type ExtendedToolType = ToolType | MeasurementTool;

export interface MeasurementToolConfig {
  id: MeasurementTool;
  name: string;
  icon: string;
  shortcut?: string;
  description: string;
  requiredPoints: number;
}

export const MEASUREMENT_TOOL_CONFIGS: Record<MeasurementTool, MeasurementToolConfig> = {
  'measure-distance': {
    id: 'measure-distance',
    name: 'Απόσταση',
    icon: 'Ruler',
    shortcut: 'D',
    description: 'Μέτρηση απόστασης μεταξύ 2 σημείων',
    requiredPoints: 2
  },
  'measure-area': {
    id: 'measure-area',
    name: 'Εμβαδό',
    icon: 'Square',
    shortcut: 'A', 
    description: 'Μέτρηση εμβαδού πολυγώνου (3+ σημεία)',
    requiredPoints: 3
  },
  'measure-angle': {
    id: 'measure-angle',
    name: 'Γωνία',
    icon: 'AngleIcon',
    shortcut: 'T',
    description: 'Μέτρηση γωνίας (3 σημεία)',
    requiredPoints: 3
  },
  'measure-radius': {
    id: 'measure-radius', 
    name: 'Ακτίνα',
    icon: 'Circle',
    description: 'Μέτρηση ακτίνας κύκλου',
    requiredPoints: 2
  },
  'measure-perimeter': {
    id: 'measure-perimeter',
    name: 'Περίμετρος', 
    icon: 'Pentagon',
    description: 'Μέτρηση περιμέτρου σχήματος',
    requiredPoints: 2
  }
};
