/**
 * ADR-739 Φάση Α — **περιγράμματα**: από κλάσεις γραμμής σε ευθύγραμμα τμήματα.
 *
 * Το τρίτο στάδιο (`measure` → `place` → **`borders`**). Δύο κανόνες το διέπουν, και οι
 * δύο υπάρχουν για να μη ζωγραφιστεί ποτέ η ίδια γραμμή δύο φορές:
 *
 * 1. **Η ακμή ανήκει στο πλέγμα, όχι στο κελί.** Δύο γειτονικά κελιά μοιράζονται μία
 *    ακμή· αν το καθένα έβγαζε τις δικές του τέσσερις, κάθε εσωτερική γραμμή θα
 *    ζωγραφιζόταν διπλά — ορατό σε ημιδιαφανή μολύβια, διπλάσιο κόστος σε PDF/DXF.
 * 2. **Συνεχόμενα ομοειδή τμήματα ενώνονται.** Ένας πίνακας 8×500 έχει ~4.500 ακμές
 *    κελιών αλλά μόνο ~510 πραγματικές γραμμές. Η ένωση γίνεται εδώ, μία φορά, στο
 *    memoized αποτέλεσμα — όχι σε κάθε ζωγραφική (§6 / το μάθημα του ADR-735).
 *
 * ## Ποιο μολύβι κερδίζει σε μια εσωτερική οριζόντια ακμή
 * Με σειρά προτεραιότητας:
 *  1. `TableRow.borderTop` της **κάτω** γραμμής — η ρητή παράκαμψη (γραμμή-σύνολο).
 *  2. Όταν οι δύο γραμμές είναι **διαφορετικής κλάσης**: το `bottom` της πάνω κλάσης.
 *     Έτσι η «γραμμή κάτω από την κεφαλίδα» είναι ιδιότητα της κεφαλίδας — εκεί την
 *     περιμένει κανείς να τη ρυθμίσει, και εκεί τη βάζει και το AutoCAD.
 *  3. Αλλιώς (ίδια κλάση): το `insideH` της κλάσης.
 *
 * @module subapps/dxf-viewer/bim/table/table-layout-borders
 */

import type { CellKey, TableBorderSpec, TableModel } from '../../types/table';
import { cellKey } from './table-model-helpers';
import type { MergeIndex } from './table-model-helpers';
import type { TableStyle } from './table-style';
import type { TableBorderSegment } from './table-layout-types';

/** Ένα υποψήφιο τμήμα πριν την ένωση: θέση στο πλέγμα + μολύβι. */
interface EdgePiece {
  readonly spec: TableBorderSpec;
  /** Δείκτης έναρξης πάνω στον άξονα διαδρομής της ακμής. */
  readonly from: number;
  readonly to: number;
}

/**
 * Δύο κελιά είναι «μέσα στην ίδια συγχώνευση» ⇔ έχουν την ίδια άγκυρα. Τότε η ακμή
 * ανάμεσά τους δεν υπάρχει: αλλιώς το πλέγμα θα φαινόταν μέσα από το συγχωνευμένο
 * κελί και η συγχώνευση θα ήταν οπτικά ανύπαρκτη.
 */
function sameMerge(merges: MergeIndex, a: CellKey, b: CellKey): boolean {
  const ownerA = merges.ownerByCell.get(a);
  return ownerA !== undefined && ownerA === merges.ownerByCell.get(b);
}

/** Το μολύβι μιας οριζόντιας ακμής στον δείκτη `r` (0 = κορυφή, `rows.length` = βάση). */
function horizontalSpec(model: TableModel, style: TableStyle, r: number): TableBorderSpec {
  const rows = model.rows;
  if (r === 0) return style.rowClasses[rows[0].rowClass].borders.top;
  if (r === rows.length) return style.rowClasses[rows[rows.length - 1].rowClass].borders.bottom;

  const above = rows[r - 1];
  const below = rows[r];
  if (below.borderTop) return below.borderTop;
  if (above.rowClass !== below.rowClass) return style.rowClasses[above.rowClass].borders.bottom;
  return style.rowClasses[above.rowClass].borders.insideH;
}

/** Το μολύβι μιας κατακόρυφης ακμής στον δείκτη `c`, για τη γραμμή `r`. */
function verticalSpec(model: TableModel, style: TableStyle, r: number, c: number): TableBorderSpec {
  const borders = style.rowClasses[model.rows[r].rowClass].borders;
  if (c === 0) return borders.left;
  if (c === model.columns.length) return borders.right;
  return borders.insideV;
}

