'use client';

/**
 * 🔴 ADR-739 §36 ΦΑΣΗ 3 — **ΠΙΑΣΤΗΚΕ ΤΟ ΠΕΡΙΓΡΑΜΜΑ ΤΗΣ ΕΠΙΛΟΓΗΣ;** — και, αν ναι, **από πού**.
 *
 * Εξήχθη από το `table-cell-pointer-hit.ts` (N.7.1: 513 → κάτω από τις 500). Το κριτήριο του
 * κοψίματος **δεν** ήταν οι γραμμές: ο χάρτης χτυπημάτων απαντά «**πού** έπεσε αυτό;» με μία
 * λέξη ανά περιοχή, ενώ εδώ η απάντηση είναι «πιάστηκε το **αντικείμενο**, και το χέρι κάθεται
 * τόσο μέσα του» — δηλαδή η αρχή μιας **χειρονομίας**, όχι ονομασία σημείου. Δύο ερωτήσεις που
 * μοιράζονται γεωμετρία, όχι μία ερώτηση σε δύο μισά.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-range-grab
 * @see table-indicator-probe-basis.ts — η κοινή βάση LOD/πλαισίου (γι' αυτό δεν είναι κυκλικό)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §36
 */

import {
  resolveTableSelectionBounds,
  tableRangeRectMm,
  type TableCellRangeBounds,
} from '../../bim/table/table-cell-range';
import {
  computeTableEntityGeometryLive,
  tableCellAtFrame,
} from '../../bim/table/table-entity-geometry';
import { indexById, resolveTableModel } from '../../bim/table/table-model-helpers';
import { isOnTableRangeBorder } from '../../bim/table/table-range-move-zone';
import { indicatorProbeBasis } from './table-indicator-probe-basis';
import type { TableCellSelection } from '../../state/table-cell-cursor-store';
import type { TableRangeGrab } from '../../bim/table/table-range-drop-target';
import type { TableRectMm } from '../../bim/table/table-layout-types';
import type { TableEntity, TableEntityGeometry } from '../../types/table-entity';
import type { Point2D } from '../../rendering/types/Types';

/** Ό,τι χρειάζεται η χειρονομία για να ξεκινήσει — δες {@link tableRangeGrabAtWorld}. */
export interface TableRangeGrabHit {
  /** Η περιοχή που πιάστηκε, σε δείκτες γραμμής/στήλης. */
  readonly source: TableCellRangeBounds;
  /** Πόσο μέσα της έπεσε το χέρι — η μετατόπιση που κρατά το σχήμα κάτω από το δάχτυλο. */
  readonly grab: TableRangeGrab;
}

/**
 * 🔴 ADR-739 §36 — **ΤΟ ΟΡΘΟΓΩΝΙΟ ΠΟΥ ΠΙΑΝΕΤΑΙ**: η ενεργή επιλογή σε sheet-mm· `null` όταν
 * δεν υπάρχει επιλογή ή όταν έχει παλιώσει.
 *
 * ## Γιατί ΔΕΝ υπάρχει εδώ δεύτερη αλήθεια για το «ποια κελιά είναι μέσα»
 * Περνά από τον **ΕΝΑ** δρόμο (`resolveTableSelectionBounds` → `tableRangeRectMm`), τον ίδιο
 * ακριβώς που ρωτά ο ζωγράφος στο `TableRenderer.selectionOf`. Αυτό **είναι** η απαίτηση, όχι
 * ευπρέπεια: ο χρήστης πιάνει το περίγραμμα **που βλέπει**. Αν ο δείκτης ρωτούσε δική του
 * γεωμετρία, θα υπήρχε ζώνη όπου το μάτι βλέπει τη γραμμή και το χέρι δεν πιάνει τίποτα —
 * και ο χρήστης θα το διάβαζε ως «δεν δουλεύει», ποτέ ως «ένα pixel διαφορά».
 *
 * ⚠️ Το κόστος ανά κίνηση ποντικιού **μετρήθηκε πριν γραφτεί** και είναι ο λόγος που το
 * `indexById` απέκτησε απομνημόνευση (δες την κεφαλίδα του `table-cell-order`): χωρίς εκείνη,
 * αυτή η γραμμή θα έχτιζε δύο `Map` μεγέθους «όσες οι γραμμές» **60 φορές το δευτερόλεπτο**.
 *
 * Εξάγεται επειδή τη ρωτά και ο **hover** (`tableIndicatorProbeAtWorld`) για τον ρόλο δείκτη:
 * το ίδιο ορθογώνιο που πιάνεται είναι εκείνο που κάνει τον δείκτη `range-move`.
 */
export function activeTableRange(
  entity: TableEntity,
  geometry: TableEntityGeometry,
  selection: TableCellSelection | null,
): { readonly bounds: TableCellRangeBounds; readonly rectMm: TableRectMm } | null {
  if (!selection) return null;
  const bounds = resolveTableSelectionBounds(resolveTableModel(entity.model), selection);
  // Μπαγιάτικο άκρο (undo / διαγραφή γραμμής) ⇒ καμία υπόσχεση. Ίδια σύμβαση με κάθε άλλον
  // καταναλωτή της επιλογής: ο καλών **δεν μαντεύει**.
  if (!bounds) return null;
  const rectMm = tableRangeRectMm(geometry.layout, bounds);
  return rectMm ? { bounds, rectMm } : null;
}

