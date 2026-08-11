/**
 * ADR-739 — **ΤΙ ΜΟΡΦΟΠΟΙΕΙΤΑΙ**: ο ΕΝΑΣ δρόμος από «τι διάλεξε ο χρήστης» σε «πού γράφεται».
 *
 * Η μορφοποίηση πίνακα έχει **δύο** στόχους με πραγματικά διαφορετική εγγραφή — τον άξονα
 * (`TableRow`/`TableColumn.styleOverride`) και την περιοχή (Ν× `TableCell.styleOverride`) — και
 * **τρεις** επιφάνειες που τους ζητούν: το mini toolbar των ζωνών δείκτη, το mini toolbar πάνω
 * σε επιλογή κελιών, και η κορδέλα.
 *
 * Χωρίς αυτό το επίπεδο, κάθε επιφάνεια θα έπρεπε να ξέρει **και τους δύο** γραφείς και να
 * διαλέγει μόνη της. Τρεις ανεξάρτητες επιλογές σημαίνει τρεις ευκαιρίες να διαφωνήσουν για το
 * ίδιο ερώτημα — και η διαφωνία θα ήταν αόρατη: «το `Shift+κλικ` στο γράμμα B μορφοποίησε τη
 * στήλη από το μενού αλλά τα κελιά από την κορδέλα» είναι σφάλμα που κανένα test δεν ψάχνει,
 * γιατί κάθε πλευρά του δουλεύει.
 *
 * ## 🔴 Ο κανόνας: Η ΠΡΟΘΕΣΗ ΤΗΣ ΕΠΙΛΟΓΗΣ ΟΡΙΖΕΙ ΤΟΝ ΣΤΟΧΟ
 * ```
 *   επιλογή είδους 'row' / 'column'  →  ΑΞΟΝΑΣ   (γράφει η γραμμή/στήλη)
 *   επιλογή είδους 'range'           →  ΚΕΛΙΑ
 *   κανένα μαρκάρισμα (μόνο δρομέας) →  ΚΕΛΙΑ    (το ενεργό κελί, κουμπωμένο σε συγχώνευση)
 * ```
 * Δεν είναι σύμβαση δική μας: είναι το Excel. Κλικ στο γράμμα `B` και μετά «Β» βάφει **τη
 * στήλη** — και ό,τι γραφτεί αργότερα σε νέα γραμμή κληρονομεί. Μαρκάρισμα `B2:B9` και «Β»
 * βάφει **εννιά κελιά** — μια δέκατη γραμμή γεννιέται άβαφη. Η διαφορά δεν είναι λεπτομέρεια
 * υλοποίησης· είναι ακριβώς αυτό που ζήτησε ο χρήστης, και ζει ήδη στο `TableSelectionKind`
 * (§27.15). Εδώ απλώς **διαβάζεται**, δεν ξαναποφασίζεται.
 *
 * ## Γιατί δέχεται θέση + επιλογή αντί για την κατάσταση του δρομέα
 * Το `TableCellCursorState` ζει σε React store (`'use client'`). Αυτό το module είναι καθαρό —
 * μηδέν React, μηδέν DOM — και πρέπει να μείνει, γιατί τα tests του είναι η μόνη απόδειξη ότι
 * οι δύο δρόμοι συμφωνούν. Δέχεται λοιπόν **δομικά** τα δύο πεδία που χρειάζεται· ίδιο μοτίβο
 * με το `TableAxisTarget`, που είναι σκόπιμα το δομικό υποσύνολο του `TableIndicatorHit`.
 *
 * ## Τι ζει ΔΙΠΛΑ και όχι εδώ
 * Το **ξεχείλισμα** (`table-format-overflow-scope.ts`): είναι η μόνη πράξη μορφοποίησης που δεν
 * μιλά αυτό το λεξιλόγιο — το `overflow` δεν είναι πεδίο του `TableCellStyle`, άρα δεν περνά
 * ούτε από το {@link setTableFormatField} ούτε από το {@link resolveTableFormatState}. Δες την
 * κεφαλίδα του για το γιατί η τομή δεν είναι το μέγεθος.
 *
 * @module subapps/dxf-viewer/bim/table/table-format-scope
 * @see bim/table/table-axis-style-ops.ts — ο γραφέας του άξονα
 * @see bim/table/table-range-style-ops.ts — ο γραφέας των κελιών
 * @see bim/table/table-format-overflow-scope.ts — ό,τι δεν χωρά στο γενικό λεξιλόγιο
 */

