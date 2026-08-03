'use client';

/**
 * ADR-739 §29 — **ΠΟΥ ΕΠΕΣΕ ΑΥΤΟ ΤΟ ΣΥΜΒΑΝ;** Η μία ερώτηση, οι δύο καταναλωτές.
 *
 * Δύο σημεία ρωτούν πλέον το ίδιο πράγμα και **πρέπει** να παίρνουν την ίδια απάντηση:
 *
 *  1. ο {@link module:subapps/dxf-viewer/ui/table-cell-editor/use-table-cell-pointer} —
 *     για να **δράσει** (ποιο κελί, ποιος άξονας)·
 *  2. ο φύλακας του §29 (`use-table-canvas-lockdown`) — για να **αποφασίσει αν το συμβάν
 *     φτάνει στον καμβά**.
 *
 * Αν οι δύο απαντήσεις μπορούσαν να αποκλίνουν έστω κατά ένα pixel, θα υπήρχε ζώνη όπου ο
 * φύλακας μπλοκάρει και ο pointer δεν δρα — δηλαδή **νεκρή λωρίδα**, ακριβώς στην άκρη του
 * πίνακα, όπου ο χρήστης δεν θα καταλάβαινε ποτέ γιατί «δεν πιάνει τίποτα». Γι' αυτό η
 * ερώτηση εξήχθη εδώ **πριν** γραφτεί ο δεύτερος καταναλωτής, και όχι μετά.
 *
 * ## Η σειρά ΕΙΝΑΙ μέρος της απάντησης
 * Πρώτα η **ζώνη δείκτη** (γράμματα στηλών / αριθμοί γραμμών), μετά το **κελί**. Οι δύο
 * περιοχές δεν τέμνονται ποτέ — η ζώνη ζει σε **αρνητικά** mm — άρα η σειρά είναι απλώς «η
 * πιο ειδική ερώτηση πρώτη», χωρίς καμία διεκδίκηση. Ίδια σειρά με το βήμα 9.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-cell-pointer-hit
 * @see bim/table/table-entity-geometry.ts — `tableCellAtWorld`, ΠΟΙΟ κελί χτυπήθηκε
 * @see bim/table/table-indicator-geometry.ts — οι ζώνες, με το LOD τους
 */

import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import {
  computeTableEntityGeometryLive,
  tableCellAtFrame,
  tableCellAtWorld,
  tablePxPerMm,
  tableWorldToFrame,
} from '../../bim/table/table-entity-geometry';
import {
  isTableIndicatorVisible,
  tableColumnEdgeAtFrame,
  tableRowEdgeAtFrame,
  tableIndicatorBandsMm,
  tableIndicatorHitAtFrame,
  type TableIndicatorBandsMm,
  type TableIndicatorHit,
} from '../../bim/table/table-indicator-geometry';
import {
  tableIndicatorCursorRoleAtFrame,
  type TableIndicatorCursorRole,
} from '../../bim/table/table-indicator-cursor-role';
// 🔴 ADR-739 §36 — ο ΕΝΑΣ δρόμος «τι διάλεξε ο χρήστης → ποιο ορθογώνιο», κοινός με τον
// ζωγράφο: ο χρήστης πιάνει το περίγραμμα **που βλέπει**.
import {
  resolveTableSelectionBounds,
  tableRangeRectMm,
} from '../../bim/table/table-cell-range';
import { indexById, resolveTableModel } from '../../bim/table/table-model-helpers';
import {
  isOnTableRangeBorder,
  PLAIN_TABLE_RANGE_DRAG,
  type TableRangeDragIntent,
} from '../../bim/table/table-range-move-zone';
import type { TableCellSelection } from '../../state/table-cell-cursor-store';
import type { TableCellRangeBounds } from '../../bim/table/table-cell-range';
import type { TableRangeGrab } from '../../bim/table/table-range-drop-target';
import type { TableRectMm } from '../../bim/table/table-layout-types';
import type {
  TableCellHit,
  TableEntity,
  TableEntityGeometry,
  TableFramePoint,
} from '../../types/table-entity';
import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';

/**
 * Πού έπεσε το πάτημα **μέσα σε αυτόν** τον πίνακα. `null` = πουθενά πάνω του — δηλαδή
 * αλλού στον καμβά ή στα περιθώρια του ίδιου του πίνακα.
 */
