/**
 * =============================================================================
 * 🏢 ADDRESS COMPONENTS - CENTRALIZED EXPORTS
 * =============================================================================
 *
 * Single source of truth for address-related UI components
 */

export { AddressCard } from './AddressCard';
export { SharedAddressActionCard } from './SharedAddressActionCard';
export type { SharedAddressActionCardProps } from './SharedAddressActionCard';
export { AddressListCard } from './AddressListCard';
export { AddressFormSection } from './AddressFormSection';
export { AddressWithHierarchy } from './AddressWithHierarchy';
export type { AddressWithHierarchyValue } from './AddressWithHierarchy';

// ADR-332 Enterprise Address Editor System — Phase 0 type barrel.
// Phase 1+ consumers (state machine, hooks, components) import from here.
export type {
  AddressEditorState,
  AddressEditorPhase,
  AddressEditorEvent,
  AddressEditorMode,
  AddressEditorDomain,
  AddressEditorFormOptions,
  AddressEditorMapOptions,
  AddressEditorActivityOptions,
  AddressEditorTelemetryOptions,
  AddressFieldStatus,
  AddressFieldConflict,
  AddressSourceType,
  AddressFreshness,
  AddressFreshnessLevel,
  ActivityCategory,
  ActivityLevel,
  ActivityVerbosity,
  GeocodingActivityEvent,
  SuggestionRanking,
  SuggestionTrigger,
  UndoEntry,
  UndoOpKind,
} from './editor/types';