import {
  clearAxisStyleOverride,
  hasAnyAxisStyleOverride,
  resolveAxesFormat,
  resolveAxisNumericRange,
  setAxisStyleField,
  writeEachAxis,
  type TableStyleAxis,
} from './table-axis-style-ops';
import {
  clearRangeStyleOverride,
  hasAnyRangeStyleOverride,
  resolveRangeFormat,
  setRangeStyleField,
} from './table-range-style-ops';
import {
  resolveCellsNumericRange,
  type TableCellNumericKey,
  type TableCellStyleKey,
  type TableFormatState,
  type TableNumericRange,
} from './table-cell-style-scan';
import {
  extendTableSelectionTo,
  resolveTableCellRange,
  resolveTableSelectionBounds,
  tableRangeCellRefs,
  tableRangeMembership,
  wholeAxisSelection,
  type TableCellRangeBounds,
  type TableCellRef,
  type TableSelectionSpan,
} from './table-cell-range';
import { axisTargetOf } from './table-axis-action-target';
// 🔴 ADR-753 Φ4 — ο **τρίτος** γραφέας. Δες την κεφαλίδα του για το γιατί τα runs δεν
// ξαναγράφονται εδώ και γιατί η κληρονομιά ταξιδεύει ως όρισμα.
import {
  cellRunNumericRangeAt,
  clearCellRunRange,
  hasCellRunRangeStyles,
  resolveCellRunState,
  setCellRunField,
} from './table-chars-style-ops';
import {
  isTableTextRunStyleKey,
  type TableTextAnchoredRange,
  type TableTextRunStyleKey,
} from './table-cell-run-ops';
import {
  nextTextHeightFromRange,
  stepAxisTextHeight,
  type TextHeightStepDirection,
} from './table-text-height-scale';
import { resolveTableModel } from './table-model-helpers';
import type { TableCellStyle, TableStyle } from './table-style';
import type {
  PersistedTableModel,
  TableAxisStyleOverride,
  TableTextRunStyle,
} from '../../types/table';

/**
 * Πού πάει η επόμενη εντολή μορφοποίησης.
 *
 * Διακριτή ένωση και όχι «άξονας + προαιρετικά όρια»: οι τρεις περιπτώσεις δεν έχουν κοινό
 * πυρήνα δεδομένων (ταυτότητες άξονα ≠ ορθογώνιο δεικτών ≠ εύρος χαρακτήρων), και ένα σχήμα με
 * προαιρετικά πεδία θα επέτρεπε την κατάσταση «άξονας **και** όρια», που δεν σημαίνει τίποτα.
 *
 * ## 🔴 ADR-753 Φ4 — ΓΙΑΤΙ ΤΡΙΤΟ ΣΚΕΛΟΣ ΚΑΙ ΟΧΙ ΠΡΟΑΙΡΕΤΙΚΟ ΠΕΔΙΟ ΣΤΟ `range`
 * Ένα `range: { bounds, chars? }` θα δούλευε **και** θα ήταν το χειρότερο σχήμα: κάθε
 * υπάρχων καταναλωτής θα συνέχιζε να μεταγλωττίζεται και θα **αγνοούσε σιωπηλά** το νέο
 * πεδίο, δηλαδή θα έβαφε ολόκληρο το κελί ακριβώς όπως πριν — το ελάττωμα που η Φ4 υπάρχει
 * για να κλείσει, ξαναγεννημένο ως προεπιλογή. Με τρίτο σκέλος ο **μεταγλωττιστής**
 * υποχρεώνει καθέναν να απαντήσει, και οι απαντήσεις γράφτηκαν όλες: δες τις οκτώ συναρτήσεις
 * από κάτω, όπου η επανάληψη «τα γράμματα ζουν μέσα σε ένα κελί» δίνει σε πέντε από αυτές την
 * απάντηση **δωρεάν**, μέσα από το {@link tableFormatScopeBounds}.
 */