export type TablePointerHit =
  /**
   * 🔴 §31.9 — το **διαχωριστικό** ανάμεσα σε δύο γράμματα στηλών. Πρέπει να είναι δική του
   * περίπτωση και όχι υποείδος του `band`, για δύο ανεξάρτητους λόγους:
   *  - ο φύλακας του §29 ρωτά μόνο «είναι `null`;» ⇒ μια τρίτη μη-`null` απάντηση αρκεί για να
   *    **φτάσει** το πάτημα στον καμβά, χωρίς να αγγιχτεί ο φύλακας·
   *  - ο pointer πρέπει να **μην** επιλέξει στήλη εδώ — αν ήταν `band`, θα το έκανε σιωπηλά.
   */
  | { readonly where: 'column-edge'; readonly columnIndex: number }
  /** Το κάτοπτρο για τις γραμμές (2026-08-04) — ίδιοι δύο λόγοι, στον άλλο άξονα. */
  | { readonly where: 'row-edge'; readonly rowIndex: number }
  | { readonly where: 'band'; readonly band: TableIndicatorHit }
  | { readonly where: 'cell'; readonly cell: TableCellHit };

/**
 * Σημείο συμβάντος → σημείο **κόσμου**, με τη ζωντανή προβολή.
 *
 * Ο ΕΝΑΣ δρόμος: τον περνούν το πάτημα, **κάθε κίνηση** της σύρσης, και οι φύλακες του §29
 * (ADR-040 — ανάγνωση τη στιγμή του συμβάντος, ποτέ στιγμιότυπο: ο χρήστης μπορεί να
 * ζουμάρει με τον τροχό ενώ σέρνει).
 */
export function tableEventWorldPoint(
  // ADR-750 Φ4 — **μόνο οι δύο συντεταγμένες**, όχι ολόκληρο `MouseEvent`: ο δρομολογητής δεξιού
  // κλικ παραδίδει `clientX`/`clientY` στη θύρα (`table-range-menu-port`), και ένα ψεύτικο
  // `MouseEvent` για να ικανοποιηθεί μια υπογραφή θα ήταν θόρυβος. Κάθε υπάρχων καλών περνά
  // αυτούσιος: το `MouseEvent` **είναι** ήδη αυτό το σχήμα.
  event: { readonly clientX: number; readonly clientY: number },
  container: HTMLElement,
  transform: ViewTransform | null,
): Point2D | null {
  if (!transform) return null;
  const rect = container.getBoundingClientRect();
  const viewport: Viewport = { width: rect.width, height: rect.height };
  return CoordinateTransforms.screenToWorld(
    { x: event.clientX - rect.left, y: event.clientY - rect.top },
    transform,
    viewport,
  );
}

/**
 * Η ερώτηση, ολόκληρη: ζώνη ⇒ κελί ⇒ τίποτα.
 *
 * Η γεωμετρία υπολογίζεται **μία** φορά εδώ και εξυπηρετεί και τις δύο υπο-ερωτήσεις — πριν
 * την εξαγωγή υπολογιζόταν δύο φορές στον ίδιο χειριστή.
 */
export function tablePointerHitAtWorld(
  entity: TableEntity,
  world: Point2D,
  viewScale: number,
): TablePointerHit | null {
  const geometry = computeTableEntityGeometryLive(entity);
  // 🔴 §31.9 — το διαχωριστικό **πρώτο**: είναι η πιο ειδική ερώτηση, και είναι η μόνη που
  // τέμνει τις άλλες δύο (η ζώνη ανοχής ζει μέσα στη λωρίδα ΚΑΙ μπαίνει μία οπή στο πλέγμα).
  // Η γεωμετρία της ζώνης παραιτείται ήδη στα ίδια pixel· η σειρά εδώ κρατά την ίδια απάντηση
  // και για το **κελί**, ώστε το διαχωριστικό να μη γίνεται «κλικ στην πρώτη γραμμή».
  const edge = columnEdgeAt(entity, world, geometry, viewScale);
  if (edge !== null) return { where: 'column-edge', columnIndex: edge };
  const rowEdge = rowEdgeAt(entity, world, geometry, viewScale);
  if (rowEdge !== null) return { where: 'row-edge', rowIndex: rowEdge };
  const band = indicatorHitAt(entity, world, geometry, viewScale);
  if (band) return { where: 'band', band };
  const cell = tableCellAtWorld(entity, world, geometry);
  return cell ? { where: 'cell', cell } : null;
}

