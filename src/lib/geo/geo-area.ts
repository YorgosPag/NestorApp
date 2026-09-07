/**
 * # Η ΣΧΕΣΗ ΔΥΟ ΠΕΡΙΟΧΩΝ — **ΤΡΕΙΣ ΑΠΑΝΤΗΣΕΙΣ, ΟΧΙ ΔΥΟ** (ADR-777 §8.63)
 *
 * Το ερώτημα *«είναι αυτό εδώ;»* έχει **τρεις** τίμιες απαντήσεις όταν το «αυτό» δεν
 * είναι σημείο αλλά **περιοχή**: *ναι, ολόκληρο* · *ίσως, εν μέρει* · *όχι*.
 *
 * ## 🏆 ΤΟ ΛΕΞΙΛΟΓΙΟ ΔΕΝ ΕΙΝΑΙ ΔΙΚΟ ΜΑΣ — ΕΙΝΑΙ ΤΟ ΠΡΟΤΥΠΟ, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΤΟ ΝΟΗΜΑ
 *
 * Τα ονόματα του {@link AreaRelation} είναι **κατά λέξη** το μοντέλο χωρικών σχέσεων
 * της OGC *(DE-9IM)* — εκείνο που εκθέτουν αυτούσιο η **Elasticsearch** *(`geo_shape`
 * query, `relation: within | intersects | disjoint | contains`)* και η **PostGIS**
 * *(`ST_Within` / `ST_Intersects` / `ST_Disjoint`)*.
 *
 * 🔑 **Άρα η «τρίτη κατηγορία» δεν είναι εφεύρεση αυτού του έργου: είναι η ΚΑΝΟΝΙΚΗ
 * ερώτηση της γεωμετρίας, και οι πλατφόρμες ακινήτων την ΥΠΟΒΑΘΜΙΖΟΥΝ σε δυαδική.**
 * Zillow, Redfin, Idealista και Rightmove φιλτράρουν με *bounding box* πάνω σε
 * **σημείο** — δηλαδή απαντούν `within` ή `disjoint` και **δεν έχουν όνομα** για το
 * ενδιάμεσο. Το ενδιάμεσο όμως υπάρχει, και είναι μεγάλο: ο **ίδιος ο Redfin**
 * δημοσίευσε ότι η γεωκωδικοποίησή του φτάνει σε ακρίβεια στέγης στο **69,1%** των
 * αγγελιών — άρα περίπου **μία στις τρεις** κρίνεται σαν σημείο ενώ **δεν είναι**.
 *
 * ⚠️ **Δεν υλοποιείται το `contains`** *(«η περιοχή της αγγελίας περιέχει την οθόνη»)*.
 * Δεν λείπει από αμέλεια: η οθόνη **δεν** το ρωτά ποτέ, και μια τέταρτη τιμή που
 * κανείς δεν παράγει θα ήταν κλάδος που **καμία** άγκυρα δεν μπορεί να κοκκινίσει —
 * δηλαδή σχόλιο μεταμφιεσμένο σε κώδικα *(μάθημα CHECK 3.54)*. Η περίπτωση **δεν
 * χάνεται**: απαντιέται `'intersects'`, που είναι η **σωστή** απάντηση στο ερώτημα
 * που όντως ρωτιέται *(«ίσως»)*.
 *
 * ## ⚠️ ΟΡΙΟ ΠΟΥ ΔΗΛΩΝΕΤΑΙ ΑΝΤΙ ΝΑ ΚΡΥΒΕΤΑΙ
 *
 * Οι έλεγχοι είναι **επίπεδοι πάνω σε σφαιρικές αποστάσεις**: κάθε μέτρηση μήκους
 * περνά από το {@link distanceMeters} *(το ΕΝΑ SSoT απόστασης του έργου)*, αλλά η
 * σύγκριση «πλευρά προς πλευρά» γίνεται σε μοίρες. Σε κλίμακα **πόλης** — τη μόνη
 * κλίμακα στην οποία ρωτιέται αυτό — το σφάλμα είναι μικρότερο από την ίδια την
 * αβεβαιότητα που μετράμε. **Δεν καλύπτεται ο αντιμεσημβρινός** (±180°): το
 * {@link GeoBoundingBox} του έργου δεν εκφράζει τυλιγμένο ορθογώνιο, και ένα φίλτρο
 * που *έμοιαζε* να το χειρίζεται θα ήταν χειρότερο από ένα που δηλώνει ότι δεν το κάνει.
 */

