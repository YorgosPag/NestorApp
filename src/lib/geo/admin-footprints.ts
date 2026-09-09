/**
 * @fileoverview SSoT — **ο αναγνώστης των παράγωγων αποτυπωμάτων** (`center`, `outerKm`,
 * `innerKm` ανά διοικητική οντότητα). ADR-846 Φάση 2.5.
 * @related types/geo/admin-footprint.ts (ο τύπος + η σύμβαση) ·
 *   scripts/build-admin-footprints.ts (ο γεννήτορας) · hooks/useAdminFootprints.ts
 * @module lib/geo/admin-footprints
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΙ ΚΛΕΙΝΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Μέχρι τη Φ2.5 ο κριτής (`lib/agency/coverage-match.ts`) έπαιρνε {@link NO_FOOTPRINTS}
 * και τα δύο **μεικτά** κελιά του πίνακα *(δηλωμένη ακτίνα × διοικητικό ερώτημα, και
 * αντίστροφα)* απαντούσαν **πάντα** `unknown`. Σωστό — αλλά άχρηστο: ένας επαγγελματίας
 * που δηλώνει *«30 χλμ γύρω από τη Θέρμη»* έμενε **άκριτος** απέναντι στο ερώτημα
 * *«Δήμος Κασσάνδρας»*, 68 χλμ μακριά. Με τα αποτυπώματα, το ίδιο ζεύγος απαντά
 * **αποδεδειγμένο `disjoint`**.
 *
 * ⚠️ **Η αγνωσία παραμένει πρώτης κατηγορίας.** Οντότητα που λείπει από το αρχείο
 * *(επίπεδα 1 και 8, οι 5 δήμοι μετά-Κλεισθένη που δεν υπάρχουν στην πηγή, οι 3
 * διφορούμενοι κωδικοί)* δίνει `null` ⇒ ο κριτής απαντά `unknown` ⇒ **κανείς δεν
 * κόβεται**. Το αρχείο **προσθέτει βεβαιότητα, δεν αφαιρεί ανοχή.**
 *
 * ⚖️ **CC-BY**: η αναφορά πηγής ταξιδεύει **μέσα** στο ίδιο το αρχείο (`meta.source`),
 * δηλαδή δεν μπορεί να ξεχαστεί σε ένα σχόλιο που δεν διανέμεται. Δες τον γεννήτορα.
 */

import { createLazyJsonSnapshot } from '@/lib/data/lazy-json-snapshot';
import { createModuleLogger } from '@/lib/telemetry';
import { distanceMeters } from '@/lib/geo/geo-distance';
import type { GeoFootprint, FootprintResolver } from '@/types/geo/admin-footprint';
import type { GeoCircle, GeoPoint } from '@/types/geo/coordinates';

const logger = createModuleLogger('admin-footprints');

/** `id` διοικητικής οντότητας → οι δύο κύκλοι της. */
export type FootprintSnapshot = ReadonlyMap<string, GeoFootprint>;

/**
 * **Η κατάσταση «ρώτησα και δεν έμαθα»** — ίδιο ιδίωμα με το `EMPTY_SNAPSHOT` της
 * ιεραρχίας. Κάθε αναζήτηση απαντά `undefined` ⇒ ο κριτής λέει `unknown`.
 */
export const EMPTY_FOOTPRINTS: FootprintSnapshot = new Map<string, GeoFootprint>();

/**
 * Δέχεται **μόνο** γραμμή που είναι πραγματικά αποτύπωμα.
 *
 * 🔴 **Ο έλεγχος `outerKm >= innerKm` ΞΑΝΑΓΙΝΕΤΑΙ ΕΔΩ, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΠΕΡΙΤΤΟΣ.** Ο
 * γεννήτορας τον επιβάλλει ως άγκυρα πριν γράψει· αυτό όμως προστατεύει το **αρχείο τη
 * στιγμή που παράχθηκε**, όχι το αρχείο **που έφτασε στον φυλλομετρητή**. Ανάμεσά τους
 * υπάρχει χειροκίνητη επεξεργασία, μισοκατεβασμένο σώμα, λάθος ανάπτυξη. Και η
 * συγκεκριμένη ανισότητα είναι **ακριβώς** αυτή από την οποία ο κριτής βγάζει
 * *αποδείξεις*: αν σπάσει, δεν παράγεται θόρυβος — παράγεται **λάθος απάντηση με
 * βεβαιότητα**. Μια γραμμή που δεν την τηρεί **απορρίπτεται** και γίνεται `unknown`.
 */
/**
 * ⚠️ **ΕΞΑΓΕΤΑΙ ΓΙΑ ΤΗΝ ΑΓΚΥΡΑ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ.** Ο φρουρός εγκλεισμού του
 * {@link readInterior} **δεν ενεργοποιείται ποτέ** από το πραγματικό δέντρο *(σωστά —
 * ο γεννήτορας δεν παράγει δίσκο εκτός περιγεγραμμένου)*. Μετρημένο: μετάλλαξη που
 * τον **καταργεί** άφησε τη σουίτα **πράσινη**. Δηλαδή ήταν *«φρουρός χωρίς απόδειξη
 * ζωής»* — ακριβώς το σχήμα που το `ssot:audit --dormant` καταγγέλλει.
 *
 * ⇒ Η εξαγωγή επιτρέπει στην άγκυρα να τον **εκτελέσει** με χαλασμένη είσοδο. Η
 * εναλλακτική *(«άφησέ τον αδοκίμαστο»)* θα ήταν σχόλιο μεταμφιεσμένο σε φρουρό.
 */
