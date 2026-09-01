/**
 * @fileoverview SSoT — προβολή γεωγραφικών σημείων σε **τοπικά μέτρα**, γύρω από ένα
 * ρητό origin.
 * @related geo-ring.ts (πρώτος καταναλωτής, μετεγκατεστημένος) · geo-line.ts (δεύτερος)
 * @module lib/geo/geo-local-frame
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΞΑΓΩΓΗ, ΟΧΙ ΝΕΑ ΣΥΝΑΡΤΗΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η ισαπέχουσα κυλινδρική προβολή ζούσε **ιδιωτική** μέσα στο `geo-ring.ts`, με το
 * origin **υπολογισμένο εσωτερικά** ως {@link vertexCentroid} του δακτυλίου. Ο άξονας
 * (`GeoPolyline`) δεν έχει κέντρο βάρους με νόημα — έχει **αρχή**· άρα η ίδια μηχανή
 * χρειάζεται το origin ως **παράμετρο**, όχι ως εσωτερικό συμπέρασμα από τα ίδια τα
 * σημεία. Αντιγραφή της συνάρτησης θα έφτιαχνε δίδυμο μέσα στο ίδιο commit (CHECK
 * 3.28, jscpd) — και σωστά, γιατί τα μαθηματικά είναι κυριολεκτικά τα ίδια. Η εξαγωγή
 * κρατά **μία** μηχανή, με **δύο** καλούντες που διαφωνούν μόνο στο ποιο σημείο
 * παίζει ρόλο origin.
 */

import type { GeoPoint } from '@/types/geo/coordinates';
import { EARTH_RADIUS_METERS } from './geo-distance';

/** Σημείο σε τοπικά μέτρα — `x` κατά μήκος του παραλλήλου, `y` κατά μήκος του μεσημβρινού. */
export interface LocalPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Προβάλλει σημεία σε **τοπικά μέτρα**, γύρω από ρητό `origin`.
 *
 * Ισαπέχουσα κυλινδρική (equirectangular) προβολή: `x` κατά μήκος του παραλλήλου,
 * `y` κατά μήκος του μεσημβρινού. Το σφάλμα είναι **δεύτερης τάξης** ως προς την
 * απόσταση από το origin — για κλίμακα οικοπέδου, κτιρίου ή τμήματος δρόμου (δεκάδες
 * έως εκατοντάδες μέτρα) είναι κάτω από το **0,01 %**, δηλαδή ασύγκριτα μικρότερο από
 * την ακρίβεια ενός σχεδίου με το δάχτυλο.
 *
 * 🔑 **Το origin είναι ΠΑΡΑΜΕΤΡΟΣ, όχι συμπέρασμα.** Ο πρώτος καταναλωτής
 * ({@link geo-ring.ts}) περνούσε πάντα το κέντρο βάρους των ίδιων σημείων· ο δεύτερος
 * (άξονας δρόμου) δεν έχει κέντρο βάρους με νόημα — έχει αρχή. Το να υπολογίζει η
 * συνάρτηση το origin μόνη της θα σήμαινε «σωστό μόνο για δακτυλίους», δηλαδή θα
 * παρέμενε ιδιωτική. Ο καλών αποφασίζει ποιο σημείο είναι το κέντρο του τοπικού
 * επιπέδου — η προβολή απλώς την εφαρμόζει.
 */
export function toLocalMetres(points: readonly GeoPoint[], origin: GeoPoint): readonly LocalPoint[] {
  const metresPerDegree = (Math.PI / 180) * EARTH_RADIUS_METERS;
  const cosLat = Math.cos((origin.lat * Math.PI) / 180);

  return points.map((point) => ({
    x: (point.lng - origin.lng) * metresPerDegree * cosLat,
    y: (point.lat - origin.lat) * metresPerDegree,
  }));
}

/**
 * Ο αντίστροφος μετασχηματισμός του {@link toLocalMetres}: τοπικά μέτρα → `GeoPoint`.
 *
 * 🔑 **Υπάρχει εδώ, όχι δίπλα στον καλούντα**, γιατί είναι το ίδιο ζευγάρι
 * προβολής/αντι-προβολής — η ίδια `metresPerDegree`/`cosLat` άλγεβρα, απλώς λυμένη
 * ως προς το αντίστροφο. Πρώτος καταναλωτής: `geo-line.ts`, που χτίζει περίγραμμα
 * ζώνης σε τοπικά μέτρα (εύκολα offsets/τόξα) και το επιστρέφει σε γεωγραφικές
 * συντεταγμένες για τον χάρτη.
 */
export function fromLocalMetres(point: LocalPoint, origin: GeoPoint): GeoPoint {
  const metresPerDegree = (Math.PI / 180) * EARTH_RADIUS_METERS;
  const cosLat = Math.cos((origin.lat * Math.PI) / 180);

  return {
    lat: origin.lat + point.y / metresPerDegree,
    lng: origin.lng + point.x / (metresPerDegree * cosLat),
  };
}
