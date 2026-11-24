import 'server-only';

/**
 * @fileoverview **ΤΙ ΚΡΑΤΑ Ο ΦΑΚΕΛΟΣ ΓΙΑ ΤΟ ΕΔΑΦΟΣ** — η τρέχουσα πηγή και το περίγραμμα που ισχύει (ADR-920 §14.11 Ζ3 · Ζ3c).
 * @related services/property-dossier/dossier-media.reader (το ΕΝΑ ερώτημα των έτοιμων αρχείων) ·
 *   services/listings/terrain-source-selection (ο ΕΝΑΣ επιλογέας της πηγής) · lib/terrain/plot-outline/plot-outline-confirmation
 * @module server/listing-terrain/dossier-terrain.reader
 *
 * 🔑 **ΚΑΝΕΝΑ ΝΕΟ ΕΡΩΤΗΜΑ**: ίδιο ερώτημα και δείκτης με τη σελίδα του φακέλου και τη βιτρίνα (`readDossierReadyFiles`)·
 * η ταυτότητα κρίνεται στη μνήμη. Το σχέδιο βρίσκεται από την **ταυτότητα** (`terrain/plot-drawing`), την οποία πελάτης δεν
 * γράφει ποτέ — όχι από κατηγορία ή όνομα, που θα έπιαναν και ένα τοπογραφικό ανεβασμένο με το χέρι.
 *
 * 🔴 **FAIL-CLOSED, ΠΟΤΕ «ΚΕΝΟ»**: αποτυχία ανάγνωσης ⇒ ονομασμένη άρνηση 503. Ένα σιωπηλό «δεν υπάρχει περίγραμμα» θα
 * δημοσίευε ισοϋψείς **χωρίς** το επιβεβαιωμένο όριο· ένα σιωπηλό «δεν υπάρχει ανάγλυφο» θα παρέκαμπτε τον έλεγχο Π6.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { ApiError } from '@/lib/api/ApiErrorHandler';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { normalizeToISO } from '@/lib/date-local';
import { getErrorMessage } from '@/lib/error-utils';
import { isInTrash } from '@/lib/files/file-trash-state';
import { isDeliverableListingFile } from '@/lib/listings/listing-file-deliverability';
import { TOPOGRAPHIC_DRAWING_IDENTITY } from '@/lib/listings/topographic-drawing-file-record';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import {
  plotOutlineChoiceOf,
  readConfirmedPlotOutline,
  type ConfirmedPlotOutline,
} from '@/lib/terrain/plot-outline/plot-outline-confirmation';
import { ringAreaM2 } from '@/lib/terrain/plot-outline/plot-outline-area';
import type { PlotDrawingPlace, PlotDrawingSummary, PlotOutlineStatus } from '@/lib/terrain/plot-outline/plot-outline-status';
import { judgeListingTerrainSource } from '@/lib/terrain/publication/listing-terrain-judge';
import type { ListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-types';
import {
  parseListingTerrainSource,
  plotOutlineChoiceIn,
  samePlotOutlineRing,
  withPlotOutline,
  type ListingTerrainSource,
  type PlotOutlineChoice,
} from '@/lib/terrain/publication/listing-terrain-source';
import {
  TERRAIN_DECLARATION_METADATA_KEY,
  decodeTerrainSurveyDeclaration,
  type TerrainSurveyDeclaration,
} from '@/lib/terrain/publication/terrain-survey-declaration';
import { fileRecordBucket } from '@/server/files/file-record-bucket';
import { compareAgencyMediaForPublication, type AgencyMediaCandidate } from '@/services/listings/agency-media-publication';
import { currentTerrainSourceRecord } from '@/services/listings/terrain-source-selection';
import { readDossierReadyFiles, type DossierReadyFile } from '@/services/property-dossier/dossier-media.reader';
import type { FileRecord } from '@/types/file-record';
import type { PropertyDossier } from '@/types/property-dossier';

const logger = createModuleLogger('DossierTerrainReader');

/** Ένα έτοιμο αρχείο του φακέλου όπως το διαβάζει η πόρτα — + το μετρημένο περίγραμμα, που κρίνεται πριν χρησιμοποιηθεί. */
type DossierTerrainFile = DossierReadyFile & Partial<Pick<FileRecord, 'plotOutline'>>;

