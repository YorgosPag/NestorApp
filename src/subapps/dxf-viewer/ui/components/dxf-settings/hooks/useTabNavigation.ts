// useTabNavigation.ts - Custom hook για tab navigation state
// STATUS: ACTIVE - Phase 1 Step 1.4
// PURPOSE: Centralized tab state management για GeneralSettingsPanel

import { useState, useCallback } from 'react';

/**
 * useTabNavigation - Custom hook για tab navigation
 *
 * Purpose:
 * - Κεντρικοποιεί τη λογική navigation μεταξύ tabs
 * - Επαναχρησιμοποιήσιμο για General tabs (Lines/Text/Grips) και Specific categories
 *
 * Features:
 * - Type-safe tab selection
 * - Default tab support
 * - Callback για tab changes
 *
 * @see docs/dxf-settings/COMPONENT_GUIDE.md#useTabNavigation
 * @see docs/dxf-settings/STATE_MANAGEMENT.md - Local State (Navigation)
 *
 * @example
 * ```tsx
 * // In GeneralSettingsPanel.tsx
 * const { activeTab, setActiveTab } = useTabNavigation<'lines' | 'text' | 'grips'>('lines');
 *
 * return (
 *   <div>
 *     <button onClick={() => setActiveTab('lines')}>Lines</button>
 *     <button onClick={() => setActiveTab('text')}>Text</button>
 *     <button onClick={() => setActiveTab('grips')}>Grips</button>
 *     {activeTab === 'lines' && <LinesTab />}
 *     {activeTab === 'text' && <TextTab />}
 *     {activeTab === 'grips' && <GripsTab />}
 *   </div>
 * );
 * ```
 */

export interface UseTabNavigationOptions<T extends string> {
  /**
   * Callback που καλείται όταν αλλάζει το active tab
   */
  onTabChange?: (newTab: T) => void;

  /**
   * Callback που καλείται πριν αλλάξει το tab (για validation)
   * Επιστρέφει true αν το tab change επιτρέπεται, false αν όχι
   */
  beforeTabChange?: (currentTab: T, newTab: T) => boolean;
}

export interface UseTabNavigationReturn<T extends string> {
  /**
   * Current active tab
   */
  activeTab: T;

  /**
   * Function για αλλαγή tab
   */
  setActiveTab: (tab: T) => void;

  /**
   * Helper function - check αν tab είναι active
   */
  isActive: (tab: T) => boolean;
}

/**
 * useTabNavigation - Custom hook για tab navigation state
 *
 * @param defaultTab - Default tab που θα είναι active στην αρχή
 * @param options - Optional configuration (callbacks)
 * @returns {UseTabNavigationReturn} - Tab navigation state and helpers
 */
export function useTabNavigation<T extends string>(
  defaultTab: T,
  options?: UseTabNavigationOptions<T>
): UseTabNavigationReturn<T> {
  const [activeTab, setActiveTabState] = useState<T>(defaultTab);

  /**
   * setActiveTab - Αλλάζει το active tab με validation support
   */
  const setActiveTab = useCallback(
    (newTab: T) => {
      // Validation check (αν υπάρχει beforeTabChange callback)
      if (options?.beforeTabChange) {
        const canChange = options.beforeTabChange(activeTab, newTab);
        if (!canChange) {
          console.warn(
            `[useTabNavigation] Tab change blocked: ${activeTab} -> ${newTab}`
          );
          return;
        }
      }

      // Update state
      setActiveTabState(newTab);

      // Callback notification (αν υπάρχει onTabChange)
      if (options?.onTabChange) {
        options.onTabChange(newTab);
      }
    },
    [activeTab, options]
  );

  /**
   * isActive - Helper function για check αν tab είναι active
   */
  const isActive = useCallback(
    (tab: T) => {
      return activeTab === tab;
    },
    [activeTab]
  );

  return {
    activeTab,
    setActiveTab,
    isActive,
  };
}

// ============================================================================
// TYPE DEFINITIONS (για common tab types)
// ============================================================================

/**
 * GeneralTabType - Type για General settings tabs
 */
export type GeneralTabType = 'lines' | 'text' | 'grips';

/**
 * SpecificCategoryType - Type για Specific settings categories
 */
export type SpecificCategoryType =
  | 'selection' // Επιλογή
  | 'cursor' // Κέρσορας
  | 'layers' // Layers
  | 'entities' // Entities
  | 'background' // Φόντο
  | 'drawing' // Χάραξη
  | 'import'; // Εισαγωγή

/**
 * MainTabType - Type για main DxfSettingsPanel tabs
 */
export type MainTabType = 'general' | 'specific';

// ============================================================================
// CONVENIENCE EXPORTS (pre-typed hooks)
// ============================================================================

/**
 * useGeneralTabNavigation - Pre-typed hook για General tabs
 */
export function useGeneralTabNavigation(
  defaultTab: GeneralTabType = 'lines',
  options?: UseTabNavigationOptions<GeneralTabType>
) {
  return useTabNavigation<GeneralTabType>(defaultTab, options);
}

/**
 * useSpecificCategoryNavigation - Pre-typed hook για Specific categories
 */
export function useSpecificCategoryNavigation(
  defaultCategory: SpecificCategoryType = 'selection',
  options?: UseTabNavigationOptions<SpecificCategoryType>
) {
  return useTabNavigation<SpecificCategoryType>(defaultCategory, options);
}

/**
 * useMainTabNavigation - Pre-typed hook για main tabs
 */
export function useMainTabNavigation(
  defaultTab: MainTabType = 'specific',
  options?: UseTabNavigationOptions<MainTabType>
) {
  return useTabNavigation<MainTabType>(defaultTab, options);
}
