/**
 * 🏢 ENTERPRISE COLOR SYSTEM - Recent Colors Store
 *
 * @version 1.0.0
 * @description LRU (Least Recently Used) store for recent color selections
 *
 * Features:
 * - localStorage persistence
 * - LRU eviction (max 10 colors by default)
 * - Deduplication
 * - Normalized hex format
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI) + ChatGPT-5
 * @since 2025-10-07
 */

import type { RecentColorsState, RecentColorsActions } from './types';

// ===== CONSTANTS =====

const STORAGE_KEY = 'dxf-viewer:recent-colors';
const DEFAULT_MAX_COLORS = 10;

// ===== UTILITY FUNCTIONS =====

/**
 * Normalize hex color to lowercase #RRGGBB format
 */
function normalizeHex(color: string): string {
  let hex = color.trim().toLowerCase();

  // Remove # if present
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }

  // Expand shorthand #RGB → #RRGGBB
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }

  // Validate hex format
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(hex)) {
    throw new Error(`Invalid hex color: ${color}`);
  }

  return `#${hex}`;
}

/**
 * Load colors from localStorage
 */
function loadFromStorage(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      // Validate and normalize all colors
      return parsed
        .filter((c) => typeof c === 'string')
        .map((c) => {
          try {
            return normalizeHex(c);
          } catch {
            return null;
          }
        })
        .filter((c): c is string => c !== null);
    }
  } catch (error) {
    console.warn('[RecentColors] Failed to load from localStorage:', error);
  }
  return [];
}

/**
 * Save colors to localStorage
 */
function saveToStorage(colors: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
  } catch (error) {
    console.warn('[RecentColors] Failed to save to localStorage:', error);
  }
}

// ===== STORE IMPLEMENTATION =====

/**
 * Create a Recent Colors Store
 */
export function createRecentColorsStore(
  maxColors: number = DEFAULT_MAX_COLORS
): RecentColorsState & RecentColorsActions {
  let colors: string[] = [];

  const store = {
    get colors() {
      return colors;
    },

    get maxColors() {
      return maxColors;
    },

    /**
     * Add a color to recent list (LRU)
     *
     * - Normalizes color to lowercase #RRGGBB(AA)
     * - Removes duplicates (moves to front if exists)
     * - Evicts oldest color if max reached
     */
    addColor(color: string): void {
      try {
        const normalized = normalizeHex(color);

        // Remove if already exists (dedupe)
        colors = colors.filter((c) => c !== normalized);

        // Add to front (most recent)
        colors.unshift(normalized);

        // Evict oldest if over max
        if (colors.length > maxColors) {
          colors = colors.slice(0, maxColors);
        }

        // Persist to storage
        saveToStorage(colors);
      } catch (error) {
        console.warn('[RecentColors] Failed to add color:', error);
      }
    },

    /**
     * Clear all recent colors
     */
    clear(): void {
      colors = [];
      saveToStorage(colors);
    },

    /**
     * Load colors from localStorage
     */
    load(): void {
      colors = loadFromStorage().slice(0, maxColors);
    },

    /**
     * Save colors to localStorage
     */
    save(): void {
      saveToStorage(colors);
    },
  };

  // Auto-load on creation
  store.load();

  return store;
}

// ===== SINGLETON INSTANCE =====

/**
 * Global recent colors store instance
 */
let globalStore: (RecentColorsState & RecentColorsActions) | null = null;

/**
 * Get global recent colors store (singleton)
 */
export function getRecentColorsStore(): RecentColorsState & RecentColorsActions {
  if (!globalStore) {
    globalStore = createRecentColorsStore();
  }
  return globalStore;
}

/**
 * Reset global store (for testing)
 */
export function resetRecentColorsStore(): void {
  globalStore = null;
}

// ===== REACT HOOK =====

/**
 * React hook for recent colors
 *
 * @example
 * ```tsx
 * const { colors, addColor, clear } = useRecentColors();
 *
 * // Add color when user selects one
 * addColor('#ff0000');
 *
 * // Display recent colors
 * colors.map(color => <ColorSwatch color={color} />)
 * ```
 */
export function useRecentColors() {
  const [state, setState] = React.useState(() => {
    const store = getRecentColorsStore();
    return { colors: store.colors };
  });

  React.useEffect(() => {
    // Reload from storage on mount
    const store = getRecentColorsStore();
    store.load();
    setState({ colors: store.colors });
  }, []);

  const addColor = React.useCallback((color: string) => {
    const store = getRecentColorsStore();
    store.addColor(color);
    setState({ colors: store.colors });
  }, []);

  const clear = React.useCallback(() => {
    const store = getRecentColorsStore();
    store.clear();
    setState({ colors: store.colors });
  }, []);

  return {
    colors: state.colors,
    addColor,
    clear,
  };
}

// React import for hook
import React from 'react';
