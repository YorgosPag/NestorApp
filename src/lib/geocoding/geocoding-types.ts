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

import type { GeoBoundingBox } from '@/types/geo/coordinates';

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
  /**
   * House number, kept separate from `street` because the editor collects it in
   * its own input. Without it no query can ever reach `accuracy: 'exact'` — the
   * best attainable answer is the street centreline.
   */
  number?: string;
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
  /**
   * True when the user declared a country but the winning candidate lies outside
   * it. The late fallback variants deliberately drop the country restriction to
   * salvage typo'd input, which can surface a same-named street on another
   * continent; flagging it (and zeroing `confidence`) keeps that rescue from
   * masquerading as a verified answer.
   *
   * @see ADR-332 D12 — country integrity
   */
  outOfDeclaredCountry?: boolean;
  /**
   * **Η ΕΚΤΑΣΗ ΤΟΥ ΑΠΟΤΕΛΕΣΜΑΤΟΣ** — όχι το σημείο του, η *έκτασή* του.
   *
   * 🔴 **Ο Nominatim τη ΓΥΡΝΑΕΙ ΠΑΝΤΑ (`boundingbox`) και εμείς την ΠΕΤΑΓΑΜΕ** —
   * μετρημένο 2026-09-02. Το κόστος δεν ήταν θεωρητικό: κάθε επιφάνεια που ήθελε να
   * δείξει το αποτέλεσμα αναγκαζόταν να **μαντέψει** ζουμ από τον βαθμό ακρίβειας,
   * δηλαδή να απαντήσει με σταθερά μια ερώτηση που **ο ίδιος ο πάροχος είχε ήδη
   * απαντήσει με μέτρηση**, ανά αποτέλεσμα.
   *
   * 🔑 **Είναι το `viewport` της Google, με άλλο όνομα** — και το καθιερωμένο πρότυπο
   * είναι `fitBounds` σε αυτό, ποτέ `switch` πάνω στον βαθμό ακρίβειας: *«the geocoder
   * returns a suggested viewport … instead of coding a switch based on the
   * geometry.location_type response»*. Ένας δρόμος 80 μέτρων και ένας δρόμος 3
   * χιλιομέτρων έχουν **τον ίδιο** βαθμό (`interpolated`) και **εντελώς διαφορετική**
   * σωστή προβολή.
   *
   * ⚠️ **Προαιρετικό επίτηδες**: ο Nominatim *συνήθως* τη δίνει, όχι *πάντα* — και μια
   * υποχρεωτική δήλωση θα ανάγκαζε κάθε καλούντα να επινοήσει ψεύτικη έκταση για τις
   * περιπτώσεις που λείπει. Η απουσία είναι **δεδομένο**: σημαίνει «πέσε πίσω στον
   * βαθμό ακρίβειας», και το {@link lib/geo/geocoding-focus} το κάνει σε ένα σημείο.
   */
  extent?: GeoBoundingBox;
}

/**
 * Same shape as `GeocodingApiResponse` minus `alternatives` — used to keep
 * payload depth bounded at 1 level.
 */
export type GeocodingAlternative = Omit<GeocodingApiResponse, 'alternatives'>;

// =============================================================================
// SERVICE OUTCOME — "not found" is not an error (ADR-332 D11)
// =============================================================================

/**
 * Why a geocoding call failed. Deliberately excludes "no results": an address
 * the provider does not know is a *legitimate answer*, not a malfunction, and
 * conflating the two is what made a working geocoder look dead.
 */
export type GeocodingFailureReason = 'timeout' | 'rate-limit' | 'network' | 'server';

/**
 * Discriminated outcome of a geocoding call. Replaces the `T | null` contract,
 * which collapsed "address does not exist" and "the request blew up" into the
 * same value and left every caller unable to tell them apart.
 */
export type GeocodingOutcome =
  | { kind: 'found'; result: GeocodingApiResponse }
  | { kind: 'not-found' }
  | { kind: 'error'; reason: GeocodingFailureReason };

/**
 * Πόσο ακριβής είναι μια γεωκωδικοποιημένη θέση — από την πιο ισχυρή στην πιο ασθενή.
 *
 * ⚠️ **Πίνακας πρώτα, τύπος παραγόμενος** (ADR-777 Α14, 2026-08-11): μέχρι τότε
 * υπήρχε **μόνο** ο τύπος, δηλαδή καμία τιμή δεν ήταν διαθέσιμη σε **χρόνο
 * εκτέλεσης** — και κάθε καταναλωτής που χρειάζεται τις τιμές (επικύρωση φόρμας,
 * `z.enum`, επιλογέας) όφειλε να τις **ξαναγράψει με το χέρι**. Δύο χειρόγραφες
 * λίστες για ένα λεξιλόγιο είναι το σχήμα που το CHECK 3.34 μέτρησε να έχει
 * αποκλίνει **κατά 63**. Η παραγωγή του τύπου από τον πίνακα είναι το **ίδιο ιδίωμα**
 * με τα `PROPERTY_TYPES` · `OFFER_KINDS` · `COMMERCIAL_STATUSES`, και είναι
 * σημασιολογικά **ταυτόσημη** με την προηγούμενη ένωση.
 */
export const GEOCODING_ACCURACIES = [
  'exact',
  'interpolated',
  'approximate',
  'center',
] as const;

export type GeocodingAccuracy = (typeof GEOCODING_ACCURACIES)[number];

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
// SOURCE TYPE — provenance label for stored addresses (ADR-332 §3.10 / Phase 8)
// =============================================================================

/**
 * Provenance category for a *stored* address record. Drives the
 * `<AddressSourceLabel>` chip in read-only views and source attribution in
 * telemetry.
 *
 * Distinct from `GeocodingSource` (which describes a single geocoding hit's
 * origin — Nominatim/cache/manual). `AddressSourceType` is broader and
 * captures the lifecycle of how a persisted address arrived in the database.
 */
export type AddressSourceType =
  | 'geocoded'   // Resolved automatically via Nominatim
  | 'dragged'    // Pin moved manually on the map
  | 'manual'     // Typed without geocoding
  | 'derived'    // Inherited from a parent record (ADR-318)
  | 'imported'   // External import (CSV, API, etc.)
  /**
   * ADR-745 §6.4 — εγκρίθηκε από **πινακίδα τοπογραφικού DXF**, ανά κελί.
   *
   * Χωριστό από το `'imported'` επίτηδες: το G2 του ADR («καμία καταγραφή προέλευσης σε επίπεδο
   * κελιού») δεν κλείνει με μια γενική ετικέτα εισαγωγής. Μια διεύθυνση από πινακίδα έχει
   * **ανθρώπινη έγκριση**, ένα `TitleBlockBinding` που δείχνει σε ποιο κελί ποιου αρχείου, και
   * `snapshotValue` για ανίχνευση απόκλισης — τίποτε από αυτά δεν ισχύει για εισαγωγή CSV.
   */
  | 'titleblock'
  | 'unknown';   // Pre-ADR-332 records without provenance metadata

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