export type TableFormatScope =
  | { readonly kind: 'axis'; readonly axis: TableStyleAxis; readonly ids: readonly string[] }
  | { readonly kind: 'range'; readonly bounds: TableCellRangeBounds }
  /**
   * 🔴 ADR-753 Φ4 — **οι μαρκαρισμένοι χαρακτήρες** μέσα στο κελί που γράφεται.
   *
   * Το `cell` είναι **ταυτότητα**, όχι ορθογώνιο: τα runs ζουν πάνω στο κελί που γράφει ο
   * επεξεργαστής — το ίδιο ακριβώς που δέχεται και το **κείμενό** του. Ένα ορθογώνιο εδώ θα
   * επέτρεπε την κατάσταση «γράμματα σε δύο κελιά», που δεν υπάρχει: η επιλογή κειμένου ζει
   * μέσα σε **ένα** πεδίο του DOM.
   *
   * ⚠️ Οι δείκτες είναι θέσεις χαρακτήρων του `TableCell.value` — δες
   * `bim/table/table-cell-run-ops.ts` για το τι σημαίνει αυτό όταν αλλάξει το κείμενο.
   *
   * 🔴 ADR-753 §25 — το `range` είναι **αγκυρωμένο** ({@link TableTextAnchoredRange}): κουβαλά
   * το κείμενο πάνω στο οποίο μετρήθηκε. Χωρίς αυτό, ο στόχος ήταν δύο αριθμοί που ο καλών
   * όφειλε να **θυμηθεί** να συνοδεύσει με το σωστό κείμενο — και δεν το θυμήθηκε: οι δείκτες
   * διαβάζονταν από το πεδίο του DOM ενώ το κείμενο γραφόταν από το πρόχειρο του δρομέα.
   */
  | {
    readonly kind: 'chars';
    readonly cell: TableCellRef;
    readonly range: TableTextAnchoredRange;
  };

/**
 * Το σκέλος «γράμματα», ονομασμένο.
 *
 * 🔴 ADR-753 §25 — ο κατασκευαστής του ({@link tableCharsFormatScopeOf}) το επιστρέφει
 * **αστένευτο**, ώστε ο ιδιοκτήτης να μπορεί να διαβάσει τη **βάση των δεικτών** χωρίς δεύτερο
 * αντίγραφό της. Πριν, ο κατασκευαστής επέστρεφε την πλατιά ένωση, ο ιδιοκτήτης δεν είχε
 * πρόσβαση στο κείμενο, και το ξαναζητούσε από **άλλη πηγή** — που είναι ακριβώς το ελάττωμα.
 */
export type TableCharsFormatScope = Extract<TableFormatScope, { readonly kind: 'chars' }>;

/**
 * Η επιλογή του χρήστη → ο στόχος. `null` όταν η επιλογή είναι μπαγιάτικη (undo, διαγραφή
 * γραμμής) — ο καλών σβήνει, δεν μαντεύει· ίδια σύμβαση με το `resolveTableSelectionBounds`.
 *
 * Χωρίς μαρκάρισμα, στόχος είναι το **ενεργό κελί** — κουμπωμένο σε ολόκληρη τη συγχώνευσή
 * του, αν ανήκει σε μία. Το κούμπωμα εδώ είναι σωστό ακριβώς επειδή ο στόχος είναι κελιά: η
 * μισή συγχώνευση δεν είναι μορφοποιήσιμη οντότητα, όπως δεν είναι ούτε αντιγράψιμη (§26.5).
 */
