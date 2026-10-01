/**
 * @fileoverview **Οι διευθύνσεις των τριών δημόσιων οθονών** — γραμμένες μία φορά.
 * @related ADR-777 §7 (Α3: τρεις οθόνες) · lib/listings/listing-filters.ts
 * @module lib/listings/listing-routes
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ — μετρημένο διπλότυπο, όχι προληπτικό
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `'/search/results'` ήταν γραμμένο **δύο** φορές (`PlaceSearchBox` ως
 * `RESULTS_ROUTE`, `SearchLandingContent` ως literal σε `<Link href>`), και η οθόνη 3
 * θα το χρειαζόταν **τρίτη** — μαζί με τη δική της, που θα γεννιόταν αμέσως σε **δύο**
 * σημεία (κάρτα με θέση · γραμμή χωρίς θέση). Ο κανόνας **N.0.2** το λέει ρητά:
 * *«ποτέ copy-paste ενός σχήματος σε N αρχεία — πρώτα φτιάξε το SSoT»*.
 *
 * ⚠️ **Ένας φάκελος διαδρομής δεν είναι η διαδρομή**: το `(light)` είναι **route
 * group** και **δεν εμφανίζεται** στη διεύθυνση. Άρα το `app/(light)/search/results`
 * σερβίρει `/search/results`. Γραμμένο εδώ ώστε να μη χρειάζεται να το θυμάται κανείς.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ Η ΣΕΛΙΔΑ ΑΚΙΝΗΤΟΥ ΚΟΥΒΑΛΑ ΤΑ ΦΙΛΤΡΑ ΜΑΖΙ ΤΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η **Α3** δεσμεύτηκε ότι *«τα φίλτρα επιμένουν»*, και μετρήθηκε ότι **75%** των
 * αποτυχιών της παλιάς μας κατάστασης ήταν ακριβώς η απώλειά τους. Η δέσμευση
 * **δεν σταματά στην οθόνη 2**: αν η σελίδα ακινήτου ξεχάσει την αναζήτηση, ο
 * επισκέπτης που γυρίζει πίσω βρίσκει **άλλη λίστα** από αυτήν που άφησε.
 *
 * Το ερώτημα δεν λύνεται με το «πίσω» του περιηγητή: ο σύνδεσμος μοιράζεται, και
 * τότε δεν υπάρχει «πίσω». Άρα τα φίλτρα ταξιδεύουν **στη διεύθυνση**, όπως παντού
 * αλλού σε αυτή τη ροή — καμία κατάσταση σε μνήμη, τίποτα να χαθεί σε ανανέωση.
 */

/**
 * Η οθόνη 1 — *«πού ψάχνεις;»* — και **η ρίζα του ιστότοπου** (ADR-777 §8.13).
 *
 * 🔴 **Ήταν `/search`, και η ρίζα σέρβιρε το ταμπλό.** Η αλλαγή δεν είναι αισθητική:
 * μετρήθηκε ότι ο επισκέπτης του **nestorconstruct.gr** προσγειωνόταν σε **φόρμα
 * σύνδεσης**, δηλαδή η δημόσια πόρτα δεν ήταν κρυμμένη — **δεν υπήρχε**.
 *
 * 🏆 **Είναι η πρακτική κάθε πύλης ακινήτων**, όχι προτίμηση: Zillow · Rightmove ·
 * XE — η αναζήτηση **είναι** η ρίζα, και το ερευνητικό εύρημα είναι κατηγορηματικό
 * («*the search input as the entire product*», με A/B σε δεκάδες εκατομμύρια
 * συνεδρίες). Καμία πύλη δεν στέλνει τον επισκέπτη σε δεύτερη διεύθυνση για να ψάξει.
 *
 * ⚠️ Το `/search` **δεν διαγράφηκε** — έγινε **μόνιμη ανακατεύθυνση** εδώ. Δύο
 * διευθύνσεις για το **ίδιο** περιεχόμενο θα ήταν διπλότυπο (ο ίδιος λόγος για τον
 * οποίο το {@link withQuery} δεν γράφει κενό `?`), και ένας σπασμένος σύνδεσμος θα
 * ήταν χειρότερος από τα δύο.
 */
import { typedHref } from '@/lib/workspace/route-worlds';

export const SEARCH_LANDING_ROUTE = '/' as const;

/** Η οθόνη 2 — χάρτης **και** λίστα. */
export const SEARCH_RESULTS_ROUTE = '/search/results' as const;

/** Η οθόνη 3 — ένα ακίνητο. Δυναμικό τμήμα: η ταυτότητα της αγγελίας. */
export const LISTING_DETAIL_ROUTE_BASE = '/listing';

/**
 * Διεύθυνση + ερώτημα, **ή σκέτη διεύθυνση όταν δεν υπάρχει ερώτημα**.
 *
 * ⚠️ Το κενό `?` **δεν** γράφεται: δύο ταυτόσημες σελίδες με και χωρίς αυτό είναι
 * δύο διευθύνσεις για το ίδιο περιεχόμενο — ο ίδιος λόγος για τον οποίο το
 * `serializeListingFilters` δεν γράφει κενά φίλτρα.
 */
