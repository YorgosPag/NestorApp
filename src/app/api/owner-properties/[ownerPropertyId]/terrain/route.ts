/**
 * @fileoverview **GET · POST · PUT · PATCH /api/owner-properties/[ownerPropertyId]/terrain** — το τοπογραφικό της αγγελίας οικοπέδου ιδιοκτήτη.
 * @related ADR-920 Β4.3 · §14.11 Ζ3 · app/api/properties/[id]/terrain/route (η αδελφή του γραφείου) ·
 *   server/listing-material/publish-owner-property-material (το υποκείμενο) · server/listing-terrain/terrain-upload.server ·
 *   server/listing-terrain/plot-outline-confirmation.server (το σκέλος επιβεβαίωσης περιγράμματος)
 * @module app/api/owner-properties/[ownerPropertyId]/terrain/route
 *
 * ```
 * GET  — κατάσταση περιγράμματος (§14.11 Ζ4): ισχύον · ποιος κρατά την απόφαση · νεότερο σχέδιο + προέλευση (και στον κάδο)
 *   · `?view=relief` (§14.11 Ζ5): το ανάγλυφο όπως το βλέπει ο ΙΔΙΟΚΤΗΤΗΣ — το περίγραμμα πάντα (Π9)· δεν δημοσιεύει τίποτα
 * POST — φόρμα ιδιοκτήτη (Β4.7): σημεία + όριο + αποτύπωμα (JSON) + δήλωση Δ2
 *   → υποκείμενο: κηδεμονία (ξένη ⇒ 404) · φάκελος του ίδιου ανθρώπου (αλλιώς TERRAIN_NO_DOSSIER)
 *   → κοινός κώδικας εδάφους: σχήμα · δήλωση · «είναι γη;» · ΤΟ ΠΕΡΙΓΡΑΜΜΑ ΠΟΥ ΙΣΧΥΕΙ ΣΤΟΝ ΦΑΚΕΛΟ (Ζ3c) · ο ΕΝΑΣ κριτής
 *   → κινητήρας: εγγραφή στο files_personal · bytes+δήλωση · διαδοχή · ΕΠΑΝΑΠΡΟΒΟΛΗ
 * PUT — επιβεβαίωση περιγράμματος (§14.11 Π2/Π3/Π6): σχέδιο DXF/PDF + { candidateId, showInListing }
 *   → ίδιος φρουρός κηδεμονίας/φακέλου → ο server ξαναβρίσκει το υποψήφιο → Π6 → σχέδιο στον φάκελο → ίδιος κινητήρας
 *   · `?view=georeference` (§14.12 φάση Α): τι δηλώθηκε, τι προτείνουν τα σημεία, τι θα έδινε η ανάγνωση ως ΕΓΣΑ'87
 * PATCH — αλλαγή περιγράμματος χωρίς νέο σχέδιο (§14.11 Ζ3c): { kind: 'visibility', showInListing } | { kind: 'remove' }
 *   → ίδιος φρουρός → το περίγραμμα που ισχύει → νέα πηγή από τον ίδιο κινητήρα (διαδοχή · ΕΠΑΝΑΠΡΟΒΟΛΗ)
 *   · γεωαναφορά (§14.12 φάση Α): { kind: 'coordinate-system', system } | { kind: 'location-visibility', showInListing }
 *   → ίδιος φρουρός → περιοχή χρήσης + διασταύρωση με τη θέση της αγγελίας → νέα πηγή από τον ίδιο κινητήρα
 * ```
 *
 * 🔑 **ΜΙΑ ΠΟΡΤΑ ΕΔΑΦΟΥΣ, ΔΥΟ ΠΡΑΞΕΙΣ.** Η επιβεβαίωση **δεν** είναι δεύτερη πόρτα δημοσίευσης (CHECK 3.76 · 3.105): ζει
 * στο ίδιο αρχείο, ξαναδημοσιεύει με την **ίδια** πόρτα (`TERRAIN_DOOR`) και τον **ίδιο** κινητήρα.
 * 🔑 Το έδαφος (ανάγνωση, κριτής, απάντηση) και η σειρά (κινητήρας) είναι **κοινά**· εδώ μένει ό,τι είναι του ιδιοκτήτη:
 * η γέννηση στον φάκελο, το επιβεβαιωμένο περίγραμμα του φακέλου και το ιστορικό της αγγελίας του.
 * ⛔ Η πηγή **δεν** εμφανίζεται σε καρτέλα του φακέλου (JSON του διακομιστή)· το **σχέδιο** του τοπογράφου εμφανίζεται.
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { auditLedgerScopeOf } from '@/lib/audit/audit-ledger';
import { buildPublishedTerrainFileRecord } from '@/lib/listings/terrain-file-record';
import { withHeavyRateLimit, withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { custodyOf, custodyWorkspace } from '@/lib/owner-property/listing-custody';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { parsePlotOutlineAmendment } from '@/lib/terrain/plot-outline/plot-outline-confirmation';
import {
  enterOwnerDoor,
  publishOwnerPropertyMaterial,
  type OwnerMaterialBirth,
  type OwnerMaterialDoorEnv,
  type OwnerMaterialPublicationDoor,
} from '@/server/listing-material/publish-owner-property-material';
import {
  OWNER_TERRAIN_RELIEF_VIEW,
  OWNER_TERRAIN_VIEW_PARAM,
  type PlotOutlineStatus,
} from '@/lib/terrain/plot-outline/plot-outline-status';
import type { ListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-types';
import {
  OWNER_TERRAIN_GEOREFERENCE_VIEW,
  parseTerrainGeoreferenceAmendment,
  type TerrainGeoreferenceAmendment,
  type TerrainGeoreferenceStatus,
} from '@/lib/terrain/publication/terrain-georeference-declaration';
import {
  amendOwnerTerrainGeoreference,
  carriedOwnerGeoreference,
  loadOwnerTerrainGeoreferenceStatus,
  type TerrainGeoreferenceAmendmentResponse,
} from '@/server/listing-terrain/terrain-georeference.server';
import {
  loadDossierOwnerReliefSnapshot,
  loadDossierPlotOutlineStatus,
  loadDossierTerrainInheritance,
} from '@/server/listing-terrain/dossier-terrain.reader';
import {
  amendOwnerPlotOutline,
  confirmOwnerPlotOutline,
  type PlotOutlineAmendmentResponse,
  type PlotOutlineConfirmationResponse,
} from '@/server/listing-terrain/plot-outline-confirmation.server';
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

/**
 * Τα πεδία του ιστορικού (ADR-195): `terrain` = «ποιο τοπογραφικό δημοσιεύεται» — το **ίδιο** με το γραφείο·
 * `plotOutline` = «ποια εγγραφή κρατά πλέον την απόφαση για το περίγραμμα»: το σχέδιο στην επιβεβαίωση (`PUT`, Ζ3), η νέα
 * πηγή εδάφους στην αλλαγή χωρίς σχέδιο (`PATCH`, Ζ3c) — ο ίδιος γραφέας, ίδιο σχήμα «ποιο διαδέχεται ποιο»·
 * `terrainGeoreference` = «ποια πηγή κρατά πλέον τη δήλωση συστήματος / τη συγκατάθεση θέσης» (§14.12 φάση Α).
 */
