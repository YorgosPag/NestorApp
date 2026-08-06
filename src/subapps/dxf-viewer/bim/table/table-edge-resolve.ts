/**
 * 🔴 ADR-768 Φ2β — **ΠΟΙΟ ΜΟΛΥΒΙ ΕΧΕΙ ΑΥΤΗ Η ΑΚΜΗ**, χωρισμένο στα δύο: τι είπε **ρητά** ο
 * χρήστης, και τι θα έλεγε η **κληρονομιά** αν δεν είχε πει τίποτα.
 *
 * Καθαρή συνάρτηση: μηδέν γεωμετρία οθόνης, μηδέν προσαρμογή μελανιού, μηδέν React.
 *
 * ## Γιατί εξήχθη από το `table-layout-borders.ts`
 * Οι τέσσερις κανόνες προτεραιότητας του ADR-750 §6.5 ζούσαν ως ιδιωτικές `rawHorizontalSpec`
 * / `rawVerticalSpec` της **διάταξης**. Το **πινέλο μορφοποίησης** τους χρειάζεται για δύο
 * ερωτήσεις που η διάταξη δεν κάνει ποτέ:
 *
 * ```
 *   «τι ΒΛΕΠΕΙ ο χρήστης σε αυτή την ακμή;»       → resolveTableEdgeSpec   (πηγή)
 *   «τι θα έβλεπε ΧΩΡΙΣ ρητή ακμή;»               → inheritedTableEdgeSpec (στόχος)
 * ```
 *
 * Η **δεύτερη** είναι ολόκληρη η «ελάχιστη υλοποίηση» (`table-format-paint.ts`): αν η
 * κληρονομιά του στόχου δίνει **ήδη** ό,τι δείχνει η πηγή, δεν γράφεται ρητή ακμή — και ο
 * στόχος μένει ζωντανός σε κάθε μελλοντική αλλαγή του στυλ. Η διάταξη δεν είχε λόγο να τη
 * ρωτήσει, γιατί εκείνη ζωγραφίζει το αποτέλεσμα, δεν το **συντάσσει**.
 *
 * Αντιγραφή των τεσσάρων επιπέδων στο πινέλο θα ήταν το χειρότερο είδος διπλότυπου: δεν σπάει
 * τη μεταγλώττιση όταν αποκλίνει, και το σύμπτωμα θα ήταν «το πινέλο μεταφέρει άλλη γραμμή από
 * αυτή που βλέπω» — ορατό σε μία ακμή στις εκατό.
 *
 * ## ⚠️ ΧΩΡΙΣ προσαρμογή μελανιού, επίτηδες
 * Το {@link resolveTableBorderInk} είναι απόφαση **οθόνης** (λευκή γραμμή σε λευκό χαρτί
 * γίνεται ορατή). Ο συντάκτης — πινέλο ή αποθήκευση — οφείλει να δει το μολύβι **όπως
 * γράφτηκε**, αλλιώς ένα βάψιμο πάνω σε σκούρο καμβά θα κάρφωνε στο μοντέλο το χρώμα που
 * επινόησε η οθόνη. Η διάταξη τυλίγει αυτή τη συνάρτηση· εδώ δεν μπαίνει ποτέ.
 *
 * @module subapps/dxf-viewer/bim/table/table-edge-resolve
 * @see bim/table/table-layout-borders.ts — ο πρώτος καταναλωτής (ζωγραφική)
 * @see bim/table/table-format-paint.ts — ο δεύτερος (πινέλο μορφοποίησης)
 * @see docs/centralized-systems/reference/adrs/ADR-750-table-cell-borders.md §6.5
 */

import type { TableBorderSpec, TableModel } from '../../types/table';
import type { TableEdgeOrientation } from '../../types/table-edges';
import { tableEdgeKeyAt } from './table-edge-model';
import type { TableStyle } from './table-style';

/**
 * **Επίπεδο 1** — η ρητή ακμή αυτής ακριβώς της θέσης πλέγματος, ή `undefined` όταν κανείς δεν
 * έχει πει τίποτα (τότε αποφασίζουν τα επίπεδα 2–4).
 *
 * Ο έλεγχος `size === 0` δεν είναι μικροβελτιστοποίηση: ο **συνηθέστερος** πίνακας δεν έχει
 * καμία ρητή ακμή, και χωρίς αυτόν θα συνθέταμε ~8.500 κλειδιά για έναν 8×500 μόνο για να
 * αστοχήσουν όλα. Η διάταξη απομνημονεύεται, άρα το κόστος δεν είναι ανά καρέ — είναι όμως
 * ανά αλλαγή μοντέλου, δηλαδή **ανά πληκτρολόγηση**.
 */
