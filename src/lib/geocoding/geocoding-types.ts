/**
 * =============================================================================
 * GEOCODING — Shared Types (ADR-332 Phase 0)
 * =============================================================================
 *
 * SSoT for all geocoding types across:
 *   - Server-side `geocoding-engine.ts` (Nominatim layer)
 *   - Client-side `geocoding-service.ts` (cache + fetch wrapper)
 *   - Address Editor system Layer 3-6 (state machine, hooks, components)
 *
 * Backward compatibility: `GeocodingApiResponse` retains all pre-existing core
 * fields (lat, lng, accuracy, confidence, displayName, resolvedCity) so that
 * legacy `AddressMap` consumers continue to work unchanged. New transparency
 * fields (resolvedFields, alternatives, partialMatch, reasoning, source) are
 * additive — old code reads only what it needs.
 *
 * @module lib/geocoding/geocoding-types
 * @see ADR-332 §3.2 Type contracts
 */

// =============================================================================
// REQUEST
// =============================================================================

/**
 * Structured geocoding query — used by `formatAddressForGeocoding()` helper
 * and the `/api/geocoding` endpoint. Mirrors the ELSTAT hierarchy plus
 * Nominatim-friendly fields.
 */
export interface GeocodingRequestBody {
  street?: string;
  city?: string;
  /** Neighborhood/area — more specific than city (e.g. "Εύοσμος" within "Θεσσαλονίκη") */
  neighborhood?: string;
  postalCode?: string;
  /** Regional Unit / Π.Ε. — maps to Nominatim `county` (e.g. "Π.Ε. Θεσσαλονίκης") */
  county?: string;
  /** Municipality / Δήμος (e.g. "Δήμος Καλαμαριάς") — used for free-form fallback */
  municipality?: string;
  region?: string;
  country?: string;
}

/**
 * Alias used by the client-side service. Identical shape to
 * `GeocodingRequestBody`. Kept as a separate name for legacy import sites that
 * already reference `StructuredGeocodingQuery`.
 */
export type StructuredGeocodingQuery = GeocodingRequestBody;

// =============================================================================
// CORE RESPONSE (legacy-compatible + new transparency fields)
// =============================================================================

/**
 * Top-level geocoding result returned by `/api/geocoding` and the client service.
 *
 * **Backward compatible** core fields (lat, lng, accuracy, confidence,
 * displayName, resolvedCity) are unchanged from the pre-ADR-332 shape.
 * **Additive** fields below the core power the Enterprise Address Editor.
 */
export interface GeocodingApiResponse {
  // ─── Legacy core (unchanged) ────────────────────────────────────────────
  lat: number;
  lng: number;
  accuracy: GeocodingAccuracy;
  confidence: number;
  displayName: string;
  /** City/town/village resolved by Nominatim — for auto-fill (legacy field) */
  resolvedCity?: string;

  // ─── ADR-332 — new transparency fields (additive) ───────────────────────
  /** All address components Nominatim resolved, normalized to ELSTAT-friendly keys. */
  resolvedFields: ResolvedAddressFields;
  /** True when Nominatim flagged at least one user-provided field as unmatched. */
  partialMatch: boolean;
  /** Per-field match status + variant attempts log + confidence breakdown. */
  reasoning: GeocodingReasoning;
  /**
   * Up to 4 alternative candidates ranked below the top result.
   * Each alternative is a flat `GeocodingApiResponse` without its own nested
   * `alternatives` (depth-1 to keep payload bounded).
   */
  alternatives: GeocodingAlternative[];
  /** Provenance metadata. */
  source: GeocodingSource;
}

/**
 * Same shape as `GeocodingApiResponse` minus `alternatives` — used to keep
 * payload depth bounded at 1 level.
 */
export type GeocodingAlternative = Omit<GeocodingApiResponse, 'alternatives'>;

export type GeocodingAccuracy = 'exact' | 'interpolated' | 'approximate' | 'center';

// =============================================================================
// RESOLVED FIELDS — Nominatim address normalized to ELSTAT keys
// =============================================================================

/**
 * Address components that Nominatim resolved, normalized to the same keys
 * the application uses elsewhere (ELSTAT hierarchy + standard mailing fields).
 *
 * All fields optional — Nominatim may not return every component for every
 * address (e.g. a settlement without a postal code).
 */
