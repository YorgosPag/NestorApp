/**
 * ADR-344 Phase 8 — Custom dictionary UI barrel.
 *
 * Public exports for the spell-check custom dictionary Manager. The
 * companion `SpellCheckToggle` and `SpellCheckContextMenu` live under
 * `ui/text-toolbar/` because they belong to the toolbar surface.
 */

export { CustomDictionaryManager } from './CustomDictionaryManager';
export { CustomDictionaryList } from './CustomDictionaryList';
export { CustomDictionaryEditorDialog } from './CustomDictionaryEditorDialog';
export { CustomDictionaryDeleteDialog } from './CustomDictionaryDeleteDialog';
export {
  useCustomDictionary,
  useCustomDictionaryMutations,
} from './hooks/useCustomDictionary';
export type {
  CreateDictionaryEntryInput,
  UpdateDictionaryEntryPatch,
} from './hooks/useCustomDictionary';
