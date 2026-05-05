/**
 * =============================================================================
 * ADDRESS EDITOR — Layer 3-5 Types (ADR-332 Phase 0)
 * =============================================================================
 *
 * SSoT for state machine, hooks, and presentational components of the
 * Enterprise Address Editor system.
 *
 * Re-exports `ResolvedAddressFields`, `GeocodingApiResponse`, etc. from
 * `@/lib/geocoding/geocoding-types` so consumers of the editor only need
 * to import from this single barrel.
 *
 * @module components/shared/addresses/editor/types
 * @see ADR-332 §3.2 Type contracts
 */

import type {
  GeocodingApiResponse,
  ResolvedAddressFields,
  GeocodingReasoning,
} from '@/lib/geocoding/geocoding-types';

// Re-export geocoding-layer types so editor consumers import from one place.
export type {
  GeocodingApiResponse,
  GeocodingAlternative,
  GeocodingAttempt,
  GeocodingAttemptStatus,
  GeocodingAccuracy,
  GeocodingProvider,
  GeocodingReasoning,
  GeocodingRequestBody,
  GeocodingServiceResult,
  GeocodingSource,
  GeocodingVariant,
  ReverseGeocodingResult,
  ResolvedAddressFields,
  FieldMatchKind,
  FieldMatchMap,
  ConfidenceBreakdown,
} from '@/lib/geocoding/geocoding-types';

// =============================================================================
// FIELD-LEVEL STATUS (Layer 5 — AddressFieldBadge)
// =============================================================================

/**
 * Per-field reconciliation status used by `<AddressFieldBadge>` next to each
 * address input. Discriminated union ensures the badge component can render
 * the right tooltip/icon without ambiguity.
 */
export type AddressFieldStatus =
  | { kind: 'match'; userValue: string; resolvedValue: string }
  | { kind: 'mismatch'; userValue: string; resolvedValue: string }
  | { kind: 'unknown'; userValue: string }
  | { kind: 'not-provided'; resolvedValue?: string }
  | { kind: 'pending' };

/** Conflict descriptor used by `<AddressReconciliationPanel>`. */
export interface AddressFieldConflict {
  field: keyof ResolvedAddressFields;
  userValue: string;
  resolvedValue: string;
}

// =============================================================================
// SOURCE & FRESHNESS (Layer 5 — AddressSourceLabel, AddressFreshnessIndicator)
// =============================================================================

export type AddressSourceType =
  | 'geocoded'
  | 'dragged'
  | 'manual'
  | 'derived'
  | 'imported'
  | 'unknown';

export type AddressFreshnessLevel =
  | 'never'
  | 'fresh'
  | 'recent'
  | 'aging'
  | 'stale';

export interface AddressFreshness {
  /** Unix ms timestamp of last successful geocoding/reverse-geocoding for this address; null = never verified. */
  verifiedAt: number | null;
  level: AddressFreshnessLevel;
  staleReason?: 'field-changed' | 'time-elapsed' | 'force-refresh-pending';
}

// =============================================================================
// ACTIVITY LOG (Layer 4 — useAddressActivity, Layer 5 — AddressActivityLog)
// =============================================================================

export type ActivityLevel = 'info' | 'success' | 'warn' | 'error';

export type ActivityCategory =
  | 'input'
  | 'request'
  | 'response'
  | 'conflict'
  | 'suggestion'
  | 'apply'
  | 'drag'
  | 'undo';

export interface GeocodingActivityEvent {
  /** ULID identifier — chronologically sortable. */
  id: string;
  /** Unix ms wall-clock timestamp. */
  timestamp: number;
  level: ActivityLevel;
  category: ActivityCategory;
  /** i18n key (e.g. `addresses.activity.requestStarted`). Never raw string. */
  i18nKey: string;
  i18nParams?: Record<string, string | number>;
}

export type ActivityVerbosity = 'basic' | 'detailed' | 'debug';

// =============================================================================
// SUGGESTIONS (Layer 4 — useAddressSuggestions, Layer 5 — AddressSuggestionsPanel)
// =============================================================================

export type SuggestionTrigger =
  | 'no-results-after-retry'
  | 'low-confidence'
  | 'multiple-candidates-similar'
  | 'partial-match-flag';

export interface SuggestionRanking {
  /** The candidate result. */
  candidate: GeocodingApiResponse;
  /** Original Nominatim rank (0 = top). */
  originalRank: number;
  /** Distance from current map center (meters) — null if no map context. */
  distanceFromCenterM: number | null;
  /** Combined ranking score (confidence + proximity weights). */
  rankScore: number;
}