export interface ResolvedAddressFields {
  street?: string;
  number?: string;
  postalCode?: string;
  neighborhood?: string;
  city?: string;
  county?: string;
  region?: string;
  country?: string;
}

// =============================================================================
// REASONING — per-field match + confidence breakdown + attempt log
// =============================================================================

/**
 * Detailed accounting of why this geocoding result has the confidence it has,
 * which field-level matches it contains, and which Nominatim variants were
 * attempted before this hit.
 *
 * Powers:
 *   - Field-level badges (Layer 5 `AddressFieldBadge`)
 *   - Confidence meter tooltip (Layer 5 `AddressConfidenceMeter`)
 *   - Activity log entries (Layer 5 `AddressActivityLog`)
 */
export interface GeocodingReasoning {
  /** Match status per user-provided / Nominatim-provided field. */
  fieldMatches: FieldMatchMap;
  /** Chronological log of variants attempted. */
  attemptsLog: GeocodingAttempt[];
  /** Breakdown of how the final `confidence` score was assembled. */
  confidenceBreakdown: ConfidenceBreakdown;
}

export type FieldMatchKind =
  /** User value matches Nominatim resolved value (case/accent-insensitive). */
  | 'match'
  /** User value differs from Nominatim resolved value. */
  | 'mismatch'
  /** User provided a value, Nominatim returned no value for that field. */
  | 'unknown'
  /** User left field empty — no comparison possible. */
  | 'not-provided';

export type FieldMatchMap = {
  [K in keyof ResolvedAddressFields]: FieldMatchKind;
};

export interface ConfidenceBreakdown {
  base: number;
  streetMatch: number;
  cityMatch: number;
  postalMatch: number;
  countyMatch: number;
  municipalityMatch: number;
}

// =============================================================================
// ATTEMPTS LOG — Nominatim variant tracking
// =============================================================================

/** Variant index in the engine's multi-strategy search (1..8). */
export type GeocodingVariant = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Outcome of a single variant attempt. */
export type GeocodingAttemptStatus = 'success' | 'no-results' | 'error' | 'skipped';

export interface GeocodingAttempt {
  variant: GeocodingVariant;
  /**
   * i18n key (e.g. `addresses.geocoding.attempts.osmStyle`) — NOT a raw string.
   * Resolved via `t()` at the UI layer (CLAUDE.md N.11).
   */
  i18nKey: string;
  /** Optional interpolation params for the i18n template. */
  i18nParams?: Record<string, string | number>;
  status: GeocodingAttemptStatus;
  /** Wall-clock duration spent on this variant (milliseconds). */
  durationMs: number;
}

// =============================================================================
// SOURCE — provenance of the geocoding hit
// =============================================================================

export type GeocodingProvider = 'nominatim' | 'cache' | 'manual';

export interface GeocodingSource {
  provider: GeocodingProvider;
  /** OSM type (e.g. 'building', 'house', 'street') — only when provider='nominatim'. */
  osmType?: string;
  /** OSM identifier (composite of class+type+id). */
  osmId?: string;
  /** Nominatim importance score (0-1). */
  importance?: number;
  /** Which engine variant produced this hit. */
  variantUsed?: GeocodingVariant;
}

// =============================================================================
// REVERSE GEOCODING (drag-end flow)
// =============================================================================

/**
 * Reverse geocoding result — structured address data resolved from coordinates.
 * Returned by `/api/geocoding/reverse`.
 *
 * Unchanged from the pre-ADR-332 shape (no new fields needed in Phase 0 — drag
 * flow currently uses these directly; richer reverse fields can be added in a
 * future iteration without breaking existing consumers).
 */
export interface ReverseGeocodingResult {
  street: string;
  number: string;
  city: string;
  neighborhood: string;
  postalCode: string;
  region: string;
  country: string;
  displayName: string;
  lat: number;
  lng: number;
}

// =============================================================================
// SERVICE-LAYER ALIAS (legacy-compatible export)
// =============================================================================

/**
 * Alias used by `geocoding-service.ts` legacy consumers. Identical shape to
 * `GeocodingApiResponse` — kept as a separate name so Phase 7+ migrations can
 * progressively replace `GeocodingServiceResult` imports with the canonical
 * `GeocodingApiResponse` once all sites are on the new editor.
 */
export type GeocodingServiceResult = GeocodingApiResponse;
