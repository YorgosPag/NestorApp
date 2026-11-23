import 'server-only';

/**
 * @fileoverview 🗺️ **ΤΟ ΣΚΕΛΟΣ ΠΕΡΙΓΡΑΜΜΑΤΟΣ ΤΗΣ ΠΟΡΤΑΣ ΕΔΑΦΟΥΣ** — επιβεβαίωση από σχέδιο (ADR-920 §14.11 Ζ3 · Π2 · Π3 · Π6)
 *   και αλλαγή χωρίς νέο σχέδιο (Ζ3c · Π9 · ρητή αφαίρεση, {@link amendOwnerPlotOutline}).
 * @related app/api/owner-properties/[ownerPropertyId]/terrain/route (`PUT` · `PATCH`, η πόρτα) · ./plot-drawing-upload.server (το σχέδιο) ·
 *   ./dossier-terrain.reader (ο φάκελος) · server/listing-material/publish-owner-property-material (ο ΕΝΑΣ κινητήρας)
 * @module server/listing-terrain/plot-outline-confirmation.server
 *
 * ```
 * [πόρτα: κηδεμονία + φάκελος, ΗΔΗ κριμένα] → σχέδιο + επιλογή (ο server βρίσκει το υποψήφιο) → τρέχουσα πηγή του φακέλου
 *   → ΑΝ υπάρχει ανάγλυφο: withPlotOutline + ο ΕΝΑΣ κριτής → Π6 (disjoint ⇒ άρνηση) ─┐   όλα ΠΡΙΝ από κάθε εγγραφή
 *   → σχέδιο στον φάκελο (+ περίγραμμα, μετρημένο πεδίο) · διαδοχή του προηγούμενου σχεδίου
 *   → ΑΝ υπάρχει ανάγλυφο: επαναδημοσίευση από τον ΕΝΑ κινητήρα (νέα πηγή · διαδοχή · ΕΠΑΝΑΠΡΟΒΟΛΗ)
 * ```
 *
 * 🔑 **«ΣΧΕΔΙΟ ΠΡΩΤΑ»**: αν πέσει η επαναδημοσίευση, το περίγραμμα δεν χάνεται — η επόμενη δημοσίευση το παίρνει από τον φάκελο
 * (η πόρτα το βάζει **πάντα**). Ανάποδα, μια επιτυχής επαναδημοσίευση με αποτυχημένο σχέδιο θα το έσβηνε στην επόμενη.
 * 🔑 **Χωρίς ανάγλυφο** φυλάγεται μόνο το σχέδιο· το περίγραμμα μπαίνει στο πρώτο ανάγλυφο (Π2). Το Π6 κρίνεται τότε στη
 * δημοσίευση ισοϋψών **χωρίς** άρνηση: εκεί ο άνθρωπος ανεβάζει ανάγλυφο, δεν επιβεβαιώνει περίγραμμα.
 * 🔑 **Ταυτοδύναμο**: δεύτερη ίδια αποστολή ⇒ νέο σχέδιο που διαδέχεται το πρώτο, ίδια πηγή (ίδια bytes ⇒ ίδιο ράφι).
 */

import { ApiError } from '@/lib/api/ApiErrorHandler';
import { buildTopographicDrawingFileRecord } from '@/lib/listings/topographic-drawing-file-record';
import { canonicalMimeForExt } from '@/config/file-types/classification-registry';
import {
  amendedPlotOutline,
  confirmedPlotOutlineOf,
  plotOutlineChoiceOf,
  type ConfirmedPlotOutline,
  type PlotOutlineAmendment,
} from '@/lib/terrain/plot-outline/plot-outline-confirmation';
import {
  encodeListingTerrainSource,
  withPlotOutline,
  type PlotOutlineChoice,
} from '@/lib/terrain/publication/listing-terrain-source';
import { findSupersededDossierMaterial } from '@/server/listing-material/material-source-lookup';
import { archiveSuperseded } from '@/server/listing-material/material-supersession';
import { writeMaterial } from '@/server/listing-material/publish-listing-material';
import {
  republishOwnerMaterial,
  type OwnerMaterialDoorEnv,
  type OwnerMaterialPublicationDoor,
} from '@/server/listing-material/publish-owner-property-material';
import { personalContainerActorOf } from '@/services/iso19650/container-transitions';

import {
  loadCurrentDossierTerrainSource,
  loadDossierTerrainState,
  type CurrentDossierTerrainSource,
} from './dossier-terrain.reader';
import { readPlotDrawingChoice, type PlotDrawingChoice } from './plot-drawing-upload.server';
import {
  TERRAIN_DOOR_CODES,
  terrainResponseOf,
  terrainUploadOfSource,
  type TerrainPublicationResponse,
  type TerrainUpload,
} from './terrain-upload.server';

