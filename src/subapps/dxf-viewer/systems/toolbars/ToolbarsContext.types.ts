import type {
  ToolType,
  ToolbarConfig,
  ToolbarState,
  ToolbarSettings,
  ToolDefinition,
  ActionDefinition,
  ToolbarOperationResult,
  ToolbarCustomization,
  ToolRunner,
  ToolEvents,
  ToolState,
  ActionState
} from './config';
import type { Point2D } from '../../rendering/types/Types';

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions (ADR-compliant - NO any)
// ============================================================================

/** Action parameters for executeAction */
export type ActionParameters = Record<string, unknown>;

/** Tool parameters for startTool */
export type ToolParameters = Record<string, unknown>;

/** Tool completion result */
export type ToolResult = Record<string, unknown> | undefined;

/** Tool input data */
export type ToolInput = { point?: Point2D; value?: unknown; [key: string]: unknown };

/** Toolbar layout information */
export interface ToolbarLayout {
  position: Point2D;
  size: { width: number; height: number };
  docked: boolean;
  visible: boolean;
  collapsed: boolean;
}

/** Event callback function type */
export type EventCallback = (...args: unknown[]) => void;

// ===== CONTEXT TYPE DEFINITION =====
export interface ToolbarsContextType {
  // State
  state: ToolbarState;
  toolRunner: ToolRunner;
  
  // Tool Management
  activateTool: (toolId: ToolType) => void;
  deactivateTool: (toolId?: ToolType) => void;
  toggleTool: (toolId: ToolType) => void;
  executeAction: (actionId: string, parameters?: ActionParameters) => void;
  getActiveTool: () => ToolType | null;
  isToolActive: (toolId: ToolType) => boolean;
  isToolEnabled: (toolId: ToolType) => boolean;
  isToolVisible: (toolId: ToolType) => boolean;
  
  // Tool Definition Management
  registerTool: (tool: ToolDefinition) => void;
  unregisterTool: (toolId: ToolType) => void;
  updateTool: (toolId: ToolType, updates: Partial<ToolDefinition>) => void;
  getTool: (toolId: ToolType) => ToolDefinition | undefined;
  getTools: () => Record<ToolType, ToolDefinition>;
  getToolsByCategory: (category: string) => ToolDefinition[];
  
  // Action Definition Management
  registerAction: (action: ActionDefinition) => void;
  unregisterAction: (actionId: string) => void;
  updateAction: (actionId: string, updates: Partial<ActionDefinition>) => void;
  getAction: (actionId: string) => ActionDefinition | undefined;
  getActions: () => Record<string, ActionDefinition>;
  
  // Toolbar Configuration Management
  createToolbar: (config: ToolbarConfig) => Promise<ToolbarOperationResult>;
  deleteToolbar: (toolbarId: string) => Promise<ToolbarOperationResult>;
  updateToolbar: (toolbarId: string, updates: Partial<ToolbarConfig>) => Promise<ToolbarOperationResult>;
  getToolbar: (toolbarId: string) => ToolbarConfig | undefined;
  getToolbars: () => Record<string, ToolbarConfig>;
  getVisibleToolbars: () => ToolbarConfig[];
  
  // Toolbar Visibility and State
  showToolbar: (toolbarId: string) => void;
  hideToolbar: (toolbarId: string) => void;
  toggleToolbar: (toolbarId: string) => void;
  collapseToolbar: (toolbarId: string) => void;
  expandToolbar: (toolbarId: string) => void;
  moveToolbar: (toolbarId: string, position: Point2D) => void;
  
  // Tool States Management
  setToolState: (toolId: ToolType, state: Partial<ToolState>) => void;
  getToolState: (toolId: ToolType) => ToolState;
  enableTool: (toolId: ToolType) => void;
  disableTool: (toolId: ToolType) => void;
  showTool: (toolId: ToolType) => void;
  hideTool: (toolId: ToolType) => void;
  
  // Action States Management
  setActionState: (actionId: string, state: Partial<ActionState>) => void;
  getActionState: (actionId: string) => ActionState;
  enableAction: (actionId: string) => void;
  disableAction: (actionId: string) => void;
  showAction: (actionId: string) => void;
  hideAction: (actionId: string) => void;
  
  // Tool Runner Functions
  startTool: (toolId: ToolType, parameters?: ToolParameters) => void;
  cancelTool: () => void;
  completeTool: (result?: ToolResult) => void;
  addToolInput: (input: ToolInput) => void;
  removeLastInput: () => void;
  clearToolInputs: () => void;
  getToolProgress: () => { current: number; total: number; percentage: number };
  
  // Hotkey Management
  registerHotkey: (hotkey: string, toolId: ToolType) => void;
  unregisterHotkey: (hotkey: string) => void;
  executeHotkey: (hotkey: string) => void;
  getHotkeys: () => Record<string, ToolType>;
  
  // Customization
  addCustomization: (customization: ToolbarCustomization) => void;
  removeCustomization: (customizationId: string) => void;
  applyCustomization: (customizationId: string) => void;
  getCustomizations: () => ToolbarCustomization[];
  exportCustomizations: () => string;
  importCustomizations: (data: string) => Promise<ToolbarOperationResult>;
  
  // Settings Management
  updateSettings: (updates: Partial<ToolbarSettings>) => void;
  resetSettings: () => void;
  getSettings: () => ToolbarSettings;
  
  // Layout and Positioning
  getToolbarLayout: (toolbarId: string) => ToolbarLayout | undefined;
  optimizeLayout: () => void;
  resetLayout: () => void;

  // Event Management
  addEventListener: (event: keyof ToolEvents, callback: EventCallback) => void;
  removeEventListener: (event: keyof ToolEvents, callback: EventCallback) => void;
  
  // Utility Functions
  searchTools: (query: string) => ToolDefinition[];
  getToolTooltip: (toolId: ToolType) => string;
  isToolbarDocked: (toolbarId: string) => boolean;
  canExecuteTool: (toolId: ToolType) => boolean;
  
  // Export/Import
  exportConfiguration: () => string;
  importConfiguration: (data: string) => Promise<ToolbarOperationResult>;
  resetToDefaults: () => void;
}

export interface ToolbarsSystemProps {
  children: React.ReactNode;
  initialToolbars?: Record<string, ToolbarConfig>;
  initialTools?: Record<ToolType, ToolDefinition>;
  initialActions?: Record<string, ActionDefinition>;
  initialSettings?: Partial<ToolbarSettings>;
  onToolChange?: (toolId: ToolType | null) => void;
  onError?: (error: string) => void;
}