/**
 * ⚠️ **`as const` στο `path` ΕΙΝΑΙ ΑΝΑΓΚΑΙΟ, ΟΧΙ ΥΦΟΣ** — επαληθεύτηκε πειραματικά:
 * χωρίς αυτό, μια ενδιάμεση `const` που χρησιμοποιείται σε **δύο** κλάδους
 * φαρδαίνει σε `string` στον δεύτερο. Το `typedHref` καλείται **χωριστά** σε κάθε
 * κλάδο — ποτέ μέσα σε τερνάρια, που φαρδαίνει και τα δύο άκρα μαζί (μετρημένο).
 */

/** Η σελίδα **ενός** ακινήτου, κρατώντας την αναζήτηση από την οποία ήρθε ο επισκέπτης. */
export function listingDetailHref(id: string, query?: string | null) {
  // `encodeURIComponent` παρότι οι enterprise ταυτότητες είναι ασφαλείς χαρακτήρες:
  // η ταυτότητα έρχεται από **δεδομένα**, και μια διεύθυνση που σπάει σε ένα `#` θα
  // αστοχούσε σιωπηλά σε ένα μόνο έγγραφο — το χειρότερο είδος σφάλματος.
  const path = `${LISTING_DETAIL_ROUTE_BASE}/${encodeURIComponent(id)}` as const;
  if (query && query.length > 0) return typedHref(`${path}?${query}`);
  return typedHref(path);
}

/**
 * ADR-884 Φ2στ · §4.12 Μέρος Δ — **οι δύο αδελφές του `tourViewHref`**: τρεις πλήρεις όψεις των
 * ίδιων μέσων («Φωτογραφίες · Κάτοψη · 3D», πρότυπο Zillow), ίδιο τμήμα `/listing/[id]`
 * με τον `TOUR_VIEW_SEGMENT` του `lib/spatial-tour/tour-routes`.
 */
export const LISTING_PHOTOS_SEGMENT = 'photos' as const;
export const LISTING_FLOORPLAN_SEGMENT = 'floorplan' as const;

/**
 * 📍 ADR-897 — **ποια φωτογραφία είναι ανοιχτή**, στη διεύθυνση: `?photo=N`, **1-based** (ό,τι λέει ο άνθρωπος:
 * «η φωτογραφία 3»). Σημείο στην κάτοψη ⇒ σύνδεσμος κατευθείαν στη φωτογραφία· η ανοιχτή φωτογραφία ⇒ μοιράσιμη διεύθυνση.
 */
export const LISTING_PHOTO_PARAM = 'photo' as const;

/** Η πλήρης-παραθύρου όψη «όλες οι φωτογραφίες» μιας αγγελίας — προαιρετικά με ανοιχτή τη φωτογραφία `photoIndex` (0-based). */
export function listingPhotosHref(id: string, photoIndex?: number) {
  const path = `${LISTING_DETAIL_ROUTE_BASE}/${encodeURIComponent(id)}/${LISTING_PHOTOS_SEGMENT}` as const;
  if (photoIndex !== undefined && Number.isInteger(photoIndex) && photoIndex >= 0) {
    return typedHref(`${path}?${LISTING_PHOTO_PARAM}=${photoIndex + 1}`);
  }
  return typedHref(path);
}

/**
 * Η ανοιχτή φωτογραφία από το query string — **0-based**, ή `null` όταν λείπει, δεν είναι ακέραιος ή βγαίνει έξω από
 * τις `total` φωτογραφίες (ένας παλιός σύνδεσμος σε αγγελία που έχασε φωτογραφίες ανοίγει απλώς τη συλλογή).
 */
export function readListingPhotoParam(query: string, total: number): number | null {
  const raw = new URLSearchParams(query).get(LISTING_PHOTO_PARAM);
  if (raw === null || !/^\d+$/u.test(raw)) return null;
  const index = Number(raw) - 1;
  return index >= 0 && index < total ? index : null;
}

/** Η πλήρης-παραθύρου όψη «κάτοψη» μιας αγγελίας. */
export function listingFloorplanHref(id: string) {
  const path = `${LISTING_DETAIL_ROUTE_BASE}/${encodeURIComponent(id)}/${LISTING_FLOORPLAN_SEGMENT}` as const;
  return typedHref(path);
}

/** Επιστροφή στα αποτελέσματα, **με τα ίδια φίλτρα**. */
export function searchResultsHref(query?: string | null) {
  if (query && query.length > 0) return typedHref(`${SEARCH_RESULTS_ROUTE}?${query}`);
  return typedHref(SEARCH_RESULTS_ROUTE);
}

/** ADR-890 Φ1 — η σελίδα αγοράς μιας περιοχής (`app/(light)/area/[id]`). */
export const AREA_MARKET_ROUTE_BASE = '/area';

