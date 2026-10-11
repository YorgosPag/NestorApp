/**
 * 🏢 UNIFIED ENTITY HEADER SYSTEM - EXPORTS
 *
 * Κεντρικό σημείο εισαγωγής για όλα τα entity header components
 * Single Source of Truth για Entity Profile Cards
 */

// Main Components
export {
  EntityDetailsHeader,
  EntityHeader,
  UnifiedEntityHeader
} from './UnifiedEntityHeaderSystem';

// Types & Interfaces
export type {
  EntityHeaderBadge,
  EntityHeaderAction,
  EntityHeaderProps
} from './UnifiedEntityHeaderSystem';

// Action Presets Factory
export {
  ENTITY_ACTION_PRESETS,
  ENTITY_ACTION_PRIORITY,
  createEntityAction,
  inDeclaredOrder,
  orderEntityActions,
} from './entity-action-presets';
export type { ActionType, EntityActionPreset } from './entity-action-presets';

// Default export
export { default } from './UnifiedEntityHeaderSystem';