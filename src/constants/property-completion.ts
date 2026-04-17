/**
 * =============================================================================
 * SSoT: Property Completion Assessment (Google Profile-Strength Pattern)
 * =============================================================================
 *
 * **Single Source of Truth** για το "how complete is this property?" score.
 * Pure function — σε κάθε call συνθέτει ένα deterministic assessment από
 * `formData` + `mediaCounts` + `levels`, σεβόμενο per-type weights, media
 * thresholds, και operationalStatus gating.
 *
 * **Google pattern references**:
 *   - Google My Business completion score: weighted fields + photo threshold +
 *     "claimed/verified" state gating.
 *   - LinkedIn All-Star profile: fixed per-field weights, missing surfaces as
 *     coaching suggestions.
 *   - Spitogatos/Idealista listing quality: media-heavy, floorplan
 *     differentiator, per-type expectations.
 *
 * **operationalStatus gating** (Batch 27 consistent):
 *   - `draft` → `shouldHide = true`. Denominator παρέχει pesa non sufficiente
 *     per un display meaningful; meter nascosto stile Material Design
 *     progressive-disclosure.
 *   - `under-construction` → finishes/systems/energy exempt from denominator
 *     (identical to Batch 27 suppression logic for missing warnings).
 *     Photos weight halved — shell photos valgono meno di finished photos.
 *     Floorplan peso pieno — κάτοψη exists da permesso οικοδομικής άδειας.
 *   - `inspection`/`maintenance`/`ready` → full scoring.
 *
 * **Bucket colors**:
 *   - `< 40%` → red (κρίσιμα data gaps).
 *   - `40% – 70%` → amber (σχεδόν πλήρες, λίγα ακόμα).
 *   - `> 70%` → green (market-ready).
 *
 * **Layering**: Leaf module — depends on `property-types`, `operational-
 * statuses`, `field-completion-weights`, `media-completion-thresholds`.
 * No component/hook/service imports.
 *
 * @module constants/property-completion
 * @enterprise ADR-287 — Completion Meter (Batch 28)
 */

import type { PropertyTypeCanonical } from '@/constants/property-types';
import { isPreCompletionOperationalStatus } from '@/constants/operational-statuses';
import {
  FIELD_KEYS,
  getFieldWeightsForType,
  type FieldKey,
  type FieldWeightEntry,
} from '@/constants/field-completion-weights';
import {
  computePhotoScore,
  computeFloorplanScore,
} from '@/constants/media-completion-thresholds';

// =============================================================================
// 1. PUBLIC TYPES
// =============================================================================

/** Minimal shape of the form-data slice the assessment needs. */
export interface CompletionFormSlice {
  readonly type: string;
  readonly operationalStatus?: string;
  readonly areaGross?: number;
  readonly areaNet?: number;
  readonly bedrooms?: number;
  readonly bathrooms?: number;
  readonly orientations?: readonly string[];
  readonly condition?: string;
  readonly energyClass?: string;
  readonly heatingType?: string;
  readonly coolingType?: string;
  readonly windowFrames?: string;
  readonly glazing?: string;
  readonly flooring?: readonly string[];
  readonly interiorFeatures?: readonly string[];
  readonly securityFeatures?: readonly string[];
}

export interface CompletionMediaCounts {
  readonly photos: number;
  readonly floorplan: number;
}

export interface CompletionBreakdownEntry {
  readonly fieldKey: FieldKey;
  readonly weight: number;
  readonly earned: number;
  readonly status: 'complete' | 'partial' | 'missing' | 'exempt';
  readonly critical: boolean;
}

export type CompletionBucket = 'red' | 'amber' | 'green';

export interface CompletionAssessment {
  /** `true` for `draft` — caller should not render meter. */
  readonly shouldHide: boolean;
  /** Score `0..1` (pre-rounding). */
  readonly score: number;
  /** Rounded percentage `0..100`. */
  readonly percentage: number;
  /** Sum of active (non-exempt) weights, adjusted for pre-completion. */
  readonly weightTotal: number;
  /** Sum of earned credit across active fields. */
  readonly weightEarned: number;
  /** Per-field breakdown, stable order matching FIELD_KEYS. */
  readonly breakdown: readonly CompletionBreakdownEntry[];
  /** Critical fields currently missing, sorted by weight desc. */
  readonly missingCritical: readonly FieldKey[];
  /** All missing fields (critical + non-critical), sorted by weight desc. */
  readonly missing: readonly FieldKey[];
  /** Fields exempt from denominator for this (type, status) combination. */
  readonly exemptFields: readonly FieldKey[];
  /** UX bucket for color coding. */
  readonly bucketColor: CompletionBucket;
}

