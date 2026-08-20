import { NextRequest } from 'next/server';
import { requireAdminFirestore } from '@/lib/api/admin-db';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { loadOwnedBuilding } from '../_shared/building-owned-doc';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { softDelete } from '@/lib/firestore/soft-delete-engine';

const logger = createModuleLogger('BuildingByIdRoute');

interface BuildingDeleteResponse {
  buildingId: string;
  deleted: boolean;
}

/**
 * 🏢 ENTERPRISE: DELETE /api/buildings/[buildingId]
 *
 * Deletes a building using Admin SDK (bypasses Firestore rules).
 * Includes tenant isolation and audit logging.
 */
/**
 * 🏢 **GET /api/buildings/[buildingId]** — ADR-777 §8.31
 *
 * Ένα **μόνο** κτίριο, με τον ίδιο φύλακα ιδιοκτησίας που χρησιμοποιεί το
 * `DELETE`. Υπήρχε **μόνο** το `DELETE` σε αυτό το μονοπάτι: μπορούσες να
 * σβήσεις ένα κτίριο με ταυτότητα, αλλά **δεν μπορούσες να το δεις**.
 *
 * Γιατί χρειάστηκε: όταν ένας σύνδεσμος `?buildingId=…` δείχνει σε κτίριο που
 * **δεν είναι** στη φορτωμένη λίστα (φιλτραρισμένο, ή στον κάδο), η οθόνη
 * χρειάζεται πηγή για να απαντήσει *«υπάρχει;»* — αλλιώς σιωπά, ή, χειρότερα,
 * δείχνει **άλλο** κτίριο (το ζωντανό ελάττωμα του §8.31).
 *
 * ⚠️ **Το «δεν βρέθηκε» και το «δεν είναι δικό σου» είναι ΤΟ ΙΔΙΟ σφάλμα** —
 * βγαίνουν και τα δύο από το `loadOwnedBuilding`. Η διάκριση θα επέτρεπε
 * απαρίθμηση ξένων ταυτοτήτων ρωτώντας τη μία μετά την άλλη.
 *
 * ⚠️ **Επιστρέφει και τα αρχειοθετημένα** (`status === 'deleted'`), επίτηδες:
 * ο καλών τα χρειάζεται για να δείξει **πανό επαναφοράς** αντί για κενό. Το
 * φιλτράρισμα των λιστών ζει αλλού (`useFirestoreBuildings`).
 */
export const GET = withStandardRateLimit(
  withAuth<ApiSuccessResponse<Record<string, unknown>>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const adminDb = requireAdminFirestore();

      const url = new URL(request.url);
      const buildingId = url.pathname.split('/').pop();

      if (!buildingId) {
        throw new ApiError(400, 'Building ID is required');
      }

      const { data } = await loadOwnedBuilding({
        buildingId,
        caller: ctx,
        action: 'view',
        db: adminDb,
      });

      return apiSuccess<Record<string, unknown>>(
        { id: buildingId, ...data },
        'Building loaded',
      );
    },
    { permissions: 'buildings:buildings:view' }
  )
);

export const DELETE = withStandardRateLimit(
  withAuth<ApiSuccessResponse<BuildingDeleteResponse>>(
    async (
      request: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache,
    ) => {
      const adminDb = requireAdminFirestore();

      // Extract buildingId from URL path: /api/buildings/[buildingId]
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/');
      const buildingId = pathParts[pathParts.length - 1];

      if (!buildingId) {
        throw new ApiError(400, 'Building ID is required');
      }

      // 🔒 TENANT ISOLATION (ADR-742 §7octies)
      // Φόρτωση **και** κρίση σε μία πράξη: η σειρά «υπάρχει; → δικό μου;» δεν
      // ξαναγράφεται εδώ. Και τα δύο «όχι» βγαίνουν από το ίδιο εργοστάσιο, άρα
      // η άρνηση ιδιοκτησίας είναι πανομοιότυπη με το γνήσιο «δεν βρέθηκε».
      const { data: buildingData } = await loadOwnedBuilding({
        buildingId,
        caller: ctx,
        action: 'delete',
        db: adminDb,
      });

      logger.info('Moving building to trash (soft-delete)', { buildingId, companyId: ctx.companyId });

      // 🗑️ ADR-281: Soft-delete — move to trash (status='deleted')
      await softDelete(adminDb, 'building', buildingId, ctx.uid, ctx.companyId, ctx.email ?? undefined);

      logger.info('Building moved to trash', { buildingId, email: ctx.email });

      // 📊 Auth audit (soft-delete engine handles entity audit)
      await logAuditEvent(ctx, 'soft_deleted', 'buildings', 'api', {
        newValue: {
          type: 'building_delete',
          value: {
            buildingId,
            name: buildingData?.name ?? '',
          },
        },
        metadata: { reason: 'Building moved to trash via API' },
      });

      return apiSuccess<BuildingDeleteResponse>(
        { buildingId, deleted: true },
        'Building moved to trash'
      );
    },
    { permissions: 'buildings:buildings:delete' }
  )
);
