/**
 * USE SELECTION SYSTEM - LEGACY COMPATIBILITY
 * @deprecated This file provides backward compatibility for existing imports.
 * New code should use ../systems/selection/useSelection
 * This file will be removed in v2.0.0
 */

import { useSelection, type SelectionContextType } from '../systems/selection/SelectionSystem';
import type {
  SelectionState,
  FilterState,
  SelectionActions,
  FilterActions,
  ViewActions
} from '../systems/selection/config';

// Re-export for backward compatibility
export type { SelectionState, FilterState, SelectionActions, FilterActions, ViewActions };

// ✅ ENTERPRISE FIX: Type-safe adapter for SelectionContextType to legacy interface
export function useSelectionSystem(): SelectionState & SelectionActions & FilterState & FilterActions & ViewActions {
  const context = useSelection();

  // Convert array-based visibleStatuses to Set-based FilterState
  const adapter = {
    ...context,
    // ✅ ENTERPRISE FIX: Convert array to Set for FilterState compatibility
    visibleStatuses: new Set(context.visibleStatuses || []),
    visibleUnitTypes: new Set(context.visibleUnitTypes || [])
  };

  return adapter as unknown as SelectionState & SelectionActions & FilterState & FilterActions & ViewActions;
}