export function tableFormatScopeOf(
  model: PersistedTableModel,
  position: TableCellRef,
  selection: TableSelectionSpan | null,
): TableFormatScope | null {
  const resolved = resolveTableModel(model);

  if (!selection) {
    const bounds = resolveTableCellRange(resolved, position, position);
    return bounds ? { kind: 'range', bounds } : null;
  }

  const bounds = resolveTableSelectionBounds(resolved, selection);
  if (!bounds) return null;
  if (selection.kind === 'range') return { kind: 'range', bounds };

  // Άξονας: οι ταυτότητες βγαίνουν από το **ίδιο** ορθογώνιο, ώστε «τι είναι μαρκαρισμένο» και
  // «τι θα γραφτεί» να μην είναι δύο εκφράσεις που τυχαίνει να συμφωνούν.
  const membership = tableRangeMembership(resolved, bounds);
  return selection.kind === 'row'
    ? { kind: 'axis', axis: 'row', ids: [...membership.rowIds] }
    : { kind: 'axis', axis: 'column', ids: [...membership.colIds] };
}

/**
 * 🔴 ADR-753 Φ4 — **οι μαρκαρισμένοι χαρακτήρες ως στόχος**· `null` όταν το κελί δεν λύνεται
 * στο μοντέλο (undo έσβησε τη γραμμή ενόσω ήταν ανοιχτή η γραμμή εργαλείων).
 *
 * Χωριστός κατασκευαστής από το {@link tableFormatScopeOf} και **όχι** τέταρτο όρισμα εκεί:
 * εκείνο διαβάζει την επιλογή του **πλέγματος** (`TableSelectionSpan`), που γεννιέται από τον
 * καμβά και το πληκτρολόγιο. Η επιλογή **χαρακτήρων** γεννιέται από ένα πεδίο του DOM, δεν
 * υπάρχει καν στο μοντέλο, και δεν συνυπάρχει ποτέ με τις άλλες δύο — ο χρήστης ή δείχνει
 * κελιά ή δείχνει γράμματα. Ένα προαιρετικό όρισμα θα ένωνε δύο κόσμους που δεν συναντιούνται.
 *
 * ⚠️ **Καμία κανονικοποίηση των δεικτών εδώ**: την κάνει ο κάθε αναγνώστης/γραφέας πάνω στο
 * **πραγματικό μήκος** του κειμένου (`clampRange`), που είναι η μόνη αυθεντία. Δεύτερο clamp
 * εδώ θα ήταν δεύτερη άποψη για το τι είναι μπαγιάτικος δείκτης.
 */
export function tableCharsFormatScopeOf(
  model: PersistedTableModel,
  cell: TableCellRef,
  range: TableTextAnchoredRange,
): TableCharsFormatScope | null {
  const resolved = resolveTableModel(model);
  // Ο ίδιος φρουρός επιβίωσης με το `tableFormatScopeOf`: το κελί πρέπει να υπάρχει **ως
  // γεωμετρία**, αλλιώς δεν υπάρχει στόχος — και ο καλών σβήνει αντί να γράψει στο πουθενά.
  return resolveTableCellRange(resolved, cell, cell) === null
    ? null
    : { kind: 'chars', cell, range };
}

