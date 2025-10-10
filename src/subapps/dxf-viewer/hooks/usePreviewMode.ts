/**
 * PREVIEW MODE MANAGEMENT HOOK - MIGRATED TO Enterprise Provider
 *
 * 🔄 MIGRATION HISTORY:
 * - 2025-10-06: ConfigurationProvider → DxfSettingsProvider
 * - 2025-10-09: Phase 3.2 - Direct Enterprise (no adapter)
 *
 * @see {@link ../providers/EnterpriseDxfSettingsProvider.tsx} - Enterprise provider
 */

import { useCallback, useMemo } from 'react';
// 🔄 MIGRATED (2025-10-09): Phase 3.2 - Direct Enterprise (no adapter)
import { useDxfSettings } from '../settings-provider';
import type { PreviewModeHookResult } from '../types/viewerConfiguration';

// Use ViewerMode from old types (compatible with both)
type ViewerMode = 'normal' | 'preview' | 'completion';

// ===== MAIN HOOK =====

export function usePreviewMode(): PreviewModeHookResult {
  // 🔄 MIGRATED: Direct Enterprise (no adapter)
  const dxfSettings = useDxfSettings();

  if (!dxfSettings) {
    // Fallback if context not available
    return {
      mode: 'normal',
      setMode: () => {},
      isPreview: false,
      isCompletion: false,
      isNormal: true
    };
  }

  const { settings, setMode } = dxfSettings;

  // ===== CURRENT STATE =====

  // 🔄 MIGRATION NOTE: Enterprise settings.mode includes all modes (normal/draft/hover/selection/completion/preview)
  // Old ViewerMode only has (normal/preview/completion)
  // Type assertion is safe here since we only use the 3 old modes in this hook
  const mode = settings.mode as ViewerMode;

  // ===== CONVENIENCE BOOLEANS =====

  const { isPreview, isCompletion, isNormal } = useMemo(() => ({
    isPreview: mode === 'preview',
    isCompletion: mode === 'completion',
    isNormal: mode === 'normal'
  }), [mode]);

  // ===== MODE SETTERS =====

  const setModeCallback = useCallback((newMode: ViewerMode) => {
    setMode(newMode);
  }, [setMode]);

  // ===== RETURN VALUE =====

  return {
    mode,
    setMode: setModeCallback,
    isPreview,
    isCompletion,
    isNormal
  };
}

// ===== CONVENIENCE HOOKS =====

export function usePreviewModeToggle() {
  const { mode, setMode } = usePreviewMode();

  const togglePreview = useCallback(() => {
    setMode(mode === 'preview' ? 'normal' : 'preview');
  }, [mode, setMode]);

  const toggleCompletion = useCallback(() => {
    setMode(mode === 'completion' ? 'normal' : 'completion');
  }, [mode, setMode]);

  const enterPreview = useCallback(() => {
    setMode('preview');
  }, [setMode]);

  const enterCompletion = useCallback(() => {
    setMode('completion');
  }, [setMode]);

  const enterNormal = useCallback(() => {
    setMode('normal');
  }, [setMode]);

  return {
    togglePreview,
    toggleCompletion,
    enterPreview,
    enterCompletion,
    enterNormal
  };
}