/** Η τρέχουσα πηγή εδάφους του φακέλου, ήδη κριμένη — μαζί με τη δήλωση Δ2 που ταξίδεψε με τα bytes της. */
export interface CurrentDossierTerrainSource {
  /** Η εγγραφή της πηγής. */
  readonly fileId: string;
  readonly source: ListingTerrainSource;
  readonly declaration: TerrainSurveyDeclaration;
}

const UNREADABLE_OUTLINE = 'TERRAIN_PLOT_OUTLINE_UNREADABLE';
const UNREADABLE_SOURCE = 'TERRAIN_CURRENT_SOURCE_UNREADABLE';

async function readFilesOr(
  adminDb: AdminFirestore,
  dossier: Pick<PropertyDossier, 'id' | 'userId'>,
  code: string,
): Promise<readonly DossierTerrainFile[]> {
  try {
    return await readDossierReadyFiles(adminDb, dossier);
  } catch (error) {
    logger.error('Τα αρχεία του φακέλου δεν διαβάστηκαν', { dossierId: dossier.id, error: getErrorMessage(error) });
    throw new ApiError(503, code);
  }
}

/** Το νεότερο **ενεργό** σχέδιο του περιγράμματος — ο ίδιος συγκριτής με όλο το υλικό, ή `null`. */
function newestDrawing(files: readonly DossierTerrainFile[]): DossierTerrainFile | null {
  let winner: DossierTerrainFile | null = null;
  for (const file of files) {
    if (file.publicationIdentity !== TOPOGRAPHIC_DRAWING_IDENTITY) continue;
    if (!isDeliverableListingFile(file, ENTITY_TYPES.PROPERTY_DOSSIER)) continue;
    if (winner === null || compareAgencyMediaForPublication(winner, file) < 0) winner = file;
  }
  return winner;
}

/** Το σχέδιο → η επιβεβαίωσή του. Σχέδιο με πεδίο που **δεν** διαβάζεται ⇒ 503: η κηδεμονία λέει ότι υπάρχει, άρα η σιωπή θα ήταν ψέμα. */
function confirmedOutlineOfDrawing(drawing: DossierTerrainFile, dossierId: string): ConfirmedPlotOutline {
  const outline = readConfirmedPlotOutline(drawing.plotOutline);
  if (outline === null) {
    logger.error('Το σχέδιο του περιγράμματος δεν έχει αναγνώσιμη επιβεβαίωση', { dossierId, fileId: drawing.id });
    throw new ApiError(503, UNREADABLE_OUTLINE);
  }
  return outline;
}

/** Ποια εγγραφή κρατά την απόφαση που ισχύει για το περίγραμμα (Ζ3c). */
export type PlotOutlineAuthority<T> =
  | { readonly kind: 'drawing'; readonly record: T }
  | { readonly kind: 'relief'; readonly record: T };

/**
 * 🏆 **ADR-920 §14.11 Ζ3c — ΠΟΙΑ ΑΠΟΦΑΣΗ ΓΙΑ ΤΟ ΠΕΡΙΓΡΑΜΜΑ ΙΣΧΥΕΙ: Η ΝΕΟΤΕΡΗ.** Δύο εγγραφές κρατούν απόφαση —
 * το σχέδιο (η επιβεβαίωση) και η τρέχουσα πηγή εδάφους (ό,τι δημοσιεύεται) — και τις κρίνει ο **ίδιος** συγκριτής
 * που κρίνει όλο το υλικό (`createdAt`, ισοπαλία στο `id`).
 *
 * | Κατάσταση | Νικά | Γιατί |
 * |---|---|---|
 * | πηγή νεότερη από το σχέδιο (ή κανένα ενεργό σχέδιο) | **η πηγή** | copy semantics (Revit: η τοπογραφία μένει όταν φύγει το DWG)· και η ρητή αφαίρεση / αλλαγή Π9 (`PATCH`) γράφει νέα πηγή |
 * | σχέδιο νεότερο από την πηγή | **το σχέδιο** | επιβεβαίωση που δεν έφτασε στην πηγή (έπεσε η επαναδημοσίευση — το «ΣΧΕΔΙΟ ΠΡΩΤΑ») |
 * | μόνο σχέδιο | **το σχέδιο** | Π2: το περίγραμμα περιμένει το πρώτο ανάγλυφο |
 * | τίποτα | — | κανένα περίγραμμα |
 *
 * ⛔ Ο κάδος του σχεδίου **δεν** αφαιρεί το περίγραμμα — το σχέδιο απλώς παύει να διεκδικεί. Η αφαίρεση είναι ρητή πράξη.
 */
