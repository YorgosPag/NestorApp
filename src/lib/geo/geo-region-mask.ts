/**
 * @fileoverview **Η ΜΑΣΚΑ ΕΞΩ ΑΠΟ ΤΟ ΟΡΙΟ** — «ο κόσμος μείον την περιοχή», ως ένα γέμισμα.
 * @related ADR-883 · `components/search-results/AdminBoundaryLayer.tsx`
 * @module lib/geo/geo-region-mask
 *
 * 🔑 **Γιατί μάσκα και όχι γέμισμα της περιοχής**: το γέμισμα **μέσα** θα έβαφε ακριβώς
 * εκεί που κοιτάει ο άνθρωπος — πάνω από δρόμους, ονόματα και πινέζες. Η μάσκα σκουραίνει
 * **ό,τι δεν ζήτησε**, και η περιοχή μένει καθαρή. *(Το Zillow περιγράφει μόνο το όριο· η
 * μάσκα είναι το βήμα πάνω από αυτό.)*
 *
 * ⚠️ **Οι τρύπες της περιοχής ξαναγεμίζουν**: ένας θύλακας *μέσα* στον δήμο που **δεν**
 * ανήκει σε αυτόν *(άλλος δήμος περικυκλωμένος)* είναι κι αυτός «εκτός» — άρα μπαίνει ως
 * χωριστό πολύγωνο της μάσκας, όχι ως τρύπα της τρύπας (που ο triangulator δεν ορίζει).
 */

/** Ο κόσμος, όσο τον δείχνει η προβολή Mercator (±85°). */
const WORLD_RING: GeoJSON.Position[] = [
  [-180, -85],
  [180, -85],
  [180, 85],
  [-180, 85],
  [-180, -85],
];

export function regionMaskGeometry(region: GeoJSON.MultiPolygon): GeoJSON.MultiPolygon {
  const outers = region.coordinates.map((polygon) => polygon[0]);
  const enclaves = region.coordinates.flatMap((polygon) => polygon.slice(1).map((hole) => [hole]));
  return { type: 'MultiPolygon', coordinates: [[WORLD_RING, ...outers], ...enclaves] };
}
