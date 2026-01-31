/**
 * 🏢 ENTERPRISE PANEL TYPE DEFINITIONS
 * ============================================================================
 *
 * Single Source of Truth για όλα τα Panel Types στο DXF Viewer.
 *
 * @fileoverview Centralized panel type definitions following enterprise patterns:
 * - Single Source of Truth (SSoT)
 * - Discriminated Unions for type safety
 * - Proper documentation
 * - Backwards compatibility via re-exports
 *
 * @module types/panel-types
 * @see ADR-010 in docs/centralized-systems/reference/adr-index.md
 * ============================================================================
 */

// ============================================================================
// 🎯 FLOATING PANEL TYPES - UI Visible Panels
// ============================================================================

/**
 * 🏢 ENTERPRISE: Floating Panel Types
 *
 * These are the panels visible in the floating panel container UI.
 * Each type corresponds to a tab in the PanelTabs component.
 *
 * @description
 * - 'levels': Επίπεδα - Level management panel
 * - 'hierarchy': Ιεραρχία - Entity hierarchy tree
 * - 'overlay': Overlay - Region overlay management
 * - 'colors': Ρυθμίσεις DXF - DXF settings (lines, text, grips)
 *
 * @example
 * ```tsx
 * import type { FloatingPanelType } from '../types/panel-types';
 *
 * const [activePanel, setActivePanel] = useState<FloatingPanelType>('levels');
 * ```
 */
export type FloatingPanelType = 'levels' | 'hierarchy' | 'overlay' | 'colors';

/**
 * 🏢 ENTERPRISE: All Panel Types (including future/hidden)
 *
 * Extended type that includes all panels, even those not currently visible in UI.
 * Use FloatingPanelType for UI-visible panels only.
 *
 * @deprecated Use FloatingPanelType for new code. This type exists for backwards
 * compatibility with legacy code that used 'layers'.
 */
export type ExtendedPanelType = FloatingPanelType | 'layers';

// ============================================================================
// 🔄 BACKWARDS COMPATIBILITY - Legacy Support
// ============================================================================

/**
 * @deprecated Use FloatingPanelType instead.
 * Alias maintained for backwards compatibility during migration.
 */
export type PanelType = FloatingPanelType;

// ============================================================================
// 🛡️ TYPE GUARDS - Runtime Type Safety
// ============================================================================

/**
 * 🏢 ENTERPRISE: Type guard for FloatingPanelType
 *
 * Runtime validation that a value is a valid FloatingPanelType.
 *
 * @param value - The value to check
 * @returns True if value is a valid FloatingPanelType
 *
 * @example
 * ```tsx
 * const handleTabChange = (value: string) => {
 *   if (isFloatingPanelType(value)) {
 *     setActivePanel(value);
 *   }
 * };
 * ```
 */
export function isFloatingPanelType(value: unknown): value is FloatingPanelType {
  return (
    typeof value === 'string' &&
    ['levels', 'hierarchy', 'overlay', 'colors'].includes(value)
  );
}

/**
 * 🏢 ENTERPRISE: All valid floating panel type values
 *
 * Useful for iteration, validation, and UI generation.
 */
export const FLOATING_PANEL_TYPES: readonly FloatingPanelType[] = [
  'levels',
  'hierarchy',
  'overlay',
  'colors',
] as const;

// ============================================================================
// 📋 PANEL METADATA - UI Configuration
// ============================================================================

/**
 * 🏢 ENTERPRISE: Panel metadata for UI rendering
 */
export interface PanelMetadata {
  /** Panel type identifier */
  type: FloatingPanelType;
  /** Translation key for panel label */
  labelKey: string;
  /** Fallback label (Greek) */
  fallbackLabel: string;
  /** Lucide icon name */
  iconName: 'BarChart' | 'Construction' | 'Map' | 'Settings';
  /** Whether panel can be disabled */
  canBeDisabled: boolean;
}

/**
 * 🏢 ENTERPRISE: Panel configuration metadata
 *
 * Centralized configuration for all floating panels.
 */
export const PANEL_METADATA: Record<FloatingPanelType, PanelMetadata> = {
  levels: {
    type: 'levels',
    labelKey: 'panels.levels.title',
    fallbackLabel: 'Επίπεδα',
    iconName: 'BarChart',
    canBeDisabled: false,
  },
  hierarchy: {
    type: 'hierarchy',
    labelKey: 'panels.hierarchy.title',
    fallbackLabel: 'Ιεραρχία',
    iconName: 'Construction',
    canBeDisabled: true,
  },
  overlay: {
    type: 'overlay',
    labelKey: 'panels.overlay.title',
    fallbackLabel: 'Overlay',
    iconName: 'Map',
    canBeDisabled: true,
  },
  colors: {
    type: 'colors',
    labelKey: 'panels.colors.title',
    fallbackLabel: 'Ρυθμίσεις DXF',
    iconName: 'Settings',
    canBeDisabled: false,
  },
} as const;

// ============================================================================
// 🎨 PANEL LAYOUT - Row Configuration
// ============================================================================

/**
 * 🏢 ENTERPRISE: Panel row layout configuration
 *
 * Defines how panels are arranged in the tab rows.
 */
export const PANEL_LAYOUT = {
  /** Top row panels */
  topRow: ['levels', 'hierarchy'] as const satisfies readonly FloatingPanelType[],
  /** Bottom row panels */
  bottomRow: ['overlay', 'colors'] as const satisfies readonly FloatingPanelType[],
} as const;

/**
 * 🏢 ENTERPRISE: Default active panel on load
 */
export const DEFAULT_PANEL: FloatingPanelType = 'levels';