import { distanceMeters } from '@/lib/geo/geo-distance';
import type { GeoArea, GeoBoundingBox, GeoCircle, GeoPoint } from '@/types/geo/coordinates';

/**
 * **ΝΑΙ · ΙΣΩΣ · ΟΧΙ** — η σχέση ενός *υποκειμένου* προς μια *περιοχή ερωτήματος*.
 *
 * ⚠️ **Το `'intersects'` εδώ σημαίνει ρητά «τέμνεται ΧΩΡΙΣ να περιέχεται».** Στην
 * Elasticsearch οι σχέσεις **επικαλύπτονται** (κάθε `within` είναι **και**
 * `intersects`), οπότε ο καλών πρέπει να θυμάται τη σειρά των ελέγχων — και κάποιος
 * θα την ξεχνούσε. Εδώ οι τρεις τιμές είναι **αμοιβαία αποκλειόμενες και
 * εξαντλητικές**: κάθε αγγελία πέφτει σε **ακριβώς έναν** κάδο, που είναι η
 * προϋπόθεση για να **κλείνει** η λογιστική της οθόνης (κανόνας 27).
 */
export type AreaRelation = 'within' | 'intersects' | 'disjoint';

/** Ορθογώνιο ή κύκλος; Διάκριση με **παρουσία πεδίου** — τα δύο μέλη δεν μοιράζονται κανένα. */
export function isBoundingBox(area: GeoArea): area is GeoBoundingBox {
  return 'south' in area;
}

/** Το **πλησιέστερο** σημείο ενός ορθογωνίου προς ένα σημείο — clamp σε κάθε άξονα. */
function nearestPointInBox(point: GeoPoint, box: GeoBoundingBox): GeoPoint {
  return {
    lat: Math.min(Math.max(point.lat, box.south), box.north),
    lng: Math.min(Math.max(point.lng, box.west), box.east),
  };
}

/** Οι τέσσερις γωνίες — το **μακρινότερο** σημείο ορθογωνίου είναι πάντα γωνία. */
function boxCorners(box: GeoBoundingBox): readonly GeoPoint[] {
  return [
    { lat: box.south, lng: box.west },
    { lat: box.south, lng: box.east },
    { lat: box.north, lng: box.west },
    { lat: box.north, lng: box.east },
  ];
}

/** Είναι το σημείο **μέσα** στο ορθογώνιο; Το σύνορο μετρά ως μέσα. */
function pointInBox(point: GeoPoint, box: GeoBoundingBox): boolean {
  return (
    point.lat >= box.south &&
    point.lat <= box.north &&
    point.lng >= box.west &&
    point.lng <= box.east
  );
}

/**
 * Η **μικρότερη** απόσταση από ένα εσωτερικό σημείο ως κάποια πλευρά, σε μέτρα.
 *
 * ⚠️ Μετριέται **ανά άξονα με σταθερή την άλλη συντεταγμένη** — ποτέ προς γωνία: η
 * κοντινότερη απόσταση σε *πλευρά* είναι η κάθετη, και μια μέτρηση προς γωνία θα την
 * **υπερεκτιμούσε**, δηλαδή θα απαντούσε «χωράει ολόκληρος» για κύκλο που ξεχειλίζει.
 */
function metresToNearestEdge(center: GeoPoint, box: GeoBoundingBox): number {
  return Math.min(
    distanceMeters(center, { lat: box.north, lng: center.lng }),
    distanceMeters(center, { lat: box.south, lng: center.lng }),
    distanceMeters(center, { lat: center.lat, lng: box.east }),
    distanceMeters(center, { lat: center.lat, lng: box.west })
  );
}

/** Κύκλος → κύκλος. */
function circleToCircle(subject: GeoCircle, query: GeoCircle): AreaRelation {
  const gap = distanceMeters(subject.center, query.center);
  const subjectM = subject.radiusKm * 1000;
  const queryM = query.radiusKm * 1000;

  if (gap > subjectM + queryM) return 'disjoint';
  if (gap + subjectM <= queryM) return 'within';
  return 'intersects';
}