export interface AssessPropertyCompletionArgs {
  readonly formData: CompletionFormSlice;
  readonly mediaCounts: CompletionMediaCounts;
  /** Number of floor levels (ADR-236) — defaults to 1 if omitted. */
  readonly levelCount?: number;
}

// =============================================================================
// 2. PRE-COMPLETION EXEMPTIONS — fields deferred until post-completion state
// =============================================================================

/**
 * Fields that are exempt from the denominator when operational status is
 * pre-completion (`draft` / `under-construction`). Identical surface to
 * Batch 27 missing-warning suppression — finishes/systems/ΠΕΑ δεν έχουν
 * εγκατασταθεί ακόμα, δεν είναι legitimate data-quality gap.
 */
const PRE_COMPLETION_EXEMPT_FIELDS: ReadonlySet<FieldKey> = new Set<FieldKey>([
  'energyClass',
  'heatingType',
  'coolingType',
  'windowFrames',
  'glazing',
  'flooring',
  'interiorFeatures',
]);

/** Photo weight reduction factor during under-construction phase. */
const PRE_COMPLETION_PHOTO_FACTOR = 0.5;

// =============================================================================
// 3. BUCKET THRESHOLDS
// =============================================================================

const BUCKET_AMBER_MIN = 40;
const BUCKET_GREEN_MIN = 71; // > 70% = green (≥ 71 rounded)

function resolveBucket(percentage: number): CompletionBucket {
  if (percentage < BUCKET_AMBER_MIN) return 'red';
  if (percentage < BUCKET_GREEN_MIN) return 'amber';
  return 'green';
}

// =============================================================================
// 4. FIELD STATUS RESOLVERS — per-field "how complete?" detection
// =============================================================================