/**
 * Θέτει **ένα** πεδίο στον στόχο, όποιος κι αν είναι. Οι τρεις καταστάσεις (`undefined`
 * αφαιρεί · `null` ρητά κανένα · αλλιώς ρητή τιμή) ταξιδεύουν αυτούσιες προς τον γραφέα.
 *
 * Η εγγύηση **by-reference στο no-op** επιβιώνει και στα τρία σκέλη: την κρατά ο κάθε γραφέας,
 * και το `writeEachAxis` την κρατά και στον πληθυντικό.
 *
 * ## 🔴 ADR-753 Φ4 — ΤΑ ΓΡΑΜΜΑΤΑ ΔΕΝ ΔΕΧΟΝΤΑΙ ΚΑΘΕ ΠΕΔΙΟ, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΤΟ EXCEL
 * Το `align`, το `fillColorHex`, η μορφή αριθμού και η εσοχή **δεν** έχουν νόημα ανά
 * χαρακτήρα. Η σωστή απάντηση γι' αυτά δεν είναι «τίποτα» — είναι **το κελί**: μετρημένο στο
 * Excel, σε λειτουργία επεξεργασίας με μαρκαρισμένα γράμματα το κουβαδάκι βάφει ολόκληρο το
 * κελί ενώ το «Α» με το χρώμα βάφει μόνο τα γράμματα. Ο διαχωρισμός **δεν** γράφεται εδώ ως
 * λίστα ονομάτων: τον ξέρει ήδη ο {@link isTableTextRunStyleKey}, το ίδιο `Record` που
 * ελέγχει ο μεταγλωττιστής και που ρωτά ήδη ο γραφέας κελιών για την **αντίστροφη**
 * κατεύθυνση (ισοπέδωση των runs).
 */
export function setTableFormatField<K extends keyof TableAxisStyleOverride>(
  model: PersistedTableModel,
  scope: TableFormatScope,
  key: K,
  value: TableAxisStyleOverride[K] | undefined,
): PersistedTableModel {
  if (scope.kind === 'axis') {
    return writeEachAxis(model, scope.ids, (next, id) =>
      setAxisStyleField(next, scope.axis, id, key, value));
  }
  if (scope.kind === 'chars' && isTableTextRunStyleKey(key)) {
    // Η μετατροπή είναι **η ίδια η απόδειξη** που μόλις έτρεξε: ο φρουρός από πάνω δηλώνει ότι
    // το πεδίο υπάρχει στο λεξιλόγιο των runs, και ο τύπος `_RunAndCellValuesAgree` του
    // `table-chars-style-ops.ts` κρατά τις **τιμές** των δύο λεξιλογίων ταυτόσημες. Χωρίς
    // εκείνον τον έλεγχο αυτή η γραμμή θα ήταν ευχή· με αυτόν είναι μετάφραση.
    return setCellRunField(
      model, scope.cell, scope.range,
      key as TableTextRunStyleKey,
      value as TableTextRunStyle[TableTextRunStyleKey],
    );
  }
  const bounds = tableFormatScopeBounds(model, scope);
  return bounds === null ? model : setRangeStyleField(model, bounds, key, value);
}

/**
 * 🔴 ADR-739 §52 — **ο στόχος ως ΟΡΘΟΓΩΝΙΟ**: ό,τι χρειάζονται οι πράξεις που δεν ξέρουν τη
 * λέξη «άξονας» — περιγράμματα (ADR-750) και συγχώνευση (ADR-755).
 *
 * Και οι δύο δέχονται **μόνο** `TableCellRangeBounds`, επίτηδες (δες την κεφαλίδα του
 * `use-table-border-actions`: «παραμετρικό ως προς τα ΟΡΙΑ και όχι ως προς τον άξονα»). Άρα
 * κάθε επιφάνεια που τους καλεί με στόχο-άξονα οφείλει να κάνει **αυτή** τη μετάφραση — και
 * μέχρι το §52 τη γνώριζε **μόνο** το `use-table-header-menu` (ιδιωτικό `axisBounds`). Η
 * κορδέλα θα ήταν ο δεύτερος τόπος, δηλαδή δύο απαντήσεις στο «ποιο ορθογώνιο είναι μια
 * μαρκαρισμένη στήλη;».
 *
 * 🔑 Περνά υποχρεωτικά από το {@link wholeAxisSelection} — τον **ΕΝΑ** ορισμό της «ολόκληρης
 * στήλης/γραμμής» (§27.16 Ε2). Ο πειρασμός είναι δύο γραμμές αριθμητικής
 * (`firstRow: 0, lastRow: rows.length - 1`)· θα ήταν **τέταρτος** ορισμός της ίδιας έννοιας
 * και θα έχανε σιωπηλά ό,τι μάθει κάποτε ο πρώτος.
 *
 * `null` όταν ο στόχος δεν επιβίωσε (undo έσβησε τον άξονα) ή σε εκφυλισμένο μοντέλο.
 */
