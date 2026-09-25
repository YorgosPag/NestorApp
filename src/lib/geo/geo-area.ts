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

import { distanceMeters, EARTH_RADIUS_METERS } from '@/lib/geo/geo-distance';
import { geoRingsNearestEdgeMetres, isPointInGeoRings } from '@/lib/geo/geo-ring';
import type { GeoArea, GeoBoundingBox, GeoCircle, GeoPoint, GeoRegion } from '@/types/geo/coordinates';

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

/** Ορθογώνιο ή κύκλος; Διάκριση με **παρουσία πεδίου** — τα τρία μέλη δεν μοιράζονται κανένα. */
export function isBoundingBox(area: GeoArea): area is GeoBoundingBox {
  return 'south' in area;
}

/** Όριο διοικητικής περιοχής (ADR-883); Το μόνο μέλος με δακτυλίους. */
export function isGeoRegion(area: GeoArea): area is GeoRegion {
  return 'rings' in area;
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
  // 🔑 Όριο ως **υποκείμενο** ⇒ το ορθογώνιό του, που το περιέχει: `within`/`disjoint`
  //    του ορθογωνίου ισχύουν **και** για το όριο· το `intersects` σημαίνει «ίσως».
  const known = isGeoRegion(subject) ? subject.bbox : subject;
  if (isGeoRegion(query)) return areaToRegion(known, query);
  if (isBoundingBox(known)) {
    return isBoundingBox(query) ? boxToBox(known, query) : boxToCircle(known, query);
  }
  return isBoundingBox(query) ? circleToBox(known, query) : circleToCircle(known, query);
}

// ============================================================================
// ΚΥΚΛΟΣ ΠΡΟΣ ΟΡΙΟ — ΜΕ ΑΠΟΔΕΙΞΗ, ΟΧΙ ΕΚΤΙΜΗΣΗ (ADR-883)
// ============================================================================

/**
 * **Είναι ο κύκλος μέσα στο όριο, έξω, ή στο σύνορο;**
 *
 * 🔒 **Δύο αβεβαιότητες προστίθενται, καμία δεν αγνοείται**: η ακτίνα του κύκλου (πόσο
 * καλά ξέρουμε πού είναι η αγγελία) **και** η ανοχή του ορίου (πόσο απλοποιήθηκε το
 * σύνορο). Με `d` = απόσταση του κέντρου από το απλοποιημένο σύνορο, το αληθινό σύνορο
 * απέχει τουλάχιστον `d − ανοχή`. Άρα:
 *
 * | Συνθήκη | Απάντηση |
 * |---|---|
 * | κέντρο μέσα **και** `d ≥ ακτίνα + ανοχή` | `within` — ολόκληρος ο κύκλος μέσα στο αληθινό όριο |
 * | κέντρο έξω **και** `d ≥ ακτίνα + ανοχή` | `disjoint` |
 * | αλλιώς | `intersects` — **«ίσως»**, και η οθόνη το λέει |
 *
 * ⚠️ Το «μέσα;» στο απλοποιημένο σχήμα είναι αξιόπιστο **μόνο** όταν `d ≥ ανοχή` — και η
 * συνθήκη το εξασφαλίζει, αφού `ακτίνα ≥ 0`.
 */
function circleToRegion(subject: GeoCircle, query: GeoRegion): AreaRelation {
  const marginM = subject.radiusKm * 1000 + query.toleranceM;
  const edgeM = geoRingsNearestEdgeMetres(subject.center, query.rings);
  if (edgeM < marginM) return 'intersects';
  return isPointInGeoRings(subject.center, query.rings) ? 'within' : 'disjoint';
}

/**
 * Ορθογώνιο ή κύκλος προς όριο. Το ορθογώνιο κρίνεται με τον **περιγεγραμμένο κύκλο**
 * του — συντηρητικά: `within`/`disjoint` του κύκλου ισχύουν και για το ορθογώνιο.
 * 🔑 Φτηνός αποκλεισμός πρώτα: υποκείμενο έξω από το ορθογώνιο του ορίου = `disjoint`.
 */
function areaToRegion(subject: GeoCircle | GeoBoundingBox, query: GeoRegion): AreaRelation {
  const subjectBox = isBoundingBox(subject) ? subject : areaBoundingBox(subject);
  if (boxToBox(subjectBox, query.bbox) === 'disjoint') return 'disjoint';
  return circleToRegion(isBoundingBox(subject) ? boxBoundingCircle(subject) : subject, query);
}