const AUDIT_FIELDS = { terrain: 'terrain', plotOutline: 'plotOutline', georeference: 'terrainGeoreference' } as const;

/** Το ίχνος στο βιβλίο του χώρου του ιδιοκτήτη: ποιο αρχείο ισχύει, ποια διαδέχεται. Ποτέ δεν ρίχνει την πράξη. */
function recordOwnerTerrainChange(
  field: (typeof AUDIT_FIELDS)[keyof typeof AUDIT_FIELDS],
  fileId: string,
  supersedes: readonly string[],
  env: OwnerMaterialDoorEnv,
): void {
  const { property, userId } = env;
  safeFireAndForget(
    EntityAuditService.recordChange({
      entityType: 'owner_property',
      entityId: property.id,
      entityName: property.title.trim() || null,
      action: 'updated',
      changes: [{ field, oldValue: supersedes.length > 0 ? supersedes.join(', ') : null, newValue: fileId }],
      performedBy: userId,
      performedByName: null,
      ...auditLedgerScopeOf(custodyWorkspace(custodyOf(property))),
    }),
    'OwnerPropertyTerrain.audit',
    { ownerPropertyId: property.id, fileId, field },
  );
}

/** 🏆 **Ό,ΤΙ ΕΙΝΑΙ ΤΟΥ ΙΔΙΟΚΤΗΤΗ** — το έδαφος το δίνει ο κοινός κώδικας, τη σειρά ο κινητήρας (ADR-920 Β4.3). */
const TERRAIN_DOOR: OwnerMaterialPublicationDoor<TerrainUpload> = {
  ...terrainMaterialDoor<OwnerMaterialDoorEnv, OwnerMaterialBirth>({
    propertyTypeOf: (env) => env.property.type,
    // 🗺️ ADR-920 §14.11 Ζ3c — το περίγραμμα που ΙΣΧΥΕΙ (νικά η νεότερη απόφαση: πηγή ή σχέδιο) — ποτέ μόνο το σχέδιο, που
    //    μπορεί να είναι στον κάδο: ο κάδος του σχεδίου δεν αφαιρεί το περίγραμμα (copy semantics).
    // 📍 ADR-920 §14.12 φάση Α — η δήλωση ΕΓΣΑ'87 και η συγκατάθεση θέσης μεταφέρονται, αφού ξανακριθούν στα νέα σημεία.
    // 🏆 ΕΝΑ ερώτημα φακέλου, ΕΝΑ κατέβασμα: η ίδια ανάγνωση της προηγούμενης πηγής δίνει και τα δύο.
    inheritedOf: async (env) => {
      const { current, outline } = await loadDossierTerrainInheritance(env.adminDb, env.dossier);
      return {
        outline,
        georeferenceFor: (incoming) => carriedOwnerGeoreference(current?.source ?? null, incoming, env.property),
      };
    },
    recordOf: ({ userId, dossierId, createdBy, sourceRevisions }) =>
      buildPublishedTerrainFileRecord({ home: { userId, dossierId }, createdBy, sourceRevisions }),
    recordPublished: (verdict, env) => recordOwnerTerrainChange(AUDIT_FIELDS.terrain, verdict.fileId, verdict.supersedes, env),
  }),
  codes: TERRAIN_DOOR_CODES,
};

