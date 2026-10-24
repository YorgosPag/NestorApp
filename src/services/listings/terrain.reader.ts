/**
 * @fileoverview ⛰️ **Ο ΑΝΑΓΝΩΣΤΗΣ ΤΗΣ ΠΗΓΗΣ ΕΔΑΦΟΥΣ** — «ποιο τοπογραφικό δημοσιεύει τώρα αυτό το οικόπεδο;» (ADR-920 Β3β).
 * @related ADR-920 §11 (η πόρτα που γράφει) · §12 · ./floor-plate.reader (ίδιο σχήμα) · ./listing-media-sources
 * @module services/listings/terrain.reader
 *
 * 🔑 **ΒΡΙΣΚΕΙ ΤΗΝ ΠΗΓΗ ΑΠΟ ΤΗΝ ΤΑΥΤΟΤΗΤΑ, ΟΧΙ ΑΠΟ ΤΗΝ ΚΑΤΗΓΟΡΙΑ**: η πηγή ζει στο `DRAWINGS`, που **επίτηδες** δεν είναι
 * στις `PUBLISHABLE_CATEGORIES` — ο αναγνώστης των φωτογραφιών δεν τη βλέπει ποτέ. Εδώ δημοσιεύεται **μόνο** ό,τι
 * έγραψε η πόρτα (`publicationIdentity === 'terrain/measured'`, το πεδίο που γράφει μόνο εκείνη), δημόσια
 * ταξινομημένο, παραδοτέο και JSON. Ένα σχέδιο DRAWINGS οποιουδήποτε άλλου είδους **δεν** γίνεται ποτέ έδαφος.
 *
 * 🔑 **Ένα ανά ακίνητο**: η πόρτα διαδέχεται την προηγούμενη (ISO 19650)· αν βρεθούν δύο, νικά η νεότερη με τον
 * **ίδιο** συγκριτή που κρίνει όλο το υλικό (`compareAgencyMediaForPublication`).
 *
 * 🔑 **Μόνο γη** (Δ1): ακίνητο που έπαψε να είναι οικόπεδο δεν δίνει πηγή ⇒ το ράφι αποσύρει το έδαφος μόνο του.
 *
 * ⚠️ Το ερώτημα είναι το **ίδιο** με του `findSupersededMaterial` (μόνο ισότητες) ⇒ κανένας νέος δείκτης.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES, FILE_CATEGORIES } from '@/config/domain-constants';
import { isLandProperty } from '@/constants/property-classification';
import { isDeliverableListingFile } from '@/lib/listings/listing-file-deliverability';
import { TERRAIN_MATERIAL, type ListingMaterial } from '@/lib/listings/listing-material';
import { TERRAIN_PUBLICATION_IDENTITY } from '@/lib/listings/terrain-file-record';
import { TERRAIN_SOURCE_CONTENT_TYPE } from '@/lib/terrain/publication/terrain-publication-contract';
import { createModuleLogger } from '@/lib/telemetry';
import type { PublicShelfSource } from '@/services/upload/utils/storage-path-public-shelf';

import {
  AGENCY_ENTITY_TYPE,
  compareAgencyMediaForPublication,
  isPubliclyClassified,
  type AgencyMediaCandidate,
} from './agency-media-publication';
import type { ListingSourceProperty } from './publish-public-listing';

const logger = createModuleLogger('terrain-reader');

const NO_TERRAIN: readonly PublicShelfSource<ListingMaterial>[] = [];

export type TerrainResolver = (
  propertyId: string,
  property: ListingSourceProperty,
) => Promise<readonly PublicShelfSource<ListingMaterial>[]>;

function isPublishableTerrainSource(file: AgencyMediaCandidate): boolean {
  return (
    file.publicationIdentity === TERRAIN_PUBLICATION_IDENTITY &&
    file.contentType === TERRAIN_SOURCE_CONTENT_TYPE &&
    isPubliclyClassified(file) &&
    isDeliverableListingFile(file, AGENCY_ENTITY_TYPE)
  );
}

/** **Η τρέχουσα πηγή εδάφους** ανάμεσα στα αρχεία σχεδίων ενός ακινήτου — καθαρή, ώστε να ελέγχεται χωρίς βάση. */
export function currentTerrainSource(
  files: readonly AgencyMediaCandidate[],
): PublicShelfSource<ListingMaterial> | null {
  let winner: AgencyMediaCandidate | null = null;
  for (const file of files) {
    if (!isPublishableTerrainSource(file)) continue;
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

async function readTerrainSources(
  adminDb: AdminFirestore,
  propertyId: string,
  property: ListingSourceProperty,
): Promise<readonly PublicShelfSource<ListingMaterial>[]> {
  const companyId = typeof property.companyId === 'string' && property.companyId.trim() !== '' ? property.companyId : null;
  // Χωρίς μισθωτή: σιωπή, ποτέ πλατύτερο ερώτημα (ίδιο συμβόλαιο με τον αναγνώστη των φωτογραφιών).
  if (companyId === null || propertyId.trim() === '' || !isLandProperty(property.type)) return NO_TERRAIN;

  try {
    const snapshot = await adminDb
      .collection(COLLECTIONS.FILES)
      .where('companyId', '==', companyId)
      .where('entityType', '==', ENTITY_TYPES.PROPERTY)
      .where('entityId', '==', propertyId)
      .where('category', '==', FILE_CATEGORIES.DRAWINGS)
      .get();

    const source = currentTerrainSource(
      snapshot.docs.map((doc) => ({ ...(doc.data() as AgencyMediaCandidate), id: doc.id })),
    );
    return source === null ? NO_TERRAIN : [source];
  } catch (error) {
    logger.warn('Η πηγή εδάφους δεν διαβάστηκε — η αγγελία δημοσιεύεται χωρίς έδαφος', {
      propertyId,
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NO_TERRAIN;
  }
}

/** **Ο επιλυτής ενός περάσματος** — συντίθεται στο `createListingMediaResolver`. */
export function createTerrainResolver(adminDb: AdminFirestore): TerrainResolver {
  return (propertyId, property) => readTerrainSources(adminDb, propertyId, property);
}