export function plotOutlineAuthorityOf<T extends AgencyMediaCandidate>(
  drawing: T | null,
  relief: T | null,
): PlotOutlineAuthority<T> | null {
  if (relief !== null && (drawing === null || compareAgencyMediaForPublication(drawing, relief) < 0)) {
    return { kind: 'relief', record: relief };
  }
  return drawing === null ? null : { kind: 'drawing', record: drawing };
}

/** Τα bytes της πηγής + η δήλωση Δ2 από το **ίδιο** αντικείμενο του κάδου της εγγραφής — ή ονομασμένη άρνηση 503. */
async function downloadDossierTerrainSource(
  record: DossierTerrainFile,
  dossierId: string,
): Promise<CurrentDossierTerrainSource> {
  try {
    const object = fileRecordBucket(record).file(record.storagePath);
    const [[meta], [raw]] = await Promise.all([object.getMetadata(), object.download()]);
    const declaration = decodeTerrainSurveyDeclaration(meta.metadata?.[TERRAIN_DECLARATION_METADATA_KEY]);
    const source = parseListingTerrainSource(JSON.parse(raw.toString('utf8')));
    if (declaration === null || source === null) throw new Error('declaration or source not readable');
    return { fileId: record.id, source, declaration };
  } catch (error) {
    logger.error('Η τρέχουσα πηγή εδάφους δεν διαβάστηκε', { dossierId, fileId: record.id, error: getErrorMessage(error) });
    throw new ApiError(503, UNREADABLE_SOURCE);
  }
}

/** Οι δύο διεκδικητές του φακέλου. */
interface DossierTerrainRecords {
  readonly drawing: DossierTerrainFile | null;
  readonly relief: DossierTerrainFile | null;
}

function terrainRecordsIn(files: readonly DossierTerrainFile[]): DossierTerrainRecords {
  return { drawing: newestDrawing(files), relief: currentTerrainSourceRecord(files, ENTITY_TYPES.PROPERTY_DOSSIER) };
}

/** Οι δύο διεκδικητές του φακέλου, από **ένα** ερώτημα. */
async function dossierTerrainRecords(
  adminDb: AdminFirestore,
  dossier: Pick<PropertyDossier, 'id' | 'userId'>,
  code: string,
): Promise<DossierTerrainRecords> {
  return terrainRecordsIn(await readFilesOr(adminDb, dossier, code));
}

/** Το περίγραμμα του νικητή — η πηγή διαβάζεται μόνο όταν νικά η ίδια. */
async function effectivePlotOutline(
  records: DossierTerrainRecords,
  dossierId: string,
  sourceOf: (relief: DossierTerrainFile) => Promise<CurrentDossierTerrainSource>,
): Promise<PlotOutlineChoice | null> {
  const authority = plotOutlineAuthorityOf(records.drawing, records.relief);
  if (authority === null) return null;
  if (authority.kind === 'relief') return plotOutlineChoiceIn((await sourceOf(authority.record)).source);
  return plotOutlineChoiceOf(confirmedOutlineOfDrawing(authority.record, dossierId));
}

/**
 * **Το περίγραμμα που ισχύει στον φάκελο** (Ζ3c) — ό,τι βάζει ο server σε ΚΑΘΕ δημοσίευση ισοϋψών, ή `null`.
 * Η πηγή κατεβαίνει **μόνο** όταν νικά (το σχέδιο είναι ήδη στην εγγραφή του).
 */