/** Ίδιο μολύβι ⇒ τα τμήματα μπορούν να ενωθούν (το `dashMm` συγκρίνεται στοιχείο-προς-στοιχείο). */
function sameSpec(a: TableBorderSpec, b: TableBorderSpec): boolean {
  if (a === b) return true;
  if (a.visible !== b.visible || a.colorHex !== b.colorHex || a.widthMm !== b.widthMm) return false;
  const da = a.dashMm ?? [];
  const db = b.dashMm ?? [];
  return da.length === db.length && da.every((v, i) => v === db[i]);
}

/**
 * Ενώνει συνεχόμενα τμήματα με ίδιο μολύβι σε ένα. Τα αόρατα απορρίπτονται εδώ — ένα
 * `visible: false` δεν πρέπει να φτάσει ποτέ σε backend ως «γραμμή μηδενικού πάχους».
 */
function coalesce(pieces: readonly EdgePiece[]): EdgePiece[] {
  const out: EdgePiece[] = [];
  for (const piece of pieces) {
    if (!piece.spec.visible) continue;
    const last = out[out.length - 1];
    if (last && last.to === piece.from && sameSpec(last.spec, piece.spec)) {
      out[out.length - 1] = { spec: last.spec, from: last.from, to: piece.to };
      continue;
    }
    out.push(piece);
  }
  return out;
}

/** Οι οριζόντιες γραμμές του πλέγματος, ενωμένες ανά ακμή. */
function horizontalSegments(
  model: TableModel,
  style: TableStyle,
  merges: MergeIndex,
  xEdges: readonly number[],
  yEdges: readonly number[],
): TableBorderSegment[] {
  const out: TableBorderSegment[] = [];

  for (let r = 0; r <= model.rows.length; r++) {
    const spec = horizontalSpec(model, style, r);
    const pieces: EdgePiece[] = [];
    for (let c = 0; c < model.columns.length; c++) {
      // Εσωτερική ακμή συγχώνευσης: δεν υπάρχει γραμμή εκεί.
      if (r > 0 && r < model.rows.length) {
        const above = cellKey(model.rows[r - 1].id, model.columns[c].id);
        const below = cellKey(model.rows[r].id, model.columns[c].id);
        if (sameMerge(merges, above, below)) continue;
      }
      pieces.push({ spec, from: c, to: c + 1 });
    }
    const y = yEdges[r];
    for (const piece of coalesce(pieces)) {
      out.push({ a: { x: xEdges[piece.from], y }, b: { x: xEdges[piece.to], y }, spec: piece.spec });
    }
  }

  return out;
}

/** Οι κατακόρυφες γραμμές του πλέγματος, ενωμένες ανά ακμή. */
function verticalSegments(
  model: TableModel,
  style: TableStyle,
  merges: MergeIndex,
  xEdges: readonly number[],
  yEdges: readonly number[],
): TableBorderSegment[] {
  const out: TableBorderSegment[] = [];

  for (let c = 0; c <= model.columns.length; c++) {
    const pieces: EdgePiece[] = [];
    for (let r = 0; r < model.rows.length; r++) {
      if (c > 0 && c < model.columns.length) {
        const left = cellKey(model.rows[r].id, model.columns[c - 1].id);
        const right = cellKey(model.rows[r].id, model.columns[c].id);
        if (sameMerge(merges, left, right)) continue;
      }
      pieces.push({ spec: verticalSpec(model, style, r, c), from: r, to: r + 1 });
    }
    const x = xEdges[c];
    for (const piece of coalesce(pieces)) {
      out.push({ a: { x, y: yEdges[piece.from] }, b: { x, y: yEdges[piece.to] }, spec: piece.spec });
    }
  }

  return out;
}

/**
 * Όλα τα τμήματα περιγράμματος του πίνακα. Άδειος πίνακας ⇒ κανένα τμήμα (ούτε
 * εξωτερικό πλαίσιο: πλαίσιο χωρίς περιεχόμενο είναι ορθογώνιο, όχι πίνακας).
 */
export function buildTableBorders(
  model: TableModel,
  style: TableStyle,
  merges: MergeIndex,
  xEdges: readonly number[],
  yEdges: readonly number[],
): TableBorderSegment[] {
  if (model.rows.length === 0 || model.columns.length === 0) return [];
  return [
    ...horizontalSegments(model, style, merges, xEdges, yEdges),
    ...verticalSegments(model, style, merges, xEdges, yEdges),
  ];
}
