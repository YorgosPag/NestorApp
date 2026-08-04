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
 * ## Ποιο μολύβι κερδίζει σε μια εσωτερική οριζόντια ακμή — **τέσσερα επίπεδα** (ADR-750 §6.5)
 * Με σειρά προτεραιότητας:
 *  1. **Η ρητή ακμή** (`TableModel.edges`) — η μόνη που μιλά για **μία** ακμή ενός κελιού.
 *  2. `TableRow.borderTop` της **κάτω** γραμμής — η παράκαμψη ολόκληρου πλάτους (γραμμή-σύνολο).
 *  3. Όταν οι δύο γραμμές είναι **διαφορετικής κλάσης**: το `bottom` της πάνω κλάσης.
 *     Έτσι η «γραμμή κάτω από την κεφαλίδα» είναι ιδιότητα της κεφαλίδας — εκεί την
 *     περιμένει κανείς να τη ρυθμίσει, και εκεί τη βάζει και το AutoCAD.
 *  4. Αλλιώς (ίδια κλάση): το `insideH` της κλάσης.
 *
 * 🔑 **Μηδέν tie-break**, και αυτό είναι ολόκληρη η διαφορά από το Excel: το επίπεδο 1 έχει
 * **έναν** ιδιοκτήτη εξ ορισμού (μια ακμή έχει ένα όνομα), οπότε δεν υπάρχει «ισοπαλία» να
 * λυθεί. Το OOXML χρειάζεται **έξι** επίπεδα — με κριτήριο τη **φωτεινότητα `R+B+2G`** — και
 * το Excel απαντά «ό,τι εφαρμόστηκε πιο πρόσφατα», δηλαδή κανόνα που δεν είναι καν
 * αποφασίσιμος από το ίδιο το αρχείο (ADR-750 §4).
 *
 * ## ⚠️ Η ρητή ακμή ΔΕΝ ξαναγεννά τις εσωτερικές ακμές μιας συγχώνευσης
 * Η ερώτηση «υπάρχει εδώ ακμή;» απαντιέται **πριν** από την «με τι μολύβι;»: το
 * {@link sameMerge} κόβει τη διαδρομή νωρίτερα. Αν το επίπεδο 1 μπορούσε να την επαναφέρει,
 * το πλέγμα θα φαινόταν **μέσα** από το συγχωνευμένο κελί και η συγχώνευση θα ήταν οπτικά
 * ανύπαρκτη — δηλαδή μια μορφοποίηση θα ακύρωνε μια δομική πράξη.
 *
 * @module subapps/dxf-viewer/bim/table/table-layout-borders
 * @see bim/table/table-edge-model.ts — η ταυτότητα της ακμής (επίπεδο 1)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { CellKey, TableBorderSpec, TableModel } from '../../types/table';
import type { TableEdgeOrientation } from '../../types/table-edges';
import { cellKey } from './table-model-helpers';
import type { MergeIndex } from './table-model-helpers';
import { sameBorderSpec, tableEdgeKeyAt } from './table-edge-model';
import { resolveTableBorderInk } from './table-ink';
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

/**
 * **Επίπεδο 1** — η ρητή ακμή αυτής ακριβώς της θέσης πλέγματος, ή `undefined` αν δεν
 * υπάρχει (τότε αποφασίζουν τα επίπεδα 2–4).
 *
 * Ο έλεγχος `size === 0` δεν είναι μικροβελτιστοποίηση: ο **συνηθέστερος** πίνακας δεν έχει
 * καμία ρητή ακμή, και χωρίς αυτόν θα συνθέταμε ~8.500 κλειδιά για έναν 8×500 μόνο για να
 * αστοχήσουν όλα. Η διάταξη απομνημονεύεται, άρα το κόστος δεν είναι ανά καρέ — είναι όμως
 * ανά αλλαγή μοντέλου, δηλαδή ανά πληκτρολόγηση.
 */