function isStringComplete(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveNumber(value: number | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isArrayComplete(value: readonly string[] | undefined): boolean {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Resolve the earned credit `[0..weight]` and status for a single field.
 * Delegates media scoring to `computePhotoScore` / `computeFloorplanScore`.
 */
function resolveFieldCredit(
  fieldKey: FieldKey,
  weight: number,
  formData: CompletionFormSlice,
  mediaCounts: CompletionMediaCounts,
  levelCount: number,
): { earned: number; status: CompletionBreakdownEntry['status'] } {
  switch (fieldKey) {
    case 'type':
      return binary(isStringComplete(formData.type), weight);

    case 'areaGross':
      return binary(isPositiveNumber(formData.areaGross), weight);
    case 'areaNet':
      return binary(isPositiveNumber(formData.areaNet), weight);
    case 'bedrooms':
      return binary(isPositiveNumber(formData.bedrooms), weight);
    case 'bathrooms':
      return binary(isPositiveNumber(formData.bathrooms), weight);

    case 'orientations':
      return binary(isArrayComplete(formData.orientations), weight);

    case 'condition':
      return binary(isStringComplete(formData.condition), weight);
    case 'energyClass':
      return binary(isStringComplete(formData.energyClass), weight);
    case 'heatingType':
      return binary(isStringComplete(formData.heatingType), weight);
    case 'coolingType':
      return binary(isStringComplete(formData.coolingType), weight);
    case 'windowFrames':
      return binary(isStringComplete(formData.windowFrames), weight);
    case 'glazing':
      return binary(isStringComplete(formData.glazing), weight);
    case 'flooring':
      return binary(isArrayComplete(formData.flooring), weight);
    case 'interiorFeatures':
      return binary(isArrayComplete(formData.interiorFeatures), weight);
    case 'securityFeatures':
      return binary(isArrayComplete(formData.securityFeatures), weight);

    case 'floorplan': {
      const score = computeFloorplanScore(mediaCounts.floorplan, levelCount);
      return {
        earned: score * weight,
        status: score >= 1 ? 'complete' : score > 0 ? 'partial' : 'missing',
      };
    }

    case 'photos': {
      const score = computePhotoScore(mediaCounts.photos, formData.type);
      return {
        earned: score * weight,
        status: score >= 1 ? 'complete' : score > 0 ? 'partial' : 'missing',
      };
    }

    // Should be unreachable — exhaustive over FIELD_KEYS
    default: {
      const _exhaustive: never = fieldKey;
      void _exhaustive;
      return { earned: 0, status: 'missing' };
    }
  }
}

function binary(
  complete: boolean,
  weight: number,
): { earned: number; status: 'complete' | 'missing' } {
  return complete
    ? { earned: weight, status: 'complete' }
    : { earned: 0, status: 'missing' };
}

// =============================================================================
// 5. MAIN ASSESSMENT FUNCTION
// =============================================================================

/**
 * Assess property completion from a form-data slice + media counts.
 *
 * **Contract**:
 *   - Deterministic: identical inputs → identical output.
 *   - No side effects, no I/O, no React hooks.
 *   - Safe to call with partial/malformed input — invalid types fall back to
 *     `apartment` matrix (conservative default).
 *   - `draft` operational status → `shouldHide = true`, other fields
 *     populated but caller should not render.
 */
export function assessPropertyCompleteness(
  args: AssessPropertyCompletionArgs,
): CompletionAssessment {
  const { formData, mediaCounts, levelCount = 1 } = args;
  const operationalStatus = formData.operationalStatus ?? null;
  const isPreCompletion = isPreCompletionOperationalStatus(operationalStatus);
  const isDraft = operationalStatus === 'draft';

  const typeForLookup =
    isStringComplete(formData.type) ? (formData.type as PropertyTypeCanonical) : undefined;
  const weightEntries = getFieldWeightsForType(typeForLookup);
  const entryByKey = new Map<FieldKey, FieldWeightEntry>(
    weightEntries.map((entry) => [entry.key, entry]),
  );

  const breakdown: CompletionBreakdownEntry[] = [];
  const exemptFields: FieldKey[] = [];
  let weightTotal = 0;
  let weightEarned = 0;

  for (const fieldKey of FIELD_KEYS) {
    const entry = entryByKey.get(fieldKey);

    // Not in per-type matrix → exempt (not in denominator)
    if (!entry) {
      breakdown.push({
        fieldKey,
        weight: 0,
        earned: 0,
        status: 'exempt',
        critical: false,
      });
      exemptFields.push(fieldKey);
      continue;
    }

    // Pre-completion exemption — Batch 27 parity
    if (isPreCompletion && PRE_COMPLETION_EXEMPT_FIELDS.has(fieldKey)) {
      breakdown.push({
        fieldKey,
        weight: 0,
        earned: 0,
        status: 'exempt',
        critical: false,
      });
      exemptFields.push(fieldKey);
      continue;
    }

    // Pre-completion photo weight reduction — shell photos valgono meno
    const effectiveWeight =
      isPreCompletion && fieldKey === 'photos'
        ? entry.weight * PRE_COMPLETION_PHOTO_FACTOR
        : entry.weight;

    const { earned, status } = resolveFieldCredit(
      fieldKey,
      effectiveWeight,
      formData,
      mediaCounts,
      levelCount,
    );

    breakdown.push({
      fieldKey,
      weight: effectiveWeight,
      earned,
      status,
      critical: entry.critical,
    });

    weightTotal += effectiveWeight;
    weightEarned += earned;
  }

  const score = weightTotal > 0 ? weightEarned / weightTotal : 0;
  const percentage = Math.round(score * 100);

  // Missing lists — sorted by weight desc, stable tie-break on FIELD_KEYS order
  const missingEntries = breakdown.filter(
    (b) => b.status === 'missing' || b.status === 'partial',
  );
  const sortedMissing = [...missingEntries].sort((a, b) => b.weight - a.weight);
  const missing = sortedMissing.map((b) => b.fieldKey);
  const missingCritical = sortedMissing
    .filter((b) => b.critical)
    .map((b) => b.fieldKey);

  return {
    shouldHide: isDraft,
    score,
    percentage,
    weightTotal,
    weightEarned,
    breakdown,
    missing,
    missingCritical,
    exemptFields,
    bucketColor: resolveBucket(percentage),
  };
}

// =============================================================================
// 6. RE-EXPORTS — ergonomic barrel for consumers
// =============================================================================

export type { FieldKey } from '@/constants/field-completion-weights';
