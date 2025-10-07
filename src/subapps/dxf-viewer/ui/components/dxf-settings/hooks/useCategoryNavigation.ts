// useCategoryNavigation.ts - Re-export του useTabNavigation για Specific categories
// STATUS: ACTIVE - Phase 1 Step 1.4
// PURPOSE: Semantic alias για category navigation (ΔΕΝ δημιουργεί διπλότυπο!)

/**
 * useCategoryNavigation - Re-export του useTabNavigation για Specific categories
 *
 * ΣΗΜΑΝΤΙΚΟ:
 * - Αυτό το file είναι SEMANTIC ALIAS - ΔΕΝ είναι διπλότυπος κώδικας
 * - Επαναχρησιμοποιεί το useTabNavigation (Κανόνας #3 του ΔΕΚΑΛΟΓΟΥ)
 * - Η λογική navigation για tabs και categories είναι η ίδια
 *
 * Why re-export instead of duplicate:
 * - DRY principle (Don't Repeat Yourself)
 * - Single source of truth για navigation logic
 * - Easier maintenance (αλλαγές στο useTabNavigation επηρεάζουν και τα categories)
 *
 * @see hooks/useTabNavigation.ts - Original implementation
 * @see docs/dxf-settings/STATE_MANAGEMENT.md - Navigation State
 */

export {
  // Main hook (generic)
  useTabNavigation,

  // Pre-typed hook για Specific categories (αυτό χρησιμοποιούμε!)
  useSpecificCategoryNavigation as useCategoryNavigation,

  // Types
  type SpecificCategoryType as CategoryType,
  type UseTabNavigationOptions as UseCategoryNavigationOptions,
  type UseTabNavigationReturn as UseCategoryNavigationReturn,
} from './useTabNavigation';

/**
 * USAGE EXAMPLE:
 *
 * ```tsx
 * // In SpecificSettingsPanel.tsx
 * import { useCategoryNavigation } from '../hooks/useCategoryNavigation';
 *
 * function SpecificSettingsPanel() {
 *   const { activeTab, setActiveTab, isActive } = useCategoryNavigation('selection');
 *
 *   return (
 *     <div>
 *       <button onClick={() => setActiveTab('selection')}>Επιλογή</button>
 *       <button onClick={() => setActiveTab('cursor')}>Κέρσορας</button>
 *       ...
 *       {activeTab === 'selection' && <SelectionCategory />}
 *       {activeTab === 'cursor' && <CursorCategory />}
 *       ...
 *     </div>
 *   );
 * }
 * ```
 */
