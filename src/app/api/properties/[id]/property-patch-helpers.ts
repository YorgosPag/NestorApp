/**
 * Pure helpers for the Property PATCH handler.
 *
 * Extracts multi-level validation/aggregation, update-data building,
 * and cancellation detection so that route.ts stays lean.
 *
 * @module api/properties/[id]/property-patch-helpers
 * @see ADR-236 (Multi-level floors)
 * @see ADR-249 (Field locking)
 */

import { z } from 'zod';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { deriveMultiLevelFields } from '@/services/multi-level.service';
import { PUBLISHED_MEDIA_LIMIT } from '@/services/upload/utils/storage-path-public-shelf';
import { MARKETING_AUDIENCES } from '@/constants/marketing-audiences';

// ============================================================================
// SCHEMA + TYPES (re-exported so route.ts can import from here)
// ============================================================================

/** Zod schema for the PATCH request body. */
export const PropertyPatchSchema = z.object({
  name: z.string().max(500).optional(),
  type: z.string().max(50).optional(),
  status: z.string().max(50).optional(),
  floor: z.union([z.string().max(50), z.number()]).nullable().optional(),
  floorId: z.string().max(128).nullable().optional(),
  area: z.number().min(0).max(999_999).nullable().optional(),
  price: z.number().min(0).max(999_999_999).nullable().optional(),
  description: z.string().max(5000).optional(),
  buildingId: z.string().max(128).nullable().optional(),
  projectId: z.string().max(128).nullable().optional(),
  companyId: z.string().max(128).nullable().optional(),
  isMultiLevel: z.boolean().optional(),
  /**
   * **Η πράξη σειράς του γραφείου** — ταυτότητες `FileRecord.id` στη δηλωμένη σειρά
   * (ADR-841 §7 Α14.7).
   *
   * 🔴 **ΓΡΑΜΜΕΝΟ ΡΗΤΑ ΕΠΕΙΔΗ ΤΟ ΣΧΗΜΑ ΕΙΝΑΙ `.passthrough()`** *(Α14.7.5)*. Χωρίς αυτή
   * τη γραμμή το πεδίο θα περνούσε **χωρίς κανέναν έλεγχο** τύπου, μήκους ή
   * περιεχομένου — ο μόνος φρουρός από κάτω είναι η λίστα **άρνησης** πέντε ονομάτων
   * του `FORBIDDEN_FIELDS`, που δεν λέει τίποτα για σχήμα.
   *
   * ⚠️ **Το άνω όριο είναι το ΥΠΑΡΧΟΝ `PUBLISHED_MEDIA_LIMIT`, όχι νέος αριθμός**
   * *(Α14.4: το όριο είναι **ένα**)*: δήλωση μεγαλύτερη από όσα μπορούν να φύγουν δεν
   * έχει τι να τακτοποιήσει.
   */
  publishedMediaOrder: z
    .array(z.string().min(1).max(128))
    .max(PUBLISHED_MEDIA_LIMIT)
    .optional(),
  /**
   * **Οι δηλωμένες κατόψεις της αγγελίας** — ταυτότητες `FileRecord.id` (ADR-841 §7 Α17.7).
   *
   * 🔴 **ΙΔΙΟ ΣΧΗΜΑ, ΔΙΑΦΟΡΕΤΙΚΟ ΒΑΡΟΣ**: το `publishedMediaOrder` **δεν μπορεί να
   * δημοσιεύσει τίποτα**· αυτό **μπορεί**. Γι' αυτό η γραμμή είναι εξίσου ρητή — και ο
   * φρουρός `classification: 'public'` παραμένει **ανέγγιχτος** στον κανόνα *(Α17.7.4)*.
   *
   * ⚠️ **Ίδιο άνω όριο, το ΥΠΑΡΧΟΝ**: το ράφι είναι **ένα** και το όριό του **συνολικό**
   * *(Α17.7.5)* — δήλωση μεγαλύτερη από όσα χωρούν δεν έχει τι να δημοσιεύσει.
   */
  publishedFloorplans: z
    .array(z.string().min(1).max(128))
    .max(PUBLISHED_MEDIA_LIMIT)
    .optional(),
  /**
   * **Το κοινό της αγγελίας** (ADR-864 §5.1) — κλειστό λεξιλόγιο, δεμένο στη ρίζα (CHECK 3.73).
   *
   * 🔴 **Ρητό επειδή το σχήμα είναι `.passthrough()`** — ίδιο σκεπτικό με το
   * `publishedMediaOrder`: χωρίς τη γραμμή, μια άγνωστη λέξη θα γραφόταν και η πύλη θα την
   * ερμήνευε σιωπηλά ως `public`. Η ίχνωση (`PROPERTY_TRACKED_FIELDS`) και η επαναπροβολή
   * (`republishPublicProjection`) είναι **ήδη** στη διαδρομή — Α2 χωρίς νέο κώδικα.
   */
  marketingAudience: z.enum(MARKETING_AUDIENCES).optional(),
  _v: z.number().int().optional(),
}).passthrough();

