/**
 * TOOLBARS EXTENDED UTILITIES
 * Extracted from utils.ts for SRP (ADR-065)
 *
 * Contains:
 * - ToolRunnerUtils: Tool runner instance management
 * - CustomizationUtils: Toolbar customization CRUD
 * - HotkeyUtils: Keyboard shortcut parsing/matching
 * - HookPatternUtils: Common hook error handling patterns
 */

import type {
  ToolbarConfig,
  ToolbarOperation,
  ToolbarOperationResult,
  ToolbarCustomization,
  ToolRunner,
  ToolStep
} from './config';
import { generateCustomizationId } from '@/services/enterprise-id.service';
import { SNAP_TOLERANCE } from '../../config/tolerance-config';

// ===== TOOL RUNNER UTILITIES =====
export const ToolRunnerUtils = {
  createToolRunner: (): ToolRunner => ({
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
        tolerance: SNAP_TOLERANCE
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
  }),

  validateToolInput: (step: ToolStep, input: unknown): { valid: boolean; error?: string } => {
    if (step.required && (input === null || input === undefined)) {
      return { valid: false, error: 'This input is required' };
    }
    if (step.validation) {
      return step.validation(input);
    }
    return { valid: true };
  },

  calculateProgress: (runner: ToolRunner): { current: number; total: number; percentage: number } => {
    const current = runner.stepIndex + 1;
    const total = runner.steps.length;
    const percentage = total > 0 ? (current / total) * 100 : 0;
    return { current, total, percentage };
  },

  getCurrentStep: (runner: ToolRunner): ToolStep | null => {
    if (runner.stepIndex >= 0 && runner.stepIndex < runner.steps.length) {
      return runner.steps[runner.stepIndex];
    }
    return null;
  },

  canProceed: (runner: ToolRunner, input?: unknown): boolean => {
    const currentStep = ToolRunnerUtils.getCurrentStep(runner);
    if (!currentStep) return false;
    if (currentStep.required && (input === null || input === undefined)) return false;
    if (currentStep.validation) {
      return currentStep.validation(input).valid;
    }
    return true;
  }
};

// ===== CUSTOMIZATION UTILITIES =====
export const CustomizationUtils = {
  createCustomization: (
    name: string,
    description: string,
    toolbarId: string,
    changes: ToolbarCustomization['changes'],
    createdBy: string = 'user'
  ): ToolbarCustomization => ({
    id: generateCustomizationId(),
    name,
    description,
    toolbarId,
    changes,
    createdAt: new Date(),
    createdBy,
    active: false
  }),

  applyCustomization: (
    config: ToolbarConfig,
    customization: ToolbarCustomization
  ): ToolbarConfig => {
    const { changes } = customization;
    let modifiedConfig = { ...config };

    if (changes.addedTools?.length > 0) {
      modifiedConfig.tools = [...modifiedConfig.tools, ...changes.addedTools];
    }

    if (changes.removedTools?.length > 0) {
      modifiedConfig.tools = modifiedConfig.tools.filter(
        toolId => !changes.removedTools.includes(toolId)
      );
    }

    if (changes.reorderedTools?.length > 0) {
      changes.reorderedTools.forEach((reorder: { from: number; to: number }) => {
        const tools = [...modifiedConfig.tools];
        const [movedTool] = tools.splice(reorder.from, 1);
        tools.splice(reorder.to, 0, movedTool);
        modifiedConfig.tools = tools;
      });
    }

    if (changes.modifiedProperties) {
      modifiedConfig = { ...modifiedConfig, ...changes.modifiedProperties };
    }

    return modifiedConfig;
  },

  validateCustomization: (customization: ToolbarCustomization): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    if (!customization.name || typeof customization.name !== 'string') errors.push('Customization name is required');
    if (!customization.toolbarId || typeof customization.toolbarId !== 'string') errors.push('Toolbar ID is required');
    if (!customization.changes || typeof customization.changes !== 'object') errors.push('Changes object is required');
    return { valid: errors.length === 0, errors };
  }
};

// ===== HOTKEY UTILITIES =====
export const HotkeyUtils = {
  parseHotkey: (hotkey: string): {
    key: string;
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    meta: boolean;
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

  formatHotkey: (hotkey: string): string => {
    const parsed = HotkeyUtils.parseHotkey(hotkey);
    const parts: string[] = [];
    if (parsed.ctrl) parts.push('Ctrl');
    if (parsed.alt) parts.push('Alt');
    if (parsed.shift) parts.push('Shift');
    if (parsed.meta) parts.push('\u2318');
    parts.push(parsed.key.toUpperCase());
    return parts.join('+');
  },

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
  createErrorHandler: (onError?: (error: string) => void) => {
    return (operation: string, error: unknown): string => {
      const errorMsg = error instanceof Error ? error.message : `Failed to ${operation}`;
      onError?.(errorMsg);
      return errorMsg;
    };
  },

  createOperationResult: (
    operation: ToolbarOperation,
    success: boolean,
    data?: unknown,
    error?: string,
    toolbarId?: string
  ): ToolbarOperationResult => ({
    success,
    operation,
    ...(toolbarId ? { toolbarId } : {}),
    ...(data !== undefined ? { data } : {}),
    ...(error ? { error } : {})
  }),

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
