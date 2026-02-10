/**
 * TOOLBARS SYSTEM UTILITIES
 * Utility functions for toolbar operations and tool management
 */

import type {
  ToolType,
  ToolCategory,
  ToolDefinition,
  ActionDefinition,
  ToolbarConfig,
  ToolbarOperation,
  ToolbarOperationResult,
  ToolbarCustomization,
  ToolRunner,
  ToolStep
} from './config';
import { DEFAULT_TOOLBAR_STYLE, TOOLBAR_CONFIG } from './config';
import type { Point2D } from '../../rendering/types/Types';
import { generateCustomizationId } from '@/services/enterprise-id.service';
// 🏢 ADR-095: Centralized Snap Tolerance
// 🏢 ADR-167: Centralized UI Positioning Constants
import { SNAP_TOLERANCE, UI_POSITIONING } from '../../config/tolerance-config';

// ===== TOOL DEFINITION UTILITIES =====
export const ToolUtils = {
  /**
   * Creates a default tool definition
   */
  createToolDefinition: (
    id: ToolType,
    category: ToolCategory,
    overrides?: Partial<ToolDefinition>
  ): ToolDefinition => {
    return {
      id,
      category,
      name: id?.charAt(0)?.toUpperCase() + id?.slice(1)?.replace('-', ' ') || 'Unknown Tool',
      label: id?.charAt(0)?.toUpperCase() + id?.slice(1)?.replace('-', ' ') || 'Unknown Tool',
      tooltip: `Execute ${id.replace('-', ' ')} tool`,
      icon: 'default',
      hotkey: TOOLBAR_CONFIG.DEFAULT_HOTKEYS[id],
      enabled: true,
      visible: true,
      toggleable: false,
      exclusive: category === 'drawing' || category === 'editing',
      requiresInput: category === 'drawing' || category === 'editing' || category === 'measurement',
      inputType: category === 'drawing' ? 'points' : category === 'measurement' ? 'points' : 'point',
      preview: category === 'drawing',
      snap: category === 'drawing' || category === 'editing',
      ortho: category === 'drawing',
      polar: category === 'drawing',
      ...overrides
    };
  },

  /**
   * Validates tool definition
   */
  validateToolDefinition: (tool: ToolDefinition): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!tool.id || typeof tool.id !== 'string') {
      errors.push('Tool ID is required and must be a string');
    }

    if (!tool.name || typeof tool.name !== 'string') {
      errors.push('Tool name is required and must be a string');
    }

    if (!tool.category) {
      errors.push('Tool category is required');
    }

    if (tool.minInputPoints && tool.maxInputPoints && tool.minInputPoints > tool.maxInputPoints) {
      errors.push('minInputPoints cannot be greater than maxInputPoints');
    }

    return { valid: errors.length === 0, errors };
  },

  /**
   * Gets tools by category
   */
  getToolsByCategory: (tools: Partial<Record<ToolType, ToolDefinition>>, category: ToolCategory): ToolDefinition[] => {
    return Object.values(tools).filter((tool): tool is ToolDefinition => Boolean(tool)).filter(tool => tool.category === category);
  },

  /**
   * Searches tools by query
   */
  searchTools: (tools: Partial<Record<ToolType, ToolDefinition>>, query: string): ToolDefinition[] => {
    const lowerQuery = query.toLowerCase();
    return Object.values(tools)
      .filter((tool): tool is ToolDefinition => Boolean(tool))
      .filter(tool =>
      tool.name.toLowerCase().includes(lowerQuery) ||
      tool.label.toLowerCase().includes(lowerQuery) ||
      tool.tooltip.toLowerCase().includes(lowerQuery) ||
      tool.metadata?.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  },

  /**
   * Gets tool hotkey
   */
  getToolHotkey: (toolId: ToolType): string | undefined => {
    return TOOLBAR_CONFIG.DEFAULT_HOTKEYS[toolId];
  },

  /**
   * Checks if tool requires input
   */
  requiresInput: (tool: ToolDefinition): boolean => {
    return tool.requiresInput && (tool.inputType !== undefined);
  }
};

