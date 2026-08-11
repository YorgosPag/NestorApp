/**
 * @fileoverview **ΤΑ ΤΡΙΑ ΕΡΩΤΗΜΑΤΑ ΠΡΟΣ ΤΟ OSM** — ποιο είναι εδώ · υπάρχει · τι σχήμα έχει.
 * @related ADR-777 · SPEC-777A §13.2 · §13.4 (ODbL) · §13.5 · §14.4 (κανόνας 2)
 * @module lib/geo/osm/osm-building
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΡΙΑ ΕΡΩΤΗΜΑΤΑ, ΤΡΕΙΣ ΣΥΝΑΡΤΗΣΕΙΣ — ΚΑΙ Η ΤΡΙΤΗ ΕΙΝΑΙ ΤΟ ΝΟΜΙΚΟ ΟΡΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Ερώτημα | Ποιος ρωτά | Τι επιστρέφει | Αποθηκεύεται; |
 * |---|---|---|---|
 * | *«ποιο κτίριο πάτησα;»* | ο **επιλογέας** | αναφορά + γεγονότα | — (μόνο η αναφορά ταξιδεύει) |
 * | *«υπάρχει αυτό, και είναι κτίριο;»* | ο **γραφέας** (§14.4 κανόνας 2) | αναφορά + **σημείο** + διεύθυνση | ✅ |
 * | *«τι σχήμα έχει;»* | ο **χάρτης**, σε κάθε εμφάνιση | **περίγραμμα** | 🔴 **ΠΟΤΕ** |
 *
 * 🔑 **Ο διαχωρισμός ΔΕΝ είναι οργάνωση κώδικα — είναι το §13.4 ως δομή.** Το OSMF
 * Geocoding Guideline επιτρέπει αποθήκευση «*names, addresses, and/or
 * latitude/longitude*»· το **περίγραμμα δεν αναφέρεται** εκεί. Γι' αυτό η δεύτερη
 * συνάρτηση ρωτά `out center tags` (σημείο + ετικέτες — **αποθηκεύσιμα**) και η τρίτη
 * `out geom` (σχήμα — **μόνο για να ζωγραφιστεί**). Δύο φράσεις εξόδου, δύο νομικές
 * κατηγορίες, και **καμία διαδρομή** από την τρίτη προς τη βάση: ο τύπος
 * `PlacePosition` δηλώνει `outline?: never` στον κλάδο `osm`.
 *
 * ⛔ **ΜΗΝ «βελτιστοποιήσεις» συγχωνεύοντας τη δεύτερη με την τρίτη.** Ένα κοινό
 * `out geom tags` θα έφερνε το περίγραμμα **στο ίδιο αντικείμενο** με τα αποθηκεύσιμα
 * πεδία, και το όριο θα κρεμόταν από το να θυμηθεί κάποιος να μην το γράψει.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔶 ΔΗΛΩΜΕΝΟ ΟΡΙΟ, **ΜΕ ΜΕΤΡΗΣΗ**: ΟΙ ΣΧΕΣΕΙΣ (multipolygon)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μετρήθηκε στο Overpass (2026-08-11, Θεσσαλονίκη ~7×6 km):
 * **38 972 `way` έναντι 93 `relation`** ⇒ οι σχέσεις είναι **0,24 %** των κτιρίων.
 *
 * - Η **επιλογή** ρωτά μόνο `way`: η δοκιμή περιεκτικότητας θέλει **κλειστό δακτύλιο**,
 *   και μια σχέση τον δίνει σε **κομμάτια** που πρέπει να ραφτούν. Ένα κτίριο-σχέση
 *   συμπεριφέρεται, από την πλευρά του επιλογέα, **ακριβώς σαν κενό του OSM** — και το
 *   §13.6 έχει ήδη απάντηση για τα κενά: πινέζα ή σχεδίαση.
 * - Η **επαλήθευση** δέχεται **και τους τρεις** τύπους: το `out center tags` απαντά
 *   ομοιόμορφα, άρα μια αναφορά που ήρθε από αλλού δεν απορρίπτεται χωρίς λόγο.
 * - Το **περίγραμμα** δίνεται μόνο για `way`· για `node`/`relation` επιστρέφεται `null`
 *   **ονομαστικά**, ποτέ κενός πίνακας (που θα διαβαζόταν ως «κτίριο χωρίς σχήμα»).
 *
 * **Layering**: leaf — δίκτυο + καθαρές συναρτήσεις. Καμία εξάρτηση από Firestore.
 */