export async function loadDossierPlotOutline(
  adminDb: AdminFirestore,
  dossier: Pick<PropertyDossier, 'id' | 'userId'>,
): Promise<PlotOutlineChoice | null> {
  const records = await dossierTerrainRecords(adminDb, dossier, UNREADABLE_OUTLINE);
  return effectivePlotOutline(records, dossier.id, (relief) => downloadDossierTerrainSource(relief, dossier.id));
}

/** Ό,τι χρειάζεται μια αλλαγή περιγράμματος χωρίς νέο σχέδιο (Π9 · αφαίρεση): η πηγή που ξαναδημοσιεύεται + το ισχύον περίγραμμα. */
export interface DossierTerrainState {
  readonly current: CurrentDossierTerrainSource;
  readonly outline: PlotOutlineChoice | null;
}

/**
 * **Η τρέχουσα πηγή μαζί με το περίγραμμα που ισχύει** — ή `null` όταν δεν δημοσιεύτηκε ποτέ ανάγλυφο. Ένα ερώτημα, ένα
 * κατέβασμα, ο **ίδιος** κανόνας με το {@link loadDossierPlotOutline}.
 */
export async function loadDossierTerrainState(
  adminDb: AdminFirestore,
  dossier: Pick<PropertyDossier, 'id' | 'userId'>,
): Promise<DossierTerrainState | null> {
  const records = await dossierTerrainRecords(adminDb, dossier, UNREADABLE_SOURCE);
  if (records.relief === null) return null;
  const current = await downloadDossierTerrainSource(records.relief, dossier.id);
  return { current, outline: await effectivePlotOutline(records, dossier.id, async () => current) };
}

/**
 * **Η τρέχουσα πηγή εδάφους του φακέλου** (ο ΕΝΑΣ επιλογέας) — ή `null` όταν δεν δημοσιεύτηκε ποτέ ανάγλυφο. Τα bytes
 * διαβάζονται από τον **κάδο της εγγραφής**, και η δήλωση Δ2 από το **ίδιο** αντικείμενο: η επαναδημοσίευση τα κρατά ως έχουν.
 */
export async function loadCurrentDossierTerrainSource(
  adminDb: AdminFirestore,
  dossier: Pick<PropertyDossier, 'id' | 'userId'>,
): Promise<CurrentDossierTerrainSource | null> {
  const { relief } = await dossierTerrainRecords(adminDb, dossier, UNREADABLE_SOURCE);
  return relief === null ? null : downloadDossierTerrainSource(relief, dossier.id);
}

// ─── ADR-920 §14.11 Ζ5 — το ανάγλυφο όπως το βλέπει ο ΙΔΙΟΚΤΗΤΗΣ (`GET …/terrain?view=relief`) ─────────────────────────

/**
 * **Το στιγμιότυπο του ιδιοκτήτη**: η τρέχουσα πηγή με το περίγραμμα που **ισχύει** (Ζ3c — και όταν το κρατά ακόμη μόνο το
 * σχέδιο), κριμένη από τον **ΕΝΑ** κριτή με κοινό `'owner'` ⇒ το περίγραμμα φαίνεται **ό,τι κι αν λέει** το Π9. `null` όταν
 * δεν δημοσιεύτηκε ποτέ ανάγλυφο.
 *
 * ⛔ **Δεν δημοσιεύει τίποτα**: δεν γράφει ράφι, δεν αγγίζει την αγγελία — το δημόσιο στιγμιότυπο το ψήνει μόνο ο ψήστης,
 * με κοινό `'public'` (CHECK 3.105). Εδώ χτίζεται ανά αίτημα και φεύγει μόνο προς τον άνθρωπο που πέρασε τον φρουρό.
 * 🔴 Fail-closed: πηγή που ο κριτής αρνείται ⇒ 503 με όνομα, ποτέ «κανένα ανάγλυφο».
 */
export async function loadDossierOwnerReliefSnapshot(
  adminDb: AdminFirestore,
  dossier: Pick<PropertyDossier, 'id' | 'userId'>,
): Promise<ListingTerrainSnapshot | null> {
  const state = await loadDossierTerrainState(adminDb, dossier);
  if (state === null) return null;
  const verdict = judgeListingTerrainSource(withPlotOutline(state.current.source, state.outline));
  if (!verdict.ok) {
    logger.error('Το ανάγλυφο του ιδιοκτήτη δεν χτίστηκε', { dossierId: dossier.id, fileId: state.current.fileId, code: verdict.code });
    throw new ApiError(503, UNREADABLE_SOURCE);
  }
  return verdict.snapshot;
}

