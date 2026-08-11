/**
 * PATCH /api/buildings — Update building via Admin SDK
 *
 * Extracted from route.ts for SRP (ADR-281 Batch 3).
 *
 * @module api/buildings/building-update.handler
 * @permission buildings:buildings:update
 * @rateLimit STANDARD (60 req/min)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFirestore } from '@/lib/api/admin-db';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { normalizeProjectIdForQuery } from '@/utils/firestore-helpers';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { loadOwnedBuilding } from './_shared/building-owned-doc';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { linkEntity } from '@/lib/firestore/entity-linking.service';
import { getErrorMessage } from '@/lib/error-utils';
import { withVersionCheck, ConflictError } from '@/lib/firestore/version-check';
import { POLICY_ERROR_CODES } from '@/lib/policy';
import { geocode } from '@/app/api/geocoding/geocoding-engine';
import { verifyPlaceRef } from '@/services/places/public-place-read.service';
import type { PlaceRef } from '@/types/geo/public-place';
// 🔴 **Το σχήμα καλωδίου γράφεται ΜΙΑ φορά** — ήταν αντιγραμμένο εδώ και στον πελάτη,
// και τα δύο αντίγραφα **είχαν ήδη αποκλίνει** (`addresses` · `category`). Το εντόπισε
// το CHECK 3.28, όχι άνθρωπος.
import type { BuildingUpdatePayload } from '@/types/building/mutation-payloads';

const logger = createModuleLogger('BuildingUpdate');

// ============================================================================
// GEOCODING HELPER
// ============================================================================

/**
 * Extracts lat/lng from the primary address in the addresses array.
 * If the address already has coordinates (from the map picker), returns them directly.
 * Otherwise calls Nominatim forward geocoding (only for manually typed addresses).
 * Returns null if geocoding fails or no meaningful address fields are present.
 */
async function geocodePrimaryAddress(
  addresses: Record<string, unknown>[],
): Promise<{ lat: number; lng: number } | null> {
  const primary = addresses.find(a => a['isPrimary'] === true) ?? addresses[0];
  if (!primary) return null;

  const existing = primary['coordinates'] as { lat?: number; lng?: number } | undefined;
  if (existing?.lat && existing?.lng) {
    return { lat: existing.lat, lng: existing.lng };
  }

  const street = typeof primary['street'] === 'string' ? primary['street'] : undefined;
  const number = typeof primary['number'] === 'string' ? primary['number'] : undefined;
  const city = typeof primary['city'] === 'string' ? primary['city'] : undefined;
  const postalCode = typeof primary['postalCode'] === 'string' ? primary['postalCode'] : undefined;
  const region = typeof primary['region'] === 'string' ? primary['region'] : undefined;
  const municipality = typeof primary['municipality'] === 'string' ? primary['municipality'] : undefined;

  if (!street && !city) return null;

  try {
    const result = await geocode({
      street: street && number ? `${street} ${number}` : street,
      city,
      postalCode,
      region,
      municipality,
      country: 'Greece',
    });
    if (!result) return null;
    return { lat: result.lat, lng: result.lng };
  } catch (err) {
    logger.warn('[Buildings] Geocoding failed — lat/lon not updated', { error: getErrorMessage(err) });
    return null;
  }
}

// ============================================================================
// ΔΕΣΜΟΣ ΠΡΟΣ ΤΟ ΕΠΙΠΕΔΟ Α (ADR-777 §14.5)
// ============================================================================

/**
 * **Κάθε ετυμηγορία απαντιέται ρητά** — καμία `default`, καμία σιωπή.
 *
 * 🔴 **Το «δεν μάθαμε» φεύγει ως 503 και ΠΟΤΕ ως 422**, και δεν είναι λεπτολογία: ένα
 * 422 λέει στον επαγγελματία *«αυτός ο τόπος δεν υπάρχει»* και τον στέλνει να
 * **φτιάξει δεύτερη ταυτότητα** για φυσικό κτίριο που έχει ήδη μία — δηλαδή να
 * παραγάγει ακριβώς το διπλότυπο που όλο το επίπεδο Α υπάρχει για να αποτρέψει
 * (§14.5). Το 503 λέει *«ξαναδοκίμασε, **μην αλλάξεις τίποτα**»*, όπως ήδη κάνει το
 * `/api/places/resolve`.
 */