export function tableFormatScopeBounds(
  model: PersistedTableModel,
  scope: TableFormatScope,
): TableCellRangeBounds | null {
  if (scope.kind === 'range') return scope.bounds;
  // 🔴 ADR-753 Φ4 — **τα γράμματα ζουν μέσα σε ΕΝΑ κελί, και αυτό είναι το ορθογώνιό τους.**
  //
  // Η μετάφραση δεν είναι παραχώρηση· είναι η σωστή απάντηση, και τη δίνει **δωρεάν** σε πέντε
  // καταναλωτές: «τι ξεχείλισμα ισχύει;», «τι μορφή αριθμού;», «ποια περιγράμματα;», «ποια
  // συγχώνευση;», «ποιο γέμισμα;» είναι όλες ερωτήσεις **κελιού** — και ο χρήστης που δείχνει
  // γράμματα δείχνει, αναγκαστικά, και το κελί που τα περιέχει. Το κούμπωμα σε ολόκληρη
  // συγχώνευση περνά από τον ΕΝΑ ορισμό ({@link resolveTableCellRange}), όπως και ο δρομέας.
  if (scope.kind === 'chars') {
    return resolveTableCellRange(resolveTableModel(model), scope.cell, scope.cell);
  }
  if (scope.ids.length === 0) return null;

  const resolved = resolveTableModel(model);
  // Ο ΕΝΑΣ ορισμός για τον πρώτο, ο ΕΝΑΣ για τον τελευταίο, ο ΕΝΑΣ επεκτατής ανάμεσα. Με
  // έναν άξονα τα δύο συμπίπτουν, οπότε η μονή περίπτωση δεν είναι ξεχωριστός κλάδος.
  const first = wholeAxisSelection(resolved, axisTargetOf(scope.axis, scope.ids[0]));
  const last = wholeAxisSelection(resolved, axisTargetOf(scope.axis, scope.ids[scope.ids.length - 1]));
  if (!first || !last) return null;
  return resolveTableSelectionBounds(resolved, extendTableSelectionTo(first, last.to));
}

/**
 * Τι δείχνει ένα χειριστήριο για τον στόχο — `null` όταν ο στόχος δεν επιβίωσε.
 *
 * ## 🔴 ADR-753 Φ4 — τα γράμματα διαβάζονται **πάνω** στην απάντηση του κελιού
 * Ένα run δηλώνει μόνο ό,τι διαφέρει· χωρίς δήλωση, τα γράμματα είναι ό,τι λέει το κελί — και
 * το κελί ό,τι λένε γραμμή, στήλη και κλάση. Διαβάζοντας **μόνο** τα runs, το κουμπί θα έλεγε
 * «όχι έντονα» για επιλογή μέσα σε κελί που το στυλ του γράφει έντονο, δηλαδή θα διέψευδε την
 * οθόνη. Γι' αυτό η απάντηση του κελιού υπολογίζεται **πρώτη** και μπαίνει ως βάση: μία
 * αλυσίδα κληρονομιάς, ένας επιλυτής της.
 */
