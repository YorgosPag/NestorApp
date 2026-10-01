/**
 * @fileoverview **ΠΟΙΟΣ ΜΠΑΙΝΕΙ ΣΤΟΝ ΧΑΡΤΗ ΤΟΥ ΚΑΤΑΛΟΓΟΥ, ΚΑΙ ΠΩΣ** — η προβολή
 * `PublicShowcase[] → GeoJSON` της σελίδας `/pro` (ADR-896).
 * @related ADR-896 · ADR-841 Α21 (κάρτα καταστημάτων) · ADR-827 §9.9 β · lib/listings/listings-geojson
 * @module lib/agency/showcase-map
 *
 * 🏆 **ΤΟ ΠΡΟΤΥΠΟ: Google Business Profile.** Δύο είδη επιχείρησης, δύο απεικονίσεις:
 * - **με κατάστημα για πελάτες** ⇒ πινέζα στη διεύθυνση·
 * - **service-area business** (ο υδραυλικός που δουλεύει από το σπίτι του) ⇒ **καμία** πινέζα· ο
 *   χάρτης δείχνει **μόνο** την περιοχή εξυπηρέτησης (`coverage-geometry.ts`).
 *
 * 🔴 **Η ΠΙΝΕΖΑ ΔΕΝ ΛΕΕΙ ΠΟΤΕ ΠΕΡΙΣΣΟΤΕΡΑ ΑΠ' ΟΣΑ ΛΕΕΙ Η ΣΕΛΙΔΑ ΠΡΟΦΙΛ.**
 * | πηγή | πινέζα; | γιατί |
 * |---|---|---|
 * | κατάστημα με **δημοσιευμένη οδό** (`street !== null`) | ✅ | ο ίδιος τη δημοσίευσε ρητά, με οδηγίες πορείας |
 * | κατάστημα «μόνο περιοχή» (`street === null`) | ⛔ | η πρακτική Google: η έδρα **δεν** φαίνεται — ούτε ως σημείο |
 * | καμία κάρτα, μόνο η παλιά έδρα (`position`) | ✅ | η σελίδα προφίλ τη δείχνει ήδη ως «Έδρα» — ο χάρτης δεν αποκαλύπτει τίποτα νέο |
 *
 * 🔑 **Ταυτότητα feature ≠ ταυτότητα εστίασης.** Κάθε κατάστημα είναι δικό του feature
 * (`companyId~locationId`), αλλά το `properties.id` — αυτό που ταιριάζουν τα επίπεδα εστίασης και
 * αναφέρει το κλικ — είναι το `companyId`. Έτσι το hover στην κάρτα φωτίζει **όλα** τα καταστήματα
 * του γραφείου, και το κλικ σε οποιοδήποτε επιλέγει **το γραφείο**.
 *
 * ⛔ **Κανένας αριθμός πάνω στις πινέζες** (Yelp «1, 2, 3»): εδώ η σειρά είναι ουδέτερη ζώνη
 * ισοπαλίας (ADR-843) — ένας αριθμός θα τη μετέτρεπε σε κατάταξη που δεν υπάρχει.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις.
 */

import { METRES_PER_KM } from '@/lib/geo/geo-distance';
import { outlineToGeoJson } from '@/lib/geo/geo-geojson';
import { geoCircleOutline, geoRingsBoundingBox } from '@/lib/geo/geo-ring';
import type { ListingMapEntry } from '@/lib/listings/listing-map-entry';
import { listingFeature, type ListingFeature, type ListingGeoJson } from '@/lib/listings/listings-geojson';
import type { PublicShowcase } from '@/types/agency-profile';
import type { GeoBoundingBox, GeoCircle, GeoPoint } from '@/types/geo/coordinates';

import { coverageShape, multiPolygonExtent } from './coverage-geometry';

/** Τα πεδία που χρειάζεται ο χάρτης — ώστε τα tests να μη στήνουν ολόκληρη βιτρίνα. */
export type MappableShowcase = Pick<PublicShowcase, 'companyId' | 'displayName' | 'position' | 'locations' | 'coverage'>;

/** **Πώς εμφανίζεται ένα γραφείο στον χάρτη** — η μία κατάταξη για πινέζες και γραμμή «εκτός χάρτη». */
export type ShowcaseMapPresence =
  /** Έχει ≥ 1 πινέζα. */
  | 'pinned'
  /** Καμία πινέζα **από επιλογή** (μόνο περιοχή)· φαίνεται μέσω της δηλωμένης εμβέλειας. */
  | 'area-only'
  /** Δεν δήλωσε ούτε τόπο ούτε κατάστημα. */
  | 'unplaced';

/** Τα σημεία που **επιτρέπεται** να γίνουν πινέζες — δες τον πίνακα της επικεφαλίδας. */
export function showcasePins(showcase: MappableShowcase): readonly { readonly key: string; readonly point: GeoPoint }[] {
  if (showcase.locations.length > 0) {
    return showcase.locations.flatMap((location) =>
      location.street !== null && location.position !== null ? [{ key: location.id, point: location.position }] : [],
    );
  }
  return showcase.position === null ? [] : [{ key: 'seat', point: showcase.position }];
}

