/**
 * useColorMenuState - Enterprise-Grade Color Menu State Management
 *
 * ENTERPRISE FEATURES:
 * - ✅ Type-safe state with validation
 * - ✅ Boundary checking for coordinates
 * - ✅ Auto-close on click outside
 * - ✅ Keyboard shortcuts (ESC to close)
 * - ✅ Performance optimization
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

// ✅ ENTERPRISE: Type-safe state schema
interface ColorMenuState {
  open: boolean;
  x: number;
  y: number;
  ids: string[];
}

// ✅ ENTERPRISE: Default state
const DEFAULT_COLOR_MENU_STATE: ColorMenuState = {
  open: false,
  x: 0,
  y: 0,
  ids: [],
};

// ✅ ENTERPRISE: Coordinate bounds (viewport-based)
function validateCoordinates(x: number, y: number): { x: number; y: number } {
  const maxX = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const maxY = typeof window !== 'undefined' ? window.innerHeight : 1080;

  return {
    x: Math.max(0, Math.min(maxX - 300, x)), // Reserve 300px for menu width
    y: Math.max(0, Math.min(maxY - 400, y)), // Reserve 400px for menu height
  };
}

/**
 * Custom hook for managing color menu popover state
 *
 * @returns Color menu state and control functions
 */
export function useColorMenuState() {
  const [state, setState] = useState<ColorMenuState>(DEFAULT_COLOR_MENU_STATE);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // ✅ ENTERPRISE: Open menu with validation
  const open = useCallback((x: number, y: number, ids: string[]) => {
    if (!ids || ids.length === 0) {
      console.warn('[useColorMenuState] Cannot open menu with empty selection');
      return;
    }

    const validated = validateCoordinates(x, y);

    setState({
      open: true,
      x: validated.x,
      y: validated.y,
      ids,
    });

    console.log('[useColorMenuState] Opened menu:', { position: validated, entityCount: ids.length });
  }, []);

  // ✅ ENTERPRISE: Close menu
  const close = useCallback(() => {
    setState(DEFAULT_COLOR_MENU_STATE);
  }, []);

  // ✅ ENTERPRISE: Update position (for drag support)
  const updatePosition = useCallback((x: number, y: number) => {
    setState(prev => {
      if (!prev.open) return prev;

      const validated = validateCoordinates(x, y);
      return {
        ...prev,
        x: validated.x,
        y: validated.y,
      };
    });
  }, []);

  // ✅ ENTERPRISE: Keyboard shortcuts (ESC to close)
  useEffect(() => {
    if (!state.open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [state.open, close]);

  // ✅ ENTERPRISE: Click outside to close
  useEffect(() => {
    if (!state.open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        close();
      }
    };

    // Add listener with delay to avoid immediate close
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [state.open, close]);

  // ✅ ENTERPRISE: Auto-close on window resize
  useEffect(() => {
    if (!state.open) return;

    const handleResize = () => {
      // Revalidate position on resize
      const validated = validateCoordinates(state.x, state.y);
      if (validated.x !== state.x || validated.y !== state.y) {
        updatePosition(validated.x, validated.y);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [state.open, state.x, state.y, updatePosition]);

  return {
    // State
    colorMenu: state,

    // Actions
    openColorMenu: open,
    closeColorMenu: close,
    updateColorMenuPosition: updatePosition,

    // Ref for click-outside detection
    colorMenuRef: menuRef,
  };
}
