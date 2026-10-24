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
import { encodeListingTerrainSource } from '@/lib/terrain/publication/listing-terrain-source';
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

/** Η δήλωση Δ2: υπάρχει, είναι πλήρης, και η ημερομηνία της δεν είναι στο μέλλον. */
function readDeclaration(formData: FormData): TerrainSurveyDeclaration {
  const raw = formData.get(TERRAIN_UPLOAD_FIELDS.declaration);
  const declaration = decodeTerrainSurveyDeclaration(typeof raw === 'string' ? raw : null);
  if (declaration === null) throw new ApiError(400, 'TERRAIN_DECLARATION_INVALID');
  if (isSurveyDateInFuture(declaration, new Date())) throw new ApiError(422, 'TERRAIN_SURVEY_DATE_IN_FUTURE');
  return declaration;
}

/** Τα bytes → JSON, ή `TERRAIN_SOURCE_MALFORMED`. Το σχήμα το κρίνει ο κοινός κριτής. */
async function readSourceJson(file: File): Promise<unknown> {
  try {
    return JSON.parse(await file.text());
  } catch {
    throw new ApiError(400, 'TERRAIN_SOURCE_MALFORMED');
  }
}

/**
 * **Τι έστειλε ο άνθρωπος** — με τη σειρά «φθηνό πρώτα»: δήλωση και είδος ακινήτου πριν διαβαστούν
 * megabytes, το στιγμιότυπο τελευταίο.
 *
 * @param propertyType το είδος του ακινήτου **όπως το διάβασε ο φρουρός κηδεμονίας** — ποτέ από τον πελάτη.
 */
export async function readTerrainUpload(formData: FormData, propertyType: unknown): Promise<TerrainUpload> {
  const file = readSourceFile(formData);
  const declaration = readDeclaration(formData);
  // Δ1: μόνο οικόπεδο / αγροτεμάχιο — ο ισχυρός κριτής, που λύνει και τις ελληνικές ετικέτες.
  if (!isLandProperty(propertyType)) throw new ApiError(422, 'TERRAIN_NOT_LAND');

  // ADR-920 §13.3 — ο ΕΝΑΣ κριτής (ίδιος με την προεπισκόπηση): σχήμα ⇒ 400, επιφάνεια ⇒ 422 με το δικό της όνομα.
  const verdict = judgeListingTerrainSource(await readSourceJson(file));
  if (!verdict.ok) throw new ApiError(verdict.code === 'TERRAIN_SOURCE_MALFORMED' ? 400 : 422, verdict.code);
  const { source, snapshot } = verdict;

  const canonical = new File([encodeListingTerrainSource(source)], file.name || 'terrain-source.json', {
    type: TERRAIN_SOURCE_CONTENT_TYPE,
  });
  return {
    file: canonical,
    declaration,
    sceneFileIds: readSceneFileIds(formData.get(TERRAIN_UPLOAD_FIELDS.sceneFileIds)),
    snapshot,
  };
}

/** Ό,τι λέει **η πόρτα** — κηδεμονία, γέννηση, ιστορικό. Όλα τα υπόλοιπα του εδάφους τα δίνει το {@link terrainMaterialDoor}. */
interface TerrainDoorParts<TEnv, TBirth> {
  /** Το είδος του ακινήτου από το έγγραφο που ήδη διάβασε ο φρουρός κηδεμονίας. */
  readonly propertyTypeOf: (env: TEnv) => unknown;
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
    read: (formData, env) => readTerrainUpload(formData, parts.propertyTypeOf(env)),
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
    terrain: { stats: snapshot.stats, contourIntervalM: snapshot.contourIntervalM, envelopeOmission: snapshot.envelopeOmission },
  };
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