export function readFootprint(value: unknown): GeoFootprint | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Partial<GeoFootprint>;
  const center = row.center;

  if (typeof center !== 'object' || center === null) return null;
  if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return null;
  if (!Number.isFinite(row.outerKm) || !Number.isFinite(row.innerKm)) return null;

  const outerKm = row.outerKm as number;
  const innerKm = row.innerKm as number;
  if (innerKm < 0 || outerKm < innerKm) return null;

  const centre = { lat: center.lat, lng: center.lng };
  const interior = readInterior(row.interior, centre, outerKm);
  return interior === null
    ? { center: centre, outerKm, innerKm }
    : { center: centre, outerKm, innerKm, interior };
}

/**
 * **ΤΟ ΕΣΩΤΕΡΙΚΟ ΚΑΛΥΜΜΑ ΠΕΡΝΑΕΙ ΤΟ ΣΥΝΟΡΟ — ΚΑΙ ΠΑΡΑΛΙΓΟ ΝΑ ΜΗΝ ΠΕΡΑΣΕΙ**
 * *(ADR-846 §9 #11)*.
 *
 * 🔴 **ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ, ΓΡΑΜΜΕΝΟ ΓΙΑΤΙ ΗΤΑΝ ΑΟΡΑΤΟ**: ο {@link readFootprint}
 * κατασκεύαζε το αποτέλεσμα **ρητά** — `return { center, outerKm, innerKm }` — και
 * **πετούσε σιωπηλά** κάθε άλλο πεδίο. Ο γεννήτορας παρήγαγε **1.050** καλύμματα με
 * **12.794** δίσκους *(+110 KB gzip)*, οι άγκυρες ήταν **πράσινες**, και η επαλήθευση
 * end-to-end **πέρασε** — γιατί έτρεχε σε `tsx`, **παρακάμπτοντας αυτόν τον αναγνώστη**.
 * Στην οθόνη **δεν θα άλλαζε τίποτα**.
 *
 * 🔑 **Το σχήμα**: *«πράσινο που σημαίνει «κανείς δεν κοίταξε»»* — το ίδιο που κυνηγά
 * όλο το `CLAUDE.md` *(N.11 · N.12 · N.18)*. Ένας **ρητός κατασκευαστής** είναι
 * σιωπηλό φίλτρο: δεν σπάει, **παραλείπει**.
 *
 * ⚠️ **Η επικύρωση είναι ΑΝΑ ΔΙΣΚΟ, όχι όλα-ή-τίποτα**: κάθε δίσκος είναι
 * **ανεξάρτητη** μαρτυρία, άρα η απόρριψη ενός δεν αγγίζει τους υπόλοιπους. Αν
 * **κανένας** δεν επιβιώσει, επιστρέφουμε `null` ⇒ ο κριτής πέφτει στον **έναν**
 * δίσκο του `innerKm`, δηλαδή στη συμπεριφορά πριν τη Φ5δ. Καμία σιωπηλή απώλεια.
 *
 * 🔒 **Και ο φρουρός εγκλεισμού ισχύει ΚΑΙ εδώ**: δίσκος που ξεφεύγει από τον
 * **περιγεγραμμένο** κύκλο είναι αδύνατος εξ ορισμού *(το κάλυμμα είναι
 * υπο-προσέγγιση)* ⇒ αρχείο που τον δηλώνει είναι χαλασμένο, και τον **απορρίπτουμε**
 * αντί να τον εμπιστευτούμε. Ίδιο σκεπτικό με το `outerKm < innerKm` παραπάνω.
 */
function readInterior(
  value: unknown,
  centre: GeoPoint,
  outerKm: number,
): readonly GeoCircle[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const discs: GeoCircle[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue;
    const disc = entry as Partial<GeoCircle>;
    const discCentre = disc.center;
    if (typeof discCentre !== 'object' || discCentre === null) continue;
    if (!Number.isFinite(discCentre.lat) || !Number.isFinite(discCentre.lng)) continue;
    if (!Number.isFinite(disc.radiusKm)) continue;

    const radiusKm = disc.radiusKm as number;
    if (radiusKm <= 0) continue;

    const point = { lat: discCentre.lat, lng: discCentre.lng };
    if (distanceMeters(centre, point) / 1000 + radiusKm > outerKm + CONTAINMENT_SLACK_KM) {
      continue;
    }
    discs.push({ center: point, radiusKm });
  }
  return discs.length > 0 ? discs : null;
}