/** Η απάντηση του `?view=relief`: το στιγμιότυπο του ιδιοκτήτη, ή `null` όταν δεν δημοσιεύτηκε ποτέ ανάγλυφο. */
interface OwnerReliefView {
  readonly snapshot: ListingTerrainSnapshot | null;
}

/** Η απάντηση του `?view=georeference` (ADR-920 §14.12 φάση Α): η κατάσταση, ή `null` όταν δεν υπάρχει ανάγλυφο. */
interface OwnerGeoreferenceView {
  readonly georeference: TerrainGeoreferenceStatus | null;
}

type OwnerTerrainView = PlotOutlineStatus | OwnerReliefView | OwnerGeoreferenceView;
type OwnerTerrainAmendment = PlotOutlineAmendmentResponse | TerrainGeoreferenceAmendmentResponse;

async function ownerPropertyIdOf(context?: RouteContext): Promise<string> {
  return (await context?.params)?.ownerPropertyId?.trim() ?? '';
}

async function handler(
  request: NextRequest,
  actor: ApiActor,
  context?: RouteContext,
): Promise<NextResponse<ApiSuccessResponse<TerrainPublicationResponse>>> {
  const published = await publishOwnerPropertyMaterial(request, actor, await ownerPropertyIdOf(context), TERRAIN_DOOR);

  logger.info('Τοπογραφικό αγγελίας ιδιοκτήτη δημοσιεύτηκε', {
    ownerPropertyId: published.listingId, ...terrainPublishedFacts(published),
  });

  return apiSuccess<TerrainPublicationResponse>(terrainResponseOf(published));
}

