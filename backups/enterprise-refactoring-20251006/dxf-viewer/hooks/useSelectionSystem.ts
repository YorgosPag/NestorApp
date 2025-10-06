/**
 * USE SELECTION SYSTEM - LEGACY COMPATIBILITY
 * @deprecated This file provides backward compatibility for existing imports.
 * New code should use ../systems/selection/useSelection
 * This file will be removed in v2.0.0
 */

import { useSelection } from '../systems/selection/SelectionSystem';
import type { 
  SelectionState, 
  FilterState, 
  SelectionActions, 
  FilterActions, 
  ViewActions 
} from '../systems/selection/config';

// Re-export for backward compatibility
export type { SelectionState, FilterState, SelectionActions, FilterActions, ViewActions };

// Proxy function that redirects to the new system
export function useSelectionSystem(): SelectionState & SelectionActions & FilterState & FilterActions & ViewActions {
  return useSelection() as SelectionState & SelectionActions & FilterState & FilterActions & ViewActions;
}