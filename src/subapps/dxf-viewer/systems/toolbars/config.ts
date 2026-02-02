/**
 * TOOLBARS SYSTEM CONFIGURATION
 * Single Source of Truth για toolbar systems και tool runners
 */

import type { Point2D } from '../../rendering/types/Types';
import { UI_COLORS } from '../../config/color-config';

// ===== BASIC TYPES =====
export type ToolType = 
  | 'select' 
  | 'pan' 
  | 'zoom-in' 
  | 'zoom-out'
  | 'zoom-window'
  | 'zoom-extent'
  | 'line' 
  | 'rectangle' 
  | 'circle' 
  | 'polyline'
  | 'arc'
  | 'text'
  | 'move' 
  | 'copy' 
  | 'rotate'
  | 'scale'
  | 'mirror'
  | 'delete' 
  | 'trim'
  | 'extend'
  | 'offset'
  | 'fillet'
  | 'chamfer'
  | 'measure-distance' 
  | 'measure-area' 
  | 'measure-angle' 
  | 'measure-radius' 
  | 'measure-perimeter'
  | 'measure-coordinates'
  | 'dimension-linear'
  | 'dimension-aligned'
  | 'dimension-angular'
  | 'dimension-radial'
  | 'layer-manager'
  | 'properties'
  | 'snap-endpoint'
  | 'snap-midpoint'
  | 'snap-center'
  | 'snap-intersection'
  | 'snap-perpendicular'
  | 'snap-tangent'
  | 'snap-quadrant'
  | 'snap-nearest'
  | 'ortho'
  | 'polar'
  | 'grid'
  | 'rulers';

export type ToolCategory = 
  | 'selection'
  | 'navigation'
  | 'drawing'
  | 'editing'
  | 'measurement'
  | 'annotation'
  | 'snap'
  | 'settings'
  | 'view'
  | 'modify';

export type ToolbarPosition = 'top' | 'bottom' | 'left' | 'right' | 'floating';
export type ToolbarOrientation = 'horizontal' | 'vertical';
export type ToolbarSize = 'small' | 'medium' | 'large';

// ===== TOOL DEFINITION =====
export interface ToolDefinition {
  id: ToolType;
  category: ToolCategory;
  name: string;
  label: string;
  tooltip: string;
  icon: string | React.ComponentType;
  hotkey?: string;
  combination?: string[];
  enabled: boolean;
  visible: boolean;
  toggleable: boolean;
  exclusive: boolean; // Cannot be active with other exclusive tools
  requiresInput: boolean;
  inputType?: 'point' | 'points' | 'rectangle' | 'circle' | 'line' | 'polygon';
  minInputPoints?: number;
  maxInputPoints?: number;
  preview: boolean; // Show preview while drawing
  snap: boolean; // Enable snap for this tool
  ortho: boolean; // Respect ortho mode
  polar: boolean; // Respect polar mode
  metadata?: {
    version: string;
    author: string;
    description: string;
    tags: string[];
  };
}

// 🏢 ENTERPRISE: Type-safe tool value types
export type ToolValue = string | number | boolean | null | Point2D | Point2D[] | ToolValue[] | { [key: string]: ToolValue };

// ===== TOOL DATA TYPES =====
export interface ToolData {
  state?: string;
  progress?: number;
  tempValues?: Record<string, ToolValue>;
  validationErrors?: string[];
  metadata?: Record<string, ToolValue>;
}

export interface ActionParameters {
  target?: string;
  values?: Record<string, ToolValue>;
  options?: Record<string, ToolValue>;
  context?: Record<string, ToolValue>;
}

export type ToolParameters = ActionParameters;

export type ToolInput = {
  point?: Point2D;
  value?: ToolValue;
  [key: string]: ToolValue | undefined;
};