// ===== ACTION DEFINITION UTILITIES =====
export const ActionUtils = {
  /**
   * Creates a default action definition
   */
  createActionDefinition: (
    id: string,
    overrides?: Partial<ActionDefinition>
  ): ActionDefinition => {
    return {
      id,
      type: 'command',
      name: id?.charAt(0)?.toUpperCase() + id?.slice(1)?.replace('-', ' ') || 'Unknown Action',
      label: id?.charAt(0)?.toUpperCase() + id?.slice(1)?.replace('-', ' ') || 'Unknown Action',
      tooltip: `Execute ${id.replace('-', ' ')} action`,
      icon: 'default',
      enabled: true,
      visible: true,
      order: 0,
      ...overrides
    };
  },

  /**
   * Validates action definition
   */
  validateActionDefinition: (action: ActionDefinition): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!action.id || typeof action.id !== 'string') {
      errors.push('Action ID is required and must be a string');
    }

    if (!action.name || typeof action.name !== 'string') {
      errors.push('Action name is required and must be a string');
    }

    if (!['tool', 'command', 'toggle', 'menu'].includes(action.type)) {
      errors.push('Action type must be one of: tool, command, toggle, menu');
    }

    return { valid: errors.length === 0, errors };
  },

  /**
   * Groups actions by group property
   */
  groupActions: (actions: Record<string, ActionDefinition>): Record<string, ActionDefinition[]> => {
    const groups: Record<string, ActionDefinition[]> = {};
    
    Object.values(actions).forEach(action => {
      const group = action.group || 'default';
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(action);
    });

    // Sort actions within each group by order
    Object.keys(groups).forEach(group => {
      groups[group].sort((a, b) => (a.order || 0) - (b.order || 0));
    });

    return groups;
  }
};

// ===== TOOLBAR CONFIGURATION UTILITIES =====
export const ToolbarUtils = {
  /**
   * Creates a default toolbar configuration
   */
  createToolbarConfig: (
    id: string,
    overrides?: Partial<ToolbarConfig>
  ): ToolbarConfig => {
    return {
      id,
      name: id?.charAt(0)?.toUpperCase() + id?.slice(1) || 'Unknown Toolbar',
      label: id?.charAt(0)?.toUpperCase() + id?.slice(1) || 'Unknown Toolbar',
      position: 'top',
      orientation: 'horizontal',
      size: 'medium',
      visible: true,
      collapsible: false,
      collapsed: false,
      floating: false,
      dockable: true,
      resizable: false,
      movable: false,
      tools: [],
      actions: [],
      separators: [],
      style: DEFAULT_TOOLBAR_STYLE,
      behavior: {
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
      },
      layout: {
        grouping: true,
        wrapContent: false,
        justifyContent: 'start',
        alignItems: 'center',
        flexDirection: 'row',
        overflow: 'visible'
      },
      ...overrides
    };
  },

  /**
   * Validates toolbar configuration
   */
  validateToolbarConfig: (config: ToolbarConfig): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!config.id || typeof config.id !== 'string') {
      errors.push('Toolbar ID is required and must be a string');
    }

    if (!config.name || typeof config.name !== 'string') {
      errors.push('Toolbar name is required and must be a string');
    }

    if (!['top', 'bottom', 'left', 'right', 'floating'].includes(config.position)) {
      errors.push('Toolbar position must be one of: top, bottom, left, right, floating');
    }

    if (!['horizontal', 'vertical'].includes(config.orientation)) {
      errors.push('Toolbar orientation must be horizontal or vertical');
    }

    if (!['small', 'medium', 'large'].includes(config.size)) {
      errors.push('Toolbar size must be small, medium, or large');
    }

    return { valid: errors.length === 0, errors };
  },

  /**
   * Calculates toolbar dimensions based on configuration
   */
  calculateDimensions: (config: ToolbarConfig): { width: number; height: number } => {
    const { tools, actions, style, layout, orientation } = config;
    const totalItems = tools.length + actions.length;
    const separatorCount = config.separators.length;
    
    const itemSize = style.buttonSize + style.buttonPadding * 2;
    const spacing = style.spacing;
    const padding = style.padding * 2;
    
    if (orientation === 'horizontal') {
      const width = (itemSize * totalItems) + (spacing * (totalItems - 1)) + 
                   (spacing * separatorCount) + padding;
      const height = itemSize + padding;
      return { width, height };
    } else {
      const width = itemSize + padding;
      const height = (itemSize * totalItems) + (spacing * (totalItems - 1)) + 
                    (spacing * separatorCount) + padding;
      return { width, height };
    }
  },

  /**
   * Gets optimal position for floating toolbar
   */
  getOptimalFloatingPosition: (
    config: ToolbarConfig,
    containerRect: DOMRect,
    avoid: DOMRect[] = []
  ): Point2D => {
    const dimensions = ToolbarUtils.calculateDimensions(config);
    
    // 🏢 ADR-167: Centralized toolbar margin
    const margin = UI_POSITIONING.TOOLBAR_MARGIN;

    // Default to center-top
    let x = (containerRect.width - dimensions.width) / 2;
    let y = margin;

    // Check for collisions with avoid rectangles
    const proposedRect = new DOMRect(x, y, dimensions.width, dimensions.height);

    for (const avoidRect of avoid) {
      if (ToolbarUtils.rectsOverlap(proposedRect, avoidRect)) {
        // Try different positions
        const positions = [
          { x: margin, y: margin }, // Top-left
          { x: containerRect.width - dimensions.width - margin, y: margin }, // Top-right
          { x: margin, y: containerRect.height - dimensions.height - margin }, // Bottom-left
          { x: containerRect.width - dimensions.width - margin, y: containerRect.height - dimensions.height - margin } // Bottom-right
        ];
        
        for (const pos of positions) {
          const testRect = new DOMRect(pos.x, pos.y, dimensions.width, dimensions.height);
          if (!avoid.some(rect => ToolbarUtils.rectsOverlap(testRect, rect))) {
            return pos;
          }
        }
      }
    }
    
    return { x, y };
  },

  /**
   * Checks if two rectangles overlap
   */
  rectsOverlap: (rect1: DOMRect, rect2: DOMRect): boolean => {
    return !(rect1.right < rect2.left || 
             rect1.left > rect2.right || 
             rect1.bottom < rect2.top || 
             rect1.top > rect2.bottom);
  }
};