function boxBoundingCircle(box: GeoBoundingBox): GeoCircle {
  const center = { lat: (box.south + box.north) / 2, lng: (box.west + box.east) / 2 };
  const radiusM = Math.max(...boxCorners(box).map((corner) => distanceMeters(center, corner)));
  return { center, radiusKm: radiusM / 1000 };
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

// ============================================================================
// ΤΟ ΠΕΡΙΓΕΓΡΑΜΜΕΝΟ ΟΡΘΟΓΩΝΙΟ — για ερωτήματα, όχι για κρίση (ADR-777 §8.65)
// ============================================================================

/** Μέτρα ανά μοίρα **γεωγραφικού πλάτους** — σταθερό σε όλη τη σφαίρα (≈ 111 195 m). */
const METRES_PER_DEGREE_LATITUDE = (Math.PI / 180) * EARTH_RADIUS_METERS;

/** Μοίρες → ακτίνια, γραμμένο μία φορά. */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * **Η περιοχή ως ορθογώνιο** — ό,τι μπορεί να ρωτηθεί σε βάση δεδομένων.
 *
 * 🔴 **ΔΕΝ ΑΝΤΙΚΑΘΙΣΤΑ ΤΟ {@link areaRelation} — ΤΟ ΤΡΟΦΟΔΟΤΕΙ.** Το περιγεγραμμένο
 * ορθογώνιο ενός κύκλου είναι **μεγαλύτερο** από τον κύκλο κατά ~21,5% (τετράγωνο
 * προς εγγεγραμμένο κύκλο), άρα ένα φίλτρο που σταματούσε εδώ θα έλεγε **ναι** σε
 * αγγελίες που ο κριτής λέει **όχι**. Είναι το κλασικό ζεύγος *«φθηνό φίλτρο ⇒
 * ακριβής κρίση»*: το ορθογώνιο **στενεύει** την ανάγνωση, το `areaRelation`
 * **αποφασίζει**.
 *
 * ⚠️ **Το ίδιο όριο με το υπόλοιπο αρχείο**: δεν καλύπτεται ο αντιμεσημβρινός. Ένα
 * ορθογώνιο που θα τύλιγε στις ±180° **δεν εκφράζεται** από τον {@link GeoBoundingBox},
 * και ένα που *έμοιαζε* να το χειρίζεται θα ήταν χειρότερο από ένα που το δηλώνει.
 */
export function areaBoundingBox(area: GeoArea): GeoBoundingBox {
  if (isBoundingBox(area)) return area;
  if (isGeoRegion(area)) return area.bbox;

  const latitudeSpan = (area.radiusKm * 1000) / METRES_PER_DEGREE_LATITUDE;
  const north = area.center.lat + latitudeSpan;
  const south = area.center.lat - latitudeSpan;

  // 🔑 **Το γεωγραφικό μήκος μετριέται στην ΑΚΡΑΙΑ παράλληλο, όχι στο κέντρο — ΚΑΙ Ο
  //    ΛΟΓΟΣ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΟΣ, ΟΧΙ ΔΙΑΙΣΘΗΤΙΚΟΣ.** Ο κλασικός τύπος του
  //    περιγεγραμμένου ορθογωνίου σφαιρικού δίσκου είναι `Δλ = asin(sin(r/R)/cos(φ))`.
  //    Η **επίπεδη** προσέγγιση `Δφ/cos(φ_κέντρου)` — που είναι το προφανές — δίνει
  //    τιμή **μικρότερη** από εκείνο το φράγμα, δηλαδή ορθογώνιο που **κόβει** ό,τι
  //    υποτίθεται ότι περικλείει.
  //
  // 📏 Μετρημένο (δίσκος 50 χλμ στις 60°): φράγμα `0,899348°` · κέντρο `0,899320°`
  //    ⇒ **λείπουν ~1,5 m** · ακραία παράλληλος `0,911742°` ⇒ περιέχει με περιθώριο.
  //
  // 🔴 **Το εύρημα ήρθε από ΜΕΤΡΗΣΗ ΜΕΤΑΛΛΑΞΗΣ, όχι από ανάγνωση**: η αρχική άγκυρα
  //    έλεγχε ότι η **γωνία** απέχει περισσότερο από την ακτίνα — αληθές για κάθε
  //    εύλογη υλοποίηση, γιατί η διαγώνιος είναι πάντα μεγαλύτερη από την πλευρά. Η
  //    εκδοχή «κέντρο» πέρασε **πράσινη**. Η άγκυρα ζητά πλέον το **σφαιρικό φράγμα**.
  //
  // ⚠️ Το ίδιο πρόσημο σφάλματος είναι **υποχρεωτικό** και για το
  //    {@link expandBoundingBox}: εκεί η διεύρυνση πρέπει να καλύπτει τη **βόρεια
  //    γωνία** του ορθογωνίου, όπου η μοίρα μήκους είναι η κοντύτερη. Ένας κοινός
  //    βοηθός, ένα πρόσημο: **ποτέ λιγότερο απ' όσο χρειάζεται**.
  const longitudeSpan = latitudeSpan / Math.cos(toRadians(widestLatitude(north, south)));

  return {
    north,
    south,
    east: area.center.lng + longitudeSpan,
    west: area.center.lng - longitudeSpan,
  };
}

/**
 * **Διεύρυνε το ορθογώνιο κατά τόσα χιλιόμετρα προς κάθε πλευρά.**
 *
 * 🔴 **Υπάρχει επειδή το φθηνό φίλτρο ΚΟΒΕΙ ΤΗΝ ΤΡΙΤΗ ΚΑΤΗΓΟΡΙΑ.** Μια αγγελία που
 * ξέρουμε μόνο *«κάπου στην πόλη»* έχει **σημείο** έξω από την οθόνη και **περιοχή**
 * που την τέμνει: ο κριτής θα την έλεγε `'intersects'` *(«ίσως»)*, αλλά ένα ερώτημα
 * πάνω στο **σημείο** δεν θα την κατέβαζε ποτέ — και το «ίσως» θα εξαφανιζόταν
 * **σιωπηλά**, χωρίς να αλλάξει γραμμή στον κριτή.
 *
 * ⇒ Το ορθογώνιο ανάγνωσης διευρύνεται κατά τη **μέγιστη** αβεβαιότητα που μπορεί να
 * έχει αγγελία. Ό,τι μπαίνει περιττά, το κόβει ο κριτής **στη μνήμη**.
 */
export function expandBoundingBox(box: GeoBoundingBox, kilometres: number): GeoBoundingBox {
  const latitudeSpan = (kilometres * 1000) / METRES_PER_DEGREE_LATITUDE;
  const north = box.north + latitudeSpan;
  const south = box.south - latitudeSpan;

  // Ίδιο σκεπτικό με το {@link areaBoundingBox}: η φαρδύτερη προσθήκη μήκους είναι
  // αυτή της **ακραίας** παραλλήλου, αλλιώς η διεύρυνση υπολείπεται εκεί που μετράει.
  const longitudeSpan = latitudeSpan / Math.cos(toRadians(widestLatitude(north, south)));

  return {
    north,
    south,
    east: box.east + longitudeSpan,
    west: box.west - longitudeSpan,
  };
}

/**
 * Η παράλληλος όπου μια μοίρα μήκους είναι η **κοντύτερη** — δηλαδή η μακρύτερη από
 * τον ισημερινό. Ψαλιδίζεται ώστε το `cos` να μη μηδενιστεί στους πόλους.
 */
function widestLatitude(north: number, south: number): number {
  const extreme = Math.max(Math.abs(north), Math.abs(south));
  return Math.min(extreme, POLE_GUARD_LATITUDE);
}

/**
 * ⚠️ **Δεν είναι το όριο του Web Mercator** *(85,051°, `lib/maps/metric-size.ts`)* —
 * εκείνο είναι ιδιότητα **προβολής**. Αυτό είναι φρουρός **διαίρεσης**: στους 90° το
 * `cos` μηδενίζεται και το άνοιγμα μήκους απειρίζεται. Δύο διαφορετικοί λόγοι, δύο
 * σταθερές — κοινή τιμή θα τις κλείδωνε μαζί χωρίς αιτία.
 */
const POLE_GUARD_LATITUDE = 89.9;