export function resolveTableFormatState<K extends TableCellStyleKey>(
  model: PersistedTableModel,
  style: TableStyle,
  scope: TableFormatScope,
  key: K,
): TableFormatState<TableCellStyle[K]> | null {
  if (scope.kind === 'axis') return resolveAxesFormat(model, style, scope.axis, scope.ids, key);

  const bounds = tableFormatScopeBounds(model, scope);
  if (bounds === null) return null;
  const cellState = resolveRangeFormat(model, style, bounds, key);
  if (cellState === null || scope.kind === 'range') return cellState;

  // Η μετατροπή γυρίζει την ένωση πίσω στο συγκεκριμένο πεδίο. Είναι ασφαλής επειδή ο
  // αναγνώστης **δεν αλλάζει πεδίο**: επιστρέφει τιμές του ίδιου `key` που του δόθηκε (ή την
  // κληρονομιά του). Δες `_RunAndCellValuesAgree` για το γιατί τα δύο λεξιλόγια συμφωνούν.
  return resolveCellRunState(
    model, scope.cell, scope.range, key, cellState,
  ) as TableFormatState<TableCellStyle[K]>;
}

/**
 * «Επαναφορά μορφοποίησης».
 *
 * ⚠️ Τα τρία σκέλη **δεν κάνουν το ίδιο πράγμα**, και σωστά: ο άξονας σβήνει τη δική του
 * παράκαμψη (το `ByLayer` του AutoCAD)· η περιοχή σβήνει τις παρακάμψεις **των κελιών** και τα
 * runs τους, χωρίς ποτέ να αγγίξει άξονα· τα **γράμματα** σβήνουν μόνο τα runs τους, χωρίς
 * ποτέ να αγγίξουν το κελί. Δες την κεφαλίδα του `clearRangeStyleOverride` για το γιατί μια
 * «επαναφορά» που καθάριζε και τον άξονα θα ήταν καταστροφική — και το ίδιο ισχύει, ένα
 * επίπεδο πιο μέσα, για μια «επαναφορά γραμμάτων» που ξεγύμνωνε ολόκληρο το κελί.
 */
export function clearTableFormatScope(
  model: PersistedTableModel,
  scope: TableFormatScope,
): PersistedTableModel {
  if (scope.kind === 'axis') {
    return writeEachAxis(model, scope.ids, (next, id) => clearAxisStyleOverride(next, scope.axis, id));
  }
  if (scope.kind === 'chars') return clearCellRunRange(model, scope.cell, scope.range);
  return clearRangeStyleOverride(model, scope.bounds);
}

/** Έχει ο στόχος **οτιδήποτε** να επαναφέρει; `some` και στα τρία σκέλη — δες τους γραφείς. */
export function canResetTableFormatScope(
  model: PersistedTableModel,
  scope: TableFormatScope,
): boolean {
  if (scope.kind === 'axis') return hasAnyAxisStyleOverride(model, scope.axis, scope.ids);
  if (scope.kind === 'chars') return hasCellRunRangeStyles(model, scope.cell, scope.range);
  return hasAnyRangeStyleOverride(model, scope.bounds);
}

/**
 * ADR-739 §52 — **ένα σκαλί μεγέθους κειμένου**, όποιος κι αν είναι ο στόχος.
 *
 * ⚠️ Τα δύο σκέλη **δεν** χρησιμοποιούν το ίδιο εύρος, και είναι σκόπιμο:
 *
 * ```
 *   άξονας   →  ΚΑΘΕ άξονας ξεκινά από ΤΟ ΔΙΚΟ ΤΟΥ μέγεθος
 *   περιοχή  →  ΟΛΑ τα κελιά ξεκινούν από ΤΟ ΚΟΙΝΟ άκρο
 * ```
 *
 * Το πρώτο είναι το «Αύξηση μεγέθους» του Excel σε πολλαπλή επιλογή στηλών: ανεβάζει καθεμιά
 * ένα σκαλί **διατηρώντας τις σχετικές διαφορές** (το σκεπτίζεται ήδη γραμμένο στο
 * `use-table-header-menu`). Το δεύτερο δεν έχει επιλογή: η εγγραφή σε περιοχή είναι **μία**
 * τιμή για όλα τα κελιά — δεν υπάρχει ανά-κελί παράκαμψη με δικό της σκαλί να διατηρηθεί —
 * και η ισοπέδωση προς την κατεύθυνση που ζήτησε ο χρήστης είναι ακριβώς η αρχή του
 * `nextBooleanFormat` («μεικτό ⇒ ορατή αλλαγή προς τα εκεί που δείχνει το κουμπί»).
 */
