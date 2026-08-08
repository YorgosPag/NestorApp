/**
 * 🔴 ADR-739 §60 — **ΠΟΙΟ ΕΠΙΠΕΔΟ ΤΟ ΑΠΟΦΑΣΙΣΕ;** Η ερώτηση που το μοντέλο μπορούσε πάντα να
 * απαντήσει και **καμία** επιφάνεια δεν έκανε ποτέ. Καθαρό· μηδέν React, μηδέν DOM.
 *
 * ## Η τρίτη ερώτηση, δίπλα στις δύο που υπάρχουν
 * Το {@link TableFormatState} απαντά **δύο**: «τι ισχύει;» (`value`/`mixed`) και «το δήλωσε ο
 * στόχος;» (`overridden`). Η δεύτερη είναι δίτιμη — και γι' αυτό είναι μισή απάντηση: όταν λέει
 * *όχι*, ο χρήστης μαθαίνει ότι κάποιος **άλλος** το είπε, χωρίς να μάθει **ποιος**. Σε πίνακα
 * με τέσσερα επίπεδα κληρονομιάς αυτό είναι η διαφορά ανάμεσα σε «θα το αλλάξω εδώ» και «θα το
 * αλλάξω στη στήλη, όπου ανήκει».
 *
 * ```
 *   στυλ:          κελί ▸ γραμμή ▸ στήλη ▸ κλάση γραμμής   (resolveCellStyle, §28.4)
 *   μορφή αριθμού: κελί ▸ γραμμή ▸ στήλη ▸ valueType       (resolveCellNumberFormat, ADR-760 §6.2)
 * ```
 *
 * ## 🔬 Πού στέκεται αυτό απέναντι στους μεγάλους — με ονόματα, όχι με γνώμη
 * | | Δείχνει «ρητό ή κληρονομημένο»; | Δείχνει **ποιο επίπεδο**; |
 * |---|---|---|
 * | **Excel** «Μορφοποίηση κελιών» | όχι — δείχνει μόνο το αποτέλεσμα | όχι |
 * | **AutoCAD** *Table Cell Format* | όχι | όχι |
 * | **ArchiCAD** Calculation Units | δεν υπάρχει κληρονομιά (ένα επίπεδο) | — |
 * | **Revit** «By Category» / **Figma** detached override | **ναι** | όχι *(και δεν αφορούν κελιά πίνακα)* |
 * | **ΝΕΣΤΩΡ** | ναι (`overridden`, §55) | **ναι** |
 *
 * ⚠️ Ο ισχυρισμός είναι **στενός επίτηδες**: το Revit και το Figma απαντούν την πρώτη ερώτηση
 * για ιδιότητες αντικειμένου, όχι για μορφή κελιού πίνακα. Η υπεροχή δεν είναι «κανείς δεν
 * σκέφτηκε την κληρονομιά» — είναι ότι **κανένα εργαλείο πίνακα** δεν τη δείχνει, και ότι
 * κανένα από τα πέντε δεν ονομάζει το **επίπεδο**.
 *
 * @module subapps/dxf-viewer/bim/table/table-format-origin
 * @see bim/table/table-cell-style-scan.ts — ο ΕΝΑΣ βρόχος πάνω στα επιλυμένα κελιά
 * @see bim/table/table-style.ts — `resolveCellStyle`, η σειρά προτεραιότητας
 */

import { forEachResolvedCellStyle, type TableCellStyleKey } from './table-cell-style-scan';
import { tableFormatScopeBounds, type TableFormatScope } from './table-format-scope';
import { tableRangeCellRefs } from './table-cell-range';
import type { TableStyle, TableStyleOverrides } from './table-style';
import type { PersistedTableModel, TableAxisStyleOverride } from '../../types/table';

/**
 * Ποιο επίπεδο έδωσε την τιμή.
 *
 * **Πέντε** τιμές και όχι τέσσερις με κοινό «βάση»: οι δύο αλυσίδες τελειώνουν σε **άλλο**
 * πράγμα — το στυλ στην κλάση γραμμής (τίτλος/κεφαλίδα/δεδομένα), η μορφή αριθμού στη
 * σημασιολογία της στήλης (`TableColumn.valueType`). Ένα κοινό `'base'` θα υποχρέωνε την
 * επιφάνεια να διαλέξει ετικέτα **ανά πεδίο**, δηλαδή να ξαναγράψει εδώ τη γνώση που ήδη
 * υπάρχει — και θα γεννούσε δυναμικό κλειδί i18n (παγίδα του ADR-744).
 */
export type TableFormatOrigin = 'cell' | 'row' | 'column' | 'rowClass' | 'valueType';