export interface PropertyMutationResult {
  id: string;
  _v?: number;
}

export interface PropertyLevelPayload {
  floorId: string;
  floorNumber: number;
  name: string;
  isPrimary: boolean;
}

/** Property PATCH body — core fields explicitly typed, extended fields passed through */
export interface PropertyPatchPayload extends Record<string, unknown> {
  name?: string;
  type?: string;
  status?: string;
  floor?: string | number;
  area?: number;
  price?: number;
  description?: string;
  buildingId?: string | null;
  projectId?: string | null;
  companyId?: string | null;
  companyName?: string;
  projectName?: string;
  // ADR-236: Multi-level fields
  isMultiLevel?: boolean;
  levels?: PropertyLevelPayload[];
  // ADR-236 Phase 2: Per-level data
  levelData?: Record<string, unknown>;
  // Auto-aggregated fields (set by server from levelData)
  areas?: Record<string, number>;
  layout?: Record<string, number>;
  orientations?: string[];
  /** ADR-841 §7 Α14.7 — η δηλωμένη σειρά των δημόσιων φωτογραφιών της αγγελίας. */
  publishedMediaOrder?: string[];
  /** ADR-841 §7 Α17.7 — οι δηλωμένες κατόψεις της αγγελίας. */
  publishedFloorplans?: string[];
}

// ============================================================================
// applyMultiLevelDefaults
// ============================================================================

/**
 * ADR-236: Validate and mutate the body for multi-level floors.
 *
 * - Ensures exactly one primary floor when levels.length >= 2
 * - Auto-derives backward-compat fields (floor, floorId, isMultiLevel)
 * - Resets isMultiLevel to false when levels is cleared
 *
 * Mutates `body` in-place (same pattern as the original inline code).
 * @throws {ApiError} if primary-floor constraint is violated
 */
export function applyMultiLevelDefaults(body: PropertyPatchPayload): void {
  if (!Array.isArray(body.levels)) return;

  if (body.levels.length >= 2) {
    const primaryCount = body.levels.filter((l) => l.isPrimary).length;
    if (primaryCount !== 1) {
      throw new ApiError(400, 'Exactly one floor must be marked as primary');
    }
    // Derivation reuses the SSoT helper — no duplicated primary-resolution math.
    const derived = deriveMultiLevelFields(body.levels);
    body.floor = derived.floor;
    body.floorId = derived.floorId;
    body.isMultiLevel = derived.isMultiLevel;
  } else if (body.levels.length === 0) {
    body.isMultiLevel = false;
  }
}

// ============================================================================
// buildUpdateData
// ============================================================================

/** Fields that are NEVER writable via PATCH (security). */
const FORBIDDEN_FIELDS: ReadonlySet<string> = new Set([
  'id', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy',
]);

/**
 * Build the sanitized Firestore update payload from the validated body.
 *
 * - Strips forbidden fields and undefined values
 * - Trims string fields (name, floor, description)
 */
export function buildUpdateData(
  body: PropertyPatchPayload,
  existing: Record<string, unknown>,
): Record<string, unknown> {
  const updateData: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body)) {
    if (FORBIDDEN_FIELDS.has(key)) continue;
    if (value === undefined) continue;
    updateData[key] = value ?? null;
  }

  if (typeof updateData.name === 'string') {
    updateData.name = (updateData.name as string).trim() || existing.name;
  }
  if (typeof updateData.floor === 'string') {
    updateData.floor = (updateData.floor as string).trim() || null;
  }
  if (typeof updateData.description === 'string') {
    updateData.description = (updateData.description as string).trim() || null;
  }

  return updateData;
}

// ============================================================================
// detectCancellation
// ============================================================================

/**
 * Returns true when the PATCH transitions from sold/reserved to any other status.
 * Used to trigger contact-link deactivation (SPEC-257A).
 */
export function detectCancellation(
  existing: Record<string, unknown>,
  body: PropertyPatchPayload,
): boolean {
  const wasSoldOrReserved =
    existing.commercialStatus === 'reserved' || existing.commercialStatus === 'sold';
  const isNoLongerSoldOrReserved =
    !!body.commercialStatus
    && body.commercialStatus !== 'reserved'
    && body.commercialStatus !== 'sold';
  return wasSoldOrReserved && isNoLongerSoldOrReserved;
}