async function assertPlaceRefResolvable(
  adminDb: ReturnType<typeof requireAdminFirestore>,
  ref: PlaceRef,
): Promise<void> {
  const verdict = await verifyPlaceRef(adminDb, ref);

  switch (verdict) {
    case 'exists':
      return;
    case 'not-a-place-id':
      throw new ApiError(422, 'placeRef is not a level-A identity', 'PLACE_REF_MALFORMED');
    case 'land-absent':
    case 'building-absent':
      throw new ApiError(422, `placeRef points to a place that does not exist (${verdict})`, 'PLACE_REF_ABSENT');
    case 'unavailable':
      throw new ApiError(503, 'Could not verify placeRef — try again', 'PLACE_REF_UNVERIFIED');
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface BuildingUpdateResponse {
  buildingId: string;
  updated: boolean;
  _v?: number;
}

// ============================================================================
// PATCH — Update Building
// ============================================================================

export const PATCH = withStandardRateLimit(
  withAuth<ApiSuccessResponse<BuildingUpdateResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
    const adminDb = requireAdminFirestore();

    try {
      const body = await request.json();
      const { buildingId, _v: expectedVersion, ...updates } = body as { buildingId: string; _v?: number } & BuildingUpdatePayload;

      if (!buildingId) {
        throw new ApiError(400, 'Building ID is required');
      }

      // 🔒 TENANT ISOLATION (ADR-742 §7octies) — βλ. `_shared/building-owned-doc`
      // Φόρτωση **και** κρίση σε μία πράξη· η σειρά δεν ξαναγράφεται εδώ.
      const { data: buildingData } = await loadOwnedBuilding({
        buildingId,
        caller: ctx,
        action: 'update',
        db: adminDb,
      });

      const IMMUTABLE_FIELDS = ['companyId'];
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([key, value]) =>
          value !== undefined && !IMMUTABLE_FIELDS.includes(key)
        )
      );

      // 🔐 ADR-233 §3.4: Uniqueness validation when `code` changes within projectId scope
      if (typeof cleanUpdates.code === 'string' && cleanUpdates.code !== buildingData?.code) {
        const effectiveProjectId = (cleanUpdates.projectId ?? buildingData?.projectId) as string | null | undefined;
        if (effectiveProjectId) {
          const duplicateSnap = await adminDb.collection(COLLECTIONS.BUILDINGS)
            .where(FIELDS.PROJECT_ID, '==', normalizeProjectIdForQuery(String(effectiveProjectId)))
            .where('code', '==', cleanUpdates.code)
            .limit(2)
            .get();
          const conflict = duplicateSnap.docs.find(d => d.id !== buildingId);
          if (conflict) {
            logger.warn('[Buildings] Duplicate code on update', { code: cleanUpdates.code, projectId: effectiveProjectId, conflictId: conflict.id });
            throw new ApiError(409, `Building code "${cleanUpdates.code}" already exists in this project`, POLICY_ERROR_CODES.DUPLICATE_CODE);
          }
        }
      }

      // 🔗 ADR-777 §14.5 — ο δεσμός προς το επίπεδο Α επαληθεύεται **πριν** γραφτεί.
      //
      // 🔴 Χωρίς αυτό η βλάβη είναι **αόρατη**: ένας δεσμός προς ανύπαρκτη ταυτότητα
      // ταξιδεύει στη δημόσια αγγελία, **φαίνεται** λυμένος, και απλώς δεν ταιριάζει
      // ποτέ με καμία ζήτηση Ζ3/Ζ5. Η μηχανή θα έλεγε «καμία αντιστοιχία» και θα είχε
      // δίκιο — κανείς δεν θα ρωτούσε γιατί.
      //
      // ⚠️ **Η άρση του δεσμού (`null`) δεν επαληθεύεται** — δεν υπάρχει τι να υπάρχει.
      if (cleanUpdates.placeRef) {
        await assertPlaceRefResolvable(adminDb, cleanUpdates.placeRef as PlaceRef);
      }

      // Auto-geocode lat/lon when addresses are saved (for weather alerts)
      if (Array.isArray(cleanUpdates.addresses)) {
        if ((cleanUpdates.addresses as unknown[]).length === 0) {
          cleanUpdates.latitude = null;
          cleanUpdates.longitude = null;
        } else {
          const coords = await geocodePrimaryAddress(cleanUpdates.addresses as Record<string, unknown>[]);
          if (coords) {
            cleanUpdates.latitude = coords.lat;
            cleanUpdates.longitude = coords.lng;
            logger.info('[Buildings] Auto-geocoded lat/lon from primary address', { buildingId, lat: coords.lat, lng: coords.lng });
          }
        }
      }

      logger.info('[Buildings] Updating building for tenant', { buildingId, companyId: ctx.companyId });

      const versionResult = await withVersionCheck({
        db: adminDb,
        collection: COLLECTIONS.BUILDINGS,
        docId: buildingId,
        expectedVersion,
        updates: cleanUpdates,
        userId: ctx.uid,
      });

      logger.info('[Buildings] Building updated', { buildingId, email: ctx.email, _v: versionResult.newVersion });

      // ADR-029 Phase D: search_documents written by Cloud Function onBuildingWrite.

      if ('projectId' in cleanUpdates) {
        linkEntity('building:projectId', {
          auth: ctx,
          entityId: buildingId,
          newLinkValue: (cleanUpdates.projectId as string) ?? null,
          existingDoc: (buildingData ?? {}) as Record<string, unknown>,
          apiPath: '/api/buildings (PATCH)',
        }).catch((err) => {
          logger.warn('[Buildings] linkEntity failed (non-blocking)', {
            buildingId,
            error: getErrorMessage(err),
          });
        });
      }

      await logAuditEvent(ctx, 'data_updated', 'buildings', 'api', {
        newValue: {
          type: 'building_update',
          value: {
            buildingId,
            fields: Object.keys(cleanUpdates),
          },
        },
        metadata: { reason: 'Building updated' },
      });

      return apiSuccess<BuildingUpdateResponse>(
        { buildingId, updated: true, _v: versionResult.newVersion },
        'Building updated successfully'
      );

    } catch (error) {
      if (error instanceof ConflictError) {
        return NextResponse.json(error.body, { status: error.statusCode });
      }
      // 🔴 **Μια ΚΡΙΜΕΝΗ απάντηση δεν ξαναγίνεται «κάτι πήγε στραβά».** Μέχρι σήμερα
      // αυτό το `catch` κατάπινε **κάθε** `ApiError` που έριχνε το ίδιο το σώμα —
      // ακόμη και το `400 Building ID is required` δέκα γραμμές πιο πάνω — και το
      // ξαναπετούσε ως **500**. Δηλαδή «*το αίτημά σου ήταν λάθος*» και «*ο
      // διακομιστής μας έσπασε*» έφταναν στον άνθρωπο **ταυτόσημα**, και μόνο το
      // δεύτερο τον καλεί να ξαναδοκιμάσει. (ADR-777 Β3 — ίδιο σχήμα με τη διάκριση
      // `absent` ⇄ `unavailable` του §13.7.2.)
      if (error instanceof ApiError) throw error;
      logger.error('[Buildings] Error updating building', { error });
      throw new ApiError(500, getErrorMessage(error, 'Failed to update building'));
    }
    },
    { permissions: 'buildings:buildings:update' }
  )
);
