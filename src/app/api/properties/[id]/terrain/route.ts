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
 * μπορούσε ποτέ να δημοσιευτεί αρνείται **με όνομα τώρα**, όχι σιωπηλά τη μέρα του ψησίματος.
 *
 * 🔑 **Αποθηκεύεται η ΚΑΝΟΝΙΚΗ πηγή, ιδιωτικά** — ποτέ η ωμή συμβολοσειρά του πελάτη, ποτέ δημόσια
 * (Δ2). Η δήλωση ταξιδεύει ως custom metadata στο **ίδιο** `save()` με τα bytes (μοτίβο μοντέλου).
 *
 * ⛔ **Καμία νέα σειρά εγγραφών.** Η σειρά ζει στον κοινό κορμό (`publishPropertyMaterial`)· εδώ μένει
 * μόνο ό,τι είναι του εδάφους.
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { requirePropertyInTenantScope } from '@/lib/auth/tenant-isolation';
import { ENTITY_TYPES, FILE_CATEGORIES } from '@/config/domain-constants';
import { isLandProperty } from '@/constants/property-classification';
import { buildPublishedTerrainFileRecord } from '@/lib/listings/terrain-file-record';
import { buildListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-snapshot';
import {
  encodeListingTerrainSource,
  parseListingTerrainSource,
  toListingTerrainInput,
  type ListingTerrainSource,
} from '@/lib/terrain/publication/listing-terrain-source';
import { LISTING_TERRAIN_SOURCE_MAX_BYTES } from '@/lib/terrain/publication/listing-terrain-config';
import type { ListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-types';
import {
  TERRAIN_DECLARATION_METADATA_KEY,
  decodeTerrainSurveyDeclaration,
  encodeTerrainSurveyDeclaration,
  isSurveyDateInFuture,
  type TerrainSurveyDeclaration,
} from '@/lib/terrain/publication/terrain-survey-declaration';
import {
  TERRAIN_SOURCE_CONTENT_TYPE,
  TERRAIN_UPLOAD_FIELDS,
  refusalOfTerrainRejection,
} from '@/lib/terrain/publication/terrain-publication-contract';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { ListingMediaRefreshOutcome } from '@/services/listings/listing-media-refresh';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { readSceneFileIds } from '../_shared/material-source-lookup';
import {
  publishPropertyMaterial,
  type MaterialDoorEnv,
  type MaterialPublicationDoor,
} from '../_shared/publish-property-material';

const logger = createModuleLogger('PropertyTerrainRoute');

export const dynamic = 'force-dynamic';

/** Το πεδίο του ιστορικού του ακινήτου — «ποιο τοπογραφικό δημοσιεύεται» (ADR-195). */
const AUDIT_FIELD = 'terrain';

/** Ό,τι διαβάζει ο αγοραστής με μια ματιά — ο πελάτης το δείχνει ως επιβεβαίωση, από την αλήθεια του server. */
interface PropertyTerrainResponse {
  readonly fileId: string;
  readonly supersedes: readonly string[];
  readonly archived: readonly string[];
  readonly listing: ListingMediaRefreshOutcome;
  readonly terrain: {
    readonly stats: ListingTerrainSnapshot['stats'];
    readonly contourIntervalM: number;
    readonly envelopeOmission: ListingTerrainSnapshot['envelopeOmission'];
  };
}

/** Τι έστειλε ο άνθρωπος — κριμένο, κανονικοποιημένο, και **ήδη** αποδεδειγμένα δημοσιεύσιμο. */
interface TerrainUpload {
  readonly file: File;
  readonly declaration: TerrainSurveyDeclaration;
  readonly sceneFileIds: readonly string[];
  readonly snapshot: ListingTerrainSnapshot;
}

/** Το αρχείο της πηγής: παρόν, JSON, μη κενό, κάτω από το ταβάνι — αλλιώς άρνηση με όνομα. */
function readSourceFile(formData: FormData): File {
  const file = formData.get(TERRAIN_UPLOAD_FIELDS.source);
  if (!(file instanceof File)) throw new ApiError(400, 'TERRAIN_SOURCE_REQUIRED');
  if (file.type !== TERRAIN_SOURCE_CONTENT_TYPE) throw new ApiError(415, 'TERRAIN_TYPE_UNSUPPORTED');
  if (file.size === 0) throw new ApiError(400, 'TERRAIN_SOURCE_EMPTY');
  if (file.size > LISTING_TERRAIN_SOURCE_MAX_BYTES) throw new ApiError(413, 'TERRAIN_SOURCE_TOO_LARGE');
  return file;
}

/** Η δήλωση Δ2: υπάρχει, είναι πλήρης, και η ημερομηνία της δεν είναι στο μέλλον. */
function readDeclaration(formData: FormData): TerrainSurveyDeclaration {
  const raw = formData.get(TERRAIN_UPLOAD_FIELDS.declaration);
  const declaration = decodeTerrainSurveyDeclaration(typeof raw === 'string' ? raw : null);
  if (declaration === null) throw new ApiError(400, 'TERRAIN_DECLARATION_INVALID');
  if (isSurveyDateInFuture(declaration, new Date())) throw new ApiError(422, 'TERRAIN_SURVEY_DATE_IN_FUTURE');
  return declaration;
}

/** Τα bytes → κανονική πηγή, ή `TERRAIN_SOURCE_MALFORMED` (μη JSON, λάθος έκδοση, εκτός ορίων). */
async function readCanonicalSource(file: File): Promise<ListingTerrainSource> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new ApiError(400, 'TERRAIN_SOURCE_MALFORMED');
  }
  const source = parseListingTerrainSource(raw);
  if (source === null) throw new ApiError(400, 'TERRAIN_SOURCE_MALFORMED');
  return source;
}

