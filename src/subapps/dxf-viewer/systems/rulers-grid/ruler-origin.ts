/**
 * 🏢 SSoT — «Αρχική» θέση κόσμου (ADR-040 Phase XXII.B).
 *
 * Το world (0,0) αγκυρώνεται στην κάτω-αριστερή γωνία των χαράκων. Μέχρι το Phase XXII.B
 * η αγκύρωση ζούσε ΜΟΝΟ μέσα στο bootstrap effect του DxfCanvas, και το `resetToOrigin()`
 * (zoom-reset) βασιζόταν στο re-fire εκείνου του effect (interception μέσω του transform
 * prop). Με το transform εκτός React props, η αγκύρωση έγινε ρητή: ΚΑΙ το bootstrap ΚΑΙ
 * το zoom-reset καλούν αυτόν τον helper — ένα σημείο αλήθειας, μηδέν interception.
 */
import type { ViewTransform } from '../../rendering/types/Types';

/**
 * Transform με scale 1 και world (0,0) στην κάτω-αριστερή γωνία της περιοχής σχεδίασης.
 *
 * 🔴 **ADR-775 §14 — ΔΙΟΡΘΩΣΗ (2026-08-08): ήταν ΔΙΠΛΗ ΜΕΤΑΤΟΠΙΣΗ, με αντίθετο αποτέλεσμα
 * από αυτό που δήλωνε.**
 *
 * Επέστρεφε `offsetX = DEFAULT_RULER_WIDTH` και `offsetY = viewportHeight −
 * DEFAULT_RULER_HEIGHT`. Όμως ο **ένας** τύπος (`CoordinateTransforms.worldToScreen`) είναι
 *
 * ```
 * screenX = area.x      + wx·scale + offsetX
 * screenY = area.bottom − wy·scale − offsetY
 * ```
 *
 * και το `getDrawingAreaRect` **ήδη** αφαιρεί τους χάρακες (`drawing-area.ts`: *«στην αρχή
 * του κόσμου (`wy = 0`, **`offsetY = 0`**) δίνει `screenY = height − 30`, που είναι ακριβώς η
 * άνω ακμή της ζώνης του κάτω χάρακα»*). Άρα η παλιά τιμή πρόσθετε **δεύτερη φορά** το chrome:
 *
 * | | παλιό | αποτέλεσμα | σωστό |
 * |---|---|---|---|
 * | οριζόντια | `offsetX = 30` | `area.x + 30` ⇒ **+30px** μετατόπιση | `0` |
 * | κατακόρυφα | `offsetY = h − 30` | `screenY(0) = (h−30) − (h−30) = **0**` ⇒ **ΠΑΝΩ**-αριστερά | `0` ⇒ `h − 30` = **ΚΑΤΩ**-αριστερά |
 *
 * 🔑 **Η συνέπεια ήταν προϊοντική, όχι θεωρητική**: κάθε σχέδιο με **θετικές** συντεταγμένες
 * (δηλαδή το φυσιολογικό) άνοιγε **εντελώς εκτός κάδρου** — ο χρήστης έβλεπε κενό μέχρι να
 * κάνει ο ίδιος zoom extents. Μετρημένο 2026-08-08 στο `/test-harness/dxf-canvas`: το fixture
 * (`x∈[100,400] · y∈[100,300]`) έδινε **0 pixels μελανιού** στην αρχική όψη· με αυτή τη
 * διόρθωση προσγειώνεται σε `x∈[130,430] · y∈[470,670]`, δηλαδή **μέσα** στο κάδρο.
 *
 * ⚠️ Το `viewportHeight` **αφαιρέθηκε** από την υπογραφή: η αγκύρωση δεν εξαρτάται από το ύψος
 * (το `area.bottom` το γνωρίζει ήδη ο τύπος). Μια παράμετρος που δεν συμμετέχει στο
 * αποτέλεσμα είναι ψέμα για το τι κάνει η συνάρτηση — και ήταν **ακριβώς** ο φορέας του
 * σφάλματος.
 */
export function computeRulerOriginTransform(): ViewTransform {
  return { scale: 1, offsetX: 0, offsetY: 0 };
}
