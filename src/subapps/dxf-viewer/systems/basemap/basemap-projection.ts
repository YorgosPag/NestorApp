/**
 * Η **μία** αλυσίδα «πλακίδιο χάρτη → χαρτί του σχεδίου», συναρμολογημένη από κομμάτια που
 * υπάρχουν ήδη. Κανένα νέο μαθηματικό δεν γεννιέται εδώ.
 *
 * ## Τα τέσσερα σκαλιά, και ποιος τα κατέχει
 * | # | Μετάβαση | Σπίτι |
 * |---|---|---|
 * | 1 | πλακίδιο `z/x/y` ↔ WGS84 | {@link ./web-mercator} |
 * | 2 | WGS84 ↔ ΕΓΣΑ'87 γεωγραφικές (**μετάθεση datum**) | {@link ../geo-referencing/ggrs87-datum} |
 * | 3 | ΕΓΣΑ'87 γεωγραφικές ↔ κάνναβος (E,N) | {@link ../geo-referencing/egsa87-projection} |
 * | 4 | κόσμος (ΕΓΣΑ mm) ↔ χαρτί (τοπικά mm) | {@link ../topography/topo-display-frame} |
 *
 * Το σκαλί 4 είναι το κρίσιμο και **δεν γράφεται εδώ**. Ο κανόνας του ADR-650 §M10f λέει ρητά:
 * *«Ό,τι ΒΓΑΙΝΕΙ στο χαρτί περνά από `project`»* — και τεκμηριώνει ότι η προβολή ήταν κάποτε
 * **αντιγραμμένη σε δύο** παραγωγούς και **απούσα από τέσσερις**, με αποτέλεσμα ο επόμενος
 * παραγωγός να γεννιέται χωρίς αυτήν. Το υπόβαθρο χάρτη είναι ακριβώς ένας τέτοιος επόμενος
 * παραγωγός. Περνά από την ίδια γέφυρα, ή δεν κάθεται σωστά.
 *
 * ## Γιατί ΔΕΝ υπάρχει `worldToGeographic` για ζωγραφική
 * Η αντίστροφη κατεύθυνση χρειάζεται **μόνο** για να αποφασιστεί ποια πλακίδια ζητούνται. Η
 * ζωγραφική είναι πάντα «εμπρός»: γωνία πλακιδίου → χαρτί. Αν η ζωγραφική χρησιμοποιούσε την
 * αντίστροφη, μια ασυμμετρία ανάμεσα στις δύο θα εμφανιζόταν ως **ολίσθηση του υποβάθρου κατά
 * το zoom** — βλάβη που μοιάζει με σφάλμα κάμερας και θα κυνηγιόταν εκεί.
 *
 * Καθαρό module — μηδέν React/DOM/δίκτυο. Η **μία** συνάρτηση που διαβάζει store είναι η
 * {@link getBasemapDisplayProjector}, στο πρότυπο του `getTopoDisplayProjector`.
 */

import type { Point2D } from '../../rendering/types/Types';
import { mmToSceneUnits } from '../../utils/scene-units';
import { ggrs87ToWgs84, wgs84ToGgrs87 } from '../geo-referencing/ggrs87-datum';
import { geographicToGrid, gridToGeographic } from '../geo-referencing/egsa87-projection';
import type { WorldToDisplayProjector } from '../geo-referencing/geo-transform';
import { getTopoDisplayProjector, projectWorldPoint } from '../topography/topo-display-frame';

/** Μέτρα → canonical mm, μέσω του SSoT μονάδων (ADR-462) — ποτέ ένα inline `× 1000`. */
function metresToMm(metres: number): number {
  return metres / mmToSceneUnits('m');
}

/** Canonical mm → μέτρα, μέσω του ίδιου SSoT. */
function mmToMetres(mm: number): number {
  return mm * mmToSceneUnits('m');
}

/**
 * WGS84 (μοίρες, όπως τα δίνει ο πάροχος χάρτη) → **κόσμος** σε ΕΓΣΑ'87 canonical mm.
 *
 * Σκαλιά 2 → 3 → μονάδες. Το αποτέλεσμα είναι στο ίδιο σύστημα με το `TopoPointStore`, δηλαδή
 * το ίδιο σύστημα που κουβαλούν οι πίνακες συντεταγμένων των παραδοτέων.
 */
export function geographicToWorldMm(lat: number, lon: number): Point2D {
  const local = wgs84ToGgrs87(lat, lon);
  const grid = geographicToGrid(local.lat, local.lon);
  return { x: metresToMm(grid.E), y: metresToMm(grid.N) };
}

/**
 * **Κόσμος** σε ΕΓΣΑ'87 canonical mm → WGS84 (μοίρες).
 *
 * Χρησιμοποιείται **μόνο** για να απαντηθεί «ποια πλακίδια καλύπτουν αυτό που βλέπω». Δες την
 * επικεφαλίδα για το γιατί δεν χρησιμοποιείται ποτέ στη ζωγραφική.
 */
export function worldMmToGeographic(x: number, y: number): { lat: number; lon: number } {
  const local = gridToGeographic(mmToMetres(x), mmToMetres(y));
  return ggrs87ToWgs84(local.lat, local.lon);
}

/**
 * Ο ενεργός προβολέας «κόσμος → χαρτί», ή `null` όταν το έργο **δεν** είναι γεωαναφερμένο.
 *
 * Είναι σκόπιμα ο **ίδιος** που χρησιμοποιεί κάθε τοπογραφικό προϊόν: αν ο χάρτης κρατούσε δικό
 * του αντίγραφο, θα υπήρχαν δύο απαντήσεις στο ερώτημα «πού κάθεται ο κόσμος πάνω στο χαρτί» —
 * και η μέρα που ο χρήστης θα ευθυγράμμιζε ξανά το έργο, η μία θα ενημερωνόταν και η άλλη όχι.
 *
 * ⚠️ Το `null` εδώ σημαίνει «**ταυτοτικός**», όχι «σφάλμα». Ο καταναλωτής όμως πρέπει να
 * ξεχωρίσει δύο πράγματα που το `null` **δεν** διακρίνει: «το έργο δεν έχει γεωαναφορά» (άρα ο
 * χάρτης δεν ξέρει πού είναι) από «η γεωαναφορά είναι ταυτοτική» (θεωρητικά δυνατό). Τη διάκριση
 * την κάνει το store της γεωαναφοράς, όχι αυτό το module.
 */
export function getBasemapDisplayProjector(): WorldToDisplayProjector | null {
  return getTopoDisplayProjector();
}

/**
 * WGS84 (μοίρες) → **χαρτί** (τοπικά mm του σχεδίου). Ολόκληρη η αλυσίδα, σε μία κλήση.
 *
 * ⚠️ Δέχεται τον προβολέα ως **όρισμα** και δεν διαβάζει store — ίδια σύμβαση με τα καθαρά
 * modules του `geo-transform`. Έτσι ο ζωγράφος τον ετοιμάζει **μία** φορά ανά καρέ, αντί να τον
 * ξαναζητά για καθεμία από τις εκατοντάδες κορυφές του πλέγματος παραμόρφωσης.
 */
export function geographicToDisplayMm(
  lat: number,
  lon: number,
  projector: WorldToDisplayProjector | null,
): Point2D {
  return projectWorldPoint(geographicToWorldMm(lat, lon), projector);
}