// ===== TOOL RUNNER UTILITIES =====
export const ToolRunnerUtils = {
  /**
   * Creates a new tool runner instance
   */
  createToolRunner: (): ToolRunner => {
    return {
      currentTool: null,
      isActive: false,
      inputPoints: [],
      requiredPoints: 0,
      minPoints: 0,
      maxPoints: 0,
      previewData: null,
      stepIndex: 0,
      steps: [],
      context: {
        snapSettings: {
          enabled: true,
          types: ['endpoint', 'midpoint', 'center'],
          tolerance: SNAP_TOLERANCE // 🏢 ADR-095
        },
        inputSettings: {
          ortho: false,
          polar: false,
          tracking: false,
          dynamicInput: true
        },
        displaySettings: {
          preview: true,
          constraints: true,
          feedback: true
        }
      }
    };
  },

  /**
   * Validates tool input based on step requirements
   * 🏢 ENTERPRISE: Using unknown for type-safe input validation
   */
  validateToolInput: (step: ToolStep, input: unknown): { valid: boolean; error?: string } => {
    if (step.required && (input === null || input === undefined)) {
      return { valid: false, error: 'This input is required' };
    }

    if (step.validation) {
      return step.validation(input);
    }

    return { valid: true };
  },

  /**
   * Calculates tool progress
   */
  calculateProgress: (runner: ToolRunner): { current: number; total: number; percentage: number } => {
    const current = runner.stepIndex + 1;
    const total = runner.steps.length;
    const percentage = total > 0 ? (current / total) * 100 : 0;
    
    return { current, total, percentage };
  },

  /**
   * Gets current tool step
   */
  getCurrentStep: (runner: ToolRunner): ToolStep | null => {
    if (runner.stepIndex >= 0 && runner.stepIndex < runner.steps.length) {
      return runner.steps[runner.stepIndex];
    }
    return null;
  },

  /**
   * Checks if tool can proceed to next step
   * 🏢 ENTERPRISE: Using unknown for type-safe input validation
   */
  canProceed: (runner: ToolRunner, input?: unknown): boolean => {
    const currentStep = ToolRunnerUtils.getCurrentStep(runner);
    if (!currentStep) return false;

    if (currentStep.required && (input === null || input === undefined)) {
      return false;
    }

    if (currentStep.validation) {
      const validation = currentStep.validation(input);
      return validation.valid;
    }

    return true;
  }
};

// ===== CUSTOMIZATION UTILITIES =====
export const CustomizationUtils = {
  /**
   * Creates a new toolbar customization
   * 🏢 ENTERPRISE: Using unknown for type-safe changes tracking
   */
  createCustomization: (
    name: string,
    description: string,
    toolbarId: string,
    changes: ToolbarCustomization['changes'],
    createdBy: string = 'user'
  // 🏢 ENTERPRISE: Using centralized ID generation (crypto-secure)
  ): ToolbarCustomization => {
    return {
      id: generateCustomizationId(),
      name,
      description,
      toolbarId,
      changes,
      createdAt: new Date(),
      createdBy,
      active: false
    };
  },

  /**
   * Applies customization to toolbar configuration
   */
  applyCustomization: (
    config: ToolbarConfig,
    customization: ToolbarCustomization
  ): ToolbarConfig => {
    const { changes } = customization;
    let modifiedConfig = { ...config };

    // Add new tools
    if (changes.addedTools?.length > 0) {
      modifiedConfig.tools = [...modifiedConfig.tools, ...changes.addedTools];
    }

    // Remove tools
    if (changes.removedTools?.length > 0) {
      modifiedConfig.tools = modifiedConfig.tools.filter(
        toolId => !changes.removedTools.includes(toolId)
      );
    }

    // Reorder tools
    if (changes.reorderedTools?.length > 0) {
      changes.reorderedTools.forEach((reorder: { from: number; to: number }) => {
        const tools = [...modifiedConfig.tools];
        const [movedTool] = tools.splice(reorder.from, 1);
        tools.splice(reorder.to, 0, movedTool);
        modifiedConfig.tools = tools;
      });
    }

    // Apply property modifications
    if (changes.modifiedProperties) {
      modifiedConfig = { ...modifiedConfig, ...changes.modifiedProperties };
    }

    return modifiedConfig;
  },

  /**
   * Validates customization data
   */
  validateCustomization: (customization: ToolbarCustomization): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!customization.name || typeof customization.name !== 'string') {
      errors.push('Customization name is required and must be a string');
    }

    if (!customization.toolbarId || typeof customization.toolbarId !== 'string') {
      errors.push('Toolbar ID is required and must be a string');
    }

    if (!customization.changes || typeof customization.changes !== 'object') {
      errors.push('Changes object is required');
    }

    return { valid: errors.length === 0, errors };
  }
};

