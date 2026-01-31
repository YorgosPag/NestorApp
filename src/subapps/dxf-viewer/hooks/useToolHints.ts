'use client';

/**
 * 🏢 ENTERPRISE (2026-01-31): PORTABLE TOOL HINTS HOOK
 *
 * ADR-082: Step-by-step tool hints system
 *
 * Returns step-by-step hints based on active tool and current drawing state.
 * Can be used in ANY component - ToolbarStatusBar, CanvasHelpBar, etc.
 *
 * Features:
 * - Portable: same hook works in multiple UI locations
 * - i18n-ready: all strings from tool-hints namespace
 * - State-aware: tracks pointCount from DrawingStateMachine
 * - Type-safe: full TypeScript support
 */

import { useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useDrawingMachine } from '../core/state-machine/useDrawingMachine';
import type { ToolType, ToolHint, ToolHintsResult } from '../ui/toolbar/types';

/**
 * Portable Tool Hints Hook
 *
 * @param activeTool - Current active tool from toolbar
 * @returns ToolHintsResult with current hint and step info
 *
 * @example
 * ```tsx
 * // In ToolbarStatusBar
 * const { currentStepText, hasHints, shortcuts } = useToolHints(activeTool);
 *
 * // In CanvasHelpBar (future)
 * const { hint, currentStep, totalSteps } = useToolHints(activeTool);
 * ```
 */
export function useToolHints(activeTool: ToolType): ToolHintsResult {
  const { t, isNamespaceReady } = useTranslation('tool-hints');
  const { pointCount } = useDrawingMachine();

  return useMemo(() => {
    // Default result for tools without hints or loading state
    const defaultResult: ToolHintsResult = {
      hint: null,
      currentStep: 0,
      totalSteps: 0,
      currentStepText: '',
      hasHints: false,
      isReady: isNamespaceReady,
    };

    // Namespace not ready yet
    if (!isNamespaceReady) {
      return defaultResult;
    }

    // No tool selected
    if (!activeTool) {
      return {
        ...defaultResult,
        currentStepText: t('common.noHint', { defaultValue: '' }),
      };
    }

    // Try to get hint for this tool
    // Tool key format: "tools.{toolId}" e.g. "tools.line", "tools.arc-3p"
    const toolKey = `tools.${activeTool}`;
    const name = t(`${toolKey}.name`, { defaultValue: '' });

    // If no name found, this tool has no hints defined
    if (!name) {
      return defaultResult;
    }

    // Get steps array with proper typing
    // returnObjects: true returns the array instead of stringified version
    const stepsRaw = t(`${toolKey}.steps`, { returnObjects: true });
    const steps: string[] = Array.isArray(stepsRaw) ? stepsRaw : [];

    // Build complete hint object
    const hint: ToolHint = {
      name,
      description: t(`${toolKey}.description`, { defaultValue: '' }),
      steps,
      shortcuts: t(`${toolKey}.shortcuts`, { defaultValue: '' }),
    };

    const totalSteps = steps.length;

    // Current step based on pointCount
    // Capped at last step (0-indexed, so max is totalSteps - 1)
    // pointCount 0 → step 0 (first instruction)
    // pointCount 1 → step 1 (second instruction, if exists)
    // etc.
    const currentStep = Math.min(pointCount, totalSteps - 1);
    const currentStepText = steps[currentStep] || '';

    return {
      hint,
      currentStep,
      totalSteps,
      currentStepText,
      hasHints: true,
      isReady: true,
    };
  }, [activeTool, pointCount, t, isNamespaceReady]);
}

/**
 * Simplified hook for just getting the current step text
 * Use when you only need the hint text, not full metadata
 *
 * @param activeTool - Current active tool
 * @returns Current step text string (empty if no hints)
 */
export function useToolHintText(activeTool: ToolType): string {
  const { currentStepText } = useToolHints(activeTool);
  return currentStepText;
}

/**
 * Hook for getting shortcuts for a tool
 *
 * @param activeTool - Current active tool
 * @returns Shortcuts string (empty if none)
 */
export function useToolShortcuts(activeTool: ToolType): string {
  const { hint } = useToolHints(activeTool);
  return hint?.shortcuts || '';
}

export default useToolHints;