export function stepTableFormatTextHeight(
  model: PersistedTableModel,
  style: TableStyle,
  scope: TableFormatScope,
  direction: TextHeightStepDirection,
): PersistedTableModel {
  if (scope.kind === 'axis') {
    return writeEachAxis(model, scope.ids, (next, id) =>
      stepAxisTextHeight(next, style, scope.axis, id, direction));
  }

  // 🔴 Η **σκάλα** είναι μία (`nextTextHeightFromRange`) και ο κανόνας «ΟΛΑ ξεκινούν από το
  // κοινό άκρο» επίσης — αλλάζει μόνο *ποιοι* είναι οι «όλοι»: κελιά ή γράμματα. Δύο σώματα
  // εδώ θα ήταν δύο σκάλες που τυχαίνει να συμφωνούν.
  const range = tableFormatNumericRange(model, style, scope, 'textHeightMm');
  if (!range) return model;
  const next = nextTextHeightFromRange(range, direction);
  if (next === null) return model;
  return setTableFormatField(model, scope, 'textHeightMm', next);
}

/**
 * Τα άκρα μιας αριθμητικής ιδιότητας στον στόχο — ό,τι χρειάζεται το βήμα μεγέθους για να ξέρει
 * *από πού* ξεκινά.
 *
 * Στον άξονα με **πολλές** ταυτότητες τα επιμέρους εύρη ενώνονται: το βήμα πρέπει να δει το
 * πραγματικό `min`/`max` όλων όσων θα γράψει, αλλιώς τρεις μαρκαρισμένες στήλες θα μεγάλωναν
 * με αφετηρία μόνο την πρώτη.
 */
export function tableFormatNumericRange(
  model: PersistedTableModel,
  style: TableStyle,
  scope: TableFormatScope,
  key: TableCellNumericKey,
): TableNumericRange | null {
  if (scope.kind !== 'axis') {
    const bounds = tableFormatScopeBounds(model, scope);
    if (bounds === null) return null;
    const cells = resolveCellsNumericRange(model, style, tableRangeCellRefs(model, bounds), key);
    // 🔴 ADR-753 Φ4 — τα **γράμματα** έχουν δικά τους άκρα **μόνο** για πεδίο που υπάρχει στο
    // λεξιλόγιό τους. Η εσοχή και η γωνία κειμένου είναι αριθμοί του **κελιού**: εκεί η
    // απάντηση του κελιού δεν είναι υποκατάστατο — **είναι** η απάντηση.
    if (scope.kind === 'range' || !isTableTextRunStyleKey(key) || cells === null) return cells;
    // Η κληρονομιά κάθε άβαφου χαρακτήρα είναι η τιμή **του κελιού** — και ο στόχος εδώ είναι
    // ένα κελί, οπότε τα δύο άκρα του συμπίπτουν και το `min` **είναι** εκείνη η τιμή.
    return cellRunNumericRangeAt(model, scope.cell, scope.range, key, cells.min);
  }

  let combined: TableNumericRange | null = null;
  for (const id of scope.ids) {
    const range = resolveAxisNumericRange(model, style, scope.axis, id, key);
    if (!range) continue;
    combined = combined === null
      ? range
      : { min: Math.min(combined.min, range.min), max: Math.max(combined.max, range.max) };
  }
  return combined;
}
