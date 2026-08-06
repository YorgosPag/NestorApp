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
 * @module subapps/dxf-viewer/bim/table/table-format-scope
 * @see bim/table/table-axis-style-ops.ts — ο γραφέας του άξονα
 * @see bim/table/table-range-style-ops.ts — ο γραφέας των κελιών
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
import {
  nextTextHeightFromRange,
  stepAxisTextHeight,
  type TextHeightStepDirection,
} from './table-text-height-scale';
import { resolveTableModel } from './table-model-helpers';
import type { TableCellStyle, TableStyle } from './table-style';
import type { PersistedTableModel, TableAxisStyleOverride } from '../../types/table';

/**
 * Πού πάει η επόμενη εντολή μορφοποίησης.
 *
 * Διακριτή ένωση και όχι «άξονας + προαιρετικά όρια»: οι δύο περιπτώσεις δεν έχουν κοινό
 * πυρήνα δεδομένων (ταυτότητες άξονα ≠ ορθογώνιο δεικτών), και ένα σχήμα με προαιρετικά πεδία
 * θα επέτρεπε την κατάσταση «άξονας **και** όρια», που δεν σημαίνει τίποτα.
 */
export type TableFormatScope =
  | { readonly kind: 'axis'; readonly axis: TableStyleAxis; readonly ids: readonly string[] }
  | { readonly kind: 'range'; readonly bounds: TableCellRangeBounds };

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
 * Θέτει **ένα** πεδίο στον στόχο, όποιος κι αν είναι. Οι τρεις καταστάσεις (`undefined`
 * αφαιρεί · `null` ρητά κανένα · αλλιώς ρητή τιμή) ταξιδεύουν αυτούσιες προς τον γραφέα.
 *
 * Η εγγύηση **by-reference στο no-op** επιβιώνει και στα δύο σκέλη: την κρατά ο κάθε γραφέας,
 * και το `writeEachAxis` την κρατά και στον πληθυντικό.
 */
export function setTableFormatField<K extends keyof TableAxisStyleOverride>(
  model: PersistedTableModel,
  scope: TableFormatScope,
  key: K,
  value: TableAxisStyleOverride[K] | undefined,
): PersistedTableModel {
  return scope.kind === 'axis'
    ? writeEachAxis(model, scope.ids, (next, id) =>
        setAxisStyleField(next, scope.axis, id, key, value))
    : setRangeStyleField(model, scope.bounds, key, value);
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
  if (scope.ids.length === 0) return null;

  const resolved = resolveTableModel(model);
  // Ο ΕΝΑΣ ορισμός για τον πρώτο, ο ΕΝΑΣ για τον τελευταίο, ο ΕΝΑΣ επεκτατής ανάμεσα. Με
  // έναν άξονα τα δύο συμπίπτουν, οπότε η μονή περίπτωση δεν είναι ξεχωριστός κλάδος.
  const first = wholeAxisSelection(resolved, axisTargetOf(scope.axis, scope.ids[0]));
  const last = wholeAxisSelection(resolved, axisTargetOf(scope.axis, scope.ids[scope.ids.length - 1]));
  if (!first || !last) return null;
  return resolveTableSelectionBounds(resolved, extendTableSelectionTo(first, last.to));
}

/** Τι δείχνει ένα χειριστήριο για τον στόχο — `null` όταν ο στόχος δεν επιβίωσε. */
export function resolveTableFormatState<K extends TableCellStyleKey>(
  model: PersistedTableModel,
  style: TableStyle,
  scope: TableFormatScope,
  key: K,
): TableFormatState<TableCellStyle[K]> | null {
  return scope.kind === 'axis'
    ? resolveAxesFormat(model, style, scope.axis, scope.ids, key)
    : resolveRangeFormat(model, style, scope.bounds, key);
}

/**
 * «Επαναφορά μορφοποίησης».
 *
 * ⚠️ Τα δύο σκέλη **δεν κάνουν το ίδιο πράγμα**, και σωστά: ο άξονας σβήνει τη δική του
 * παράκαμψη (το `ByLayer` του AutoCAD)· η περιοχή σβήνει τις παρακάμψεις **των κελιών** και τα
 * runs τους, χωρίς ποτέ να αγγίξει άξονα. Δες την κεφαλίδα του `clearRangeStyleOverride` για
 * το γιατί μια «επαναφορά» που καθάριζε και τον άξονα θα ήταν καταστροφική.
 */
export function clearTableFormatScope(
  model: PersistedTableModel,
  scope: TableFormatScope,
): PersistedTableModel {
  return scope.kind === 'axis'
    ? writeEachAxis(model, scope.ids, (next, id) => clearAxisStyleOverride(next, scope.axis, id))
    : clearRangeStyleOverride(model, scope.bounds);
}

/** Έχει ο στόχος **οτιδήποτε** να επαναφέρει; `some` και στα δύο σκέλη — δες τους γραφείς. */
export function canResetTableFormatScope(
  model: PersistedTableModel,
  scope: TableFormatScope,
): boolean {
  return scope.kind === 'axis'
    ? hasAnyAxisStyleOverride(model, scope.axis, scope.ids)
    : hasAnyRangeStyleOverride(model, scope.bounds);
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

  const range = resolveCellsNumericRange(
    model, style, tableRangeCellRefs(model, scope.bounds), 'textHeightMm',
  );
  if (!range) return model;
  const next = nextTextHeightFromRange(range, direction);
  return next === null ? model : setRangeStyleField(model, scope.bounds, 'textHeightMm', next);
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
  if (scope.kind === 'range') {
    return resolveCellsNumericRange(
      model, style, tableRangeCellRefs(model, scope.bounds), key,
    );
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
