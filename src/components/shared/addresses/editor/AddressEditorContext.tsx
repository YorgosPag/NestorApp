'use client';

/**
 * AddressEditorContext — sub-component access without prop drilling (ADR-332 Phase 5, Layer 6)
 *
 * Provides the full coordinator state to any descendant component.
 * The context value is memoised inside <AddressEditor> so re-renders
 * only propagate when one of the constituent hook outputs changes.
 *
 * @module components/shared/addresses/editor/AddressEditorContext
 * @see ADR-332 §4 Phase 5
 */

import { createContext, useContext } from 'react';
import type { UseAddressEditorResult } from './hooks/useAddressEditor';
import type { UseAddressSuggestionsResult } from './hooks/useAddressSuggestions';
import type { UseAddressReconciliationResult } from './hooks/useAddressReconciliation';
import type { UseAddressUndoResult } from './hooks/useAddressUndo';
import type { AddressFieldStatusMap } from './hooks/useAddressFieldStatus';
import type { AddressEditorMode, ResolvedAddressFields } from './types';

export interface AddressEditorContextValue {
  editorState: UseAddressEditorResult['state'];
  fieldStatus: AddressFieldStatusMap;
  activity: UseAddressEditorResult['activity'];
  suggestions: UseAddressSuggestionsResult;
  reconciliation: UseAddressReconciliationResult;
  undo: UseAddressUndoResult;
  userInput: ResolvedAddressFields;
  mode: AddressEditorMode;
}

const AddressEditorContext = createContext<AddressEditorContextValue | null>(null);

export function useAddressEditorContext(): AddressEditorContextValue {
  const ctx = useContext(AddressEditorContext);
  if (!ctx) throw new Error('useAddressEditorContext must be used inside <AddressEditor>');
  return ctx;
}

export { AddressEditorContext };
