import 'server-only';

/**
 * @fileoverview ⛰️ **Ό,ΤΙ ΕΙΝΑΙ ΤΟΥ ΕΔΑΦΟΥΣ ΣΕ ΚΑΘΕ ΠΟΡΤΑ ΔΗΜΟΣΙΕΥΣΗΣ** — ένας αναγνώστης αιτήματος, ένα σώμα απάντησης (ADR-920 Β4.3).
 * @related app/api/properties/[id]/terrain/route (το γραφείο) · app/api/owner-properties/[ownerPropertyId]/terrain/route
 *   (ο ιδιοκτήτης) · server/listing-material/publish-listing-material (ο κινητήρας)
 * @module server/listing-terrain/terrain-upload.server
 *
 * ```
 * πελάτης: σημεία + όριο + αποτύπωμα (JSON) + δήλωση Δ2
 *   → εδώ: αρχείο · δήλωση · «είναι γη;» · ο ΕΝΑΣ κριτής (ξηρή εκτέλεση) · κανονική πηγή
 *   → πόρτα: κηδεμονία · γέννηση εγγραφής · ιστορικό     → κινητήρας: εγγραφή · διαδοχή · επαναπροβολή
 * ```
 *
 * 🔴 **Ο ΔΙΑΚΟΜΙΣΤΗΣ ΔΕΝ ΕΜΠΙΣΤΕΥΕΤΑΙ ΚΑΝΕΝΑ ΠΑΡΑΓΩΓΟ ΤΟΥ ΠΕΛΑΤΗ.** Ο πελάτης στέλνει **μετρήσεις**· το
 * στιγμιότυπο το χτίζει ο **ΕΝΑΣ** `judgeListingTerrainSource` (ADR-920 §13.3), ο ίδιος που δείχνει η
 * προεπισκόπηση. Ό,τι δεν θα μπορούσε ποτέ να δημοσιευτεί αρνείται **με όνομα τώρα**, όσο ο άνθρωπος είναι παρών.
 *
 * 🔑 **ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΗΝ ΠΟΡΤΑ**: η ανάγνωση και η απάντηση είναι **ίδιες** για το γραφείο και τον ιδιοκτήτη· δύο
 * αντίγραφα θα σήμαιναν ότι ένα όριο ή ένας κωδικός διορθώνεται στη μία πόρτα και όχι στην άλλη. Εδώ **δεν** ζουν:
 * ο φρουρός κηδεμονίας (CHECK 3.100: κυριολεκτικό `intent` στο `route.ts`), η **γέννηση** της εγγραφής (CHECK 3.105
 * Κ2: μόνο σε πόρτα με επαναπροβολή) και το ιστορικό (άλλο βιβλίο ανά κηδεμονία).
 *
 * 🔑 **Αποθηκεύεται η ΚΑΝΟΝΙΚΗ πηγή, ιδιωτικά** — ποτέ η ωμή συμβολοσειρά του πελάτη (Δ2). Η δήλωση ταξιδεύει ως
 * custom metadata στο **ίδιο** `save()` με τα bytes.
 */

