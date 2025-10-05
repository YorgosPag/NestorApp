/**
 * ✨ SELECTION SYSTEM
 * Centralized selection management system for entities and regions
 *
 * ⚠️  ΠΡΙΝ ΔΗΜΙΟΥΡΓΗΣΕΙΣ ΝΕΟ SELECTION LOGIC:
 * 📖 Architecture Guide: src/subapps/dxf-viewer/centralized_systems.md
 * 🔍 Section: "Selection Systems" - Χρησιμοποίησε τα υπάρχοντα hooks και utilities
 *
 * 🏢 ENTERPRISE PATTERN: Centralized selection state με React hooks
 *
 * @example
 * // ✅ ΣΩΣΤΑ - Χρήση centralized hooks
 * const { selectedEntities, selectEntity } = useSelection();
 *
 * // ❌ ΛΑΘΟΣ - Custom selection state
 * const [selected, setSelected] = useState([]); // Bypass centralized system
 */

// Configuration and types
export * from './config';

// Utilities
export * from './utils';

// Hooks (can be imported safely) - now exported from SelectionSystem
export { useSelection, useSelectionContext } from './SelectionSystem';

// Components need to be imported from .tsx files directly
// For components, import directly: import { SelectionSystem } from './systems/selection/SelectionSystem';

// Re-export main system component for convenience
export { SelectionSystem } from './SelectionSystem';