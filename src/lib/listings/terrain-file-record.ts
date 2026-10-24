/**
 * @fileoverview **ΤΙ ΕΓΓΡΑΦΟ `files` ΓΕΝΝΑ Η ΔΗΜΟΣΙΕΥΣΗ ΤΟΠΟΓΡΑΦΙΚΟΥ ΣΕ ΑΓΓΕΛΙΑ** — μία απάντηση (ADR-920 Β3).
 * @related lib/listings/floorplan-file-record · lib/listings/model-file-record (οι αδελφοί) ·
 *   app/api/properties/[id]/terrain/route (η πόρτα)
 * @module lib/listings/terrain-file-record
 *
 * 🔴 **ΑΔΕΛΦΟΣ, ΟΧΙ ΠΑΡΑΜΕΤΡΟΣ** των άλλων δύο: άλλη πόρτα = δικός της κατασκευαστής (ADR-909 Β1).
 *
 * 🔑 **Το έγγραφο είναι η ΙΔΙΩΤΙΚΗ ΠΗΓΗ, όχι το δημόσιο παράγωγο** (ADR-920 Δ2 · μοτίβο ADR-845):
 * τα bytes είναι η κανονική πηγή (`encodeListingTerrainSource`) και δεν φεύγουν ποτέ ωμά. Το δημόσιο
 * ράφι (Β3β) **ψήνει** από αυτά το `ListingTerrainSnapshot` — όπως ο ψήστης των μοντέλων ψήνει το GLB.
 * Το `classification: 'public'` λέει *«ο άνθρωπος εξουσιοδότησε δημοσίευση»* (η δήλωση Δ2 είναι η πράξη)·
 * το *τι* φεύγει το αποφασίζει ο ψήστης, ποτέ το έγγραφο.
 *
 * 🔑 **`DRAWINGS`, όχι νέα κατηγορία**: το τοπογραφικό **είναι** παραδοτέο τεχνικό σχέδιο, με την ίδια
 * διάρκεια διατήρησης (90 ημέρες κάδος · 10 χρόνια αρχείο). Η κατηγορία `DRAWINGS` **δεν** είναι στις
 * `PUBLISHABLE_CATEGORIES` του `agency-media.reader` ⇒ η πηγή δεν μπορεί να βγει από τη διαδρομή των
 * φωτογραφιών. Ο αναγνώστης του εδάφους τη βρίσκει από την **ταυτότητα**, όχι από την κατηγορία.
 *
 * ⛔ **ΜΗΝ το κάνεις παράμετρο «για ευελιξία»** — ένα ανέβασμα τοπογραφικού χωρίς πρόθεση δημοσίευσης
 * θα ήταν άλλη πόρτα (ο διαχειριστής αρχείων), χωρίς ταυτότητα.
 *
 * 🔑 **ΔΥΟ ΣΠΙΤΙΑ, ΕΝΑ ΕΓΓΡΑΦΟ** *(ADR-920 Β4.3)*: το εταιρικό ακίνητο κρατά την πηγή στα αρχεία της εταιρείας
 * (`PROPERTY`/`propertyId`), το ακίνητο του ιδιοκτήτη στον **φάκελό** του (`PROPERTY_DOSSIER`/`dossierId`, `files_personal`,
 * ADR-866). Ο τύπος {@link TerrainSourceHome} **ζευγαρώνει** κάτοχο και δοχείο: εταιρεία με φάκελο ή άνθρωπος με εταιρικό
 * ακίνητο δεν μεταγλωττίζονται. Τα υπόλοιπα πεδία είναι **ίδια** — άρα και η ταυτότητα, η κατηγορία και η διαδοχή.
 */

import {
  ENTITY_TYPES,
  FILE_CATEGORIES,
  FILE_CLASSIFICATIONS,
  FILE_DOMAINS,
} from '@/config/domain-constants';
import {
  buildPendingFileRecordData,
  type BuildPendingFileRecordResult,
} from '@/services/file-record';
import { TERRAIN_SOURCE_CONTENT_TYPE } from '@/lib/terrain/publication/terrain-publication-contract';
import type { ModelSourceRevision } from './model-source-revisions';

/** Η επέκταση της κανονικής διαδρομής — **χωρίς τελεία**. */
const TERRAIN_FILE_EXT = 'json';

/**
 * **Η ταυτότητα του δημοσιευμένου εδάφους** — ΕΝΑ ανά ακίνητο: νέα δημοσίευση **διαδέχεται** την
 * προηγούμενη (ISO 19650 superseded, ποτέ σβήσιμο). Πρόθεμα είδους `terrain`, αδελφό των `model` /
 * `floorplan`, ώστε τα είδη να μη συγκρουστούν ποτέ. ⛔ Ποτέ όνομα αρχείου ή ανθρώπου μέσα (ADR-769).
 */
export const TERRAIN_PUBLICATION_IDENTITY = 'terrain/measured';

/**
 * **Πού ζει η πηγή** — κάτοχος **και** δοχείο, ζευγαρωμένα από τον τύπο.
 * ⚠️ Το διακρίνει το **κλειδί** του κατόχου (`companyId` | `userId`), όπως το `FileCustody` (ADR-866 §5.2).
 */
export type TerrainSourceHome =
  | { readonly companyId: string; readonly propertyId: string }
  | { readonly userId: string; readonly dossierId: string };

/** Κάτοχος + δοχείο της εγγραφής — η **μία** αντιστοίχιση σπιτιού → πεδία. */
function fileCoordinatesOf(home: TerrainSourceHome) {
  return 'userId' in home
    ? { userId: home.userId, entityType: ENTITY_TYPES.PROPERTY_DOSSIER, entityId: home.dossierId }
    : { companyId: home.companyId, entityType: ENTITY_TYPES.PROPERTY, entityId: home.propertyId };
}

/** Ό,τι ξέρει η πόρτα τη στιγμή που γεννά το έγγραφο — και ούτε πεδίο παραπάνω. */
export interface PublishedTerrainFileRequest {
  readonly home: TerrainSourceHome;
  readonly createdBy: string;
  /**
   * Από ποια αρχεία σκηνής προήλθε (πόρτα του DXF Viewer, Β5) — **κενό** για ανέβασμα από τη φόρμα (Β4).
   * Τα revisions τα διαβάζει ο **διακομιστής** (ADR-845 Ο-25), ποτέ ο πελάτης.
   */
  readonly sourceRevisions: readonly ModelSourceRevision[];
}

/** 🏆 **Το έγγραφο της ιδιωτικής πηγής του εδάφους** — σε αναμονή (`PENDING`), όπως κάθε ανέβασμα. */
export function buildPublishedTerrainFileRecord(
  request: PublishedTerrainFileRequest,
): BuildPendingFileRecordResult {
  return buildPendingFileRecordData({
    ...fileCoordinatesOf(request.home),
    domain: FILE_DOMAINS.CONSTRUCTION,
    category: FILE_CATEGORIES.DRAWINGS,
    contentType: TERRAIN_SOURCE_CONTENT_TYPE,
    // Το όνομα το ορίζει ο κανόνας, όχι ο πελάτης: ένα ακίνητο έχει **ένα** τοπογραφικό αγγελίας.
    originalFilename: `terrain-source.${TERRAIN_FILE_EXT}`,
    createdBy: request.createdBy,
    ext: TERRAIN_FILE_EXT,
    classification: FILE_CLASSIFICATIONS.PUBLIC,
    publicationIdentity: TERRAIN_PUBLICATION_IDENTITY,
    sourceRevisions: request.sourceRevisions,
  });
}
