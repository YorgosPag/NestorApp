/**
 * @fileoverview **ΤΙ ΕΓΓΡΑΦΟ `files` ΓΕΝΝΑ Η ΔΗΜΟΣΙΕΥΣΗ ΜΙΑΣ ΚΑΤΟΨΗΣ ΑΠΟ ΤΟ ΣΧΕΔΙΟ** — μία απάντηση (ADR-909 Β1).
 * @related lib/listings/model-file-record (ο αδελφός) · services/listings/agency-media-publication (ο αναγνώστης)
 * @module lib/listings/floorplan-file-record
 *
 * 🔴 **ΑΔΕΛΦΟΣ ΤΟΥ `buildPublishedModelFileRecord`, ΟΧΙ ΠΑΡΑΜΕΤΡΟΣ ΤΟΥ.** Εκείνο το αρχείο το γράφει
 * ρητά: *«άλλη πόρτα = δικός της κατασκευαστής, όχι σημαία εδώ»*. Η κάτοψη έχει άλλη κατηγορία, άλλη
 * ταυτότητα, και δύο πεδία που το μοντέλο δεν έχει υποχρεωτικά.
 *
 * 🔑 **Το ίδιο σώμα το εκτελούν η πόρτα ΚΑΙ η άγκυρα της ραφής** — το μάθημα του Ο-13: fixture που
 * γράφει `classification: 'public'` με το χέρι περιγράφει έγγραφο που **κανείς δεν γράφει**.
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
import { FLOORPLAN_CONTENT_TYPE } from './floorplan-publication-contract';
import { floorplanPublicationIdentityKey } from './floorplan-publication-identity';
import type { FloorplanRenderRecipe } from './floorplan-render-recipe';
import type { ModelSourceRevision } from './model-source-revisions';

/** Η επέκταση της κανονικής διαδρομής — **χωρίς τελεία**. Η πόρτα δέχεται **μόνο** PNG. */
const FLOORPLAN_FILE_EXT = 'png';

/** **Το αρχείο σκηνής, στην έκδοση που είχε τη στιγμή της δημοσίευσης** — ακριβώς ένα, ποτέ κανένα. */
type FloorplanSourceRevisions = readonly [ModelSourceRevision];

interface PublishedFloorplanFileRequest {
  readonly companyId: string;
  readonly propertyId: string;
  readonly createdBy: string;
  /** Το επίπεδο του viewer από το οποίο βγήκε — **από εδώ παράγεται η ταυτότητα** (Α3). */
  readonly levelId: string;
  /**
   * 🔴 **ΥΠΟΧΡΕΩΤΙΚΟ ΣΤΟΝ ΤΥΠΟ, ΣΕ ΑΝΤΙΘΕΣΗ ΜΕ ΤΟ ΜΟΝΤΕΛΟ** (ADR-909 §5, άγκυρα Β1): κάτοψη που λέγεται
   * «μετρημένη» χωρίς να ξέρουμε **από ποια έκδοση** σχεδίου θα έμενε για πάντα `unknown` στην
   * παλαιότητα — δηλαδή το κοινό θα έβλεπε «υπολογισμένη από το σχέδιο» για εικόνα που κανείς δεν
   * μπορεί να πει αν ισχύει. Η πόρτα **αρνείται** αντί να τη γεννήσει.
   */
  readonly sourceRevisions: FloorplanSourceRevisions;
  /** Η συνταγή απόδοσης (Α6) — υποχρεωτική για τον ίδιο λόγο. */
  readonly renderRecipe: FloorplanRenderRecipe;
}

/**
 * 🏆 **ΤΟ ΕΓΓΡΑΦΟ ΤΗΣ ΠΑΡΑΓΟΜΕΝΗΣ ΚΑΤΟΨΗΣ** — σε αναμονή, όπως κάθε ανέβασμα.
 *
 * - **`CONSTRUCTION`**: παραδοτέο της μελέτης, όπως και το μοντέλο.
 * - **`classification: 'public'`**: η πόρτα **είναι** η πράξη δημοσίευσης — ζητά ονομαστικό στόχο και
 *   δικαίωμα δημοσίευσης πριν γραφτεί ένα byte.
 * - **Ταυτότητα `floorplan/measured/{levelId}`**: η προέλευση διαβάζεται από το πρόθεμά της (Α1).
 *
 * ⛔ **ΜΗΝ το κάνεις παράμετρο «για ευελιξία»**: κάτοψη που ανεβαίνει με το χέρι περνά από **άλλη**
 * πόρτα (τον διαχειριστή αρχείων), χωρίς ταυτότητα και χωρίς συνταγή — και μένει «Δηλωμένη».
 */
export function buildPublishedFloorplanFileRecord(
  request: PublishedFloorplanFileRequest,
): BuildPendingFileRecordResult {
  return buildPendingFileRecordData({
    companyId: request.companyId,
    entityType: ENTITY_TYPES.PROPERTY,
    entityId: request.propertyId,
    domain: FILE_DOMAINS.CONSTRUCTION,
    category: FILE_CATEGORIES.FLOORPLANS,
    contentType: FLOORPLAN_CONTENT_TYPE,
    // Το όνομα παράγεται από **αναγνωριστικά**: ο πελάτης δεν ονομάζει το αρχείο, ο κανόνας ονομασίας ναι.
    originalFilename: `${request.levelId}.${FLOORPLAN_FILE_EXT}`,
    createdBy: request.createdBy,
    ext: FLOORPLAN_FILE_EXT,
    classification: FILE_CLASSIFICATIONS.PUBLIC,
    publicationIdentity: floorplanPublicationIdentityKey(request.levelId),
    sourceRevisions: request.sourceRevisions,
    renderRecipe: request.renderRecipe,
  });
}
