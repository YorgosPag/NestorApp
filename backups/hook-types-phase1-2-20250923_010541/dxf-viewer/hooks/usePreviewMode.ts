/**
 * PREVIEW MODE MANAGEMENT HOOK
 * Καθαρή διαχείριση των viewer modes (normal/preview/completion)
 */

import { useCallback, useMemo } from 'react';
import { useViewerConfig } from '../providers/ConfigurationProvider';
import type { ViewerMode, PreviewModeHookResult } from '../types/viewerConfiguration';

// ===== MAIN HOOK =====

export function usePreviewMode(): PreviewModeHookResult {
  const { config, setMode } = useViewerConfig();

  // ===== CURRENT STATE =====

  const mode = config.mode;

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