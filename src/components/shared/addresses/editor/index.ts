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
export type { AddressEditorProps } from './AddressEditor.types';
export type { AddressEditorContextValue } from './AddressEditorContext';
