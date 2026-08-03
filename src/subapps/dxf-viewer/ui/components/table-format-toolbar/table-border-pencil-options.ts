/**
 * ADR-750 Φ5 — **τι προσφέρει καθένα από τα χειριστήρια του μολυβιού**.
 *
 * Καθαρά δεδομένα, μηδέν React: το πάνελ τα αποδίδει, δεν τα εφευρίσκει. Και **κανένα** από τα
 * δύο δεν είναι δική μας λίστα — αντλούνται από τα υπάρχοντα SSoT:
 *
 * ```
 *   τύποι γραμμής  →  stores/LinetypeRegistry   (ISO 8 + ό,τι εισήχθη από `.lin` / DXF)
 *   πάχη           →  config/lineweight-iso-catalog  (οι 23 θετικές πένες ISO 128-20)
 * ```
 *
 * ## 🔴 Γιατί ΔΕΝ γράφτηκε εδώ ένα «διαλεγμένο» υποσύνολο
 * Ο πειρασμός είναι να προσφερθούν «οι 6 συνηθισμένες πένες» και «οι 4 συνηθισμένοι τύποι»,
 * γιατί 23 + 9 φαίνονται πολλά για mini toolbar. Θα ήταν **δεύτερη κλίμακα**: ο ίδιος χρήστης
 * που διαλέγει 0,18 mm για μια γραμμή του σχεδίου δεν θα μπορούσε να τη δώσει σε ένα
 * περίγραμμα πίνακα, χωρίς να του λέει τίποτα το UI. Το μέγεθος της λίστας είναι πρόβλημα
 * **παρουσίασης** (κύλιση) και λύνεται εκεί.
 *
 * ## Γιατί το «ByLayer» πετιέται
 * Ο κατάλογος τύπων γραμμής προσφέρει `ByLayer` ως πρώτη επιλογή — σωστό για **οντότητες** του
 * σχεδίου, που έχουν layer. Ένα περίγραμμα πίνακα δεν έχει: κληρονομεί από το **στυλ του
 * πίνακα**, και αυτό λέγεται ήδη «Αυτόματο» (Α23). Δύο ονόματα για την ίδια σημασία μέσα στο
 * ίδιο μενού θα ήταν το ακριβές σχήμα της Α19.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/table-border-pencil-options
 * @see rendering/linetype-thumbnail.ts — η προεπισκόπηση, ίδιο SSoT με τον renderer
 * @see docs/centralized-systems/reference/adrs/ADR-750-table-cell-borders.md §19
 */

import { LINEWEIGHT_CONCRETE_MM_VALUES } from '../../../config/lineweight-iso-catalog';
import { listSelectableLinetypeNames } from '../../../stores/LinetypeRegistry';
import { LINETYPE_SENTINEL_NAMES } from '../../../config/linetype-iso-catalog';

/**
 * Τα ονόματα τύπων γραμμής που μπορεί να διαλέξει ο χρήστης για περίγραμμα πίνακα.
 *
 * **Συνάρτηση και όχι σταθερά**: το `LinetypeRegistry` είναι ζωντανό (εισαγωγή `.lin`, DXF
 * import, δημιουργία από τον χρήστη). Μια σταθερή λίστα θα πάγωνε στην πρώτη φόρτωση του
 * module — δηλαδή ένας τύπος που μόλις εισήχθη δεν θα εμφανιζόταν ποτέ, μέχρι refresh.
 */
export function tableBorderLinetypeNames(): readonly string[] {
  return listSelectableLinetypeNames().filter(
    (name) => name !== LINETYPE_SENTINEL_NAMES.BYLAYER && name !== LINETYPE_SENTINEL_NAMES.BYBLOCK,
  );
}

/** Οι πένες που μπορεί να διαλέξει ο χρήστης, σε mm — οι 23 θετικές του ISO 128-20. */
export function tableBorderWeightsMm(): readonly number[] {
  return LINEWEIGHT_CONCRETE_MM_VALUES;
}