/** Ποιο εσωτερικό όριο στήλης είναι κάτω από το σημείο· `null` κάτω από το LOD ή αλλού. */
function columnEdgeAt(
  entity: TableEntity,
  world: Point2D,
  geometry: TableEntityGeometry,
  viewScale: number,
): number | null {
  const probe = indicatorProbeBasis(entity, world, geometry, viewScale);
  return probe && tableColumnEdgeAtFrame(geometry.layout, probe.frame, probe.bands);
}

/** Ποιο εσωτερικό όριο γραμμής είναι κάτω από το σημείο· `null` κάτω από το LOD ή αλλού. */
function rowEdgeAt(
  entity: TableEntity,
  world: Point2D,
  geometry: TableEntityGeometry,
  viewScale: number,
): number | null {
  const probe = indicatorProbeBasis(entity, world, geometry, viewScale);
  return probe && tableRowEdgeAtFrame(geometry.layout, probe.frame, probe.bands);
}

/**
 * ADR-739 §30/§31 — **ό,τι χρειάζεται ο hover**, σε μία ανάγνωση γεωμετρίας.
 *
 * Τρίτος καταναλωτής της ίδιας γεωμετρίας: ο **hover** των λωρίδων. Ρωτά λιγότερα από τον
 * {@link tablePointerHitAtWorld} επίτηδες — και είναι η μόνη διαφορά που δικαιολογεί δεύτερη
 * εξαγωγή: το hover τρέχει σε **κάθε κίνηση ποντικιού**, ενώ η ερώτηση του κελιού είναι
 * γραμμική σάρωση **όλων** των κελιών της διάταξης (`tableCellAtFrame`). Ένας πίνακας 500
 * γραμμών θα πλήρωνε 60 φορές το δευτερόλεπτο μια απάντηση που κανείς δεν διαβάζει.
 *
 * ⚠️ **Δεν είναι δεύτερο αντίγραφο**: είναι η **ίδια** ιδιωτική συνάρτηση που ήδη
 * χρησιμοποιεί ο `tablePointerHitAtWorld` — απλώς απέκτησε όνομα και εξαγωγή. Το LOD και οι
 * μετατροπές μένουν σε ένα σημείο, άρα ο hover δεν μπορεί να ανάψει λωρίδα που δεν
 * ζωγραφίζεται.
 *
 * ## 🔴 §31 — γιατί επιστρέφει **ζεύγος** και όχι δύο συναρτήσεις
 * Ο δείκτης του ΟΣ (§31) και το φωτισμένο γράμμα (§30) είναι δύο **διαφορετικές** απαντήσεις
 * με δύο διαφορετικούς καταναλωτές (`useCrosshairCursor` / `TableRenderer`), αλλά πηγάζουν
 * από την **ίδια** ανάγνωση: `computeTableEntityGeometryLive` + `tableWorldToFrame`. Δύο
 * εξαγωγές θα σήμαιναν δύο υπολογισμούς γεωμετρίας **ανά κίνηση ποντικιού** — ακριβώς το
 * κόστος που ο σχολιασμός από πάνω μόλις απέφυγε. Μία ερώτηση, δύο πεδία.
 */
