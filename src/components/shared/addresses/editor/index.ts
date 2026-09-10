/**
 * Public barrel for the Enterprise Address Editor (ADR-332 Layer 6)
 *
 * Import path for consumers:
 *   import { AddressEditor } from '@/components/shared/addresses/editor'
 *
 * @module components/shared/addresses/editor
 * @see ADR-332 §4 Phase 5
 */

export { AddressEditor } from './AddressEditor';
export { AddressEditorContext, useAddressEditorContext } from './AddressEditorContext';
export type {
  AddressEditorProps,
  AddressEditorHandle,
  AddressEditorPlacementOptions,
  EditorPinDrop,
} from './AddressEditor.types';
export type { AddressEditorContextValue } from './AddressEditorContext';
export { AddressFieldBadge } from './components/AddressFieldBadge';
export { AddressSourceLabel } from './components/AddressSourceLabel';
export { AddressFreshnessIndicator } from './components/AddressFreshnessIndicator';
export { AddressCoordsBadge } from './components/AddressCoordsBadge';
export { AddressDragConfirmDialog } from './components/AddressDragConfirmDialog';
export type { AddressDragConfirmDialogProps } from './components/AddressDragConfirmDialog';
export { computeFreshness } from './helpers/computeFreshness';
export type { AddressSourceType, AddressFreshness, AddressFreshnessLevel, ResolvedAddressFields } from './types';
/**
 * ADR-332 **D26** — ο δεσμός καταλόγου⇄χάρτη ταξιδεύει μέσα σε αυτή την ομάδα, οπότε
 * κάθε καλών που στήνει τον δεσμό χρειάζεται τον **τύπο** της (`LocationInlineForm`).
 * Το `SuggestionRanking` βγαίνει μαζί: είναι ό,τι παραδίδει το `onCandidatesChange`.
 */
export type { AddressEditorSuggestionOptions, SuggestionRanking, SuggestionMapReport } from './types';
