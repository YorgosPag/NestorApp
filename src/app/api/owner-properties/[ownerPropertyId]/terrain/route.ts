/**
 * @fileoverview **POST /api/owner-properties/[ownerPropertyId]/terrain** — το τοπογραφικό της αγγελίας οικοπέδου ιδιοκτήτη.
 * @related ADR-920 Β4.3 · app/api/properties/[id]/terrain/route (η αδελφή του γραφείου) ·
 *   server/listing-material/publish-owner-property-material (το υποκείμενο) · server/listing-terrain/terrain-upload.server
 * @module app/api/owner-properties/[ownerPropertyId]/terrain/route
 *
 * ```
 * φόρμα ιδιοκτήτη (Β4.7): σημεία + όριο + αποτύπωμα (JSON) + δήλωση Δ2
 *   → υποκείμενο: κηδεμονία (ξένη ⇒ 404) · φάκελος του ίδιου ανθρώπου (αλλιώς TERRAIN_NO_DOSSIER)
 *   → κοινός κώδικας εδάφους: σχήμα · δήλωση · «είναι γη;» · ο ΕΝΑΣ κριτής
 *   → κινητήρας: εγγραφή στο files_personal · bytes+δήλωση · διαδοχή · ΕΠΑΝΑΠΡΟΒΟΛΗ
 * ```
 *
 * 🔑 **Η ΙΔΙΑ ΠΟΡΤΑ ΜΕ ΤΟ ΓΡΑΦΕΙΟ, ΑΛΛΟ ΣΠΙΤΙ.** Το έδαφος (ανάγνωση, κριτής, απάντηση) και η σειρά (κινητήρας) είναι
 * **κοινά**· εδώ μένει μόνο ό,τι είναι του ιδιοκτήτη: η γέννηση στον φάκελο και το ιστορικό της αγγελίας του.
 * ⛔ Η πηγή **δεν** εμφανίζεται σε καρτέλα του φακέλου: είναι JSON του διακομιστή, όχι έγγραφο του ανθρώπου.
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { auditLedgerScopeOf } from '@/lib/audit/audit-ledger';
import { buildPublishedTerrainFileRecord } from '@/lib/listings/terrain-file-record';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { custodyOf, custodyWorkspace } from '@/lib/owner-property/listing-custody';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import {
  publishOwnerPropertyMaterial,
  type OwnerMaterialBirth,
  type OwnerMaterialDoorEnv,
  type OwnerMaterialPublicationDoor,
} from '@/server/listing-material/publish-owner-property-material';
import {
  TERRAIN_DOOR_CODES,
  terrainMaterialDoor,
  terrainPublishedFacts,
  terrainResponseOf,
  type TerrainPublicationResponse,
  type TerrainUpload,
} from '@/server/listing-terrain/terrain-upload.server';
import { EntityAuditService } from '@/services/entity-audit.service';

const logger = createModuleLogger('OwnerPropertyTerrainRoute');

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ ownerPropertyId: string }> };

/** Το πεδίο του ιστορικού — το **ίδιο** με το γραφείο: «ποιο τοπογραφικό δημοσιεύεται» (ADR-195). */
const AUDIT_FIELD = 'terrain';

/** Το ίχνος στο βιβλίο του χώρου του ιδιοκτήτη: ποια πηγή δημοσιεύεται, ποιες διαδέχεται. Ποτέ δεν ρίχνει τη δημοσίευση. */
function recordTerrainPublished(fileId: string, supersedes: readonly string[], env: OwnerMaterialDoorEnv): void {
  const { property, userId } = env;
  safeFireAndForget(
    EntityAuditService.recordChange({
      entityType: 'owner_property',
      entityId: property.id,
      entityName: property.title.trim() || null,
      action: 'updated',
      changes: [{ field: AUDIT_FIELD, oldValue: supersedes.length > 0 ? supersedes.join(', ') : null, newValue: fileId }],
      performedBy: userId,
      performedByName: null,
      ...auditLedgerScopeOf(custodyWorkspace(custodyOf(property))),
    }),
    'OwnerPropertyTerrain.audit',
    { ownerPropertyId: property.id, fileId },
  );
}

/** 🏆 **Ό,ΤΙ ΕΙΝΑΙ ΤΟΥ ΙΔΙΟΚΤΗΤΗ** — το έδαφος το δίνει ο κοινός κώδικας, τη σειρά ο κινητήρας (ADR-920 Β4.3). */
const TERRAIN_DOOR: OwnerMaterialPublicationDoor<TerrainUpload> = {
  ...terrainMaterialDoor<OwnerMaterialDoorEnv, OwnerMaterialBirth>({
    propertyTypeOf: (env) => env.property.type,
    recordOf: ({ userId, dossierId, createdBy, sourceRevisions }) =>
      buildPublishedTerrainFileRecord({ home: { userId, dossierId }, createdBy, sourceRevisions }),
    recordPublished: (verdict, env) => recordTerrainPublished(verdict.fileId, verdict.supersedes, env),
  }),
  codes: TERRAIN_DOOR_CODES,
};

async function handler(
  request: NextRequest,
  actor: ApiActor,
  context?: RouteContext,
): Promise<NextResponse<ApiSuccessResponse<TerrainPublicationResponse>>> {
  const ownerPropertyId = (await context?.params)?.ownerPropertyId?.trim() ?? '';
  const published = await publishOwnerPropertyMaterial(request, actor, ownerPropertyId, TERRAIN_DOOR);

  logger.info('Τοπογραφικό αγγελίας ιδιοκτήτη δημοσιεύτηκε', {
    ownerPropertyId: published.listingId, ...terrainPublishedFacts(published),
  });

  return apiSuccess<TerrainPublicationResponse>(terrainResponseOf(published));
}

export const POST = withHeavyRateLimit(
  withPersonalOrOrgAuth<ApiSuccessResponse<TerrainPublicationResponse>, RouteContext>(handler),
);