import { ApiError } from '@/lib/api/ApiErrorHandler';
import { FILE_CATEGORIES } from '@/config/domain-constants';
import { isLandProperty } from '@/constants/property-classification';
import { judgeListingTerrainSource } from '@/lib/terrain/publication/listing-terrain-judge';
import {
  NO_TERRAIN_GEOREFERENCE_CHOICE,
  encodeListingTerrainSource,
  parseListingTerrainSource,
  withGeoreferenceChoice,
  withPlotOutline,
  type ListingTerrainSource,
  type PlotOutlineChoice,
  type TerrainGeoreferenceChoice,
} from '@/lib/terrain/publication/listing-terrain-source';
import { LISTING_TERRAIN_SOURCE_MAX_BYTES } from '@/lib/terrain/publication/listing-terrain-config';
import type { ListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-types';
import {
  TERRAIN_DECLARATION_METADATA_KEY,
  encodeTerrainSurveyDeclaration,
  judgeTerrainSurveyDeclaration,
  type TerrainSurveyDeclaration,
} from '@/lib/terrain/publication/terrain-survey-declaration';
import {
  TERRAIN_SOURCE_CONTENT_TYPE,
  TERRAIN_UPLOAD_FIELDS,
} from '@/lib/terrain/publication/terrain-publication-contract';
import type { BuildPendingFileRecordResult } from '@/services/file-record';
import type { ListingMediaRefreshOutcome } from '@/services/listings/listing-media-refresh';
import { readSceneFileIds } from '@/server/listing-material/material-source-lookup';
import type {
  ListingMaterialDoor,
  ListingMaterialPublication,
  ListingMaterialVerdict,
} from '@/server/listing-material/publish-listing-material';

/**
 * Οι κωδικοί της πόρτας για δικαίωμα, δοχείο και ανέβασμα — **ίδιοι** σε κάθε κηδεμονία, όπως και τα μηνύματά τους.
 * Το `noDossier` το στέλνει μόνο ο ιδιοκτήτης: η αγγελία του δεν έχει φάκελο όπου να ζήσει η πηγή.
 */
export const TERRAIN_DOOR_CODES = {
  notCapable: 'TERRAIN_PUBLICATION_NOT_CAPABLE',
  noDossier: 'TERRAIN_NO_DOSSIER',
  uploadFailed: 'TERRAIN_UPLOAD_FAILED',
} as const;

/** Τι έστειλε ο άνθρωπος — κριμένο, κανονικοποιημένο, και **ήδη** αποδεδειγμένα δημοσιεύσιμο. */
export interface TerrainUpload {
  readonly file: File;
  readonly declaration: TerrainSurveyDeclaration;
  /** Προέλευση από σκηνή (πόρτα του viewer, Β5)· το υποκείμενο του ιδιοκτήτη δεν έχει σχέδια και την αγνοεί. */
  readonly sceneFileIds: readonly string[];
  readonly snapshot: ListingTerrainSnapshot;
}

/** Ό,τι διαβάζει ο αγοραστής με μια ματιά — ο πελάτης το δείχνει ως επιβεβαίωση, από την αλήθεια του server. */
export interface TerrainPublicationResponse {
  readonly fileId: string;
  readonly supersedes: readonly string[];
  readonly archived: readonly string[];
  readonly listing: ListingMediaRefreshOutcome;
  readonly terrain: {
    readonly stats: ListingTerrainSnapshot['stats'];
    readonly contourIntervalM: number;
    readonly envelopeOmission: ListingTerrainSnapshot['envelopeOmission'];
    /** ADR-920 §14.11 — το περίγραμμα όπως το βλέπει ο ιδιοκτήτης (κάλυψη Π6), ή γιατί λείπει· `null` + `null` = κανένα. */
    readonly plotOutline: Omit<NonNullable<ListingTerrainSnapshot['plotOutline']>, 'ring'> | null;
    readonly plotOutlineOmission: ListingTerrainSnapshot['plotOutlineOmission'];
    /**
     * ADR-920 §14.12 φάση Α — έχει το ανάγλυφο θέση (όπως το βλέπει ο ιδιοκτήτης), ή γιατί όχι. **Ποτέ** οι συντεταγμένες:
     * η απάντηση μιας δημοσίευσης δεν είναι δρόμος για τη θέση.
     */
    readonly georeferenced: boolean;
    readonly georeferenceOmission: ListingTerrainSnapshot['georeferenceOmission'];
  };
}

/** Η δημοσίευση όσο τη χρειάζονται η απάντηση και το ημερολόγιο — ανεξάρτητα από το πώς λέγεται το ακίνητο. */
type PublishedTerrain = Pick<
  ListingMaterialPublication<TerrainUpload, unknown>,
  'fileId' | 'supersedes' | 'archived' | 'listing' | 'parsed' | 'bytes' | 'sourceRevisions'
>;

/** Το αρχείο της πηγής: παρόν, JSON, μη κενό, κάτω από το ταβάνι — αλλιώς άρνηση με όνομα. */
function readSourceFile(formData: FormData): File {
  const file = formData.get(TERRAIN_UPLOAD_FIELDS.source);
  if (!(file instanceof File)) throw new ApiError(400, 'TERRAIN_SOURCE_REQUIRED');
  if (file.type !== TERRAIN_SOURCE_CONTENT_TYPE) throw new ApiError(415, 'TERRAIN_TYPE_UNSUPPORTED');
  if (file.size === 0) throw new ApiError(400, 'TERRAIN_SOURCE_EMPTY');
  if (file.size > LISTING_TERRAIN_SOURCE_MAX_BYTES) throw new ApiError(413, 'TERRAIN_SOURCE_TOO_LARGE');
  return file;
}

/** Η κατάσταση HTTP κάθε άρνησης της δήλωσης: σχήμα ⇒ 400, ημερολόγιο ⇒ 422. */
const DECLARATION_REFUSAL_STATUS = { TERRAIN_DECLARATION_INVALID: 400, TERRAIN_SURVEY_DATE_IN_FUTURE: 422 } as const;

/** Η δήλωση Δ2 από τον ΙΔΙΟ κριτή με τη φόρμα του ιδιοκτήτη (ADR-920 Β4.7): πλήρης, και όχι στο μέλλον. */
function readDeclaration(formData: FormData): TerrainSurveyDeclaration {
  const verdict = judgeTerrainSurveyDeclaration(formData.get(TERRAIN_UPLOAD_FIELDS.declaration), new Date());
  if (!verdict.ok) throw new ApiError(DECLARATION_REFUSAL_STATUS[verdict.code], verdict.code);
  return verdict.declaration;
}

/** Τα bytes → κανονική πηγή, ή `TERRAIN_SOURCE_MALFORMED` (το ίδιο σχήμα με τον κοινό κριτή). */
async function readSource(file: File): Promise<ListingTerrainSource> {
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
 * 🔴 **ADR-920 §14.11 Π2 — ΤΟ ΠΕΡΙΓΡΑΜΜΑ ΤΟ ΒΑΖΕΙ Ο SERVER, ΠΑΝΤΑ.** Ό,τι περίγραμμα έστειλε ο browser μέσα στην πηγή
 * **αντικαθίσταται** από το περίγραμμα που **ισχύει** στον φάκελο (ή αφαιρείται, `null`): περίγραμμα που φτάνει μαζί με
 * ισοϋψείς δεν είναι επιβεβαίωση. Ζ3c: «ισχύει» = η νεότερη απόφαση (πηγή ή σχέδιο) — νέο ανάγλυφο **μεταφέρει** το
 * περίγραμμα του προηγούμενου, ακόμη κι αν το σχέδιο πήγε στον κάδο. Ο ΕΝΑΣ γραφέας (`withPlotOutline`)· επιβεβαιωμένο που δεν χωρά πια στο συμβόλαιο ⇒ 503, ποτέ σιωπή.
 */
function withConfirmedOutline(source: ListingTerrainSource, confirmed: PlotOutlineChoice | null): ListingTerrainSource {
  const composed = withPlotOutline(source, confirmed);
  if (composed === null) throw new ApiError(503, 'TERRAIN_PLOT_OUTLINE_UNREADABLE');
  return composed;
}

/**
 * 🔴 **ADR-920 §14.12 φάση Α — ΤΗ ΔΗΛΩΣΗ ΣΥΣΤΗΜΑΤΟΣ ΚΑΙ ΤΗ ΣΥΓΚΑΤΑΘΕΣΗ ΘΕΣΗΣ ΤΙΣ ΒΑΖΕΙ Ο SERVER, ΠΑΝΤΑ.** Ό,τι έστειλε ο browser
 * σε αυτά τα δύο πεδία **αντικαθίσταται** από ό,τι ισχύει στην κηδεμονία: ένα ανέβασμα σημείων δεν είναι δήλωση του
 * ιδιοκτήτη. Οι ΔΥΟ γραφείς (`withGeoreferenceChoice`)· ό,τι δεν χωρά στο συμβόλαιο ⇒ 503, ποτέ σιωπή.
 */
function withCarriedGeoreference(source: ListingTerrainSource, choice: TerrainGeoreferenceChoice): ListingTerrainSource {
  const composed = withGeoreferenceChoice(source, choice);
  if (composed === null) throw new ApiError(503, 'TERRAIN_CURRENT_SOURCE_UNREADABLE');
  return composed;
}

/**
 * **Η πηγή → ό,τι ανεβαίνει**: ο ΕΝΑΣ κριτής (ίδιος με την προεπισκόπηση) και η κανονική σειριοποίηση. Τον καλούν η
 * δημοσίευση ισοϋψών **και** η επαναδημοσίευση μετά από επιβεβαίωση περιγράμματος (Ζ3) — μία κρίση, όχι δύο.
 */
export function terrainUploadOfSource(params: {
  readonly source: ListingTerrainSource;
  readonly declaration: TerrainSurveyDeclaration;
  readonly fileName: string;
  readonly sceneFileIds: readonly string[];
}): TerrainUpload {
  // ADR-920 §13.3 — σχήμα ⇒ 400, επιφάνεια ⇒ 422 με το δικό της όνομα.
  const verdict = judgeListingTerrainSource(params.source);
  if (!verdict.ok) throw new ApiError(verdict.code === 'TERRAIN_SOURCE_MALFORMED' ? 400 : 422, verdict.code);
  const file = new File([encodeListingTerrainSource(verdict.source)], params.fileName || 'terrain-source.json', {
    type: TERRAIN_SOURCE_CONTENT_TYPE,
  });
  return { file, declaration: params.declaration, sceneFileIds: params.sceneFileIds, snapshot: verdict.snapshot };
}

/**
 * **Ό,τι κληρονομεί ένα νέο ανάγλυφο από την κηδεμονία του** — διαβασμένο **μία** φορά, πριν κριθούν τα νέα σημεία.
 *
 * 🗺️ `outline`: το περίγραμμα που ισχύει (ADR-920 §14.11 Ζ3 · Ζ3c) — `null` = κανένα.
 * 📍 `georeferenceFor`: η δήλωση συστήματος + η συγκατάθεση θέσης που ισχύουν για τα **νέα** σημεία (§14.12 φάση Α). Είναι
 *    συνάρτηση επειδή η δήλωση **ξανακρίνεται** πάνω σε ό,τι ανέβηκε· είναι **σύγχρονη** επειδή ό,τι χρειάζεται από τον
 *    φάκελο έχει ήδη διαβαστεί — καμία δεύτερη ανάγνωση.
 */
export interface TerrainInheritance {
  readonly outline: PlotOutlineChoice | null;
  readonly georeferenceFor: (incoming: ListingTerrainSource) => TerrainGeoreferenceChoice;
}

/** Κηδεμονία χωρίς φάκελο (το γραφείο): κανένα περίγραμμα, καμία δήλωση, καμία συγκατάθεση — **ρητά**. */
export const NO_TERRAIN_INHERITANCE: TerrainInheritance = {
  outline: null,
  georeferenceFor: () => NO_TERRAIN_GEOREFERENCE_CHOICE,
};

/**
 * **Τι έστειλε ο άνθρωπος** — με τη σειρά «φθηνό πρώτα»: δήλωση και είδος ακινήτου πριν διαβαστούν
 * megabytes, το στιγμιότυπο τελευταίο.
 *
 * @param propertyType το είδος του ακινήτου **όπως το διάβασε ο φρουρός κηδεμονίας** — ποτέ από τον πελάτη.
 * @param inherited ό,τι κληρονομεί το νέο ανάγλυφο **από την πόρτα** — ρωτιέται **μία** φορά, αφού περάσουν τα φθηνά.
 */
export async function readTerrainUpload(
  formData: FormData,
  propertyType: unknown,
  inherited: () => Promise<TerrainInheritance>,
): Promise<TerrainUpload> {
  const file = readSourceFile(formData);
  const declaration = readDeclaration(formData);
  // Δ1: μόνο οικόπεδο / αγροτεμάχιο — ο ισχυρός κριτής, που λύνει και τις ελληνικές ετικέτες.
  if (!isLandProperty(propertyType)) throw new ApiError(422, 'TERRAIN_NOT_LAND');

  const incoming = await readSource(file);
  const { outline, georeferenceFor } = await inherited();
  const outlined = withConfirmedOutline(incoming, outline);
  const source = withCarriedGeoreference(outlined, georeferenceFor(outlined));
  return terrainUploadOfSource({
    source,
    declaration,
    fileName: file.name,
    sceneFileIds: readSceneFileIds(formData.get(TERRAIN_UPLOAD_FIELDS.sceneFileIds)),
  });
}

/** Ό,τι λέει **η πόρτα** — κηδεμονία, γέννηση, ιστορικό. Όλα τα υπόλοιπα του εδάφους τα δίνει το {@link terrainMaterialDoor}. */
interface TerrainDoorParts<TEnv, TBirth> {
  /** Το είδος του ακινήτου από το έγγραφο που ήδη διάβασε ο φρουρός κηδεμονίας. */
  readonly propertyTypeOf: (env: TEnv) => unknown;
  /**
   * 🗺️📍 Ό,τι κληρονομεί το νέο ανάγλυφο σε αυτή την κηδεμονία ({@link TerrainInheritance}): ο φάκελος του ιδιοκτήτη το
   * διαβάζει με **ένα** ερώτημα και **ένα** κατέβασμα· το γραφείο (χωρίς φάκελο, χωρίς κάρτα ιδιοκτήτη) απαντά
   * `NO_TERRAIN_INHERITANCE`. ⚠️ Χωρίς προεπιλογή: κάθε πόρτα δηλώνει τι ισχύει γι' αυτήν.
   */
  readonly inheritedOf: (env: TEnv) => Promise<TerrainInheritance>;
  /** 🔒 Η γέννηση: `buildPublishedTerrainFileRecord`, γραμμένο **στην πόρτα** (CHECK 3.105 Κ2). */
  readonly recordOf: (birth: TBirth) => BuildPendingFileRecordResult;
  /** Το ίχνος στο ιστορικό του ακινήτου. ⚠️ Δεν επιτρέπεται να ρίξει τη δημοσίευση. */
  readonly recordPublished: (verdict: ListingMaterialVerdict, env: TEnv) => void;
}

/** 🏆 **Η πόρτα του εδάφους για τον κινητήρα** — ό,τι είναι του εδάφους, μία φορά, για κάθε κηδεμονία. */
export function terrainMaterialDoor<TEnv, TBirth>(
  parts: TerrainDoorParts<TEnv, TBirth>,
): ListingMaterialDoor<TerrainUpload, undefined, TEnv, TBirth> {
  return {
    category: FILE_CATEGORIES.DRAWINGS,
    codes: { uploadFailed: TERRAIN_DOOR_CODES.uploadFailed },
    read: (formData, env) => readTerrainUpload(formData, parts.propertyTypeOf(env), () => parts.inheritedOf(env)),
    fileOf: (upload) => upload.file,
    sceneFileIdsOf: (upload) => upload.sceneFileIds,
    recordOf: (_upload, birth) => parts.recordOf(birth),
    // 🏆 Η «ΜΙΑ ΕΓΓΡΑΦΗ»: η δήλωση Δ2 στην κανονική μορφή του ενός γραφέα, ποτέ η ωμή του πελάτη.
    customMetadataOf: (upload) => ({
      [TERRAIN_DECLARATION_METADATA_KEY]: encodeTerrainSurveyDeclaration(upload.declaration),
    }),
    afterSuccession: async (_upload, verdict, env) => {
      parts.recordPublished(verdict, env);
      return undefined;
    },
  };
}

/** Το σώμα της απάντησης — τα `stats` του **server**, ποτέ του πελάτη. */
export function terrainResponseOf(published: PublishedTerrain): TerrainPublicationResponse {
  const { fileId, supersedes, archived, listing } = published;
  const { snapshot } = published.parsed;
  return {
    fileId,
    supersedes,
    archived,
    listing,
    terrain: {
      stats: snapshot.stats,
      contourIntervalM: snapshot.contourIntervalM,
      envelopeOmission: snapshot.envelopeOmission,
      plotOutline: plotOutlineFactsOf(snapshot.plotOutline),
      plotOutlineOmission: snapshot.plotOutlineOmission,
      georeferenced: snapshot.georeference !== null,
      georeferenceOmission: snapshot.georeferenceOmission,
    },
  };
}

/** Το περίγραμμα χωρίς τον δακτύλιο — ο πελάτης έχει ήδη το σχήμα· χρειάζεται μόνο ό,τι μέτρησε ο server. */
function plotOutlineFactsOf(
  outline: ListingTerrainSnapshot['plotOutline'],
): TerrainPublicationResponse['terrain']['plotOutline'] {
  if (outline === null) return null;
  return { areaM2: outline.areaM2, coverage: outline.coverage, coveredFraction: outline.coveredFraction };
}

/** Τα γεγονότα της δημοσίευσης για το ημερολόγιο — η πόρτα προσθέτει μόνο τα δικά της ταυτοποιητικά. */
export function terrainPublishedFacts(published: PublishedTerrain): Record<string, unknown> {
  return {
    fileId: published.fileId,
    bytes: published.bytes,
    triangles: published.parsed.snapshot.mesh.slopeClass.length,
    supersedes: published.supersedes.length,
    archived: published.archived.length,
    sources: published.sourceRevisions.length,
    listing: published.listing,
  };
}