import { isPointInGeoOutline, geoOutlineAreaSqm } from '@/lib/geo/geo-ring';
import type { GeoOutline, GeoPoint } from '@/types/geo/coordinates';
import type { OsmElementType } from '@/types/geo/public-place';
import {
  overpassQuerySeconds,
  runOverpassQueryStrict,
  type OverpassElement,
} from './overpass-client';

// =============================================================================
// 1. ΤΙ ΜΑΘΑΙΝΟΥΜΕ ΓΙΑ ΕΝΑ ΚΤΙΡΙΟ — και τι επίτηδες ΔΕΝ μαθαίνουμε
// =============================================================================

/** Οι διευθυνσιακές ετικέτες, όπως τις γράφει το OSM. Ό,τι λείπει είναι `null`. */
export interface OsmAddressTags {
  readonly street: string | null;
  readonly houseNumber: string | null;
  readonly city: string | null;
  readonly postalCode: string | null;
}

/**
 * Ό,τι το OSM λέει για ένα κτίριο, **περιορισμένο σε ό,τι επιτρέπεται να αποθηκευτεί**.
 *
 * 🔶 **ΔΕΝ περιέχει `useCode`, και είναι απόφαση με λόγο.** Το OSM δίνει
 * `building=apartments|house|retail|…` — δεκάδες τιμές, **ανοιχτό** σύνολο. Ο τύπος
 * {@link PublicBuilding} όμως δηλώνει ρητά *«χρήση, ως **κωδικός λεξιλογίου** — ποτέ
 * ελεύθερο κείμενο προς εμφάνιση (N.11)»*. Περνώντας την ωμή τιμή θα γεννούσαμε
 * **ωμό κλειδί i18n στην οθόνη** την πρώτη φορά που κάποιος μαρκάρει
 * `building=greenhouse` — ακριβώς η αστοχία που φρουρεί το CHECK 3.36.
 *
 * Η σωστή θεραπεία είναι **χαρτογράφηση προς κλειστό δικό μας λεξιλόγιο**, με ρητή
 * κατάσταση «άλλο» — δηλαδή **απόφαση τομέα** που δεν λαμβάνεται σιωπηλά μέσα σε έναν
 * αναγνώστη ετικετών. Μέχρι τότε το `useCode` μένει `null`, που ο τύπος **ήδη**
 * εκφράζει ως «δεν το ξέρουμε».
 */
export interface OsmBuildingFact {
  readonly elementType: OsmElementType;
  readonly elementId: string;
  /** Το αντιπροσωπευτικό σημείο, **όπως το έδωσε το Overpass** (`out center`). */
  readonly point: GeoPoint;
  readonly address: OsmAddressTags;
  /** `building:levels` — μετρημένη κάλυψη **17 %** στο κέντρο Θεσσαλονίκης. */
  readonly floorsAboveGround: number | null;
  /** `start_date` — μετρημένη κάλυψη **1,4 %**. Σχεδόν πάντα `null`, και το λέμε. */
  readonly constructionYear: number | null;
}

// =============================================================================
// 2. ΑΝΑΓΝΩΣΗ ΕΤΙΚΕΤΩΝ — καθαρή, δοκιμάσιμη χωρίς δίκτυο
// =============================================================================

function tag(element: OverpassElement, key: string): string | null {
  const value = element.tags?.[key]?.trim();
  return value === undefined || value === '' ? null : value;
}

/**
 * Ετικέτα → ακέραιος, ή `null`.
 *
 * ⚠️ **Το OSM είναι ελεύθερο κείμενο και το δείχνει.** Μετρημένο δείγμα από το κέντρο
 * Θεσσαλονίκης: `addr:housenumber: "53,60"` — **δύο** αριθμοί σε ένα πεδίο. Τα
 * αριθμητικά πεδία δέχονται **μόνο** καθαρό ακέραιο· ό,τι άλλο γίνεται `null`, γιατί
 * ένα `parseInt('4-6')` θα έγραφε **4** στο κοινό επίπεδο Α ως γεγονός.
 */