export function tableIndicatorProbeAtWorld(
  entity: TableEntity,
  world: Point2D,
  viewScale: number,
  // 🔴 ADR-739 §36 — η **ενεργή επιλογή** και τα **πλήκτρα**, τη στιγμή του συμβάντος.
  //
  // Έρχονται ως ορίσματα και δεν διαβάζονται εδώ, παρότι και τα δύο θα ήταν προσβάσιμα: η
  // επιλογή ζει σε store με getter, τα πλήκτρα στο `MouseEvent`. Ο λόγος είναι ο ίδιος που
  // κρατά αυτό το module καθαρό από την αρχή — απαντά «**πού** έπεσε αυτό;», όχι «**τι**
  // κατάσταση έχει η εφαρμογή». Ο ΕΝΑΣ ακροατής κίνησης ξέρει και τα δύο και τα δίνει.
  selection: TableCellSelection | null = null,
  intent: TableRangeDragIntent = PLAIN_TABLE_RANGE_DRAG,
): TableIndicatorProbe {
  const geometry = computeTableEntityGeometryLive(entity);
  const probe = indicatorProbeBasis(entity, world, geometry, viewScale);
  if (!probe) return EMPTY_PROBE;
  return {
    hit: tableIndicatorHitAtFrame(geometry.layout, probe.frame, probe.bands),
    cursor: tableIndicatorCursorRoleAtFrame(
      geometry.layout,
      probe.frame,
      probe.bands,
      activeTableRange(entity, geometry, selection)?.rectMm ?? null,
      intent,
    ),
  };
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
 * αυτή η γραμμή θα χτίζε δύο `Map` μεγέθους «όσες οι γραμμές» **60 φορές το δευτερόλεπτο**.
 */
function activeTableRange(
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
 * 🔴 ADR-739 §36 ΦΑΣΗ 3 — **ΠΙΑΣΤΗΚΕ ΤΟ ΠΕΡΙΓΡΑΜΜΑ ΤΗΣ ΕΠΙΛΟΓΗΣ;** — και, αν ναι, **από πού**.
 * `null` παντού αλλού.
 *
 * ## Γιατί ζει εδώ και όχι στη χειρονομία
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

/** Ό,τι χρειάζεται η χειρονομία για να ξεκινήσει — δες {@link tableRangeGrabAtWorld}. */
export interface TableRangeGrabHit {
  /** Η περιοχή που πιάστηκε, σε δείκτες γραμμής/στήλης. */
  readonly source: TableCellRangeBounds;
  /** Πόσο μέσα της έπεσε το χέρι — η μετατόπιση που κρατά το σχήμα κάτω από το δάχτυλο. */
  readonly grab: TableRangeGrab;
}

/** Ο δείκτης, φερμένος μέσα στο κλειστό διάστημα. Δες {@link tableRangeGrabAtWorld} για το γιατί. */
function clampToSpan(index: number, first: number, last: number): number {
  return Math.min(Math.max(index, first), last);
}

/** Ό,τι ξέρει ο hover για το σημείο κάτω από το ποντίκι — δες {@link tableIndicatorProbeAtWorld}. */
export interface TableIndicatorProbe {
  /** §30 — ποια υποδιαίρεση φωτίζεται· `null` = καμία. */
  readonly hit: TableIndicatorHit | null;
  /** §31 — ποιο σχήμα οφείλει ο δείκτης του ΟΣ· `null` = κανένα (μένει το σταυρόνημα). */
  readonly cursor: TableIndicatorCursorRole | null;
}

/**
 * Κάτω από το LOD δεν υπάρχει τίποτα — ούτε φωτισμός ούτε δείκτης. Σταθερό αντικείμενο ώστε
 * η συχνότερη διαδρομή (ποντίκι εκτός πίνακα) να μην κατανέμει μνήμη 60 φορές το δευτερόλεπτο.
 */
const EMPTY_PROBE: TableIndicatorProbe = { hit: null, cursor: null };

/** Σε ποια υποδιαίρεση ζώνης έπεσε το συμβάν· `null` όταν ο δείκτης δεν ζωγραφίζεται καν (LOD). */
function indicatorHitAt(
  entity: TableEntity,
  world: Point2D,
  geometry: TableEntityGeometry,
  viewScale: number,
): TableIndicatorHit | null {
  const probe = indicatorProbeBasis(entity, world, geometry, viewScale);
  return probe && tableIndicatorHitAtFrame(geometry.layout, probe.frame, probe.bands);
}

/**
 * 🔴 §31.9 — **η κοινή βάση κάθε ερώτησης δείκτη**: LOD ⇒ πλαίσιο ⇒ πάχη ζωνών.
 *
 * Εξήχθη επειδή το CHECK 3.28 (jscpd, N.18) την έπιασε ως **sibling clone μέσα στο ίδιο
 * αρχείο** τη στιγμή που γεννήθηκε ο τρίτος καταναλωτής (το διαχωριστικό). Δεν ήταν
 * φορμαλισμός: τρία αντίγραφα του «είναι ορατός ο δείκτης;» σημαίνουν ότι μια αλλαγή στο LOD
 * θα άφηνε **δύο** από τα τρία να πιάνουν ζώνη που δεν ζωγραφίζεται.
 *
 * `null` κάτω από το κατώφλι — ένα σημείο, μία απάντηση, για όλους.
 */
function indicatorProbeBasis(
  entity: TableEntity,
  world: Point2D,
  geometry: TableEntityGeometry,
  viewScale: number,
): { readonly frame: TableFramePoint; readonly bands: TableIndicatorBandsMm } | null {
  const pxPerMm = tablePxPerMm(geometry.mmToWorld, viewScale);
  if (!isTableIndicatorVisible(geometry.layout.widthMm, geometry.layout.heightMm, pxPerMm)) {
    return null;
  }
  return {
    frame: tableWorldToFrame(entity, world, geometry.mmToWorld),
    bands: tableIndicatorBandsMm(pxPerMm),
  };
}
