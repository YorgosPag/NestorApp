/**
 * entity-closed-rings — SSoT για **ΕΝΑ** ερώτημα: «αυτή η οντότητα ορίζεται από κλειστά
 * δαχτυλίδια ορίου, και σε ποιο πεδίο ζουν;»
 *
 * ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ (ADR-662 · N.18): δύο οντότητες κρατούν **ακριβώς το ίδιο σχήμα
 * δεδομένων** (`Point2D[][]`, ένα ή περισσότερα implicitly κλειστά rings — `last→first`
 * χωρίς διπλή κορυφή) κάτω από **διαφορετικό όνομα πεδίου**:
 *   - γραμμοσκίαση  → `HatchEntity.boundaryPaths`      (ADR-507)
 *   - τοπογραφική   → `TopoSurfaceEntity.footprint`    (ADR-662 Φ2β)
 *
 * Χωρίς αυτό το module κάθε καταναλωτής έγραφε τον δικό του `isHatchEntity` κλάδο και ο
 * επόμενος τύπος θα τον **κλωνοποιούσε** με άλλο όνομα πεδίου — sibling clone που το
 * name-based `ssot:discover` (CHECK 3.18) **δεν** πιάνει, μόνο το token-based jscpd
 * (CHECK 3.28). Ρωτώντας εδώ, ένας κλάδος στον καταναλωτή καλύπτει **όλους** τους
 * ring-bounded τύπους — και ο επόμενος τύπος προστίθεται σε **αυτό** το αρχείο, μία φορά.
 *
 * ΠΛΑΙΣΙΟ ΣΥΝΤΕΤΑΓΜΕΝΩΝ — τα rings επιστρέφονται **ΩΜΑ**, χωρίς κανέναν μετασχηματισμό:
 * είναι ήδη στο ίδιο frame που διαβάζουν ο renderer (`worldToScreen`) και το hit-test
 * (`hitTestTopoSurface` / `hitTestHatch`). Καμία `mmToSceneUnits`, κανένας projector —
 * το `buildTopoSurfaceEntity` **έχει ήδη** προβάλει στο ενεργό display frame. Οποιαδήποτε
 * κλίμακα εδώ θα έδειχνε τις έλξεις σε άλλο σημείο από εκεί που φαίνεται η γραμμή.
 *
 * ΚΑΜΙΑ ΠΟΛΙΤΙΚΗ: επιστρέφει ό,τι κρατά η οντότητα, χωρίς φιλτράρισμα εκφυλισμένων rings.
 * Κάθε καταναλωτής έχει **ήδη** τον δικό του (διαφορετικό) πήχη — `ringEdgeMidpoints`
 * θέλει ≥2 κορυφές, `nearestFootOnPolyline` ≥2, `hatchBoundsCenter` ≥1, το point-in-polygon
 * του hit-test ≥3. Βάζοντας έναν ενιαίο πήχη εδώ θα άλλαζε σιωπηλά τη συμπεριφορά της
 * γραμμοσκίασης· η ερώτηση αυτού του module είναι «ποια rings», όχι «ποια rings αξίζουν».
 *
 * @see ./polyline-perpendicular-feet.ts — προβολή cursor πάνω στις ακμές των rings
 * @see ../../types/topo-surface.ts — `TopoSurfaceEntity.footprint`
 * @see docs/centralized-systems/reference/adrs/ADR-662-topography-ribbon-migration.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../extended-types';
import { isHatchEntity, isTopoSurfaceEntity } from '../../types/entities';

/**
 * Σύνολο κλειστών δαχτυλιδιών ορίου. Κάθε ring είναι **implicitly κλειστό**: η ακμή
 * `last→first` υπάρχει αλλά η πρώτη κορυφή **δεν** επαναλαμβάνεται στο τέλος.
 */
export type ClosedRings = readonly (readonly Point2D[])[];

/** Κοινή άδεια απάντηση — μηδέν allocation στο (συντριπτικά συχνότερο) «δεν έχει όριο». */
const NO_CLOSED_RINGS: ClosedRings = [];

/**
 * Τα κλειστά δαχτυλίδια ορίου μιας οντότητας, ή κενό όταν η οντότητα δεν ορίζεται από
 * όριο (γραμμή, πολυγραμμή, κύκλος, BIM, κείμενο, XLine — όλα κενό).
 *
 * ⚠️ Η **πολυγραμμή δεν** ανήκει εδώ, ακόμη κι όταν είναι `closed`: τα rings είναι
 * χαρακτηριστικό οντοτήτων που ορίζονται **αποκλειστικά** από όριο, ενώ η πολυγραμμή
 * έχει δικούς της κλάδους με ανοιχτή/κλειστή σημασιολογία (`closed` flag). Ρίχνοντάς την
 * εδώ θα διπλασιάζαμε τις έλξεις της.
 */
export function entityClosedRings(entity: Entity): ClosedRings {
  if (isHatchEntity(entity)) return entity.boundaryPaths;
  if (isTopoSurfaceEntity(entity)) return entity.footprint;
  return NO_CLOSED_RINGS;
}