export function showcaseMapPresence(showcase: MappableShowcase): ShowcaseMapPresence {
  if (showcasePins(showcase).length > 0) return 'pinned';
  return showcase.locations.length > 0 ? 'area-only' : 'unplaced';
}

/** Ο διαχωριστής του feature id — δεν εμφανίζεται ποτέ σε enterprise id (`comp_*`, `sloc_*`). */
const FEATURE_KEY_SEPARATOR = '~';

function showcaseFeatures(showcase: MappableShowcase): ListingFeature[] {
  return showcasePins(showcase).map(({ key, point }) => ({
    ...listingFeature(showcase.companyId, showcase.displayName, { shape: 'pin', point }),
    id: `${showcase.companyId}${FEATURE_KEY_SEPARATOR}${key}`,
  }));
}

/** Γραφεία → GeoJSON, από τον **έναν** ζωγράφο (`listingFeature`). */
export function showcaseMapGeoJson(showcases: readonly MappableShowcase[]): ListingGeoJson {
  return { type: 'FeatureCollection', features: showcases.flatMap(showcaseFeatures) };
}

/**
 * **Έχει ο χάρτης κάτι να πει;** — πινέζα **ή** δηλωμένη εμβέλεια. Ένας κατάλογος όπου όλοι
 * δουλεύουν «μόνο περιοχή» δεν έχει καμία πινέζα, αλλά ο χάρτης είναι ο **μόνος** τόπος όπου
 * φαίνεται πού δουλεύει ο καθένας.
 */
export function hasDirectoryMap(showcases: readonly MappableShowcase[]): boolean {
  return showcases.some((showcase) => showcasePins(showcase).length > 0 || showcase.coverage !== null);
}

/** Ό,τι χρειάζονται στοίβα και δείκτης άκρης: όνομα, **χωρίς** τιμή (ο κατάλογος δεν έχει τιμές). */
export function showcaseMapEntry(showcase: Pick<PublicShowcase, 'companyId' | 'displayName'>): ListingMapEntry {
  return { id: showcase.companyId, title: showcase.displayName, price: null };
}

/**
 * **Πού φτάνει ο χάρτης όταν ανοίγει με αυτό το γραφείο επιλεγμένο** (`?selected=`) — η δηλωμένη
 * εμβέλεια **μαζί** με τα καταστήματα, όχι το κατάστημα σε ζουμ δρόμου.
 *
 * ⚠️ **Οι διοικητικές περιοχές δεν μπαίνουν εδώ**: τα όριά τους φορτώνονται από το δίκτυο, και η
 * άφιξη είναι σύγχρονη. Φτάνουμε στα καταστήματα, και η κάμερα πετά στα όρια **όταν έρθουν**
 * (`CoverageFootprintLayer`). `null` = τίποτα να καδραριστεί ⇒ η προεπιλογή του χάρτη.
 */
export function showcaseArrivalExtent(showcase: MappableShowcase): GeoBoundingBox | null {
  const pins = showcasePins(showcase).map((pin) => pin.point);
  const shape = coverageShape(showcase.coverage);
  if (shape.kind === 'drawn') return multiPolygonExtent(shape.geometry, pins);
  return geoRingsBoundingBox([pins]);
}

/**
 * **Η ΑΠΟΔΕΙΞΗ ΩΣ ΣΧΗΜΑ** (ADR-896 §7.3) — οι αποθηκευμένοι κύκλοι παρουσίας (`PublicShowcase.presence`), **ακριβώς**
 * όπως γράφτηκαν: κύκλος με ακτίνα ⇒ το περίγραμμά του· ακτίνα 0 (ακριβής πινέζα αγγελίας) ⇒ σημείο.
 *
 * 🔴 **ADR-846 Φ5δ — ΠΟΤΕ ΔΙΕΥΡΥΝΣΗ, ΠΟΤΕ ΑΡΙΘΜΟΣ**: δεν μεγαλώνει κανέναν κύκλο «για να φαίνεται», δεν ενώνει, δεν
 * μετρά. Το πεδίο είναι ήδη **σύνολο απορροφημένων κύκλων** — λέει *πού*, και δομικά **δεν μπορεί** να πει *πόσα*.
 * Ένα feature ανά κύκλο **χωρίς** ιδιότητες: τίποτα να γίνει ετικέτα πλήθους.
 */
export function presenceFootprintGeoJson(
  presence: readonly GeoCircle[],
): GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: presence.map((circle): GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.Point> => {
      const outline = geoCircleOutline(circle.center, circle.radiusKm * METRES_PER_KM);
      return outline !== null
        ? outlineToGeoJson(outline)
        : { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [circle.center.lng, circle.center.lat] } };
    }),
  };
}