function explicitSpec(
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
 * Το μολύβι της οριζόντιας ακμής στη θέση `(r, c)` — `r` = 0 κορυφή, `rows.length` βάση.
 *
 * 🔴 Παίρνει **και** τη στήλη, σε αντίθεση με πριν: μέχρι το ADR-750 μια οριζόντια ακμή
 * είχε αναγκαστικά το ίδιο μολύβι σε όλο το πλάτος (η πηγή ήταν πάντα η γραμμή ή η κλάση
 * της), οπότε η στήλη ήταν πράγματι άσχετη. Η ρητή ακμή είναι η πρώτη πηγή που μπορεί να
 * πει κάτι διαφορετικό **ανά στήλη** — δηλαδή είναι ακριβώς αυτό που κάνει το «περίγραμμα σε
 * μεμονωμένο κελί» εκφράσιμο.
 */
function horizontalSpec(
  model: TableModel,
  style: TableStyle,
  r: number,
  c: number,
  surfaceHex: string,
): TableBorderSpec {
  return resolveTableBorderInk(rawHorizontalSpec(model, style, r, c), surfaceHex);
}

/**
 * Τα **τέσσερα επίπεδα** αυτούσια — η πηγή του μολυβιού, πριν από κάθε προσαρμογή οθόνης.
 *
 * Ξεχωριστή συνάρτηση ώστε η {@link resolveTableBorderInk} να τυλίγει **ΕΝΑ** σημείο ανά
 * προσανατολισμό: με την προσαρμογή σκορπισμένη στα `return` της κληρονομιάς, το πέμπτο επίπεδο
 * που θα προστεθεί κάποτε θα την ξεχνούσε — και θα ήταν αόρατο, γιατί μια αχνή γραμμή δεν
 * πετάει σφάλμα.
 */
function rawHorizontalSpec(
  model: TableModel,
  style: TableStyle,
  r: number,
  c: number,
): TableBorderSpec {
  const explicit = explicitSpec(model, 'H', r, c);
  if (explicit) return explicit;

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
function verticalSpec(
  model: TableModel,
  style: TableStyle,
  r: number,
  c: number,
  surfaceHex: string,
): TableBorderSpec {
  return resolveTableBorderInk(rawVerticalSpec(model, style, r, c), surfaceHex);
}

/** Τα τέσσερα επίπεδα της κατακόρυφης, αυτούσια — δες {@link rawHorizontalSpec}. */
function rawVerticalSpec(
  model: TableModel,
  style: TableStyle,
  r: number,
  c: number,
): TableBorderSpec {
  const explicit = explicitSpec(model, 'V', r, c);
  if (explicit) return explicit;

  const borders = style.rowClasses[model.rows[r].rowClass].borders;
  if (c === 0) return borders.left;
  if (c === model.columns.length) return borders.right;
  return borders.insideV;
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
    if (last && last.to === piece.from && sameBorderSpec(last.spec, piece.spec)) {
      out[out.length - 1] = { spec: last.spec, from: last.from, to: piece.to };
      continue;
    }
    out.push(piece);
  }
  return out;
}

/**
 * 🔴 ADR-750 Φ5 (Α24) — **εδώ, και μόνο εδώ, αποσυντίθεται η διπλή γραμμή.**
 *
 * Ένα μολύβι με `doubleGapMm` βγάζει **δύο** τμήματα, μετατοπισμένα κατά ±μισή απόσταση πάνω
 * στην κάθετη του τμήματος, και **χωρίς** το πεδίο. Δηλαδή ο καμβάς, το PDF, το DXF και ο ΤΕΚ
 * βλέπουν δύο συνηθισμένες γραμμές και κανένας τους δεν μαθαίνει τη λέξη «διπλή».
 *
 * ## Γιατί στη διάταξη και όχι στον ζωγράφο
 * Ο ζωγράφος είναι **τέσσερις** ζωγράφοι. Μια «διπλή» υλοποιημένη στον καμβά θα ήταν μια
 * γραμμή στην οθόνη και **καμία** στην εξαγωγή — ακριβώς η κατηγορία ασυμφωνίας που ο ADR-739
 * §3 υπάρχει για να αποκλείσει, και που η ίδια αυτή διαδρομή πλήρωσε ήδη μία φορά με το
 * γερμένο κείμενο (`stamp-table-layout.ts`: τρεις μηχανές συμφωνούσαν, μία όχι).
 *
 * ## Γιατί η κάθετη έρχεται ως παράμετρος και δεν παράγεται από τη γεωμετρία
 * Θα ήταν εύκολο να ρωτηθεί το ίδιο το τμήμα («ίδιο `y` ⇒ οριζόντιο»). Θα ήταν όμως **δεύτερη**
 * πηγή για τον προσανατολισμό, δίπλα στην {@link tableBorderSideOrientation} που τον ξέρει ήδη
 * — και θα σιωπούσε σε εκφυλισμένο τμήμα μηδενικού μήκους, όπου ίδιο `y` **και** ίδιο `x`.
 * Ο παραγωγός ξέρει τον άξονά του· τον λέει.
 *
 * ⚠️ Η διπλή στο **εξωτερικό** σύνορο ξεπερνά το πλαίσιο κατά μισή απόσταση — σκόπιμα: το ίδιο
 * κάνει το AutoCAD, γιατί η διπλή είναι **μία** γραμμή που πάχυνε, όχι δύο που μετακόμισαν.
 */
function pushBorder(
  out: TableBorderSegment[],
  a: Point2D,
  b: Point2D,
  spec: TableBorderSpec,
  normal: Point2D,
): void {
  const gap = spec.doubleGapMm;
  if (gap === undefined) {
    out.push({ a, b, spec });
    return;
  }

  const { doubleGapMm: _drop, ...single } = spec;
  for (const sign of [-1, 1]) {
    const dx = (normal.x * gap * sign) / 2;
    const dy = (normal.y * gap * sign) / 2;
    out.push({
      a: { x: a.x + dx, y: a.y + dy },
      b: { x: b.x + dx, y: b.y + dy },
      spec: single,
    });
  }
}

/** Η κάθετη μιας οριζόντιας ακμής δείχνει κατά `y`· μιας κατακόρυφης κατά `x`. */
const NORMAL_OF_HORIZONTAL: Point2D = { x: 0, y: 1 };
const NORMAL_OF_VERTICAL: Point2D = { x: 1, y: 0 };

/**
 * Ό,τι χρειάζεται **ένα πέρασμα** του πλέγματος, σε ΕΝΑ σχήμα.
 *
 * 🔴 ADR-584/N.18 — δεν είναι καλλωπισμός: οι δύο περάσεις (οριζόντιο · κατακόρυφο) είναι
 * **συμμετρικά** εξ ορισμού, οπότε κάθε παράμετρος που προστίθεται στο ένα προστίθεται και στο
 * άλλο. Με θετικές παραμέτρους η υπογραφή γραφόταν **δύο φορές**, και το CHECK 3.28 το έπιασε τη
 * στιγμή που το `surfaceHex` (§38.11) την πέρασε τα 50 tokens. Με το σχήμα, η επόμενη ερώτηση
 * «τι χρειάζεται ένα πέρασμα;» έχει **ΕΝΑ** σημείο να απαντηθεί — άρα ο δίδυμος δεν είναι πια
 * εκφράσιμος.
 */
interface GridPass {
  model: TableModel;
  style: TableStyle;
  merges: MergeIndex;
  xEdges: readonly number[];
  yEdges: readonly number[];
  surfaceHex: string;
}

/** Οι οριζόντιες γραμμές του πλέγματος, ενωμένες ανά ακμή. */
function horizontalSegments({
  model,
  style,
  merges,
  xEdges,
  yEdges,
  surfaceHex,
}: GridPass): TableBorderSegment[] {
  const out: TableBorderSegment[] = [];

  for (let r = 0; r <= model.rows.length; r++) {
    const pieces: EdgePiece[] = [];
    for (let c = 0; c < model.columns.length; c++) {
      // Εσωτερική ακμή συγχώνευσης: δεν υπάρχει γραμμή εκεί. Ο έλεγχος μένει **πριν** από
      // κάθε ερώτηση μολυβιού — ούτε η ρητή ακμή δεν την επαναφέρει (δες την κεφαλίδα).
      if (r > 0 && r < model.rows.length) {
        const above = cellKey(model.rows[r - 1].id, model.columns[c].id);
        const below = cellKey(model.rows[r].id, model.columns[c].id);
        if (sameMerge(merges, above, below)) continue;
      }
      pieces.push({ spec: horizontalSpec(model, style, r, c, surfaceHex), from: c, to: c + 1 });
    }
    const y = yEdges[r];
    for (const piece of coalesce(pieces)) {
      pushBorder(
        out,
        { x: xEdges[piece.from], y },
        { x: xEdges[piece.to], y },
        piece.spec,
        NORMAL_OF_HORIZONTAL,
      );
    }
  }

  return out;
}

/** Οι κατακόρυφες γραμμές του πλέγματος, ενωμένες ανά ακμή — δες {@link GridPass}. */
function verticalSegments({
  model,
  style,
  merges,
  xEdges,
  yEdges,
  surfaceHex,
}: GridPass): TableBorderSegment[] {
  const out: TableBorderSegment[] = [];

  for (let c = 0; c <= model.columns.length; c++) {
    const pieces: EdgePiece[] = [];
    for (let r = 0; r < model.rows.length; r++) {
      if (c > 0 && c < model.columns.length) {
        const left = cellKey(model.rows[r].id, model.columns[c - 1].id);
        const right = cellKey(model.rows[r].id, model.columns[c].id);
        if (sameMerge(merges, left, right)) continue;
      }
      pieces.push({ spec: verticalSpec(model, style, r, c, surfaceHex), from: r, to: r + 1 });
    }
    const x = xEdges[c];
    for (const piece of coalesce(pieces)) {
      pushBorder(
        out,
        { x, y: yEdges[piece.from] },
        { x, y: yEdges[piece.to] },
        piece.spec,
        NORMAL_OF_VERTICAL,
      );
    }
  }

  return out;
}

/**
 * Όλα τα τμήματα περιγράμματος του πίνακα. Άδειος πίνακας ⇒ κανένα τμήμα (ούτε
 * εξωτερικό πλαίσιο: πλαίσιο χωρίς περιεχόμενο είναι ορθογώνιο, όχι πίνακας).
 *
 * 🔴 ADR-739 §38.11 — το `surfaceHex` είναι **υποχρεωτικό**, ακριβώς όπως στο αδελφό
 * `placeCells`. Προεπιλογή θα σήμαινε ότι ο επόμενος καλών μπορεί να **μην απαντήσει** «πάνω σε
 * τι ζωγραφίζω;» — και η σιωπηλή απάντηση «χαρτί» δίνει πλέγμα που εξαφανίζεται στον σκούρο
 * καμβά, χωρίς κανένα σφάλμα πουθενά. Το ερώτημα δεν έχει ασφαλή προεπιλογή· έχει **ιδιοκτήτη**.
 */
export function buildTableBorders(
  model: TableModel,
  style: TableStyle,
  merges: MergeIndex,
  xEdges: readonly number[],
  yEdges: readonly number[],
  surfaceHex: string,
): TableBorderSegment[] {
  if (model.rows.length === 0 || model.columns.length === 0) return [];
  const pass: GridPass = { model, style, merges, xEdges, yEdges, surfaceHex };
  return [...horizontalSegments(pass), ...verticalSegments(pass)];
}