// =============================================================================
// STATE MACHINE (Layer 3 — addressEditorMachine)
// =============================================================================

/**
 * Discriminated union of all possible editor phases.
 * Used by `addressEditorMachine` (Phase 1 deliverable).
 */
export type AddressEditorState =
  | { phase: 'idle' }
  | { phase: 'typing'; lastEditMs: number }
  | { phase: 'debouncing'; etaMs: number }
  | {
      phase: 'loading';
      attempt: number;
      totalAttempts: number;
      /** i18n key describing the current variant (e.g. `addresses.geocoding.attempts.osmStyle`). */
      variantI18nKey: string;
    }
  | {
      phase: 'success';
      result: GeocodingApiResponse;
      freshness: AddressFreshness;
    }
  | {
      phase: 'partial';
      result: GeocodingApiResponse;
      conflicts: AddressFieldConflict[];
      resolved: number;
      total: number;
    }
  | {
      phase: 'conflict';
      result: GeocodingApiResponse;
      conflicts: AddressFieldConflict[];
    }
  | {
      phase: 'suggestions';
      candidates: GeocodingApiResponse[];
      reason: SuggestionTrigger;
    }
  | {
      phase: 'stale';
      lastResult: GeocodingApiResponse;
      reason: 'field-changed';
    }
  | {
      phase: 'error';
      reason: 'no-results' | 'timeout' | 'rate-limit' | 'network';
      canRetry: boolean;
    };

export type AddressEditorPhase = AddressEditorState['phase'];

// =============================================================================
// EDITOR EVENTS (state machine inputs — Layer 3)
// =============================================================================

/**
 * Events that drive transitions in `addressEditorMachine`. Each event triggers
 * a transition function that returns the next `AddressEditorState`.
 */
export type AddressEditorErrorReason = Extract<AddressEditorState, { phase: 'error' }>['reason'];

export type AddressEditorEvent =
  | { type: 'FIELD_EDITED'; field: keyof ResolvedAddressFields; value: string; nowMs: number }
  | { type: 'DEBOUNCE_TICK'; nowMs: number }
  | { type: 'GEOCODE_STARTED'; attempt: number; totalAttempts: number; variantI18nKey: string }
  | { type: 'GEOCODE_SUCCESS'; result: GeocodingApiResponse; nowMs: number }
  | { type: 'GEOCODE_FAILED'; reason: AddressEditorErrorReason }
  | { type: 'CONFLICT_DETECTED'; conflicts: AddressFieldConflict[] }
  | { type: 'SUGGESTIONS_TRIGGERED'; candidates: GeocodingApiResponse[]; reason: SuggestionTrigger }
  | { type: 'STALE_FLAGGED' }
  | { type: 'CORRECTION_APPLIED'; nowMs: number }
  | { type: 'RESET' };

// =============================================================================
// UNDO/REDO (Layer 4 — useAddressUndo)
// =============================================================================

export type UndoOpKind =
  | 'field-correction'
  | 'bulk-correction'
  | 'suggestion-accepted'
  | 'drag-applied'
  | 'form-cleared';

export interface UndoEntry {
  id: string;          // ULID
  timestamp: number;   // unix ms
  kind: UndoOpKind;
  /** Snapshot to restore on undo. */
  before: ResolvedAddressFields;
  /** Snapshot resulting from the operation. */
  after: ResolvedAddressFields;
  /** i18n description for UI label. */
  i18nKey: string;
  i18nParams?: Record<string, string | number>;
}

// =============================================================================
// COORDINATOR PUBLIC API (Layer 6 — AddressEditor — defined here for Phase 5)
// =============================================================================

export type AddressEditorMode = 'edit' | 'view';

export type AddressEditorDomain =
  | 'contact'
  | 'project'
  | 'building'
  | 'procurement'
  | 'showcase'
  | 'frontage';

export interface AddressEditorFormOptions {
  showHierarchy?: boolean;
  showAddressType?: boolean;
  showBlockSide?: boolean;
  showCustomLabel?: boolean;
}

export interface AddressEditorMapOptions {
  height?: 'small' | 'medium' | 'large' | 'full';
  showLocateMe?: boolean;
  initialZoom?: number;
}

export interface AddressEditorActivityOptions {
  enabled?: boolean;
  verbosity?: ActivityVerbosity;
  collapsed?: boolean;
}

export interface AddressEditorTelemetryOptions {
  enabled?: boolean;
  contextEntityType?: string;
  contextEntityId?: string;
}

// =============================================================================
// REASONING re-export (convenience)
// =============================================================================

export type { GeocodingReasoning as AddressGeocodingReasoning };
