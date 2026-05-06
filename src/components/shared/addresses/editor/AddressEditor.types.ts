/**
 * AddressEditor public API types (ADR-332 Phase 5, Layer 6)
 *
 * Re-exports all editor types needed by consumers so they import from one barrel.
 * The full `AddressEditorProps` interface is defined here and consumed by
 * `AddressEditor.tsx`.
 *
 * @module components/shared/addresses/editor/AddressEditor.types
 * @see ADR-332 §3.3 Coordinator API
 */

import type { ReactNode } from 'react';
import type { ResolvedAddressFields as _ResolvedAddressFields } from './types';

/** Imperative handle exposed via `ref` on `<AddressEditor>`. */
export interface AddressEditorHandle {
  /** Queue an externally-resolved drag address for the confirm dialog. */
  setPendingDrag(addr: _ResolvedAddressFields): void;
}

export type {
  AddressEditorMode,
  AddressEditorDomain,
  AddressEditorFormOptions,
  AddressEditorMapOptions,
  AddressEditorActivityOptions,
  AddressEditorTelemetryOptions,
  ResolvedAddressFields,
  AddressEditorState,
  AddressFieldStatus,
  AddressSourceType,
  AddressFreshness,
  GeocodingApiResponse,
  GeocodingActivityEvent,
  ActivityVerbosity,
  SuggestionTrigger,
  SuggestionRanking,
  AddressFieldConflict,
  UndoEntry,
  UndoOpKind,
} from './types';

export interface AddressEditorProps {
  /** Current address value (semi-controlled — changes reset internal state when parent passes a new object reference). */
  value: ResolvedAddressFields;
  /** Called on every user field change. Keep parent state in sync. */
  onChange: (addr: ResolvedAddressFields) => void;
  /**
   * Called specifically when a map drag is confirmed (in addition to `onChange`).
   * Use this to clear Greek hierarchy fields in the parent — drag data has no hierarchy.
   */
  onDragApplied?: (addr: ResolvedAddressFields) => void;
  /**
   * Called after every undo or redo action. Use to reset external state that
   * depends on the current address value (e.g. clear map drag-pin position).
   */
  onUndoRedo?: () => void;
  /** 'edit' shows form + geocoding; 'view' is read-only enriched display. Default: 'edit'. */
  mode?: AddressEditorMode;
  /** Domain context — influences field visibility defaults. Default: 'contact'. */
  domain?: AddressEditorDomain;
  /** Form field visibility options. */
  formOptions?: AddressEditorFormOptions;
  /** Map display options (reserved for Phase 6 map integration). */
  mapOptions?: AddressEditorMapOptions;
  /** Activity log configuration. */
  activityLog?: AddressEditorActivityOptions;
  /** Telemetry options (reserved for Phase 9). */
  telemetry?: AddressEditorTelemetryOptions;
  className?: string;
  /** Optional children rendered inside the editor context — can use `useAddressEditorContext()`. */
  children?: ReactNode;
}
