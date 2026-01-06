/**
 * 🏢 ENTERPRISE: Performance Monitor Toggle Hook
 *
 * Following Bentley/Autodesk pattern:
 * - Performance monitoring available ONLY in design tools (DXF Viewer)
 * - OFF by default for better performance
 * - State persisted in localStorage
 * - Accessible via toggle in DebugToolbar
 *
 * @see docs/features/performance/PERFORMANCE_MONITOR.md
 * @author Enterprise Architecture Team
 * @since 2026-01-06
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

// 🏢 ENTERPRISE: Storage key for persistence
const STORAGE_KEY = 'dxf-viewer-performance-monitor-enabled';

// 🏢 ENTERPRISE: Default OFF for better performance (Bentley/Autodesk pattern)
const DEFAULT_ENABLED = false;

export interface UsePerformanceMonitorToggleReturn {
  /** Whether performance monitor is enabled */
  isEnabled: boolean;
  /** Toggle performance monitor on/off */
  toggle: () => void;
  /** Explicitly set enabled state */
  setEnabled: (enabled: boolean) => void;
}

/**
 * 🏢 ENTERPRISE: Hook for managing Performance Monitor visibility
 *
 * Features:
 * - Persists state in localStorage
 * - SSR-safe (checks for window)
 * - Default OFF for production performance
 *
 * @example
 * const { isEnabled, toggle } = usePerformanceMonitorToggle();
 *
 * return (
 *   <>
 *     <button onClick={toggle}>
 *       {isEnabled ? 'Hide' : 'Show'} Performance Monitor
 *     </button>
 *     {isEnabled && <PerformanceMonitor />}
 *   </>
 * );
 */
export function usePerformanceMonitorToggle(): UsePerformanceMonitorToggleReturn {
  // 🏢 ENTERPRISE: Initialize from localStorage (SSR-safe)
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_ENABLED;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        return JSON.parse(stored) === true;
      }
    } catch (error) {
      console.warn('[PerformanceMonitor] Failed to read from localStorage:', error);
    }

    return DEFAULT_ENABLED;
  });

  // 🏢 ENTERPRISE: Persist to localStorage on change
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(isEnabled));
    } catch (error) {
      console.warn('[PerformanceMonitor] Failed to save to localStorage:', error);
    }
  }, [isEnabled]);

  // 🏢 ENTERPRISE: Toggle function (stable reference)
  const toggle = useCallback(() => {
    setIsEnabled(prev => !prev);
  }, []);

  // 🏢 ENTERPRISE: Explicit setter (stable reference)
  const setEnabled = useCallback((enabled: boolean) => {
    setIsEnabled(enabled);
  }, []);

  return {
    isEnabled,
    toggle,
    setEnabled
  };
}

/**
 * 🏢 ENTERPRISE: Standalone function to check if Performance Monitor is enabled
 * Useful for conditional imports and lazy loading
 */
export function isPerformanceMonitorEnabled(): boolean {
  if (typeof window === 'undefined') {
    return DEFAULT_ENABLED;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== null ? JSON.parse(stored) === true : DEFAULT_ENABLED;
  } catch {
    return DEFAULT_ENABLED;
  }
}
