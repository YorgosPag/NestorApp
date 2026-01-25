/**
 * ✨ SELECTION SYSTEM - CENTRALIZED UNIVERSAL SELECTION
 * Centralized selection management for ALL entity types
 *
 * 🏢 ENTERPRISE (2026-01-25): Universal Selection System
 *
 * ⚠️  ΠΡΙΝ ΔΗΜΙΟΥΡΓΗΣΕΙΣ ΝΕΟ SELECTION LOGIC:
 * 📖 Architecture Guide: src/subapps/dxf-viewer/docs/CENTRALIZED_SYSTEMS.md
 * 🔍 Section: "Selection Systems" - Χρησιμοποίησε τα υπάρχοντα hooks και utilities
 *
 * 🏢 ENTERPRISE PATTERN: Centralized selection state με React hooks
 *
 * @example
 * // ✅ ΣΩΣΤΑ - Χρήση universal selection hook (NEW)
 * const selection = useUniversalSelection();
 * selection.select('entity-id', 'overlay');
 * selection.selectMultiple([{ id: 'a', type: 'overlay' }, { id: 'b', type: 'dxf-entity' }]);
 * if (selection.isSelected('entity-id')) { ... }
 *
 * // ✅ ΣΩΣΤΑ - Χρήση legacy hooks (backward compatible)
 * const { selectedRegionIds, selectRegions } = useSelection();
 *
 * // ❌ ΛΑΘΟΣ - Custom selection state
 * const [selected, setSelected] = useState([]); // Bypass centralized system
 *
 * @see ADR-030 in centralized_systems_TABLE.md
 */

// Types - NEW universal types
export * from './types';

// Configuration and types
export * from './config';

// Utilities
export * from './utils';

// Hooks (can be imported safely) - now exported from SelectionSystem
export {
  useSelection,
  useSelectionContext,
  useUniversalSelection,  // 🆕 NEW: Primary universal selection hook
  useOverlaySelection,    // 🆕 NEW: Backward compatible overlay selection hook
} from './SelectionSystem';

// Types re-export
export type { SelectionContextType, UniversalSelectionHook } from './SelectionSystem';

// Components need to be imported from .tsx files directly
// For components, import directly: import { SelectionSystem } from './systems/selection/SelectionSystem';

// Re-export main system component for convenience
export { SelectionSystem } from './SelectionSystem';