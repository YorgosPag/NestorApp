/**
 * =============================================================================
 * createLifecycleMutationRoute — `/api/trash/{entityType}/{entityId}/<πράξη>`, μία φορά
 * =============================================================================
 *
 * Οι πράξεις κύκλου ζωής που δεν σβήνουν έγγραφο (επαναφορά από κάδο · αρχειοθέτηση ·
 * επαναφορά από αρχείο) έχουν το **ίδιο** κέλυφος: ταυτοποίηση, έλεγχος ότι η
 * οντότητα έχει κύκλο ζωής, προαιρετική άδεια, μία κλήση στη μηχανή, γραμμή ασφαλείας.
 * Διαφέρουν μόνο σε ό,τι δηλώνει το {@link LifecycleMutationSpec}.
 *
 * ⚠️ Το **όριο ρυθμού ΔΕΝ είναι εδώ**: το δηλώνει η ίδια η διαδρομή, γύρω από το εργοστάσιο
 * (`withStandardRateLimit(createLifecycleMutationRoute({ … }))`). Βαθμίδα κρυμμένη σε
 * εργοστάσιο είναι αόρατη στο CHECK 3.78 (ADR-855) — η διαδρομή μετριέται «αδήλωτη».
 *
 * ⚠️ Η οριστική διαγραφή **δεν** είναι εδώ: σβήνει έγγραφο και ακυρώνει cache έργου — άλλη πράξη.
 *
 * @module lib/api/lifecycle-mutation-route
 * @enterprise ADR-281 — SSOT Soft-Delete System · ADR-329 §3.9
 */

import 'server-only';

import type { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache, PermissionId } from '@/lib/auth';
import { hasPermission } from '@/lib/auth/permissions';
import { ApiError, apiSuccess } from '@/lib/api/ApiErrorHandler';
import {
  isSoftDeletableEntity,
  SOFT_DELETE_CONFIG,
  type SoftDeleteEntityConfig,
} from '@/lib/firestore/soft-delete-config';
import type { SoftDeletableEntityType } from '@/types/soft-deletable';

/** Ό,τι χρειάζεται η μηχανή για να εκτελέσει την πράξη. */
export interface LifecycleMutationInput {
  readonly db: FirebaseFirestore.Firestore;
  readonly entityType: SoftDeletableEntityType;
  readonly entityId: string;
  readonly ctx: AuthContext;
}

/** Ό,τι διαφέρει από πράξη σε πράξη. */
export interface LifecycleMutationSpec<TResult extends object> {
  /**
   * Η άδεια που απαιτεί η πράξη για αυτή την οντότητα. `undefined` ⇒ η οντότητα **δεν έχει**
   * αυτή την πράξη (400). Παράλειψη ολόκληρου του πεδίου ⇒ αρκεί η ταυτοποίηση.
   */
  readonly permissionOf?: (config: SoftDeleteEntityConfig) => string | undefined;
  /** Η κλήση στη μηχανή· ό,τι επιστρέψει μπαίνει στην απάντηση δίπλα στην ταυτότητα. */
  readonly run: (input: LifecycleMutationInput) => Promise<TResult>;
  /** Η πράξη όπως γράφεται στο βιβλίο ασφαλείας. */
  readonly securityAction: Parameters<typeof logAuditEvent>[1];
  /** Το μήνυμα επιτυχίας, από το αγγλικό όνομα της οντότητας. */
  readonly outcome: (labelEn: string) => string;
}

type LifecycleSegment = { params: Promise<{ entityType: string; entityId: string }> };

/** Αρνείται όποιον δεν έχει την άδεια της πράξης — ή όταν η οντότητα δεν έχει την πράξη. */
async function assertPermitted(
  spec: Pick<LifecycleMutationSpec<object>, 'permissionOf'>,
  config: SoftDeleteEntityConfig,
  ctx: AuthContext,
  cache: PermissionCache,
): Promise<void> {
  if (!spec.permissionOf) return;

  const permission = spec.permissionOf(config);
  if (permission === undefined) {
    throw new ApiError(400, `${config.labelEn} does not support this operation`);
  }
  if (!(await hasPermission(ctx, permission as PermissionId, {}, cache))) {
    throw new ApiError(403, 'Permission denied', 'FORBIDDEN');
  }
}

/**
 * Χτίζει το `POST` μιας πράξης κύκλου ζωής.
 *
 * @example
 * // src/app/api/trash/[entityType]/[entityId]/archive/route.ts
 * export const POST = withStandardRateLimit(createLifecycleMutationRoute({ … }));
 */
export function createLifecycleMutationRoute<TResult extends object>(
  spec: LifecycleMutationSpec<TResult>,
) {
  return withAuth(
    async (
      _request: NextRequest,
      ctx: AuthContext,
      cache: PermissionCache,
      segmentData?: LifecycleSegment,
    ) => {
      const { entityType, entityId } = await segmentData!.params;

      if (!isSoftDeletableEntity(entityType)) {
        throw new ApiError(400, `Invalid entity type: ${entityType}`);
      }

      const config = SOFT_DELETE_CONFIG[entityType];
      await assertPermitted(spec, config, ctx, cache);

      const result = await spec.run({ db: getAdminFirestore(), entityType, entityId, ctx });
      const message = spec.outcome(config.labelEn);

      await logAuditEvent(ctx, spec.securityAction, entityType, 'api', {
        newValue: { type: 'status', value: { entityId, ...result } },
        metadata: { reason: message },
      });

      return apiSuccess({ entityType, entityId, ...result }, message);
    },
    {},
  );
}