function integerTag(element: OverpassElement, key: string): number | null {
  const raw = tag(element, key);
  if (raw === null || !/^\d{1,4}$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/** Το σημείο ενός στοιχείου: κόμβος έχει δικό του, way/relation έχουν `center`. */
function elementPoint(element: OverpassElement): GeoPoint | null {
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (lat === undefined || lon === undefined) return null;
  return { lat, lng: lon };
}

/** Το περίγραμμα ενός `way` από `out geom`. */
function elementOutline(element: OverpassElement): GeoOutline | null {
  const geometry = element.geometry;
  if (geometry === undefined || geometry.length < 3) return null;

  // ⚠️ Το OSM **επαναλαμβάνει** την πρώτη κορυφή στο τέλος ενός κλειστού way· ο
  // {@link GeoOutline} ορίζει ρητά ότι *«δεν επαναλαμβάνεται η πρώτη κορυφή»*, γιατί
  // «το κλείσιμο είναι ιδιότητα του τύπου». Η μετατροπή γίνεται **εδώ, στο σύνορο**.
  const first = geometry[0];
  const last = geometry[geometry.length - 1];
  const closed = first.lat === last.lat && first.lon === last.lon;
  const ring = closed ? geometry.slice(0, -1) : geometry;

  return ring.length < 3 ? null : ring.map((v) => ({ lat: v.lat, lng: v.lon }));
}

function isBuilding(element: OverpassElement): boolean {
  // ⚠️ `building=no` υπάρχει στο OSM και σημαίνει **ρητά «δεν είναι κτίριο»**. Ένας
  // έλεγχος «υπάρχει η ετικέτα;» θα το δεχόταν.
  const value = tag(element, 'building');
  return value !== null && value !== 'no';
}

function factFrom(element: OverpassElement): OsmBuildingFact | null {
  const point = elementPoint(element);
  if (point === null) return null;

  return {
    elementType: element.type as OsmElementType,
    elementId: String(element.id),
    point,
    address: {
      street: tag(element, 'addr:street'),
      houseNumber: tag(element, 'addr:housenumber'),
      city: tag(element, 'addr:city'),
      postalCode: tag(element, 'addr:postcode'),
    },
    floorsAboveGround: integerTag(element, 'building:levels'),
    constructionYear: integerTag(element, 'start_date'),
  };
}

// =============================================================================
// 3. «ΠΟΙΟ ΚΤΙΡΙΟ ΠΑΤΗΣΑ;»
// =============================================================================

/**
 * Πόσο μακριά ψάχνουμε γύρω από το κλικ.
 *
 * ⚠️ **Δεν είναι ανοχή στόχευσης — είναι όριο άντλησης.** Το κριτήριο επιλογής είναι
 * **περιεκτικότητα** (δες {@link findOsmBuildingAt}), όχι εγγύτητα· η ακτίνα υπάρχει
 * μόνο για να μη ζητήσουμε ολόκληρη την πόλη. 50 m καλύπτει κάθε κτίριο του οποίου το
 * περίγραμμα μπορεί να περιέχει το σημείο.
 */
const PICK_RADIUS_METRES = 50;

export type OsmBuildingPick =
  | { readonly kind: 'found'; readonly fact: OsmBuildingFact; readonly outline: GeoOutline }
  /** Δεν υπάρχει κτίριο **εκεί** — ο άνθρωπος πάει στην εναλλακτική του §13.6. */
  | { readonly kind: 'none' }
  /** Δεν μάθαμε. **Ποτέ** δεν διαβάζεται ως «όχι». */
  | { readonly kind: 'unavailable' };

/**
 * **Ποιο κτίριο βρίσκεται σε αυτό το σημείο;**
 *
 * 🔑 **Κριτήριο: ΠΕΡΙΕΚΤΙΚΟΤΗΤΑ, ποτέ εγγύτητα.** Το «πλησιέστερο κτίριο» είναι
 * **εικασία** — και το §13.3 απαγορεύει ρητά την «εικασία εγγύτητας» ως τρόπο να
 * αποφασιστεί ταυτότητα. Αν το σημείο δεν πέφτει **μέσα** σε κανένα περίγραμμα, η
 * απάντηση είναι **`none`**, και ο άνθρωπος έχει ήδη δύο άλλες χειρονομίες.
 *
 * ⚠️ **Όταν περιέχεται σε περισσότερα από ένα, νικά το ΜΙΚΡΟΤΕΡΟ.** Το OSM
 * μοντελοποιεί συχνά ένα συγκρότημα ως μεγάλο περίγραμμα με μικρότερα μέσα του
 * (`building:part`, πτέρυγες, εσωτερικές αυλές). Το μικρότερο είναι το **πιο
 * συγκεκριμένο** — και η επιλογή δεν είναι εικασία **ταυτότητας** αλλά επιλογή
 * **ανάλυσης**: και τα δύο περιέχουν πραγματικά το σημείο.
 */
export async function findOsmBuildingAt(point: GeoPoint): Promise<OsmBuildingPick> {
  const query = `
    [out:json][timeout:${overpassQuerySeconds()}];
    way["building"](around:${PICK_RADIUS_METRES},${point.lat},${point.lng});
    out geom tags;
  `.trim();

  const outcome = await runOverpassQueryStrict(query);
  if (!outcome.ok) return { kind: 'unavailable' };

  const containing = outcome.elements
    .filter(isBuilding)
    .map((element) => ({ element, outline: elementOutline(element) }))
    .filter((candidate): candidate is { element: OverpassElement; outline: GeoOutline } =>
      candidate.outline !== null && isPointInGeoOutline(point, candidate.outline),
    )
    .sort((a, b) => geoOutlineAreaSqm(a.outline) - geoOutlineAreaSqm(b.outline));

  const winner = containing[0];
  if (winner === undefined) return { kind: 'none' };

  // ⚠️ Το `out geom` **δεν** δίνει `center`. Το αντιπροσωπευτικό σημείο θα το ζητήσει
  // ο **γραφέας** από την επαλήθευση (`out center`), ώστε ό,τι αποθηκεύεται να είναι
  // η απάντηση **του Overpass** και όχι δικός μας υπολογισμός πάνω σε γεωμετρία που
  // δεν επιτρέπεται να κρατήσουμε. Εδώ αρκεί το κέντρο βάρους για την **προεπισκόπηση**.
  const fact = factFrom({ ...winner.element, center: centreOf(winner.outline) });
  if (fact === null) return { kind: 'none' };

  return { kind: 'found', fact, outline: winner.outline };
}

/** Κέντρο βάρους κορυφών, στη μορφή που περιμένει το `OverpassElement.center`. */
function centreOf(outline: GeoOutline): { lat: number; lon: number } {
  let lat = 0;
  let lon = 0;
  for (const vertex of outline) {
    lat += vertex.lat;
    lon += vertex.lng;
  }
  return { lat: lat / outline.length, lon: lon / outline.length };
}

// =============================================================================
// 4. «ΥΠΑΡΧΕΙ, ΚΑΙ ΕΙΝΑΙ ΚΤΙΡΙΟ;» — η επαλήθευση πηγής του §14.4
// =============================================================================

export type OsmBuildingVerdict =
  | { readonly kind: 'verified'; readonly fact: OsmBuildingFact }
  /** Το στοιχείο δεν υπάρχει (πια). Οι εθελοντές σβήνουν — §13.2. */
  | { readonly kind: 'absent' }
  /** Υπάρχει, αλλά **δεν είναι κτίριο** — δρόμος, όριο, χρήση γης. */
  | { readonly kind: 'not-a-building' }
  | { readonly kind: 'unavailable' };

/**
 * **Υπάρχει αυτό το στοιχείο OSM, και είναι όντως κτίριο;**
 *
 * 🔴 **Αυτή ΕΙΝΑΙ η «επαλήθευση πηγής» του §14.4 κανόνας 2.** Ο πελάτης στέλνει
 * **μόνο** μια αναφορά· ό,τι πρόκειται να γραφτεί στο κοινό επίπεδο Α — σημείο,
 * διεύθυνση, όροφοι — το **ξαναρωτά ο διακομιστής**. Έτσι το «*σου λέω εγώ ότι αυτό
 * το κτίριο είναι στη Θεσσαλονίκη*» δεν έχει πού να ακουστεί.
 *
 * ⚠️ **Τέσσερις καταστάσεις, και καμία δεν συμπτύσσεται.** Το `absent` και το
 * `unavailable` μοιάζουν («δεν πήραμε κτίριο») και είναι **αντίθετα**: το πρώτο
 * σημαίνει *«το OSM απάντησε: δεν υπάρχει»*, το δεύτερο *«το OSM δεν απάντησε»*.
 * Γράφοντας κοινό «όχι», μια διακοπή δικτύου θα ακύρωνε την ταυτότητα ενός υπαρκτού
 * κτιρίου — για **όλους** (§14.4).
 */
export async function verifyOsmBuilding(
  elementType: OsmElementType,
  elementId: string,
): Promise<OsmBuildingVerdict> {
  const query = `
    [out:json][timeout:${overpassQuerySeconds()}];
    ${elementType}(${elementId});
    out center tags;
  `.trim();

  const outcome = await runOverpassQueryStrict(query);
  if (!outcome.ok) return { kind: 'unavailable' };

  const element = outcome.elements[0];
  if (element === undefined) return { kind: 'absent' };
  if (!isBuilding(element)) return { kind: 'not-a-building' };

  const fact = factFrom(element);
  // ⚠️ Στοιχείο **χωρίς σημείο** δεν είναι «μη κτίριο» — είναι απάντηση που δεν
  // μπορούμε να χρησιμοποιήσουμε, δηλαδή το ίδιο πρακτικά με «δεν απάντησε».
  return fact === null ? { kind: 'unavailable' } : { kind: 'verified', fact };
}

// =============================================================================
// 5. «ΤΙ ΣΧΗΜΑ ΕΧΕΙ;» — ΖΩΝΤΑΝΑ, ΠΟΤΕ ΑΠΟΘΗΚΕΥΜΕΝΟ (§13.4)
// =============================================================================

/**
 * Το αποτέλεσμα της ζωντανής άντλησης σχήματος.
 *
 * 🔴 **ΤΡΕΙΣ καταστάσεις, και η τρίτη γεννήθηκε από ΖΩΝΤΑΝΗ ΔΟΚΙΜΗ** (2026-08-11).
 *
 * Η πρώτη γραφή επέστρεφε `GeoOutline | null` και συγχώνευε **δύο** πολύ διαφορετικά
 * πράγματα στο `null`: *«αυτό το στοιχείο **δεν έχει** δακτύλιο»* και *«**δεν
 * ρωτήσαμε** επιτυχώς»*. Φάνηκε μόνο όταν το δημόσιο Overpass μας έκοψε με το όριο
 * των **2 slots ανά IP**: η διαδρομή απάντησε στον πελάτη *«αυτός ο τόπος δεν έχει
 * σχήμα»* για κτίριο του οποίου το περίγραμμα είχαμε δει **δύο λεπτά νωρίτερα**.
 *
 * Είναι κατά λέξη η αστοχία που αυτό το ίδιο αρχείο τεκμηριώνει στο
 * {@link verifyOsmBuilding} (*«το `absent` και το `unavailable` μοιάζουν και είναι
 * **αντίθετα**»*) — γραμμένη **από τον ίδιο συγγραφέα, στο ίδιο commit**. Ο τύπος
 * την κάνει πλέον **αδύνατη**.
 */
export type OsmOutlineFetch =
  | { readonly kind: 'outline'; readonly outline: GeoOutline }
  /** Δεν **υπάρχει** δακτύλιος να δειχθεί: `node`, `relation`, ή σβησμένο στοιχείο. */
  | { readonly kind: 'no-shape' }
  /** Δεν **μάθαμε**. ΠΟΤΕ δεν διαβάζεται ως «δεν έχει σχήμα». */
  | { readonly kind: 'unavailable' };

/**
 * Το **περίγραμμα** ενός κτιρίου OSM, για να ζωγραφιστεί **τώρα**.
 *
 * ⛔ **Η τιμή που επιστρέφει ΔΕΝ επιτρέπεται να καταλήξει σε Firestore.** Ο τύπος
 * βοηθά (`PlacePosition` κλάδος `osm`: `outline?: never`), αλλά ο τύπος φρουρεί το
 * **πεδίο**, όχι τη **συνήθεια**: μια «προσωρινή μνήμη περιγραμμάτων» θα ήταν
 * ακριβώς η *«συστηματική συγκέντρωση»* που ενεργοποιεί το share-alike (§13.4).
 *
 * 🔶 `no-shape` για `node` (ένα σημείο **δεν έχει** σχήμα) και για `relation` (θέλει
 * ράψιμο μελών· **0,24 %** των κτιρίων, μετρημένο) — **χωρίς καν να ρωτήσει**.
 */
export async function fetchOsmBuildingOutline(
  elementType: OsmElementType,
  elementId: string,
): Promise<OsmOutlineFetch> {
  if (elementType !== 'way') return { kind: 'no-shape' };

  const query = `
    [out:json][timeout:${overpassQuerySeconds()}];
    way(${elementId});
    out geom;
  `.trim();

  const outcome = await runOverpassQueryStrict(query);
  if (!outcome.ok) return { kind: 'unavailable' };

  const element = outcome.elements[0];
  if (element === undefined) return { kind: 'no-shape' };

  const outline = elementOutline(element);
  return outline === null ? { kind: 'no-shape' } : { kind: 'outline', outline };
}