/** Ό,τι μαθαίνει ο άνθρωπος — από την αλήθεια του server. */
export interface PlotOutlineConfirmationResponse {
  readonly drawingFileId: string;
  /** Τα σχέδια που διαδέχτηκε, και όσα αρχειοθετήθηκαν πράγματι. */
  readonly supersedes: readonly string[];
  readonly archived: readonly string[];
  readonly outline: { readonly areaM2: number; readonly candidateId: string; readonly showInListing: boolean };
  /** Η επαναδημοσίευση του ανάγλυφου — `null` όταν ο φάκελος δεν έχει ακόμη ανάγλυφο (το περίγραμμα περιμένει το πρώτο). */
  readonly terrain: TerrainPublicationResponse | null;
}

/**
 * **Η τρέχουσα πηγή με αυτό το περίγραμμα (ή χωρίς, `null`) → ό,τι ανεβαίνει** — ο ΕΝΑΣ γραφέας (`withPlotOutline`), ο ΕΝΑΣ
 * κριτής (`terrainUploadOfSource`) και η δήλωση Δ2 της πηγής ως έχει. Κοινό της επιβεβαίωσης (`PUT`) και της αλλαγής (`PATCH`).
 */
function reliefUploadWith(current: CurrentDossierTerrainSource, outline: PlotOutlineChoice | null): TerrainUpload {
  const source = withPlotOutline(current.source, outline);
  if (source === null) throw new ApiError(400, 'TERRAIN_PLOT_OUTLINE_INVALID');
  return terrainUploadOfSource({ source, declaration: current.declaration, fileName: 'terrain-source.json', sceneFileIds: [] });
}

/** Το περίγραμμα πάνω στο τρέχον ανάγλυφο, κριμένο από τον ΕΝΑ κριτή — ή ονομασμένη άρνηση (Π6), πριν από κάθε εγγραφή. */
function reliefWithOutline(current: CurrentDossierTerrainSource, confirmed: ConfirmedPlotOutline): TerrainUpload {
  const upload = reliefUploadWith(current, plotOutlineChoiceOf(confirmed));
  const omission = upload.snapshot.plotOutlineOmission;
  // Π6 — καμία κοινή επιφάνεια: άλλο σύστημα ή άλλη περιοχή. Ποτέ μετατόπιση.
  if (omission === 'outside-surface') throw new ApiError(422, 'TERRAIN_PLOT_OUTLINE_DISJOINT');
  if (omission === 'degenerate-outline') throw new ApiError(400, 'TERRAIN_PLOT_OUTLINE_INVALID');
  return upload;
}

/** Το σχέδιο στον φάκελο, με το επιβεβαιωμένο περίγραμμα ως μετρημένο πεδίο — και διαδοχή του προηγούμενου. */
async function storeDrawing(env: OwnerMaterialDoorEnv, choice: PlotDrawingChoice, confirmed: ConfirmedPlotOutline) {
  const { adminDb, userId, dossier } = env;
  const actor = personalContainerActorOf(userId);
  const { fileId, storagePath, recordBase } = buildTopographicDrawingFileRecord({
    home: { userId, dossierId: dossier.id },
    createdBy: actor.uid,
    kind: choice.drawing.kind,
    originalFilename: choice.drawing.fileName,
  });
  // Ο Ο-27: οι προκάτοχοι ρωτιούνται ΠΡΙΝ γραφτεί ο νεοφερμένος — αλλιώς θα διαδεχόταν τον εαυτό του.
  const supersedes = await findSupersededDossierMaterial(adminDb, userId, dossier.id, recordBase.category, recordBase);
  const file = new File([choice.drawing.bytes], choice.drawing.fileName, { type: canonicalMimeForExt(choice.drawing.kind) });
  await writeMaterial({
    adminDb, actor, fileId, storagePath, recordBase, measured: { plotOutline: confirmed }, file,
    customMetadata: undefined, uploadFailed: TERRAIN_DOOR_CODES.uploadFailed,
  });
  const archived = await archiveSuperseded(actor, supersedes, fileId);
  return { fileId, supersedes, archived };
}

/**
 * 🏆 **ΕΠΙΒΕΒΑΙΩΣΗ ΠΕΡΙΓΡΑΜΜΑΤΟΣ** — ο φάκελος είναι ήδη κριμένος από την πόρτα (`enterOwnerDoor`).
 *
 * @param terrainDoor η πόρτα εδάφους **της διαδρομής** — η γέννηση της πηγής (`buildPublishedTerrainFileRecord`) μένει
 *   γραμμένη στο `route.ts` (CHECK 3.105 Κ2)· εδώ αλλάζει μόνο το `read`, που δίνει την ήδη κριμένη πηγή.
 */
