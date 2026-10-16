/**
 * @fileoverview Μητρώο λήξεων — **ΣΕ ΠΟΙΟΝ ΔΗΜΟ ΕΙΝΑΙ ΤΟ ΑΚΙΝΗΤΟ**, για το «Βρες επαγγελματία» (ADR-915 §24).
 * @related services/places/showcase-location-area.ts (ο κριτής) · lib/document-validity/document-next-step.ts (ποιος το
 *   χρειάζεται) · services/listings/publish-public-listing.ts (`collectPlaceKnowledge` — η αλυσίδα κτίριο → έργο)
 * @module services/document-registry/registry-property-area.server
 *
 * 🔑 **ΕΝΑΣ ΚΡΙΤΗΣ, ΤΡΕΙΣ ΠΗΓΕΣ ΣΗΜΕΙΟΥ** — από τη φθηνότερη και ήδη αποθηκευμένη προς την ακριβότερη:
 *   1. **αγγελία** του ακινήτου → `adminArea.municipalityId`: γράφτηκε στη δημοσίευση από τον ίδιο κριτή (ADR-890 Φ0)
 *      και η αγγελία έχει ήδη διαβαστεί ⇒ **μηδέν** αναγνώσεις·
 *   2. **ιδιώτης** με δηλωμένο σημείο → `showcaseLocationArea`·
 *   3. **ακίνητο εταιρείας** χωρίς αγγελία → κτίριο → έργο → η ισχυρότερη διεύθυνση (`resolveListingPosition`) →
 *      `showcaseLocationArea`. Η **ίδια** αλυσίδα με τη δημοσίευση αγγελίας — καμία δεύτερη ανάγνωση διεύθυνσης.
 * 🔑 **Δήμος, ποτέ βαθύτερα**: ο κατάλογος ψάχνει «ποιος καλύπτει την περιοχή», και ο δήμος είναι η βαθμίδα που
 *    δικαιολογεί **κάθε** ακρίβεια θέσης (ακόμα και «κέντρο περιοχής», `DEPTH_BY_ACCURACY`).
 * 🔑 **Μόνο όσα θα δειχτούν**: ο καλών δίνει τα ακίνητα με γραμμή «Βρες επαγγελματία» (`needsProfessionalSearch`) —
 *    ποτέ σάρωση όλων των 500, και φραγμένη ταυτοχρονία.
 * ⚠️ `null` = «δεν αποδεικνύεται» (καμία θέση · σημείο εκτός ορίων · ευρετήριο που δεν διαβάστηκε), **ποτέ** «πουθενά».
 *    Η οθόνη τότε ανοίγει τον κατάλογο **χωρίς** περιοχή και το λέει.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { chunkArray } from '@/lib/array-utils';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { trimmedStringOrNull } from '@/lib/type-guards';
import { collectPlaceKnowledge } from '@/services/listings/publish-public-listing';
import { resolveListingPosition } from '@/services/listings/public-listing-position';
import { showcaseLocationArea } from '@/services/places/showcase-location-area';
import type { GeoPoint } from '@/types/geo/coordinates';
import type { PublicListing } from '@/types/public-listing';
import type { RegistryProperty } from './registry-properties.server';

const logger = createModuleLogger('registry-property-area');

/** Πόσα ακίνητα ρωτιούνται ταυτόχρονα — η αλυσίδα κτίριο → έργο είναι δύο αναγνώσεις ανά ακίνητο. */
const AREA_CONCURRENCY = 10;

export interface RegistryAreaQuestion {
  /** Τα ακίνητα που θα δείξουν «Βρες επαγγελματία» — κανένα άλλο δεν ρωτιέται. */
  readonly wanted: ReadonlySet<string>;
  /** Ό,τι είναι «του γραφείου» (ακίνητα εταιρείας + εντολές υπό θεματοφυλακή), όπως το διάβασε ήδη το μητρώο. */
  readonly subjects: ReadonlyMap<string, RegistryProperty>;
  /** Οι αγγελίες που διάβασε ήδη το μητρώο (ταυτότητα αγγελίας = ταυτότητα ακινήτου). */
  readonly listings: readonly PublicListing[];
  readonly now: Date;
}

/** Ο δήμος του σημείου — ή `null`· το «δεν μπόρεσα να ρωτήσω» καταγράφεται, δεν γίνεται μόνιμη απάντηση. */
async function municipalityOfPoint(point: GeoPoint | null, propertyId: string): Promise<string | null> {
  const result = await showcaseLocationArea(point);
  if (result === 'unavailable') {
    logger.warn('Το ευρετήριο ορίων δεν διαβάστηκε — το ακίνητο μένει χωρίς περιοχή', { data: { propertyId } });
    return null;
  }
  return result.area?.adminId ?? null;
}

/** Το σημείο ακινήτου εταιρείας — η ισχυρότερη διεύθυνση της αλυσίδας κτίριο → έργο, ή `null`. */
async function companyPropertyPoint(db: AdminFirestore, property: RegistryProperty, now: Date): Promise<GeoPoint | null> {
  const knowledge = await collectPlaceKnowledge(
    db,
    { buildingId: trimmedStringOrNull(property.data.buildingId), projectId: trimmedStringOrNull(property.data.projectId) },
    now.toISOString(),
  );
  const position = resolveListingPosition(knowledge, null);
  return position.kind === 'known' ? position.point : null;
}

/**
 * ⚠️ **Η περιοχή είναι βοήθεια, όχι προϋπόθεση**: μια αποτυχία εδώ δεν ρίχνει το μητρώο λήξεων — το ακίνητο μένει
 *    χωρίς περιοχή και ο κατάλογος ανοίγει χωρίς αυτήν (το λέει η οθόνη).
 */
async function areaOf(db: AdminFirestore, property: RegistryProperty, now: Date): Promise<string | null> {
  try {
    const point = property.scope === 'owner-property' ? property.declaredPoint : await companyPropertyPoint(db, property, now);
    return await municipalityOfPoint(point, property.id);
  } catch (cause) {
    logger.warn('Η περιοχή του ακινήτου δεν υπολογίστηκε', { data: { propertyId: property.id, error: getErrorMessage(cause) } });
    return null;
  }
}

/**
 * **Ο δήμος κάθε ακινήτου που θα δείξει «Βρες επαγγελματία»** — ταυτότητα ADR-883 (`municipality:<κωδ.>`) ή `null`.
 * Ένα ακίνητο που δεν είναι «του γραφείου» δεν ρωτιέται ποτέ (ίδια εμβέλεια με τα ονόματα του μητρώου).
 */
export async function readRegistryPropertyAreas(
  db: AdminFirestore,
  { wanted, subjects, listings, now }: RegistryAreaQuestion,
): Promise<ReadonlyMap<string, string | null>> {
  const areas = new Map<string, string | null>();
  const listed = new Map(listings.map((listing) => [listing.id, listing.adminArea?.municipalityId ?? null]));
  const pending: RegistryProperty[] = [];
  for (const id of wanted) {
    const property = subjects.get(id);
    if (property === undefined) continue;
    const fromListing = listed.get(id) ?? null;
    if (fromListing !== null) areas.set(id, fromListing);
    else pending.push(property);
  }
  for (const group of chunkArray(pending, AREA_CONCURRENCY)) {
    const resolved = await Promise.all(group.map(async (property) => [property.id, await areaOf(db, property, now)] as const));
    for (const [id, area] of resolved) areas.set(id, area);
  }
  return areas;
}