// ─── ADR-920 §14.11 Ζ4 — η κατάσταση που βλέπει ο ιδιοκτήτης (`GET …/terrain`) ─────────────────────────────────────────

/** Πού είναι ένα σχέδιο: ενεργό, στον κάδο (επαναφέρεται) — ή τίποτα από τα δύο (αρχειοθετημένο από διάδοχο · εκκαθαρισμένο). */
function drawingPlaceOf(file: DossierTerrainFile): PlotDrawingPlace | null {
  if (isDeliverableListingFile(file, ENTITY_TYPES.PROPERTY_DOSSIER)) return 'active';
  return isInTrash({ lifecycleState: file.lifecycleState, isDeleted: file.isDeleted }) ? 'trash' : null;
}

/** Το σχέδιο που αναφέρεται: το νεότερο **ενεργό** (αυτό διεκδικεί)· αλλιώς το νεότερο **στον κάδο** (το Figma «Restore»). */
function reportedDrawing(files: readonly DossierTerrainFile[], active: DossierTerrainFile | null): DossierTerrainFile | null {
  if (active !== null) return active;
  let winner: DossierTerrainFile | null = null;
  for (const file of files) {
    if (file.publicationIdentity !== TOPOGRAPHIC_DRAWING_IDENTITY || drawingPlaceOf(file) !== 'trash') continue;
    if (winner === null || compareAgencyMediaForPublication(winner, file) < 0) winner = file;
  }
  return winner;
}

function drawingSummaryOf(file: DossierTerrainFile, dossierId: string, inForce: PlotOutlineChoice | null): PlotDrawingSummary {
  const confirmed = confirmedOutlineOfDrawing(file, dossierId);
  return {
    fileId: file.id,
    fileName: file.displayName?.trim() || file.originalFilename,
    createdAt: normalizeToISO(file.createdAt),
    place: drawingPlaceOf(file) ?? 'trash',
    candidateId: confirmed.candidateId,
    origin: confirmed.origin,
    drawingUnit: confirmed.drawingUnit,
    drawingSha256: confirmed.drawingSha256,
    areaM2: confirmed.areaM2,
    isOutlineSource: inForce !== null && samePlotOutlineRing(confirmed.ring, inForce.ringWorldMm),
  };
}

/**
 * **Τι ξέρει ο φάκελος για το περίγραμμα, όπως το δείχνει η καρτέλα «Τοπογραφικό»** (Ζ4). Ένα ερώτημα, ο **ίδιος** κανόνας
 * «νικά η νεότερη απόφαση» με τη δημοσίευση (η πηγή κατεβαίνει μόνο αν νικά) — ο browser δεν τον ξαναϋπολογίζει ποτέ.
 * Fail-closed όπως όλος ο αναγνώστης: ό,τι δεν διαβάζεται ⇒ 503 με όνομα, ποτέ «κανένα περίγραμμα».
 */
export async function loadDossierPlotOutlineStatus(
  adminDb: AdminFirestore,
  dossier: Pick<PropertyDossier, 'id' | 'userId'>,
): Promise<PlotOutlineStatus> {
  const files = await readFilesOr(adminDb, dossier, UNREADABLE_OUTLINE);
  const records = terrainRecordsIn(files);
  const authority = plotOutlineAuthorityOf(records.drawing, records.relief);
  const inForce = await effectivePlotOutline(records, dossier.id, (relief) => downloadDossierTerrainSource(relief, dossier.id));
  const drawing = reportedDrawing(files, records.drawing);

  return {
    hasRelief: records.relief !== null,
    outline: inForce === null || authority === null ? null : {
      showInListing: inForce.showInListing,
      areaM2: ringAreaM2(inForce.ringWorldMm),
      authority: authority.kind,
    },
    drawing: drawing === null ? null : drawingSummaryOf(drawing, dossier.id, inForce),
  };
}
