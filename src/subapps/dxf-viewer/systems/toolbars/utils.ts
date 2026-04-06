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
} from './config';
import { DEFAULT_TOOLBAR_STYLE, TOOLBAR_CONFIG } from './config';
import type { Point2D } from '../../rendering/types/Types';
import { UI_POSITIONING } from '../../config/tolerance-config';

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

// ===== RE-EXPORTS from toolbars-extended-utils.ts (ADR-065 split) =====
export {
  ToolRunnerUtils,
  CustomizationUtils,
  HotkeyUtils,
  HookPatternUtils,
} from './toolbars-extended-utils';

// ===== COMBINED UTILITY EXPORT =====
import {
  ToolRunnerUtils as _ToolRunnerUtils,
  CustomizationUtils as _CustomizationUtils,
  HotkeyUtils as _HotkeyUtils,
  HookPatternUtils as _HookPatternUtils,
} from './toolbars-extended-utils';

export const ToolbarSystemUtils = {
  ...ToolUtils,
  ...ActionUtils,
  ...ToolbarUtils,
  ..._ToolRunnerUtils,
  ..._CustomizationUtils,
  ..._HotkeyUtils,
  ..._HookPatternUtils
};