export function explicitTableEdgeSpec(
  model: TableModel,
  orientation: TableEdgeOrientation,
  r: number,
  c: number,
): TableBorderSpec | undefined {
  if (model.edges.size === 0) return undefined;
  const key = tableEdgeKeyAt(model, orientation, r, c);
  return key === undefined ? undefined : model.edges.get(key);
}

/**
 * **Επίπεδα 2–4** — τι θα έδειχνε αυτή η ακμή **χωρίς** ρητή παράκαμψη.
 *
 * Η μία ερώτηση που κάνει η «ελάχιστη υλοποίηση» για τον στόχο. Ολική: κάθε θέση πλέγματος
 * έχει απάντηση, γιατί το τελευταίο επίπεδο είναι πάντα το στυλ.
 */
export function inheritedTableEdgeSpec(
  model: TableModel,
  style: TableStyle,
  orientation: TableEdgeOrientation,
  r: number,
  c: number,
): TableBorderSpec {
  return orientation === 'H'
    ? inheritedHorizontal(model, style, r)
    : inheritedVertical(model, style, r, c);
}

/**
 * **Και τα τέσσερα επίπεδα** — τι βλέπει ο χρήστης, πριν από κάθε προσαρμογή οθόνης.
 *
 * Η σύνθεση γράφεται **μία** φορά εδώ και όχι σε κάθε καλούντα: δύο `explicit ?? inherited`
 * σε δύο αρχεία είναι δύο σημεία που μπορούν κάποτε να μάθουν διαφορετική σειρά — και η
 * αντίστροφη σειρά μεταγλωττίζεται μια χαρά.
 */
export function resolveTableEdgeSpec(
  model: TableModel,
  style: TableStyle,
  orientation: TableEdgeOrientation,
  r: number,
  c: number,
): TableBorderSpec {
  return (
    explicitTableEdgeSpec(model, orientation, r, c)
    ?? inheritedTableEdgeSpec(model, style, orientation, r, c)
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Ιδιωτικά — τα επίπεδα 2–4 ανά προσανατολισμό
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Οριζόντια ακμή: `r === 0` κορυφή, `r === rows.length` βάση, αλλιώς ανάμεσα σε δύο γραμμές.
 *
 * ⚠️ **Δεν** παίρνει στήλη, σε αντίθεση με το {@link explicitTableEdgeSpec}: κανένα από τα
 * επίπεδα 2–4 δεν μπορεί να πει κάτι διαφορετικό **ανά στήλη** (η πηγή τους είναι πάντα η
 * γραμμή ή η κλάση της). Η ρητή ακμή είναι η **μόνη** που μπορεί — και είναι ακριβώς αυτό που
 * κάνει το «περίγραμμα σε μεμονωμένο κελί» εκφράσιμο. Παράμετρος που δεν χρησιμοποιείται θα
 * υπονοούσε το αντίθετο.
 */
function inheritedHorizontal(model: TableModel, style: TableStyle, r: number): TableBorderSpec {
  const rows = model.rows;
  if (r === 0) return style.rowClasses[rows[0].rowClass].borders.top;
  if (r === rows.length) return style.rowClasses[rows[rows.length - 1].rowClass].borders.bottom;

  const above = rows[r - 1];
  const below = rows[r];
  // Επίπεδο 2 — η παράκαμψη ολόκληρου πλάτους (γραμμή-σύνολο, ADR-750 Φ1).
  if (below.borderTop) return below.borderTop;
  // Επίπεδο 3 — αλλαγή κλάσης: η γραμμή «κάτω από την κεφαλίδα» ανήκει στην κεφαλίδα.
  if (above.rowClass !== below.rowClass) return style.rowClasses[above.rowClass].borders.bottom;
  // Επίπεδο 4 — ίδια κλάση.
  return style.rowClasses[above.rowClass].borders.insideH;
}

/** Κατακόρυφη ακμή: `c === 0` αριστερά, `c === columns.length` δεξιά, αλλιώς εσωτερική. */
function inheritedVertical(
  model: TableModel,
  style: TableStyle,
  r: number,
  c: number,
): TableBorderSpec {
  const borders = style.rowClasses[model.rows[r].rowClass].borders;
  if (c === 0) return borders.left;
  if (c === model.columns.length) return borders.right;
  return borders.insideV;
}