export interface ValidationInput {
  value: ToolValue;
  type: string;
  constraints?: Record<string, ToolValue>;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

export interface ToolStepOption {
  label: string;
  value: unknown;
  description?: string;
  disabled?: boolean;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  warnings?: string[];
}

export interface ContextMenuContext {
  position: Point2D;
  target?: string;
  entities?: string[];
  metadata?: Record<string, unknown>;
}

// ===== ACTION DEFINITION =====
export interface ActionDefinition {
  id: string;
  type: 'tool' | 'command' | 'toggle' | 'menu';
  name: string;
  label: string;
  tooltip: string;
  icon: string | React.ComponentType;
  hotkey?: string;
  enabled: boolean;
  visible: boolean;
  command?: string;
  parameters?: ActionParameters;
  confirmationRequired?: boolean;
  confirmationMessage?: string;
  group?: string;
  order?: number;
}

// ===== TOOLBAR CONFIGURATION =====
export interface ToolbarConfig {
  id: string;
  name: string;
  label: string;
  position: ToolbarPosition;
  orientation: ToolbarOrientation;
  size: ToolbarSize;
  visible: boolean;
  collapsible: boolean;
  collapsed: boolean;
  floating: boolean;
  dockable: boolean;
  resizable: boolean;
  movable: boolean;
  tools: string[]; // Tool IDs
  actions: string[]; // Action IDs
  separators: number[]; // Positions where to insert separators
  style: ToolbarStyle;
  behavior: ToolbarBehavior;
  layout: ToolbarLayout;
}

export interface ToolbarStyle {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  padding: number;
  margin: number;
  spacing: number;
  shadow: boolean;
  opacity: number;
  buttonSize: number;
  buttonPadding: number;
  buttonRadius: number;
  iconSize: number;
  fontSize: number;
  fontFamily: string;
  textColor: string;
  hoverColor: string;
  activeColor: string;
  disabledColor: string;
}

export interface ToolbarBehavior {
  autoHide: boolean;
  autoCollapse: boolean;
  showTooltips: boolean;
  tooltipDelay: number;
  clickThrough: boolean;
  contextMenu: boolean;
  dragToReorder: boolean;
  rightClickActions: boolean;
  doubleClickActions: boolean;
  keyboardNavigation: boolean;
}

export interface ToolbarLayout {
  grouping: boolean;
  maxColumns?: number;
  maxRows?: number;
  wrapContent: boolean;
  justifyContent: 'start' | 'center' | 'end' | 'space-between' | 'space-around';
  alignItems: 'start' | 'center' | 'end' | 'stretch';
  flexDirection: 'row' | 'column';
  overflow: 'visible' | 'hidden' | 'scroll' | 'auto';
}

// ===== TOOLBAR STATE =====
export interface ToolbarState {
  toolbars: Record<string, ToolbarConfig>;
  tools: Partial<Record<ToolType, ToolDefinition>>;
  actions: Record<string, ActionDefinition>;
  activeTool: ToolType | null;
  activeToolbar: string | null;
  toolStates: Partial<Record<ToolType, {
    active: boolean;
    enabled: boolean;
    visible: boolean;
    data?: ToolData;
  }>>;
  actionStates: Record<string, {
    enabled: boolean;
    visible: boolean;
    checked?: boolean;
    data?: ToolData;
  }>;
  customizations: ToolbarCustomization[];
  settings: ToolbarSettings;
}

// ===== TOOLBAR SETTINGS =====
export interface ToolbarSettings {
  general: {
    showLabels: boolean;
    showTooltips: boolean;
    tooltipDelay: number;
    animationDuration: number;
    keyboardShortcuts: boolean;
    contextMenus: boolean;
  };
  appearance: {
    theme: 'light' | 'dark' | 'auto';
    density: 'compact' | 'comfortable' | 'spacious';
    iconSet: string;
    customCSS: string;
  };
  behavior: {
    stickyTools: boolean;
    autoSwitchTools: boolean;
    confirmDestructive: boolean;
    rememberState: boolean;
    adaptiveUI: boolean;
  };
  accessibility: {
    highContrast: boolean;
    largeText: boolean;
    keyboardOnly: boolean;
    screenReader: boolean;
    reduceMotion: boolean;
  };
}

// ===== TOOLBAR CUSTOMIZATION =====
export interface ToolbarCustomization {
  id: string;
  name: string;
  description: string;
  toolbarId: string;
  changes: {
    addedTools: string[];
    removedTools: string[];
    reorderedTools: Array<{ from: number; to: number }>;
    modifiedProperties: Record<string, unknown>;
  };
  createdAt: Date;
  createdBy: string;
  active: boolean;
}

// ===== TOOL RUNNER CONFIGURATION =====
export interface ToolRunner {
  currentTool: ToolType | null;
  isActive: boolean;
  inputPoints: Array<ToolInput>;
  requiredPoints: number;
  minPoints: number;
  maxPoints: number;
  previewData: unknown;
  stepIndex: number;
  steps: ToolStep[];
  context: ToolContext;
}

export interface ToolStep {
  id: string;
  name: string;
  description: string;
  prompt: string;
  inputType: 'point' | 'distance' | 'angle' | 'text' | 'option';
  required: boolean;
  validation?: (input: unknown) => ValidationResult;
  defaultValue?: unknown;
  options?: ToolStepOption[];
}

export interface ToolContext {
  snapSettings: {
    enabled: boolean;
    types: string[];
    tolerance: number;
  };
  inputSettings: {
    ortho: boolean;
    polar: boolean;
    tracking: boolean;
    dynamicInput: boolean;
  };
  displaySettings: {
    preview: boolean;
    constraints: boolean;
    feedback: boolean;
  };
}

// ===== DEFAULT CONFIGURATIONS =====
export const DEFAULT_TOOLBAR_STYLE: ToolbarStyle = {
  backgroundColor: UI_COLORS.TOOLBAR_BG,
  borderColor: UI_COLORS.TOOLBAR_BORDER,
  borderWidth: 1,
  borderRadius: 4,
  padding: 8,
  margin: 4,
  spacing: 4,
  shadow: true,
  opacity: 1.0,
  buttonSize: 32,
  buttonPadding: 8,
  buttonRadius: 4,
  iconSize: 16,
  fontSize: 12,
  fontFamily: 'Arial, sans-serif',
  textColor: UI_COLORS.TOOLBAR_TEXT,
  hoverColor: UI_COLORS.TOOLBAR_HOVER,
  activeColor: UI_COLORS.TOOLBAR_ACTIVE,
  disabledColor: UI_COLORS.TOOLBAR_DISABLED
};

export const DEFAULT_TOOLBAR_BEHAVIOR: ToolbarBehavior = {
  autoHide: false,
  autoCollapse: false,
  showTooltips: true,
  tooltipDelay: 500,
  clickThrough: false,
  contextMenu: true,
  dragToReorder: false,
  rightClickActions: true,
  doubleClickActions: false,
  keyboardNavigation: true
};

export const DEFAULT_TOOLBAR_LAYOUT: ToolbarLayout = {
  grouping: true,
  wrapContent: false,
  justifyContent: 'start',
  alignItems: 'center',
  flexDirection: 'row',
  overflow: 'visible'
};

export const DEFAULT_TOOLBAR_SETTINGS: ToolbarSettings = {
  general: {
    showLabels: false,
    showTooltips: true,
    tooltipDelay: 500,
    animationDuration: 200,
    keyboardShortcuts: true,
    contextMenus: true
  },
  appearance: {
    theme: 'light',
    density: 'comfortable',
    iconSet: 'default',
    customCSS: ''
  },
  behavior: {
    stickyTools: false,
    autoSwitchTools: true,
    confirmDestructive: true,
    rememberState: true,
    adaptiveUI: true
  },
  accessibility: {
    highContrast: false,
    largeText: false,
    keyboardOnly: false,
    screenReader: false,
    reduceMotion: false
  }
};

// ===== CONSTANTS =====
export const TOOLBAR_CONFIG = {
  // Size constants
  MIN_BUTTON_SIZE: 20,
  MAX_BUTTON_SIZE: 64,
  DEFAULT_BUTTON_SIZE: 32,
  MIN_ICON_SIZE: 12,
  MAX_ICON_SIZE: 48,
  DEFAULT_ICON_SIZE: 16,
  
  // Animation durations
  FAST_ANIMATION: 100,
  NORMAL_ANIMATION: 200,
  SLOW_ANIMATION: 400,
  
  // Spacing
  COMPACT_SPACING: 2,
  NORMAL_SPACING: 4,
  COMFORTABLE_SPACING: 8,
  
  // Z-index values
  TOOLBAR_Z_INDEX: 1000,
  FLOATING_TOOLBAR_Z_INDEX: 1100,
  TOOLTIP_Z_INDEX: 1200,
  CONTEXT_MENU_Z_INDEX: 1300,
  
  // Default toolbar IDs
  MAIN_TOOLBAR: 'main',
  DRAWING_TOOLBAR: 'drawing',
  EDITING_TOOLBAR: 'editing',
  MEASUREMENT_TOOLBAR: 'measurement',
  SNAP_TOOLBAR: 'snap',
  STATUS_TOOLBAR: 'status',
  
  // Keyboard shortcuts
  DEFAULT_HOTKEYS: {
    'select': 'Escape',
    'line': 'L',
    'rectangle': 'R',
    'circle': 'C',
    'polyline': 'P',
    'zoom-in': '+',
    'zoom-out': '-',
    'zoom-extent': 'E',
    'pan': 'Space',
    'delete': 'Delete',
    'copy': 'Ctrl+C',
    'move': 'M',
    'grid': 'F7',
    'ortho': 'F8',
    'snap-endpoint': 'F3',
    'snap-midpoint': 'F4',
    'snap-center': 'F5'
  } as Record<ToolType | string, string>
} as const;

// ===== TOOLBAR OPERATIONS =====
export type ToolbarOperation = 
  | 'create-toolbar'
  | 'delete-toolbar'
  | 'show-toolbar'
  | 'hide-toolbar'
  | 'move-toolbar'
  | 'resize-toolbar'
  | 'add-tool'
  | 'remove-tool'
  | 'reorder-tools'
  | 'customize-toolbar'
  | 'reset-toolbar'
  | 'export-config'
  | 'import-config';

export interface ToolbarOperationResult {
  success: boolean;
  operation: ToolbarOperation;
  toolbarId?: string;
  error?: string;
  data?: unknown;
}

// ===== TOOL EVENTS =====
export interface ToolEvents {
  onToolActivate: (toolId: ToolType) => void;
  onToolDeactivate: (toolId: ToolType) => void;
  onToolExecute: (toolId: ToolType, parameters?: ActionParameters) => void;
  onToolStep: (toolId: ToolType, stepIndex: number, input: ValidationInput) => void;
  onToolComplete: (toolId: ToolType, result: ToolExecutionResult) => void;
  onToolCancel: (toolId: ToolType) => void;
  onToolError: (toolId: ToolType, error: string) => void;
  onActionExecute: (actionId: string, parameters?: ActionParameters) => void;
  onHotkeyPressed: (hotkey: string, toolId: ToolType) => void;
  onContextMenu: (x: number, y: number, context: ContextMenuContext) => void;
  onCustomization: (customization: ToolbarCustomization) => void;
}

// ===== TYPE EXPORTS =====
export type ToolState = NonNullable<ToolbarState['toolStates'][ToolType]>;
export type ActionState = NonNullable<ToolbarState['actionStates'][string]>;
