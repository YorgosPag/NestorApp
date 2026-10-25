import 'server-only';

/**
 * @fileoverview **ΤΑ ΓΕΓΟΝΟΤΑ ΤΗΣ ΔΗΜΟΣΙΕΥΣΗΣ** — ό,τι η καθαρή προβολή δεν μπορεί να ξέρει, επειδή
 * ζει σε αρχεία ή σε άλλα έγγραφα (ADR-890 Φ0).
 * @related `publish-public-listing.ts` (ο ΕΝΑΣ γραφέας) · `lib/geo/admin-area-of-point.ts` ·
 *   `lib/listings/construction-year.ts` · `public-listing-gallery-projection.ts` (ίδιο ιδίωμα)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΙΔΙΟ ΙΔΙΩΜΑ ΜΕ ΤΗ ΣΥΛΛΟΓΗ: «Η ΠΡΟΒΟΛΗ ΓΡΑΦΕΙ ΚΕΝΟ, Ο ΓΡΑΦΕΑΣ ΔΕΝΕΙ»
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Το `projectListingShape` είναι **καθαρό** και το καλούν και οθόνες (δόλωμα ιδιώτη, ζήτηση). Αν
 * διάβαζε όρια ή το δημόσιο κτίριο, κάθε τέτοια κλήση θα γινόταν I/O. Άρα γράφει `null`, και ο
 * γραφέας — **μόνο** αυτός — λύνει τα γεγονότα και τα δένει πριν το `set()`, όπως ήδη κάνει με το
 * `withPublishedGallery`.
 *
 * ⚠️ **ΔΕΝ ΠΕΤΑ ΠΟΤΕ.** Ένα όριο που δεν διαβάστηκε ή ένα δημόσιο κτίριο που δεν απάντησε δεν
 * επιτρέπεται να ακυρώσει τη δημοσίευση: η αγγελία φεύγει με `null` στο αντίστοιχο πεδίο, η βλάβη
 * καταγράφεται, και η επόμενη επαναπροβολή τη διορθώνει.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import type { AdminAreaAssignment } from '@/lib/geo/admin-area-of-point';
import { resolveListingConstructionYear, type ConstructionYearSources } from '@/lib/listings/construction-year';
import type { SourcedAttribute } from '@/lib/property/attribute-provenance';
import { createModuleLogger } from '@/lib/telemetry';
import { attributeAdminArea } from '@/services/places/admin-area-attribution.server';
import { readPublicBuildingConstructionYear } from '@/services/places/public-place-read.service';
import { readTourPresence, type TourPresence } from '@/server/spatial-tour/tour-presence';
import type { ListingPosition, ListingTourPresence, PublicListing } from '@/types/public-listing';
import type { DeclaredAdminArea, PlaceKnowledge } from './public-listing-projection-types';

const logger = createModuleLogger('listing-publication-facts');

/** Ό,τι δένει ο γραφέας στην αγγελία, πάνω από την καθαρή προβολή. */
export interface ListingPublicationFacts {
  readonly adminArea: AdminAreaAssignment | null;
  readonly constructionYear: SourcedAttribute<number> | null;
  readonly tour: ListingTourPresence | null;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Η δήλωση της διεύθυνσης που **κέρδισε** τη θέση — ίσο σημείο, ίδια πηγή δεδομένων (ADR-890 §21). */
function declarationAt(position: ListingPosition, declarations: readonly DeclaredAdminArea[]): string | null {
  if (position.kind === 'unknown') return null;
  const { lat, lng } = position.point;
  return declarations.find(({ point }) => point.lat === lat && point.lng === lng)?.areaId ?? null;
}

/**
 * Η διοικητική περιοχή της **ήδη λυμένης** θέσης — ποτέ πιο ακριβής από αυτήν· με τη δηλωμένη ουρά, αν επικυρωθεί
 * (ADR-890 §21). Απόρριψη ⇒ μένει η μέτρηση και καταγράφεται (σήμα «φουσκωμένης περιοχής»)· το `not-deeper` είναι
 * φυσιολογικό (πινέζα ήδη ως την κοινότητα) και **δεν** καταγράφεται.
 */
async function adminAreaOf(
  listingId: string,
  position: ListingPosition,
  declarations: readonly DeclaredAdminArea[],
): Promise<AdminAreaAssignment | null> {
  const declaredAreaId = declarationAt(position, declarations);
  try {
    const { assignment, declaration } = await attributeAdminArea(position, declaredAreaId);
    if (declaration.kind === 'rejected' && declaration.reason !== 'not-deeper') {
      logger.warn('Απορρίφθηκε δηλωμένη περιοχή — μένει η μετρημένη', {
        listingId,
        areaId: declaredAreaId,
        reason: declaration.reason,
      });
    }
    return assignment;
  } catch (error) {
    logger.warn('Δεν αποδόθηκε διοικητική περιοχή — η αγγελία φεύγει χωρίς', { listingId, error: describe(error) });
    return null;
  }
}

/** Η δημόσια εγγραφή του κτιρίου του δεσμού (επίπεδο Α), αν υπάρχει. */
async function publicRecordOf(
  adminDb: AdminFirestore,
  listingId: string,
  place: PlaceKnowledge,
): Promise<ConstructionYearSources['publicRecord']> {
  const placeId = place.ref?.buildingId ?? null;
  if (placeId === null) return null;

  try {
    const fact = await readPublicBuildingConstructionYear(adminDb, placeId);
    return fact === null ? null : { fact, placeId };
  } catch (error) {
    logger.warn('Δεν διαβάστηκε το δημόσιο κτίριο — μένει μόνο η δήλωση', { listingId, error: describe(error) });
    return null;
  }
}

/** Το **δημόσιο μισό** της απάντησης του κριτή — η ΜΙΑ περικοπή `TourPresence → ListingTourPresence`. Καθαρή. */
export function listedTourFromPresence(presence: TourPresence | null): ListingTourPresence | null {
  return presence === null ? null : { visibility: presence.visibility };
}

/**
 * **Η περιήγηση 360° που φαίνεται στην αγγελία** (ADR-884 · ADR-777 §8.88) — η απάντηση του ΕΝΟΣ κριτή
 * (`readTourPresence`), κομμένη στο δημόσιο μισό της. Κανένας δεύτερος κανόνας «φαίνεται;» εδώ.
 *
 * ⚠️ Αποτυχία ανάγνωσης ⇒ `null`: η κάρτα δεν δείχνει σήμα — ποτέ ψευδές «έχει» — και η νυχτερινή συμφιλίωση το διορθώνει.
 */
async function listedTourOf(adminDb: AdminFirestore, listingId: string): Promise<ListingTourPresence | null> {
  try {
    return listedTourFromPresence(await readTourPresence(adminDb, listingId));
  } catch (error) {
    logger.warn('Δεν διαβάστηκε η παρουσία περιήγησης — η αγγελία φεύγει χωρίς σήμα', { listingId, error: describe(error) });
    return null;
  }
}

/**
 * **Λύνει τα γεγονότα της δημοσίευσης** για μια αγγελία που ήδη προβλήθηκε.
 *
 * 🔑 Η περιοχή κρίνεται πάνω στο `listing.position` — τη θέση που **ήδη** αποφάσισε η προβολή με
 * `outranksForLocation`, και που βλέπει ο επισκέπτης. Κανένας δεύτερος υπολογισμός θέσης.
 *
 * ⚠️ **Ανεξάρτητες ερωτήσεις ⇒ `Promise.all`**: τα όρια ζουν σε αρχεία, το δημόσιο κτίριο σε άλλο
 * έγγραφο — σειριακά θα πλήρωναν δύο γύρους για δουλειά ενός.
 */
export async function resolvePublicationFacts(
  adminDb: AdminFirestore,
  listing: PublicListing,
  place: PlaceKnowledge,
): Promise<ListingPublicationFacts> {
  const [adminArea, publicRecord, tour] = await Promise.all([
    adminAreaOf(listing.id, listing.position, place.declaredAdminAreas ?? []),
    publicRecordOf(adminDb, listing.id, place),
    listedTourOf(adminDb, listing.id),
  ]);

  return {
    adminArea,
    tour,
    constructionYear: resolveListingConstructionYear(
      { declared: place.buildingConstructionYear ?? null, publicRecord },
      listing.projectedAt,
    ),
  };
}

/** **Δένει** τα γεγονότα στην αγγελία. Καθαρή — ίδια είσοδος, ίδιο έγγραφο (idempotent). */
export function withPublicationFacts(listing: PublicListing, facts: ListingPublicationFacts): PublicListing {
  return { ...listing, adminArea: facts.adminArea, constructionYear: facts.constructionYear, tour: facts.tour };
}