/**
 * 🔴 **ΠΙΑΣΤΗΚΕ ΤΟ ΠΕΡΙΓΡΑΜΜΑ;** `null` παντού αλλού.
 *
 * ## Γιατί ζει δίπλα στον χάρτη χτυπημάτων και όχι στη χειρονομία
 * Είναι η **ίδια** ερώτηση που απαντά ο δείκτης (`range-move` / `range-copy`), από την **ίδια**
 * γεωμετρία: το ίδιο LOD ({@link indicatorProbeBasis}), το ίδιο ορθογώνιο
 * ({@link activeTableRange}), την ίδια οπή (`bands.gapMm`). Δύο αντίγραφα θα σήμαιναν ζώνη όπου
 * ο δείκτης υπόσχεται μετακίνηση και το πάτημα δεν πιάνει τίποτα — δηλαδή ακριβώς το «δεν
 * δουλεύει» που περιγράφει η κεφαλίδα του {@link activeTableRange}, από την πίσω πόρτα.
 *
 * ## 🔴 Η ΜΕΤΑΤΟΠΙΣΗ ΣΥΛΛΗΨΗΣ **ΠΕΡΙΟΡΙΖΕΤΑΙ ΜΕΣΑ** ΣΤΗΝ ΠΕΡΙΟΧΗ
 * Η ζώνη σύλληψης διαστέλλεται **εκατέρωθεν** της γραμμής (§36): πιάνοντας την πάνω πλευρά, το
 * χέρι είναι συχνά πάνω στο **γειτονικό** κελί, έξω από την περιοχή. Χωρίς τον περιορισμό η
 * μετατόπιση θα έβγαινε **αρνητική**, δηλαδή η περιοχή θα προσγειωνόταν ένα κελί παρακάτω από
 * εκεί που δείχνει το χέρι — σε **κάθε** κίνηση της σύρσης.
 *
 * ⚠️ Ο περιορισμός γίνεται σε **δείκτες** και όχι στο σημείο, και ο λόγος βρέθηκε γράφοντας:
 * ένα σημείο περιορισμένο πάνω στην ακμή του ορθογωνίου πέφτει **ακριβώς πάνω σε γραμμή του
 * πλέγματος**, όπου το `tableCellAtFrame` (κλειστά διαστήματα) απαντά το **προηγούμενο** κελί —
 * δηλαδή ξαναγεννά την αρνητική μετατόπιση από την πίσω πόρτα. Στους δείκτες δεν υπάρχει
 * αμφισημία ακμής. Καλύπτει επίσης τη **συγχώνευση** που ξεπερνά την περιοχή: εκείνη επιστρέφει
 * την **άγκυρά** της, που μπορεί να κάθεται έξω.
 *
 * Ο φύλακας «είμαστε μέσα στο πλέγμα;» περνά από τον **ΕΝΑ** δρόμο (`tableCellAtFrame`) αντί
 * για δεύτερη σύγκριση ορίων: η επιλογή μπορεί να ακουμπά την πάνω γραμμή, οπότε η εξωτερική
 * εμβέλεια βγαίνει σε αρνητικά mm — όπου ζουν οι **λαβές** (§27.11, «ένα pixel, μία ερώτηση»)
 * και δεν πιάνεται περιοχή.
 */
export function tableRangeGrabAtWorld(
  entity: TableEntity,
  world: Point2D,
  viewScale: number,
  selection: TableCellSelection | null,
): TableRangeGrabHit | null {
  const geometry = computeTableEntityGeometryLive(entity);
  const probe = indicatorProbeBasis(entity, world, geometry, viewScale);
  if (!probe) return null;
  const range = activeTableRange(entity, geometry, selection);
  if (!range) return null;
  // ⚠️ `gapMm` — **η ίδια** οπή που ρωτά και ο ρόλος δείκτη (`tableIndicatorCursorRoleAtFrame`),
  // δηλαδή η `gripAperturePx` του §27.16 Ε4. Κανένας δεύτερος αριθμός.
  if (!isOnTableRangeBorder(range.rectMm, probe.frame, probe.bands.gapMm)) return null;

  const hit = tableCellAtFrame(geometry.layout, probe.frame);
  if (!hit) return null;
  const row = indexById(entity.model.rows).get(hit.rowId);
  const col = indexById(entity.model.columns).get(hit.colId);
  if (row === undefined || col === undefined) return null;

  const { firstRow, lastRow, firstCol, lastCol } = range.bounds;
  return {
    source: range.bounds,
    grab: {
      dRow: clampToSpan(row, firstRow, lastRow) - firstRow,
      dCol: clampToSpan(col, firstCol, lastCol) - firstCol,
    },
  };
}

/** Ο δείκτης, φερμένος μέσα στο κλειστό διάστημα. Δες {@link tableRangeGrabAtWorld} για το γιατί. */
function clampToSpan(index: number, first: number, last: number): number {
  return Math.min(Math.max(index, first), last);
}