/**
 * **PUT — επιβεβαίωση περιγράμματος.** Ο φρουρός κηδεμονίας/φακέλου κρίνει **πριν** διαβαστεί το σώμα (ξένη αγγελία δεν
 * πληρώνει ποτέ την ανάγνωση ενός σχεδίου megabytes).
 */
async function confirmHandler(
  request: NextRequest,
  actor: ApiActor,
  context?: RouteContext,
): Promise<NextResponse<ApiSuccessResponse<PlotOutlineConfirmationResponse>>> {
  const env = await enterOwnerDoor(await ownerPropertyIdOf(context), actor, TERRAIN_DOOR);
  const confirmed = await confirmOwnerPlotOutline(env, await request.formData(), TERRAIN_DOOR);
  recordOwnerTerrainChange(AUDIT_FIELDS.plotOutline, confirmed.drawingFileId, confirmed.supersedes, env);

  logger.info('Περίγραμμα οικοπέδου επιβεβαιώθηκε', {
    ownerPropertyId: env.ownerPropertyId,
    drawingFileId: confirmed.drawingFileId,
    supersedes: confirmed.supersedes.length,
    republished: confirmed.terrain !== null,
  });

  return apiSuccess<PlotOutlineConfirmationResponse>(confirmed);
}

/** Το σώμα JSON — ό,τι δεν διαβάζεται ως JSON είναι απλώς άκυρο αίτημα, όχι σφάλμα διακομιστή. */
async function jsonBodyOf(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/**
 * **PATCH, σκέλος γεωαναφοράς** (ADR-920 §14.12 φάση Α): δήλωση συστήματος ή συγκατάθεση θέσης — ίδια πόρτα, ίδιος κινητήρας,
 * ίδιο ιστορικό. Στο ημερολόγιο μπαίνει **το είδος** της αλλαγής, ποτέ συντεταγμένη.
 */
async function amendGeoreference(
  env: OwnerMaterialDoorEnv,
  amendment: TerrainGeoreferenceAmendment,
): Promise<TerrainGeoreferenceAmendmentResponse> {
  const amended = await amendOwnerTerrainGeoreference(env, amendment, TERRAIN_DOOR);
  if (amended.terrain !== null) {
    recordOwnerTerrainChange(AUDIT_FIELDS.georeference, amended.terrain.fileId, amended.terrain.supersedes, env);
  }
  logger.info('Γεωαναφορά ανάγλυφου άλλαξε', {
    ownerPropertyId: env.ownerPropertyId,
    kind: amendment.kind,
    changed: amended.changed,
  });
  return amended;
}

/**
 * **PATCH — αλλαγή περιγράμματος χωρίς νέο σχέδιο** (ADR-920 §14.11 Ζ3c): Π9 (δημόσιο ή όχι) ή ρητή αφαίρεση. Ίδιος
 * φρουρός, ίδια πόρτα (`TERRAIN_DOOR` — η γέννηση μένει εδώ, CHECK 3.105 Κ2), ίδιο ιστορικό.
 */
async function amendHandler(
  request: NextRequest,
  actor: ApiActor,
  context?: RouteContext,
): Promise<NextResponse<ApiSuccessResponse<OwnerTerrainAmendment>>> {
  const env = await enterOwnerDoor(await ownerPropertyIdOf(context), actor, TERRAIN_DOOR);
  const body = await jsonBodyOf(request);
  const amendment = parsePlotOutlineAmendment(body);
  if (amendment === null) {
    // 📍 Δύο κλειστά λεξιλόγια, ένα σώμα: ό,τι δεν είναι ΑΚΡΙΒΩΣ ένα από τα δύο είναι άκυρο αίτημα.
    const georeference = parseTerrainGeoreferenceAmendment(body);
    if (georeference === null) throw new ApiError(400, 'TERRAIN_PLOT_OUTLINE_AMENDMENT_INVALID');
    return apiSuccess<TerrainGeoreferenceAmendmentResponse>(await amendGeoreference(env, georeference));
  }

  const amended = await amendOwnerPlotOutline(env, amendment, TERRAIN_DOOR);
  if (amended.terrain !== null) {
    recordOwnerTerrainChange(AUDIT_FIELDS.plotOutline, amended.terrain.fileId, amended.terrain.supersedes, env);
  }

  logger.info('Περίγραμμα οικοπέδου άλλαξε χωρίς νέο σχέδιο', {
    ownerPropertyId: env.ownerPropertyId,
    kind: amendment.kind,
    changed: amended.changed,
  });

  return apiSuccess<PlotOutlineAmendmentResponse>(amended);
}

/**
 * **GET — τι ξέρει ο φάκελος για το περίγραμμα** (ADR-920 §14.11 Ζ4): ισχύον περίγραμμα, ποιος κρατά την απόφαση, το
 * νεότερο σχέδιο (και στον κάδο) με την προέλευσή του. Μόνο ανάγνωση· ίδιος φρουρός κηδεμονίας/φακέλου με τις πράξεις.
 *
 * `?view=relief` (Ζ5) — το ανάγλυφο όπως το βλέπει ο **ιδιοκτήτης**: το περίγραμμα πάνω του **πάντα** (Π9). Ο φρουρός
 * κρίνει **πριν** διαβαστεί οτιδήποτε· η απάντηση δεν γράφεται πουθενά (ούτε ράφι, ούτε αγγελία).
 */
async function statusHandler(
  request: NextRequest,
  actor: ApiActor,
  context?: RouteContext,
): Promise<NextResponse<ApiSuccessResponse<OwnerTerrainView>>> {
  const env = await enterOwnerDoor(await ownerPropertyIdOf(context), actor, TERRAIN_DOOR);
  const view = new URL(request.url).searchParams.get(OWNER_TERRAIN_VIEW_PARAM);
  if (view === OWNER_TERRAIN_RELIEF_VIEW) {
    return apiSuccess<OwnerReliefView>({ snapshot: await loadDossierOwnerReliefSnapshot(env.adminDb, env.dossier) });
  }
  if (view === OWNER_TERRAIN_GEOREFERENCE_VIEW) {
    return apiSuccess<OwnerGeoreferenceView>({ georeference: await loadOwnerTerrainGeoreferenceStatus(env) });
  }
  return apiSuccess<PlotOutlineStatus>(await loadDossierPlotOutlineStatus(env.adminDb, env.dossier));
}

export const GET = withStandardRateLimit(
  withPersonalOrOrgAuth<ApiSuccessResponse<OwnerTerrainView>, RouteContext>(statusHandler),
);

export const POST = withHeavyRateLimit(
  withPersonalOrOrgAuth<ApiSuccessResponse<TerrainPublicationResponse>, RouteContext>(handler),
);

export const PUT = withHeavyRateLimit(
  withPersonalOrOrgAuth<ApiSuccessResponse<PlotOutlineConfirmationResponse>, RouteContext>(confirmHandler),
);

export const PATCH = withHeavyRateLimit(
  withPersonalOrOrgAuth<ApiSuccessResponse<OwnerTerrainAmendment>, RouteContext>(amendHandler),
);