/**
 * Ανοχή **20 m** στον έλεγχο εγκλεισμού δίσκου-σε-περιγεγραμμένο.
 *
 * ⚠️ Δεν είναι χαλαρότητα: ο γεννήτορας στρογγυλοποιεί το κέντρο στα **4 δεκαδικά**
 * *(≈11 m)* και την ακτίνα **προς τα κάτω** στα 2. Χωρίς ανοχή, η ίδια η
 * στρογγυλοποίηση θα απέρριπτε νόμιμους οριακούς δίσκους.
 */
const CONTAINMENT_SLACK_KM = 0.02;

/**
 * Ο τεμπέλης αναγνώστης του παράγωγου αρχείου — **ένα** στιγμιότυπο ανά σελίδα.
 *
 * ⚠️ Ο μηχανισμός *(cache + single-flight + «αποτυχία αφήνει το cache άδειο»)* **δεν
 * γράφεται εδώ**: ζει στο `lib/data/lazy-json-snapshot.ts`, εξαγμένος από τον
 * `useAdministrativeHierarchy` **ακριβώς** για να μη γεννηθεί εδώ το δίδυμό του (N.18).
 */
/**
 * **Ωμό φορτίο → στιγμιότυπο.** Πετά αν το σχήμα δεν είναι το αναμενόμενο.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΕΞΑΓΕΤΑΙ — **ΕΝΑΣ ΑΝΑΛΥΤΗΣ, ΔΥΟ ΠΗΓΕΣ BYTES** *(ADR-846 §9 #13)*
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Το ίδιο αρχείο διαβάζεται πλέον από **δύο** πλευρές: ο περιηγητής το κατεβάζει με
 * `fetch` *(εδώ, μέσω {@link ADMIN_FOOTPRINTS_SOURCE})*, ο διακομιστής το διαβάζει με
 * `fs` *(`services/places/admin-footprints.reader.ts`)* γιατί το σχετικό URL
 * `/data/…` **δεν επιλύεται στο Node**.
 *
 * 🔴 **Αν η ανάλυση γραφόταν δεύτερη φορά, θα ΑΠΕΚΛΙΝΕ σιωπηλά** — ο δεύτερος
 * συγγραφέας θυμάται τους τρεις ελέγχους και ξεχνά τον τέταρτο, και ο διακομιστής
 * αποδέχεται αποτύπωμα που ο περιηγητής απορρίπτει *(ή το ανάποδο)*: **δύο αλήθειες
 * για το ίδιο byte**. Ίδιο σχήμα με το ζεύγος της ιεραρχίας, όπου η **διπλή** υλοποίηση
 * είναι ρητά δηλωμένη ως κόστος. Εδώ δεν χρειάστηκε να πληρωθεί: **μόνο** η πηγή των
 * bytes διαφέρει, και μένει έξω από αυτή τη συνάρτηση.
 */
export function buildFootprintSnapshot(payload: unknown): FootprintSnapshot {
  const parsed = payload as { data?: unknown };
  const rows = parsed.data;
  // Ίδιος φρουρός με την ιεραρχία: σελίδα σφάλματος ή HTML fallback **δεν** επιτρέπεται
  // να φτάσει ως βρόχος μέσα σε render.
  if (typeof rows !== 'object' || rows === null || Array.isArray(rows)) {
    throw new TypeError('Τα αποτυπώματα δεν έχουν το αναμενόμενο σχήμα');
  }

  const snapshot = new Map<string, GeoFootprint>();
  let rejected = 0;
  for (const [adminId, value] of Object.entries(rows)) {
    const footprint = readFootprint(value);
    if (footprint === null) {
      rejected += 1;
      continue;
    }
    snapshot.set(adminId, footprint);
  }

  if (rejected > 0) {
    logger.warn('Αποτυπώματα που δεν πέρασαν τον έλεγχο εγκλεισμού — μένουν άγνωστα', {
      rejected,
      accepted: snapshot.size,
    });
  }
  return snapshot;
}

export const ADMIN_FOOTPRINTS_SOURCE = createLazyJsonSnapshot<FootprintSnapshot>({
  url: '/data/admin-footprints.json',
  build: buildFootprintSnapshot,
  onFailure: (error) => {
    logger.warn('Δεν φορτώθηκαν τα αποτυπώματα — τα μεικτά ερωτήματα μένουν «δεν ξέρω»', {
      error: error instanceof Error ? error.message : String(error),
    });
  },
});

/**
 * **Ο αναγνώστης που δίνεται στον κριτή** — σύγχρονος, καθαρός, χωρίς React.
 *
 * ⚠️ **Επιστρέφει `null` όσο το αρχείο δεν έχει φορτώσει**, και αυτό είναι σωστό:
 * `null` = *«δεν ξέρω»*, ποτέ *«δεν καλύπτει»*. Ο κύκλος ζωής της φόρτωσης ανήκει στο
 * {@link useAdminFootprints}, όχι εδώ — ίδιος διαχωρισμός με το `lineageIdsOf`.
 */
export const footprintOf: FootprintResolver = (adminId) =>
  ADMIN_FOOTPRINTS_SOURCE.peek()?.get(adminId) ?? null;
