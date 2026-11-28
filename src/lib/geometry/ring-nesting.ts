/**
 * =============================================================================
 * RING NESTING (SSoT) — «ποιος δακτύλιος είναι περίγραμμα, ποιος τρύπα, και ποιανού;»
 * =============================================================================
 *
 * Το σύνορο ενός συνόλου τριγώνων (`tinBoundaryLoops`) είναι **λίστα** δακτυλίων χωρίς ιεραρχία: αλυσοδένονται πάνω σε
 * μη κατευθυνόμενες ακμές, άρα η φορά τους δεν λέει αν ένας δακτύλιος είναι νησί ή τρύπα. Ένα SVG δεν χρειάζεται την
 * απάντηση (`fill-rule="evenodd"`). Ένα πολύγωνο GeoJSON τη χρειάζεται: ο πρώτος δακτύλιος είναι ο εξωτερικός, οι
 * υπόλοιποι τρύπες **του** — και ο χάρτης το επιβάλλει (δες `geo-geojson.polygonsToGeoJson`).
 *
 * 🔑 **Ο κανόνας είναι ο ίδιος even–odd**, διατυπωμένος ως βάθος: ένας δακτύλιος που περιέχεται σε **άρτιο** πλήθος
 * άλλων είναι περίγραμμα· σε **περιττό**, τρύπα του μικρότερου δακτυλίου που τον περιέχει. Έτσι η κάτοψη (SVG) και ο
 * χάρτης (GeoJSON) γεμίζουν **ακριβώς** τα ίδια σημεία — όχι επειδή συμφώνησαν δύο υλοποιήσεις, αλλά επειδή είναι ο
 * ίδιος ορισμός.
 *
 * 🔑 **Γιατί όχι βιβλιοθήκη boolean πράξεων** (`polygon-clipping`, XOR των δακτυλίων): λύνει γενικότερο πρόβλημα
 * (τεμνόμενα σύνορα) με αριθμητικό sweep που **πετά** σε σχεδόν συμπίπτοντα σημεία. Εδώ η είσοδος είναι σύνορο
 * τριγωνισμού — οι δακτύλιοι **δεν τέμνονται ποτέ** — και η ερώτηση έχει ακριβή, συνδυαστική απάντηση.
 *
 * ⚠️ **Προϋπόθεση (του καλούντος)**: οι δακτύλιοι δεν τέμνονται και δεν μοιράζονται ακμή· επιτρέπεται να ακουμπούν σε
 * **κορυφή**. Γι' αυτό το σημείο ελέγχου κάθε δακτυλίου είναι το **μέσο μιας ακμής του**, ποτέ κορυφή: μια κοινή κορυφή
 * βρίσκεται πάνω στο σύνορο του άλλου, όπου το «μέσα;» δεν έχει απάντηση.
 *
 * Έξοδος κατά RFC 7946 §3.1.6: περιγράμματα **αριστερόστροφα**, τρύπες **δεξιόστροφα** (σε άξονες x ανατολή, y βορράς).
 *
 * @module lib/geometry/ring-nesting
 */

import { pointInPolygon, shoelaceArea, type PlanarPoint } from './planar-polygon';

/** Ένα πολύγωνο με τις τρύπες του — δακτύλιοι **ανοιχτοί** (η πρώτη κορυφή δεν επαναλαμβάνεται). */
export interface NestedPolygon {
  readonly outer: readonly PlanarPoint[];
  readonly holes: readonly (readonly PlanarPoint[])[];
}

interface RingFacts {
  readonly ring: readonly PlanarPoint[];
  /** Εμβαδόν χωρίς πρόσημο. */
  readonly area: number;
  /** `true` ⇒ οι κορυφές είναι ήδη αριστερόστροφα. */
  readonly counterClockwise: boolean;
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  /** Μέσο της πρώτης ακμής με μήκος — σημείο του δακτυλίου που δεν είναι κορυφή. */
  readonly probe: PlanarPoint;
}

function probeOf(ring: readonly PlanarPoint[]): PlanarPoint {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    if (a.x !== b.x || a.y !== b.y) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  return ring[0];
}

function factsOf(ring: readonly PlanarPoint[]): RingFacts {
  const signed = shoelaceArea(ring);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of ring) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  return { ring, area: Math.abs(signed), counterClockwise: signed > 0, minX, minY, maxX, maxY, probe: probeOf(ring) };
}

/** Περιέχει ο `outer` τον `inner`; Μόνο μεγαλύτερος δακτύλιος μπορεί να περιέχει μικρότερο (δεν τέμνονται). */
function contains(outer: RingFacts, inner: RingFacts): boolean {
  if (outer === inner || outer.area <= inner.area) return false;
  const { x, y } = inner.probe;
  if (x < outer.minX || x > outer.maxX || y < outer.minY || y > outer.maxY) return false;
  return pointInPolygon(inner.probe, outer.ring);
}

/** Ο δακτύλιος με τη ζητούμενη φορά (αντίγραφο μόνο όταν χρειάζεται αναστροφή). */
function wound(facts: RingFacts, counterClockwise: boolean): readonly PlanarPoint[] {
  return facts.counterClockwise === counterClockwise ? facts.ring : [...facts.ring].reverse();
}

/**
 * Δακτύλιοι χωρίς ιεραρχία → πολύγωνα με τις τρύπες τους (κανόνας even–odd, δες την κεφαλίδα). Δακτύλιοι με λιγότερες
 * από τρεις κορυφές ή μηδενικό εμβαδόν παραλείπονται: δεν περικλείουν τίποτα. Η σειρά εξόδου ακολουθεί τη σειρά
 * εισόδου των περιγραμμάτων — ίδια είσοδος, ίδια bytes.
 */
export function nestRings(rings: readonly (readonly PlanarPoint[])[]): NestedPolygon[] {
  const all = rings.filter((ring) => ring.length >= 3).map(factsOf).filter((facts) => facts.area > 0);
  const parents = all.map((ring) => all.filter((other) => contains(other, ring)));

  const holesOf = new Map<RingFacts, (readonly PlanarPoint[])[]>();
  all.forEach((ring, i) => {
    if (parents[i].length % 2 === 0) holesOf.set(ring, []);
  });
  all.forEach((ring, i) => {
    if (parents[i].length % 2 === 0) return;
    // Ο άμεσος γονέας μιας τρύπας είναι ο ΜΙΚΡΟΤΕΡΟΣ δακτύλιος που την περιέχει — και έχει άρτιο βάθος, άρα είναι περίγραμμα.
    const parent = parents[i].reduce((smallest, candidate) => (candidate.area < smallest.area ? candidate : smallest));
    holesOf.get(parent)?.push(wound(ring, false));
  });

  return [...holesOf.entries()].map(([outer, holes]) => ({ outer: wound(outer, true), holes }));
}