/**
 * `/area/<ταυτότητα ADR-883>` — αναγνώσιμη διεύθυνση (`/area/municipality:0701`).
 * ⚠️ **Χωρίς `encodeURIComponent`, επίτηδες**: το `:` επιτρέπεται σε τμήμα διαδρομής (RFC 3986 §3.3, `pchar`)
 * και η ταυτότητα έχει κλειστό αλφάβητο (`isAdminAreaId`: `[a-z_]` · `:` · ψηφία). Η σελίδα δέχεται και την
 * κωδικοποιημένη μορφή (`%3A`), για συνδέσμους που την κωδικοποίησαν αλλού.
 */
export function areaMarketHref(areaId: string) {
  return typedHref(`${AREA_MARKET_ROUTE_BASE}/${areaId}`);
}

/**
 * **Η γενική διέξοδος** — η οθόνη 1, τυποποιημένη για `<Link>` και `router`.
 *
 * 🔑 **ΓΡΑΦΤΗΚΕ ΟΤΑΝ Ο ΔΕΥΤΕΡΟΣ ΤΗ ΧΡΕΙΑΣΤΗΚΕ, ΟΧΙ ΠΡΙΝ**: το `typedHref(
 * SEARCH_LANDING_ROUTE)` ζούσε ωμό στο `DesktopOnlyGate`, ενώ οι **δύο αδελφές**
 * οθόνες αυτού του αρχείου εξήγαν ήδη κατασκευαστή. Ο δεύτερος καταναλωτής είναι η
 * **διέξοδος της άρνησης** του ADR-844 — ο άνθρωπος που έφτασε από email σε στόχο
 * **χωρίς** δημόσια διεύθυνση, και χρειάζεται *κάπου* να πάει.
 *
 * ⚠️ **Χωρίς παράμετρο φίλτρων, και είναι σκόπιμο**: όποιος προσγειώνεται εδώ **δεν
 * έχει** αναζήτηση να διατηρήσει — ή την έχασε, ή δεν την έκανε ποτέ. Ένα ερώτημα
 * θα υποσχόταν συνέχεια που δεν υπάρχει.
 */
export function searchLandingHref() {
  return typedHref(SEARCH_LANDING_ROUTE);
}

/**
 * 🖼️ **Η ακτίνα της βραχυχρόνιας μίσθωσης** (ADR-777 §8.82) — δική της διεύθυνση, ήρωας
 * και αναζήτηση, όπως το `/pro` για τους επαγγελματίες.
 *
 * 🔑 **Το όνομα είναι η λειτουργία `stay` του `landing-modes.ts`** — η ίδια λέξη που
 *    λέει η καρτέλα της αρχικής. Όχι `/short-term-rentals`: μία λέξη για μία έννοια σε
 *    διεύθυνση, κωδικό και καρτέλα.
 *
 * ⚠️ **ΔΕΝ είναι τέταρτη οθόνη της ροής αναζήτησης**: είναι **πόρτα** προς την οθόνη 2 με
 *    το `offerKind=leaseShort` ήδη γραμμένο. Τα αποτελέσματα ζουν **μία** φορά, στο
 *    {@link SEARCH_RESULTS_ROUTE} — εκεί ζουν και οι ημερομηνίες (`StayFilterFields`).
 */
export const SHORT_STAY_LANDING_ROUTE = '/stay' as const;

export function shortStayLandingHref() {
  return typedHref(SHORT_STAY_LANDING_ROUTE);
}

/**
 * 🧮 **Ο δημόσιος υπολογιστής αντικειμενικής αξίας** (ADR-898 Φ2, `app/(light)/ergaleia/antikeimeniki-axia`).
 *
 * 🔑 **Ελληνική διεύθυνση σε λατινικά, επίτηδες** (απόφαση Giorgio 2026-10-01): η σελίδα υπάρχει για την οργανική
 *    αναζήτηση («αντικειμενική αξία υπολογισμός»). Το `/ergaleia` είναι **πρόθεμα για εργαλεία**, όχι μία σελίδα —
 *    δηλωμένο στο `OUTSIDE_WORKSPACE`.
 */
export const OBJECTIVE_VALUE_ROUTE = '/ergaleia/antikeimeniki-axia' as const;

/**
 * `query` = προσυμπλήρωση από αγγελία (ADR-898 Φ3, `serializeObjectiveValuePrefill`) — ο υπολογιστής ανοίγει με ό,τι
 * ξέρει η αγγελία και ρωτά μόνο τα υπόλοιπα. Χωρίς ερώτημα ⇒ σκέτη διεύθυνση (όχι κενό `?`).
 */
export function objectiveValueHref(query?: string | null) {
  if (query && query.length > 0) return typedHref(`${OBJECTIVE_VALUE_ROUTE}?${query}`);
  return typedHref(OBJECTIVE_VALUE_ROUTE);
}
