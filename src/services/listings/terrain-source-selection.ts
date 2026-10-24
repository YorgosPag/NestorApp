/**
 * @fileoverview ⛰️ **«ΠΟΙΟ ΤΟΠΟΓΡΑΦΙΚΟ ΔΗΜΟΣΙΕΥΕΙ ΑΥΤΟ ΤΟ ΟΙΚΟΠΕΔΟ;»** — ο ΕΝΑΣ καθαρός επιλογέας (ADR-920 Β3β · Β4.4).
 * @related ADR-920 §12 · §13.6 · ./terrain.reader (η εταιρική ανάγνωση) ·
 *   services/property-dossier/dossier-media-publication (ο φάκελος ιδιοκτήτη)
 * @module services/listings/terrain-source-selection
 *
 * 🔑 **ΕΝΑΣ ΚΡΙΤΗΣ, ΔΥΟ ΚΗΔΕΜΟΝΙΕΣ**: το εταιρικό ακίνητο (`property`, `files`) και ο φάκελος ιδιοκτήτη
 * (`property_dossier`, `files_personal`) ρωτούν την **ίδια** ερώτηση· αλλάζει μόνο ο τύπος οντότητας που οφείλει να
 * έχει το αρχείο. Εξήχθη από τον `terrain.reader` (που είναι `server-only` λόγω βάσης) ώστε να τον καλεί και η καθαρή
 * γραμμή ιδιοκτήτη (`ownerListingMediaSources`), την οποία φορτώνει και ο browser.
 *
 * 🔑 **ΒΡΙΣΚΕΙ ΤΗΝ ΠΗΓΗ ΑΠΟ ΤΗΝ ΤΑΥΤΟΤΗΤΑ, ΟΧΙ ΑΠΟ ΤΗΝ ΚΑΤΗΓΟΡΙΑ**: δημοσιεύεται **μόνο** ό,τι έγραψε η πόρτα
 * (`publicationIdentity === 'terrain/measured'`), δημόσια ταξινομημένο, παραδοτέο και JSON. Τα δύο πεδία θεματοφυλακής
 * δεν τα γράφει **κανένας** πελάτης — ούτε στο `files` ούτε στο `files_personal` (ADR-845 §7.17 Α4α · ADR-920 Β4.6).
 *
 * 🔑 **Ένα ανά ακίνητο**: αν βρεθούν δύο, νικά η νεότερη με τον **ίδιο** συγκριτή που κρίνει όλο το υλικό.
 */

import { TERRAIN_MATERIAL, type ListingMaterial } from '@/lib/listings/listing-material';
import { isDeliverableListingFile } from '@/lib/listings/listing-file-deliverability';
import { TERRAIN_PUBLICATION_IDENTITY } from '@/lib/listings/terrain-file-record';
import { TERRAIN_SOURCE_CONTENT_TYPE } from '@/lib/terrain/publication/terrain-publication-contract';
import type { PublicShelfSource } from '@/services/upload/utils/storage-path-public-shelf';
import type { FileRecord } from '@/types/file-record';

import {
  compareAgencyMediaForPublication,
  isPubliclyClassified,
  type AgencyMediaCandidate,
} from './agency-media-publication';

function isPublishableTerrainSource(file: AgencyMediaCandidate, entityType: FileRecord['entityType']): boolean {
  return (
    file.publicationIdentity === TERRAIN_PUBLICATION_IDENTITY &&
    file.contentType === TERRAIN_SOURCE_CONTENT_TYPE &&
    isPubliclyClassified(file) &&
    isDeliverableListingFile(file, entityType)
  );
}

/**
 * **Η τρέχουσα πηγή εδάφους** ανάμεσα στα αρχεία ενός υποκειμένου — ή `null`.
 *
 * @param entityType — ο τύπος που οφείλει να έχει το αρχείο (`property` | `property_dossier`). Ο **κάτοχος** (εταιρεία
 *   ή άνθρωπος) κρίνεται από τον καλούντα, γιατί μόνο εκείνος ξέρει ποιο υποκείμενο διάβασε.
 */
export function currentTerrainSource(
  files: readonly AgencyMediaCandidate[],
  entityType: FileRecord['entityType'],
): PublicShelfSource<ListingMaterial> | null {
  let winner: AgencyMediaCandidate | null = null;
  for (const file of files) {
    if (!isPublishableTerrainSource(file, entityType)) continue;
    if (winner === null || compareAgencyMediaForPublication(winner, file) < 0) winner = file;
  }
  if (winner === null) return null;

  return {
    privateStoragePath: winner.storagePath,
    storagePlacement: winner.storagePlacement,
    material: TERRAIN_MATERIAL,
    sourceFileId: winner.id,
  };
}