// ===== HOTKEY UTILITIES =====
export const HotkeyUtils = {
  /**
   * Parses hotkey string into components
   */
  parseHotkey: (hotkey: string): { 
    key: string; 
    ctrl: boolean; 
    alt: boolean; 
    shift: boolean; 
    meta: boolean 
  } => {
    const parts = hotkey.toLowerCase().split('+');
    const key = parts[parts.length - 1];
    
    return {
      key,
      ctrl: parts.includes('ctrl'),
      alt: parts.includes('alt'),
      shift: parts.includes('shift'),
      meta: parts.includes('meta') || parts.includes('cmd')
    };
  },

  /**
   * Formats hotkey for display
   */
  formatHotkey: (hotkey: string): string => {
    const parsed = HotkeyUtils.parseHotkey(hotkey);
    const parts: string[] = [];

    if (parsed.ctrl) parts.push('Ctrl');
    if (parsed.alt) parts.push('Alt');
    if (parsed.shift) parts.push('Shift');
    if (parsed.meta) parts.push('⌘');
    
    parts.push(parsed.key.toUpperCase());

    return parts.join('+');
  },

  /**
   * Checks if hotkey matches keyboard event
   */
  matchesEvent: (hotkey: string, event: KeyboardEvent): boolean => {
    const parsed = HotkeyUtils.parseHotkey(hotkey);
    
    return (
      event.key.toLowerCase() === parsed.key &&
      event.ctrlKey === parsed.ctrl &&
      event.altKey === parsed.alt &&
      event.shiftKey === parsed.shift &&
      event.metaKey === parsed.meta
    );
  }
};

// ===== COMMON HOOK PATTERNS =====
export const HookPatternUtils = {
  /**
   * Creates safe error handler for hooks
   */
  createErrorHandler: (onError?: (error: string) => void) => {
    return (operation: string, error: unknown): string => {
      const errorMsg = error instanceof Error ? error.message : `Failed to ${operation}`;
      onError?.(errorMsg);
      return errorMsg;
    };
  },

  /**
   * Creates operation result factory
   * 🏢 ENTERPRISE: Using unknown for type-safe data passing
   */
  createOperationResult: (
    operation: ToolbarOperation,
    success: boolean,
    data?: unknown,
    error?: string,
    toolbarId?: string
  ): ToolbarOperationResult => {
    return {
      success,
      operation,
      ...(toolbarId ? { toolbarId } : {}),
      ...(data !== undefined ? { data } : {}),
      ...(error ? { error } : {})
    };
  },

  /**
   * Creates safe state updater with error handling
   */
  createSafeStateUpdater: <T>(
    setState: React.Dispatch<React.SetStateAction<T>>,
    onError?: (error: string) => void
  ) => {
    return (updater: (prev: T) => T, operation: string = 'update state') => {
      try {
        setState(updater);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : `Failed to ${operation}`;
        onError?.(errorMsg);
      }
    };
  },

  /**
   * Creates common callback with error boundary
   */
  createSafeCallback: <T extends unknown[], R>(
    callback: (...args: T) => R,
    onError?: (error: string) => void,
    operation: string = 'execute callback'
  ) => {
    return (...args: T): R | undefined => {
      try {
        return callback(...args);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : `Failed to ${operation}`;
        onError?.(errorMsg);
        return undefined;
      }
    };
  }
};

// ===== COMBINED UTILITY EXPORT =====
export const ToolbarSystemUtils = {
  ...ToolUtils,
  ...ActionUtils,
  ...ToolbarUtils,
  ...ToolRunnerUtils,
  ...CustomizationUtils,
  ...HotkeyUtils,
  ...HookPatternUtils
};
