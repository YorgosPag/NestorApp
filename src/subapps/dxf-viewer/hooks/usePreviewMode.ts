/**
 * PREVIEW MODE MANAGEMENT HOOK - MIGRATED TO DxfSettingsProvider
 *
 * 🔄 MIGRATION NOTE (2025-10-06):
 * This hook now uses DxfSettingsProvider instead of ConfigurationProvider.
 * ConfigurationProvider has been MERGED into DxfSettingsProvider.
 */

import { useCallback, useMemo } from 'react';
import { useDxfSettings, type ViewerMode } from '../providers/DxfSettingsProvider';
import type { PreviewModeHookResult } from '../types/viewerConfiguration';

// ===== MAIN HOOK =====

export function usePreviewMode(): PreviewModeHookResult {
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

  const mode = settings.mode;

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