export async function confirmOwnerPlotOutline(
  env: OwnerMaterialDoorEnv,
  formData: FormData,
  terrainDoor: OwnerMaterialPublicationDoor<TerrainUpload>,
): Promise<PlotOutlineConfirmationResponse> {
  const choice = await readPlotDrawingChoice(formData);
  const confirmed = confirmedPlotOutlineOf(choice.candidate, choice.request, {
    drawingSha256: choice.drawing.sha256,
    drawingUnit: choice.drawingUnit,
  });
  const current = await loadCurrentDossierTerrainSource(env.adminDb, env.dossier);
  const upload = current === null ? null : reliefWithOutline(current, confirmed);

  const stored = await storeDrawing(env, choice, confirmed);
  const published = upload === null
    ? null
    : await republishOwnerMaterial(env, terrainDoor, upload);

  return {
    drawingFileId: stored.fileId,
    supersedes: stored.supersedes,
    archived: stored.archived,
    outline: { areaM2: confirmed.areaM2, candidateId: confirmed.candidateId, showInListing: confirmed.showInListing },
    terrain: published === null ? null : terrainResponseOf(published),
  };
}

/** Ό,τι μαθαίνει ο άνθρωπος από μια αλλαγή περιγράμματος — `changed: false` = ήδη ίσχυε, τίποτα δεν γράφτηκε. */
export interface PlotOutlineAmendmentResponse {
  readonly changed: boolean;
  /** Το περίγραμμα που ισχύει πλέον — `null` = κανένα. */
  readonly outline: { readonly showInListing: boolean } | null;
  readonly terrain: TerrainPublicationResponse | null;
}

/** Ίδια bytes ⇒ ίδια απόφαση: η κανονική σειριοποίηση είναι η ΜΙΑ σύγκριση (κλειδιά σε σταθερή σειρά, mm). */
function carries(current: CurrentDossierTerrainSource, outline: PlotOutlineChoice | null): boolean {
  const composed = withPlotOutline(current.source, outline);
  return composed !== null && encodeListingTerrainSource(composed) === encodeListingTerrainSource(current.source);
}

/**
 * 🏆 **ΑΛΛΑΓΗ ΠΕΡΙΓΡΑΜΜΑΤΟΣ ΧΩΡΙΣ ΝΕΟ ΣΧΕΔΙΟ** (ADR-920 §14.11 Ζ3c — Π9 · ρητή αφαίρεση). Ο φάκελος είναι ήδη κριμένος.
 *
 * 🔑 Αλλάζει **το περίγραμμα που ισχύει** (ο ίδιος κανόνας «νικά η νεότερη απόφαση» με τη δημοσίευση ισοϋψών) και γράφει
 * **νέα πηγή**, που διαδέχεται την τρέχουσα από τον ΕΝΑ κινητήρα — άρα και ΕΠΑΝΑΠΡΟΒΟΛΗ. Το σχέδιο **δεν** αγγίζεται: είναι
 * η απόδειξη του τι βρέθηκε στα bytes του, όχι η τρέχουσα απόφαση.
 * 🔑 **Ταυτοδύναμο**: όταν η πηγή ήδη λέει ακριβώς αυτό που ισχύει **και** αυτό που ζητήθηκε ⇒ τίποτα δεν γράφεται. Και οι
 *    δύο όροι χρειάζονται: σχέδιο νεότερο από την πηγή (έπεσε η επαναδημοσίευση) σημαίνει ότι η πηγή ΔΕΝ λέει αυτό που ισχύει —
 *    ένα «ήδη αφαιρεμένο» χωρίς εγγραφή θα το ξανάφερνε η επόμενη δημοσίευση ισοϋψών.
 * ⛔ Χωρίς ανάγλυφο ⇒ 409: δεν υπάρχει δημοσίευση να αλλάξει (το περίγραμμα περιμένει το πρώτο ανάγλυφο, Π2).
 */
export async function amendOwnerPlotOutline(
  env: OwnerMaterialDoorEnv,
  amendment: PlotOutlineAmendment,
  terrainDoor: OwnerMaterialPublicationDoor<TerrainUpload>,
): Promise<PlotOutlineAmendmentResponse> {
  const state = await loadDossierTerrainState(env.adminDb, env.dossier);
  if (state === null) throw new ApiError(409, 'TERRAIN_PLOT_OUTLINE_NO_RELIEF');
  if (state.outline === null && amendment.kind === 'visibility') throw new ApiError(409, 'TERRAIN_PLOT_OUTLINE_NONE');

  const next = state.outline === null ? null : amendedPlotOutline(state.outline, amendment);
  const outline = next === null ? null : { showInListing: next.showInListing };
  if (carries(state.current, state.outline) && carries(state.current, next)) return { changed: false, outline, terrain: null };

  const published = await republishOwnerMaterial(env, terrainDoor, reliefUploadWith(state.current, next));
  return { changed: true, outline, terrain: terrainResponseOf(published) };
}
