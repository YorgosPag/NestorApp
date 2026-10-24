/**
 * @fileoverview **POST /api/properties/[id]/terrain** — η πόρτα του τοπογραφικού της αγγελίας οικοπέδου.
 * @related ADR-920 Β3 (Α2 · Α4 · Δ1 · Δ2) · ADR-909 Β1 (ο κοινός κορμός) · ADR-845 §7.17 (πόρτες υλικού)
 * @module app/api/properties/[id]/terrain/route
 *
 * ```
 * πελάτης (φόρμα Β4 · DXF Viewer Β5): σημεία + όριο + αποτύπωμα (JSON) + δήλωση Δ2
 *   → εδώ: σχήμα · δήλωση · «είναι γη;» · ΞΑΝΑΧΤΙΣΙΜΟ του στιγμιοτύπου (ξηρή εκτέλεση)
 *   → κοινός κορμός: κηδεμονία · δικαίωμα · εγγραφή · bytes+δήλωση · διαδοχή · επαναπροβολή
 * ```
 *
 * 🔴 **Ο ΔΙΑΚΟΜΙΣΤΗΣ ΔΕΝ ΕΜΠΙΣΤΕΥΕΤΑΙ ΚΑΝΕΝΑ ΠΑΡΑΓΩΓΟ ΤΟΥ ΠΕΛΑΤΗ.** Ο πελάτης στέλνει **μετρήσεις**· το
 * στιγμιότυπο (TIN, ισοϋψείς, κλίσεις, όγκος) το χτίζει **ο ίδιος** builder που θα ψήσει το δημόσιο ράφι
 * (`buildListingTerrainSnapshot`). Εδώ τρέχει **νωρίτερα**, όσο ο άνθρωπος είναι παρών: ό,τι δεν θα
 * μπορούσε ποτέ να δημοσιευτεί αρνείται **με όνομα τώρα**, όχι σιωπηλά τη μέρα του ψησίματος. Η κρίση είναι ο
 * **ΕΝΑΣ** `judgeListingTerrainSource` (ADR-920 §13.3) — ο ίδιος που δείχνει η προεπισκόπηση του ιδιοκτήτη.
 *
 * 🔑 **Αποθηκεύεται η ΚΑΝΟΝΙΚΗ πηγή, ιδιωτικά** — ποτέ η ωμή συμβολοσειρά του πελάτη, ποτέ δημόσια
 * (Δ2). Η δήλωση ταξιδεύει ως custom metadata στο **ίδιο** `save()` με τα bytes (μοτίβο μοντέλου).
 *
 * ⛔ **Καμία νέα σειρά εγγραφών.** Η σειρά ζει στον κοινό κορμό (`publishPropertyMaterial`)· ό,τι είναι του
 * εδάφους (ανάγνωση, κριτής, απάντηση) ζει στο `server/listing-terrain/terrain-upload.server`, **κοινό** με την πόρτα
 * του ιδιοκτήτη (ADR-920 Β4.3). Εδώ μένει ό,τι είναι **του γραφείου**: φρουρός μισθωτή, γέννηση στα εταιρικά
 * αρχεία, ιστορικό του ακινήτου.
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { requirePropertyInTenantScope } from '@/lib/auth/tenant-isolation';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { buildPublishedTerrainFileRecord } from '@/lib/listings/terrain-file-record';
import { EntityAuditService } from '@/services/entity-audit.service';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import {
  TERRAIN_DOOR_CODES,
  terrainMaterialDoor,
  terrainPublishedFacts,
  terrainResponseOf,
  type TerrainPublicationResponse,
  type TerrainUpload,
} from '@/server/listing-terrain/terrain-upload.server';
import {
  publishPropertyMaterial,
  type MaterialBirth,
  type MaterialDoorEnv,
  type MaterialPublicationDoor,
} from '../_shared/publish-property-material';

const logger = createModuleLogger('PropertyTerrainRoute');

export const dynamic = 'force-dynamic';

/** Το πεδίο του ιστορικού του ακινήτου — «ποιο τοπογραφικό δημοσιεύεται» (ADR-195). */
const AUDIT_FIELD = 'terrain';

/** Το ίχνος στο ιστορικό του ακινήτου: ποια πηγή δημοσιεύεται, ποιες διαδέχεται. Ποτέ δεν ρίχνει τη δημοσίευση. */
function recordTerrainPublished(fileId: string, supersedes: readonly string[], env: MaterialDoorEnv): void {
  const { ctx, propertyId, property } = env;
  safeFireAndForget(
    EntityAuditService.recordChange({
      entityType: ENTITY_TYPES.PROPERTY,
      entityId: propertyId,
      entityName: typeof property.name === 'string' ? property.name : null,
      action: 'updated',
      changes: [{ field: AUDIT_FIELD, oldValue: supersedes.length > 0 ? supersedes.join(', ') : null, newValue: fileId }],
      performedBy: ctx.uid,
      performedByName: null,
      companyId: ctx.companyId,
    }),
    'PropertyTerrain.audit',
    { propertyId, fileId },
  );
}

/** 🏆 **Ό,ΤΙ ΕΙΝΑΙ ΤΟΥ ΓΡΑΦΕΙΟΥ** — το έδαφος το δίνει ο κοινός κώδικας, τη σειρά ο κορμός (ADR-909 Β1 · ADR-920 Β4.3). */
const TERRAIN_DOOR: MaterialPublicationDoor<TerrainUpload> = {
  ...terrainMaterialDoor<MaterialDoorEnv, MaterialBirth>({
    propertyTypeOf: (env) => env.property.type,
    recordOf: ({ companyId, propertyId, createdBy, sourceRevisions }) =>
      buildPublishedTerrainFileRecord({ home: { companyId, propertyId }, createdBy, sourceRevisions }),
    recordPublished: (verdict, env) => recordTerrainPublished(verdict.fileId, verdict.supersedes, env),
  }),
  // 🔒 Η πρόθεση εγγραφής γράφεται **εδώ** (CHECK 3.100)· το **πότε** τρέχει το αποφασίζει ο κορμός — πρώτο.
  judgeProperty: (query) => requirePropertyInTenantScope({ ...query, intent: 'write' }),
  codes: TERRAIN_DOOR_CODES,
};

async function handlePost(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<ApiSuccessResponse<TerrainPublicationResponse>>> {
  const published = await publishPropertyMaterial(request, ctx, TERRAIN_DOOR);

  logger.info('Τοπογραφικό αγγελίας δημοσιεύτηκε', {
    propertyId: published.propertyId, companyId: ctx.companyId, ...terrainPublishedFacts(published),
  });

  return apiSuccess<TerrainPublicationResponse>(terrainResponseOf(published));
}

export const POST = withHeavyRateLimit(
  withAuth<ApiSuccessResponse<TerrainPublicationResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
      handlePost(request, ctx),
    { permissions: 'properties:properties:update' },
  ),
);
