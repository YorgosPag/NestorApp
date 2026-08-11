/**
 * @fileoverview **ΑΝΑΓΝΩΣΗ ΤΟΥ ΕΠΙΠΕΔΟΥ Α ΑΠΟ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ** — και η μία ερώτηση που τη χρειάζεται.
 * @related ADR-777 · SPEC-777A §13.4 (ODbL) · CHECK 3.35
 * @module services/places/public-place-read.service
 *
 * 🔑 **Ο πελάτης ΔΕΝ περνά από εδώ.** Οι δύο συλλογές είναι `read: if true`, οπότε η
 * οθόνη τις διαβάζει **απευθείας** (ίδιο σχήμα με το `usePublicListings`). Αυτό το
 * αρχείο υπάρχει για τη **μία** ερώτηση που ο πελάτης δεν μπορεί να απαντήσει μόνος
 * του: *«ποιο είναι το ζωντανό περίγραμμα αυτού του τόπου;»* — γιατί η απάντηση
 * απαιτεί κλήση προς το Overpass, και **αυτή** οφείλει να γίνει από τον διακομιστή
 * (ένα κλειδί χρήστη προς δημόσιο API θα ήταν ανοιχτός ενισχυτής).
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTERPRISE_ID_PREFIXES } from '@/services/enterprise-id-prefixes';
import { enterpriseIdType, isValidEnterpriseId } from '@/services/enterprise-id-parse';
import type { OsmReference, PublicBuilding, PublicLand } from '@/types/geo/public-place';

/**
 * Το **πρόθεμα της ταυτότητας ΕΙΝΑΙ ο διαχωριστής τύπου.**
 *
 * 🔑 Δεν χρειάζεται δεύτερη παράμετρος «τι είδους τόπος είναι αυτό;» στη διαδρομή: το
 * `land_*` και το `pbld_*` **το λένε ήδη**, και το λένε από το **ίδιο μητρώο** που
 * παρήγαγε την ταυτότητα (N.6) — όχι από regex γραμμένο εδώ.
 */
export type PlaceKind = 'land' | 'building';

export function placeKindOf(placeId: string): PlaceKind | null {
  if (!isValidEnterpriseId(placeId)) return null;

  const type = enterpriseIdType(placeId);
  if (type === ENTERPRISE_ID_PREFIXES.PUBLIC_LAND) return 'land';
  if (type === ENTERPRISE_ID_PREFIXES.PUBLIC_BUILDING) return 'building';
  return null;
}

/**
 * Η αναφορά OSM αυτού του τόπου, όταν από εκεί ήρθε η θέση του.
 *
 * ⚠️ `null` σημαίνει **τρία διαφορετικά πράγματα** και εδώ σκόπιμα δεν ξεχωρίζονται:
 * δεν υπάρχει τέτοιος τόπος · υπάρχει αλλά η θέση του δεν ήρθε από OSM · η θέση είναι
 * άγνωστη. Ο **μόνος** καταναλωτής ρωτά *«έχω περίγραμμα να ζωγραφίσω;»*, και η
 * απάντηση «όχι» είναι η ίδια και στις τρεις — μια διάκριση εδώ θα ήταν λεξιλόγιο που
 * κανείς δεν διαβάζει (ADR-749 §5: φρουρός χωρίς απόδειξη ζωής).
 */
export async function readPlaceOsmRef(
  adminDb: AdminFirestore,
  placeId: string,
): Promise<OsmReference | null> {
  const kind = placeKindOf(placeId);
  if (kind === null) return null;

  if (kind === 'land') {
    const land = (
      await adminDb.collection(COLLECTIONS.PUBLIC_LANDS).doc(placeId).get()
    ).data() as PublicLand | undefined;

    return land?.position.kind === 'known' && land.position.provenance === 'osm'
      ? land.position.osmRef
      : null;
  }

  const building = (
    await adminDb.collection(COLLECTIONS.PUBLIC_BUILDINGS).doc(placeId).get()
  ).data() as PublicBuilding | undefined;

  return building?.footprint.kind === 'known' && building.footprint.provenance === 'osm'
    ? building.footprint.osmRef
    : null;
}