/**
 * **Τι έστειλε ο άνθρωπος** — με τη σειρά «φθηνό πρώτα»: δήλωση και είδος ακινήτου πριν διαβαστούν
 * megabytes, το στιγμιότυπο τελευταίο.
 */
async function readTerrainUpload(formData: FormData, env: MaterialDoorEnv): Promise<TerrainUpload> {
  const file = readSourceFile(formData);
  const declaration = readDeclaration(formData);
  // Δ1: μόνο οικόπεδο / αγροτεμάχιο — ο ισχυρός κριτής, που λύνει και τις ελληνικές ετικέτες.
  if (!isLandProperty(env.property.type)) throw new ApiError(422, 'TERRAIN_NOT_LAND');

  const source = await readCanonicalSource(file);
  const built = buildListingTerrainSnapshot(toListingTerrainInput(source));
  if (!built.ok) throw new ApiError(422, refusalOfTerrainRejection(built.reason));

  const canonical = new File([encodeListingTerrainSource(source)], file.name || 'terrain-source.json', {
    type: TERRAIN_SOURCE_CONTENT_TYPE,
  });
  return {
    file: canonical,
    declaration,
    sceneFileIds: readSceneFileIds(formData.get(TERRAIN_UPLOAD_FIELDS.sceneFileIds)),
    snapshot: built.snapshot,
  };
}

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

/** 🏆 **Ό,ΤΙ ΕΙΝΑΙ ΤΟΥ ΕΔΑΦΟΥΣ** — ο κορμός κάνει όλα τα υπόλοιπα (ADR-909 Β1). */
const TERRAIN_DOOR: MaterialPublicationDoor<TerrainUpload> = {
  // 🔒 Η πρόθεση εγγραφής γράφεται **εδώ** (CHECK 3.100)· το **πότε** τρέχει το αποφασίζει ο κορμός — πρώτο.
  judgeProperty: (query) => requirePropertyInTenantScope({ ...query, intent: 'write' }),
  category: FILE_CATEGORIES.DRAWINGS,
  codes: { notCapable: 'TERRAIN_PUBLICATION_NOT_CAPABLE', uploadFailed: 'TERRAIN_UPLOAD_FAILED' },
  read: readTerrainUpload,
  fileOf: (upload) => upload.file,
  sceneFileIdsOf: (upload) => upload.sceneFileIds,
  recordOf: (_upload, birth) => buildPublishedTerrainFileRecord(birth),
  // 🏆 Η «ΜΙΑ ΕΓΓΡΑΦΗ»: η δήλωση Δ2 στην κανονική μορφή του ενός γραφέα, ποτέ η ωμή του πελάτη.
  customMetadataOf: (upload) => ({
    [TERRAIN_DECLARATION_METADATA_KEY]: encodeTerrainSurveyDeclaration(upload.declaration),
  }),
  afterSuccession: async (_upload, verdict, env) => {
    recordTerrainPublished(verdict.fileId, verdict.supersedes, env);
    return undefined;
  },
};

async function handlePost(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<ApiSuccessResponse<PropertyTerrainResponse>>> {
  const published = await publishPropertyMaterial(request, ctx, TERRAIN_DOOR);
  const { propertyId, fileId, supersedes, archived, listing } = published;
  const { snapshot } = published.parsed;

  logger.info('Τοπογραφικό αγγελίας δημοσιεύτηκε', {
    fileId, propertyId, companyId: ctx.companyId, bytes: published.bytes, triangles: snapshot.mesh.slopeClass.length,
    supersedes: supersedes.length, archived: archived.length, sources: published.sourceRevisions.length, listing,
  });

  return apiSuccess<PropertyTerrainResponse>({
    fileId,
    supersedes,
    archived,
    listing,
    terrain: { stats: snapshot.stats, contourIntervalM: snapshot.contourIntervalM, envelopeOmission: snapshot.envelopeOmission },
  });
}

export const POST = withHeavyRateLimit(
  withAuth<ApiSuccessResponse<PropertyTerrainResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
      handlePost(request, ctx),
    { permissions: 'properties:properties:update' },
  ),
);