/**
 * Η απάντηση για **έναν στόχο**: ένα επίπεδο, «ανάμεικτο» ή «δεν έχω τι να πω».
 *
 * `'mixed'` σημαίνει ότι δύο κελιά του στόχου παίρνουν την τιμή τους από **διαφορετικά**
 * επίπεδα — κατάσταση συχνή και όχι παθολογική (μια μαρκαρισμένη στήλη περνά από γραμμή
 * κεφαλίδας και γραμμές δεδομένων). `null` = στόχος που δεν βρέθηκε.
 *
 * ⚠️ Είναι **ορθογώνιο** με το `mixed` της τιμής: δύο κελιά μπορούν να δείχνουν την **ίδια**
 * τιμή από διαφορετικά επίπεδα (η στήλη λέει «έντονα» και το ένα κελί το ξαναλέει). Γι' αυτό
 * δεν συγχωνεύεται με το {@link TableFormatState}: θα ήταν δύο ερωτήσεις σε ένα πεδίο.
 */
export type TableFormatOriginState = TableFormatOrigin | 'mixed' | null;

/**
 * Από πού έρχεται **αυτό το πεδίο στυλ** για τα κελιά του στόχου.
 *
 * ⚠️ Ο έλεγχος είναι `!== undefined` και **όχι** truthiness: το `fillColorHex: null` σημαίνει
 * «ρητά **κανένα** γέμισμα» (`clearable`, δες `table-style.ts`) — δηλαδή απόφαση αυτού του
 * επιπέδου, όχι απουσία. Με truthiness, το «ρητά χωρίς γέμισμα» θα εμφανιζόταν ως κληρονομιά
 * και ο χρήστης θα έψαχνε στη στήλη μια δήλωση που είχε κάνει ο ίδιος στο κελί.
 */
export function resolveTableStyleFieldOrigin(
  model: PersistedTableModel,
  style: TableStyle,
  scope: TableFormatScope,
  key: TableCellStyleKey,
): TableFormatOriginState {
  return foldOrigins(model, style, scope, (overrides) => declaringLevel(overrides, key) ?? 'rowClass');
}

/**
 * Από πού έρχεται η **μορφή αριθμού** — η ίδια ερώτηση, η **άλλη** αλυσίδα.
 *
 * Ξεχωριστή συνάρτηση και όχι παράμετρος «ποια αλυσίδα;»: το `numberFormat` δεν είναι
 * `TableCellStyleKey` (η τομή το αποκλείει ρητά — δες `table-cell-style-scan.ts`), άρα ο τύπος
 * **δεν επιτρέπει** να ζητηθεί από την πρώτη. Η διάκριση ζει στον μεταγλωττιστή, όχι σε σχόλιο.
 */
export function resolveTableNumberFormatOrigin(
  model: PersistedTableModel,
  style: TableStyle,
  scope: TableFormatScope,
): TableFormatOriginState {
  return foldOrigins(model, style, scope, (overrides) => (
    declaringLevel(overrides, 'numberFormat') ?? 'valueType'
  ));
}

// ──────────────────────────────────────────────────────────────────────────────
// Ιδιωτικά
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Το **πρώτο** επίπεδο που δηλώνει το πεδίο, με τη σειρά του `resolveCellStyle`· `null` όταν
 * κανένα δεν το δηλώνει.
 *
 * Η σειρά γράφεται **μία** φορά, εδώ, και είναι η ίδια που εκτελεί το `inherited(...)` του
 * `table-style.ts` και το `explicitCellNumberFormat` του `table-cell-format.ts`. Ένας δεύτερος
 * κατάλογος θα ήταν το σχήμα των δύο λιστών namespace του CHECK 3.34: δύο απαντήσεις στο ίδιο
 * ερώτημα, με τη μία να αποκλίνει την ημέρα που προστεθεί πέμπτο επίπεδο.
 */
function declaringLevel(
  overrides: TableStyleOverrides,
  key: keyof TableAxisStyleOverride,
): TableFormatOrigin | null {
  if (overrides.cell?.[key] !== undefined) return 'cell';
  if (overrides.row?.[key] !== undefined) return 'row';
  if (overrides.column?.[key] !== undefined) return 'column';
  return null;
}

/**
 * Ο **ΕΝΑΣ** βρόχος: διατρέχει τα κελιά του στόχου και συμπυκνώνει τις προελεύσεις σε μία.
 *
 * Χρησιμοποιεί το υπάρχον {@link forEachResolvedCellStyle}, που κουβαλά ήδη τα `overrides`
 * **ακριβώς** για αναγνώστες σαν αυτόν (δες την κεφαλίδα του). Δεύτερος βρόχος πάνω στα ίδια
 * κελιά θα ήταν ο structural clone που εκείνο το module υπάρχει για να αποτρέψει.
 */
function foldOrigins(
  model: PersistedTableModel,
  style: TableStyle,
  scope: TableFormatScope,
  originOf: (overrides: TableStyleOverrides) => TableFormatOrigin,
): TableFormatOriginState {
  const bounds = tableFormatScopeBounds(model, scope);
  if (bounds === null) return null;

  let seen: TableFormatOrigin | null = null;
  let mixed = false;

  const visited = forEachResolvedCellStyle(model, style, tableRangeCellRefs(model, bounds), (cell) => {
    const origin = originOf(cell.overrides);
    if (seen === null) seen = origin;
    else if (seen !== origin) mixed = true;
  });

  if (!visited || seen === null) return null;
  return mixed ? 'mixed' : seen;
}