/** Κύκλος → ορθογώνιο. */
function circleToBox(subject: GeoCircle, query: GeoBoundingBox): AreaRelation {
  const radiusM = subject.radiusKm * 1000;
  const inside = pointInBox(subject.center, query);

  if (!inside) {
    const gap = distanceMeters(subject.center, nearestPointInBox(subject.center, query));
    return gap > radiusM ? 'disjoint' : 'intersects';
  }
  return metresToNearestEdge(subject.center, query) >= radiusM ? 'within' : 'intersects';
}

/** Ορθογώνιο → κύκλος. */
function boxToCircle(subject: GeoBoundingBox, query: GeoCircle): AreaRelation {
  const radiusM = query.radiusKm * 1000;
  const gap = distanceMeters(query.center, nearestPointInBox(query.center, subject));
  if (gap > radiusM) return 'disjoint';

  const furthest = Math.max(
    ...boxCorners(subject).map((corner) => distanceMeters(query.center, corner))
  );
  return furthest <= radiusM ? 'within' : 'intersects';
}

/** Ορθογώνιο → ορθογώνιο. */
function boxToBox(subject: GeoBoundingBox, query: GeoBoundingBox): AreaRelation {
  const apart =
    subject.south > query.north ||
    subject.north < query.south ||
    subject.west > query.east ||
    subject.east < query.west;
  if (apart) return 'disjoint';

  const contained =
    subject.south >= query.south &&
    subject.north <= query.north &&
    subject.west >= query.west &&
    subject.east <= query.east;
  return contained ? 'within' : 'intersects';
}

/**
 * **Η ΜΙΑ ΕΡΩΤΗΣΗ**: πώς σχετίζεται το `subject` με την περιοχή `query`;
 *
 * 🔑 **Τα δύο ορίσματα ΔΕΝ είναι εναλλάξιμα, και η ασυμμετρία ΕΙΝΑΙ το νόημα.** Το
 * `subject` είναι *«πού μπορεί να βρίσκεται το ακίνητο»*, το `query` *«πού κοιτάει ο
 * άνθρωπος»*. Το `'within'` λέει *«ό,τι κι αν ισχύει μέσα στην αβεβαιότητά μας, το
 * ακίνητο είναι στην οθόνη»* — δηλαδή **βεβαιότητα παρά την άγνοια**. Η αντίστροφη
 * ερώτηση είναι διαφορετική ερώτηση και δίνει, σωστά, διαφορετική απάντηση.
 *
 * ⚠️ **Αγγελία που ξέρουμε ΑΚΡΙΒΩΣ πού είναι δεν παίρνει ΠΟΤΕ `'intersects'`** — και
 * δεν χρειάστηκε ειδική περίπτωση: το σημείο εκφράζεται ως κύκλος **μηδενικής**
 * ακτίνας, όπου το `within` και το `intersects` **συμπίπτουν γεωμετρικά**. Η
 * βεβαιότητα δίνει δυαδική απάντηση **επειδή είναι βεβαιότητα**, όχι επειδή κάποιος
 * έγραψε `if`.
 */
export function areaRelation(subject: GeoArea, query: GeoArea): AreaRelation {
  if (isBoundingBox(subject)) {
    return isBoundingBox(query) ? boxToBox(subject, query) : boxToCircle(subject, query);
  }
  return isBoundingBox(query) ? circleToBox(subject, query) : circleToCircle(subject, query);
}

/**
 * Τέμνονται καθόλου; — *«υπάρχει έστω ένα κοινό σημείο»*.
 *
 * 🔑 Υπάρχει επειδή **δύο** καλούντες ρωτούν ακριβώς αυτό και **τίποτα άλλο**: η
 * ομοιότητα δύο εντολών ζήτησης *(`demand-similarity`)* και κάθε μελλοντικός έλεγχος
 * επικάλυψης. Χωρίς όνομα, ο καθένας θα έγραφε `!== 'disjoint'` — και ο τρίτος θα το
 * έγραφε **λάθος**.
 */
export function areasOverlap(a: GeoArea, b: GeoArea): boolean {
  return areaRelation(a, b) !== 'disjoint';
}
