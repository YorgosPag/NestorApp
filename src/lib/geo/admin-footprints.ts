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
import type { GeoFootprint, FootprintResolver } from '@/types/geo/admin-footprint';

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
function readFootprint(value: unknown): GeoFootprint | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Partial<GeoFootprint>;
  const center = row.center;

  if (typeof center !== 'object' || center === null) return null;
  if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return null;
  if (!Number.isFinite(row.outerKm) || !Number.isFinite(row.innerKm)) return null;

  const outerKm = row.outerKm as number;
  const innerKm = row.innerKm as number;
  if (innerKm < 0 || outerKm < innerKm) return null;

  return { center: { lat: center.lat, lng: center.lng }, outerKm, innerKm };
}

/**
 * Ο τεμπέλης αναγνώστης του παράγωγου αρχείου — **ένα** στιγμιότυπο ανά σελίδα.
 *
 * ⚠️ Ο μηχανισμός *(cache + single-flight + «αποτυχία αφήνει το cache άδειο»)* **δεν
 * γράφεται εδώ**: ζει στο `lib/data/lazy-json-snapshot.ts`, εξαγμένος από τον
 * `useAdministrativeHierarchy` **ακριβώς** για να μη γεννηθεί εδώ το δίδυμό του (N.18).
 */
export const ADMIN_FOOTPRINTS_SOURCE = createLazyJsonSnapshot<FootprintSnapshot>({
  url: '/data/admin-footprints.json',
  build: (payload) => {
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
  },
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
