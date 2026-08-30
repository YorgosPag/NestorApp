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
  tableCellAtWorld,
} from '../../bim/table/table-entity-geometry';
import {
  tableIndicatorHitAtFrame,
  type TableIndicatorHit,
} from '../../bim/table/table-indicator-geometry';
import {
  tableColumnEdgeAtFrame,
  tableRowEdgeAtFrame,
} from '../../bim/table/table-axis-edge-probe';
// 🔴 §31.9 / N.7.1 — η κοινή βάση και το πιάσιμο περιοχής μετακόμισαν σε δικά τους αρχεία· δες
// τις κεφαλίδες τους για το κριτήριο του κοψίματος (δεν ήταν οι γραμμές).
import { indicatorProbeBasis } from './table-indicator-probe-basis';
// 🔴 ADR-833 Φάση 3 — η καρτέλα φύλλου: **έβδομο κανάλι** της ίδιας σάρωσης, με τον ίδιο δρόμο
// που ρωτά και ο ζωγράφος. Δικό της module (N.7.1) — δες την κεφαλίδα εκείνου.
import { tableWorksheetStripAtWorld } from './table-worksheet-tab-probe';
import type { TableWorksheetStripHit } from '../../bim/table/table-worksheet-tabs-geometry';
// 🔴 ADR-739 §43 — το κουμπί «επιλογή όλων» της γωνίας: **μία** ερώτηση περιοχής, κοινή με τον
// ρόλο δείκτη και τον ζωγράφο.
import { isTableSelectAllCornerAtFrame } from '../../bim/table/table-select-all-corner';
import { activeTableRange } from './table-range-grab';
import {
  tableIndicatorCursorRoleAtFrame,
  type TableIndicatorCursorRole,
} from '../../bim/table/table-indicator-cursor-role';
// 🔴 ADR-739 §40 — το ⊕ της εισαγωγής (Word parity): μία σάρωση, τρεις καταναλωτές.
import {
  tableInsertControlAtFrame,
  type TableInsertControlHit,
  type TableInsertControlMode,
} from '../../bim/table/table-insert-control';
// 🔴 ADR-739 §42 — το ⊖ της διαγραφής: **μέσα** στη ζώνη, πάνω στο στοιχείο που θα φύγει.
import {
  tableDeleteControlAtFrame,
  type TableDeleteControlHit,
} from '../../bim/table/table-delete-control';
// 🔴 ADR-739 §36 — ο ΕΝΑΣ δρόμος «τι διάλεξε ο χρήστης → ποιο ορθογώνιο», κοινός με τον
// ζωγράφο: ο χρήστης πιάνει το περίγραμμα **που βλέπει**.
import {
  PLAIN_TABLE_RANGE_DRAG,
  type TableRangeDragIntent,
} from '../../bim/table/table-range-move-zone';
// 🔴 ADR-754 §14 — η λαβή συμπλήρωσης: **πέμπτο κανάλι της ίδιας σάρωσης**, με τον ίδιο δρόμο
// που ρωτά και ο φρουρός του πατήματος (`table-fill-handle-drag`).
import { tableFillHandleHitAtFrame } from '../../bim/table/table-fill-handle';
// 🔴 ADR-828 Φ4α — το κουμπί «Επιλογές Αυτόματης Συμπλήρωσης»: **έκτο κανάλι** της ίδιας
// σάρωσης, με τον ίδιο δρόμο που ρωτά και ο φρουρός του πατήματος (`table-fill-badge-press`).
import { tableFillBadgeHitAtFrame } from '../../bim/table/table-fill-badge';
import type { TableCellRangeBounds, TableCellRef } from '../../bim/table/table-cell-range';
import type { TableCellSelection } from '../../state/table-cell-cursor-store';
import type { TableEntity, TableEntityGeometry } from '../../types/table-entity';
import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';


/**
 * 🔴 CHECK 3.70 — **επανεξαγωγή ΚΑΙ εισαγωγή.** Το `export type { X } from '…'` **δεν** φέρνει
 * το `X` στο πεδίο ορατότητας αυτού του αρχείου, και εδώ το χρειάζονται δύο υπογραφές. Η πύλη
 * των αδέσμευτων αναγνωριστικών το πιάνει· γράφεται σωστά από την αρχή.
 *
 * Η επανεξαγωγή υπάρχει ώστε οι **δύο** υπάρχοντες εισαγωγείς (`table-axis-resize-drag`,
 * `table-point-mode-pointer`) να μη χρειαστεί να μάθουν ότι το λεξιλόγιο μετακόμισε: η
 * εξαγωγή ήταν κίνηση **μεγέθους**, όχι αλλαγή συμβολαίου.
 */
export type { TablePointerHit } from './table-pointer-hit-kinds';
import type { TablePointerHit } from './table-pointer-hit-kinds';

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
  // 🔴 §40.8 — **το ⊕ πριν από όλα**, και η σειρά εδώ δεν λύνει διεκδίκηση: ο οπλισμένος
  // δίσκος ζει έξω από κάθε άλλη περιοχή αυτής της συνάρτησης (πιο έξω και από τη ζώνη
  // γραμμάτων), οπότε οι υπόλοιπες τέσσερις απαντούν ούτως ή άλλως `null` εκεί. Μπαίνει πρώτο
  // γιατί είναι η **πιο ειδική** ερώτηση — ίδιο κριτήριο με το διαχωριστικό από κάτω.
  const control = armedInsertControlAt(entity, world, geometry, viewScale);
  if (control) return { where: 'insert-control', control };
  // 🔴 §31.9 — το διαχωριστικό **πρώτο**: είναι η πιο ειδική ερώτηση, και είναι η μόνη που
  // τέμνει τις άλλες δύο (η ζώνη ανοχής ζει μέσα στη λωρίδα ΚΑΙ μπαίνει μία οπή στο πλέγμα).
  // Η γεωμετρία της ζώνης παραιτείται ήδη στα ίδια pixel· η σειρά εδώ κρατά την ίδια απάντηση
  // και για το **κελί**, ώστε το διαχωριστικό να μη γίνεται «κλικ στην πρώτη γραμμή».
  const edge = columnEdgeAt(entity, world, geometry, viewScale);
  if (edge !== null) return { where: 'column-edge', columnIndex: edge };
  const rowEdge = rowEdgeAt(entity, world, geometry, viewScale);
  if (rowEdge !== null) return { where: 'row-edge', rowIndex: rowEdge };
  // 🔴 §42 — **το ⊖ πριν από τη ζώνη**: ζει μέσα στο κουτί του γράμματος, άρα η σειρά εδώ
  // λύνει πραγματική διεκδίκηση (σε αντίθεση με το ⊕ από πάνω, που ζει έξω από όλα).
  const remove = armedDeleteControlAt(entity, world, geometry, viewScale);
  if (remove) return { where: 'delete-control', control: remove };
  const band = indicatorHitAt(entity, world, geometry, viewScale);
  if (band) return { where: 'band', band };
  // 🔴 §43 — **η γωνία μετά τις ζώνες**, και η σειρά εδώ **δεν** λύνει διεκδίκηση: η γωνία είναι
  // ξένη προς κάθε άλλη περιοχή αυτής της συνάρτησης (η απόδειξη — τρεις δομικοί λόγοι, όχι
  // σύμπτωση — ζει στην κεφαλίδα του `table-select-all-corner`). Μπαίνει **μετά** τη ζώνη γιατί
  // είναι η **λιγότερο** ειδική ερώτηση της οικογένειας του δείκτη: ρωτά ένα σκέτο ορθογώνιο,
  // ενώ όλες οι από πάνω ρωτούν «ποιο **από** τα Ν».
  if (selectAllCornerAt(entity, world, geometry, viewScale)) return { where: 'select-all-corner' };
  // 🔴 ADR-833 Φάση 3 — **η καρτέλα φύλλου, μετά από ΚΑΘΕ λαβή.**
  //
  // Η σειρά **δεν** λύνει γεωμετρική διεκδίκηση: η λωρίδα ζει πέρα από το κενό της οπής λαβής
  // (`TABLE_INDICATOR_GRIP_CLEARANCE_PX` = 9 px), και η μακρύτερη εμβέλεια που φτάνει ως εκεί
  // είναι η λαβή συμπλήρωσης με **7 px** — ανισότητα κλειδωμένη σε άγκυρα. Δηλώνει
  // **παραίτηση**: όταν κάποτε ακουμπήσουν, νικά η λαβή. Η λαβή είναι **δομική** πράξη και δεν
  // έχει δεύτερο δρόμο· η καρτέλα είναι **πλοήγηση** και έχει (η διπλανή της, ή το επόμενο
  // κλικ). Ίδιο κριτήριο με το §27.11: σε αμφισβήτηση νικά αυτός που δεν έχει εναλλακτική.
  const strip = tableWorksheetStripAtWorld(entity, world, geometry, viewScale);
  if (strip) {
    // ADR-833 Φάση 4 — η λωρίδα απαντά **μία** φορά για δύο πράγματα· εδώ μόνο μεταφράζεται σε
    // λεξιλόγιο του χάρτη χτυπημάτων. Καμία δεύτερη σάρωση, καμία δεύτερη σειρά προτεραιότητας.
    return strip.kind === 'tab' ? { where: 'worksheet-tab', tab: strip.tab } : { where: 'worksheet-add' };
  }
  const cell = tableCellAtWorld(entity, world, geometry);
  return cell ? { where: 'cell', cell } : null;
}

/**
 * 🔴 §43 — πάτησε το χέρι το κουμπί «επιλογή όλων»· `null` κάτω από το LOD.
 *
 * Το LOD δεν ξαναρωτιέται εδώ — το απαντά το {@link indicatorProbeBasis}, όπως για κάθε άλλη
 * ερώτηση δείκτη. Χωρίς αυτό, ένα κλικ στο κενό γύρω από μια κουκκίδα θα μάρκαρε ολόκληρο
 * πίνακα που **δεν έχει καν ζωγραφισμένη γωνία**.
 */
function selectAllCornerAt(
  entity: TableEntity,
  world: Point2D,
  geometry: TableEntityGeometry,
  viewScale: number,
): boolean {
  const probe = indicatorProbeBasis(entity, world, geometry, viewScale);
  return probe !== null && isTableSelectAllCornerAtFrame(probe.frame, probe.bands);
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

/**
 * 🔴 §40.8 — το ⊕ **που πατιέται** κάτω από το σημείο· `null` σε φάση `nearby`, κάτω από το
 * LOD, ή οπουδήποτε αλλού. Δες την περίπτωση `'insert-control'` για το γιατί μόνο `armed`.
 *
 * ## Γιατί η κατάσταση είναι σταθερά `'table-mode'` και δεν γίνεται παράμετρος
 * Και οι τρεις καλούντες αυτής της συνάρτησης (ο φύλακας του §29, ο pointer, ο δρομολογητής
 * μενού) ζουν **μόνο** όσο υπάρχει ζωντανός δρομέας — δηλαδή είναι εξ ορισμού σε λειτουργία
 * πίνακα. Μια παράμετρος εδώ θα ήταν τιμή που κανείς δεν μπορεί να δώσει διαφορετική, δηλαδή
 * μια ακόμα ευκαιρία να δοθεί λάθος. Ο **hover** — ο μόνος που όντως ρωτά και για την απλή
 * επιλογή — ρωτά από αλλού ({@link tableIndicatorProbeAtWorld}) και **περνά** την κατάστασή του.
 */
function armedInsertControlAt(
  entity: TableEntity,
  world: Point2D,
  geometry: TableEntityGeometry,
  viewScale: number,
): TableInsertControlHit | null {
  const probe = indicatorProbeBasis(entity, world, geometry, viewScale);
  if (!probe) return null;
  const control = tableInsertControlAtFrame(
    geometry.layout,
    probe.frame,
    probe.pxPerMm,
    'table-mode',
  );
  return control?.phase === 'armed' ? control : null;
}

/**
 * 🔴 §42 — το ⊖ **που πατιέται** κάτω από το σημείο· `null` σε φάση `nearby`, κάτω από το LOD,
 * σε στενή υποδιαίρεση, ή οπουδήποτε αλλού.
 *
 * Δεν παίρνει `mode`: το ⊖ ζει **μέσα** στη ζώνη, και η ζώνη υπάρχει μόνο σε λειτουργία
 * πίνακα. Έξω από αυτήν δεν υπάρχει τίποτα να ρωτηθεί — ίδιο σκεπτικό με το σχόλιο του
 * {@link armedInsertControlAt} για το γιατί η κατάστασή του είναι σταθερή.
 */
function armedDeleteControlAt(
  entity: TableEntity,
  world: Point2D,
  geometry: TableEntityGeometry,
  viewScale: number,
): TableDeleteControlHit | null {
  const probe = indicatorProbeBasis(entity, world, geometry, viewScale);
  if (!probe) return null;
  const control = tableDeleteControlAtFrame(
    geometry.layout,
    probe.frame,
    probe.bands,
    probe.pxPerMm,
  );
  return control?.phase === 'armed' ? control : null;
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
  // 🔴 §40 — σε ποια κατάσταση ρωτάμε. Προεπιλογή η λειτουργία πίνακα, ώστε οι δεκάδες
  // υπάρχουσες κλήσεις/tests να μη χρειαστεί να μάθουν μια έννοια που δεν τους αφορά.
  mode: TableInsertControlMode = 'table-mode',
  // 🔴 ADR-754 §14 — **το ενεργό κελί, ΟΤΑΝ Η ΛΑΒΗ ΖΕΙ**· `null` = καμία λαβή.
  //
  // Ένα όρισμα, δύο σιωπές: «κανένας δρομέας σε αυτόν τον πίνακα» και «ο χρήστης πληκτρολογεί»
  // (§13.5 — η λαβή σιωπά σε γραφή, Excel parity). Και οι δύο σημαίνουν το ίδιο εδώ, και ο
  // καλών είναι ο **μόνος** που ξέρει να τις διακρίνει — δες τη σύμβαση του `selection` από
  // πάνω: αυτό το module απαντά «**πού** έπεσε αυτό;», ποτέ «τι κατάσταση έχει η εφαρμογή».
  fillAnchor: TableCellRef | null = null,
  // 🔴 ADR-828 Φ4α — **η γεμισμένη περιοχή, όταν το κουμπί επιλογών ζει**· `null` = κανένα
  // κουμπί.
  //
  // Έρχεται λυμένη και δεν κρίνεται εδώ, με την **ίδια** σύμβαση που κρατά όλο το module
  // καθαρό (δες `selection` και `fillAnchor` από πάνω): εδώ απαντιέται «**πού** έπεσε αυτό;»,
  // ποτέ «τι κατάσταση έχει η εφαρμογή». Και η κρίση της είναι ουσιωδώς κατάσταση —
  // *«έγινε συμπλήρωση, και είναι ακόμη η τελευταία πράξη πάνω σε αυτό το μοντέλο;»* —
  // δηλαδή ερώτηση που ο ΕΝΑΣ ακροατής κίνησης ξέρει να απαντήσει και αυτό εδώ όχι.
  fillBadge: TableCellRangeBounds | null = null,
): TableIndicatorProbe {
  const geometry = computeTableEntityGeometryLive(entity);
  const probe = indicatorProbeBasis(entity, world, geometry, viewScale);
  if (!probe) return EMPTY_PROBE;
  // 🔴 §40 — **μία** σάρωση του χειριστηρίου, **τρεις** καταναλωτές: ο ζωγράφος (ποιο ⊕
  // βάφεται), ο δείκτης του ΟΣ (γίνεται κουμπί;) και το κλικ (τι εισάγεται). Δύο κλήσεις θα
  // πλήρωναν τη γεωμετρία δύο φορές ανά κίνηση ποντικιού — και θα άφηναν περιθώριο να
  // ζωγραφιστεί ⊕ σε άλλο σύνορο από εκείνο που θα εισήγαγε το πάτημα.
  const insert = tableInsertControlAtFrame(geometry.layout, probe.frame, probe.pxPerMm, mode);
  // 🔴 §42 — **τέταρτο κανάλι της ίδιας σάρωσης**: το ⊖ της διαγραφής. Μόνο σε λειτουργία
  // πίνακα, γιατί μόνο εκεί υπάρχει ζώνη — σε απλή επιλογή η ερώτηση δεν έχει αντικείμενο.
  const remove =
    mode === 'table-mode'
      ? tableDeleteControlAtFrame(geometry.layout, probe.frame, probe.bands, probe.pxPerMm)
      : null;
  // 🔴 ADR-739 §36 — **ΜΙΑ** ανάλυση της εμβέλειας, **δύο** καταναλωτές: το ορθογώνιο που
  // πιάνεται (`range-move`) και η πηγή της λαβής (ADR-754 §14). Εδώ έγραφε
  // `activeTableRange(...)?.rectMm ?? null` μέσα στην κλήση· με δεύτερο καταναλωτή, η ίδια
  // γραμμή θα έτρεχε **δύο φορές ανά κίνηση ποντικιού** — και το `resolveTableSelectionBounds`
  // κουμπώνει σε συγχωνεύσεις, δηλαδή δεν είναι φθηνό.
  //
  // 🔴 §36.9 — το `fillAnchor` περνά **και εδώ**, και έτσι έπαψαν να είναι δύο ερωτήσεις: το
  // ορθογώνιο της μετακίνησης και η πηγή της λαβής είναι πλέον **το ίδιο αντικείμενο**. Πριν,
  // η `tableFillSourceBounds` καλούνταν χωριστά ακριβώς από κάτω — δηλαδή ο κανόνας «χωρίς
  // επιλογή, το ενεργό κελί» ίσχυε για τη λαβή και **όχι** για το περίγραμμα, μέσα στο ίδιο
  // καρέ και για τον ίδιο χρήστη.
  const range = activeTableRange(entity, geometry, selection, fillAnchor);
  // 🔴 ADR-754 §14 — η ίδια `tableFillHandleHitAtFrame` που ρωτά το πάτημα, πάνω στα **ίδια**
  // όρια. Ο χρήστης δείχνει με τον δείκτη **αυτό που θα πιάσει**.
  const fill = fillAnchor
    ? tableFillHandleHitAtFrame(geometry.layout, probe.frame, probe.pxPerMm, range?.bounds ?? null)
    : null;
  // 🔴 ADR-828 Φ4α — **έκτο κανάλι της ίδιας σάρωσης**: το κουμπί επιλογών κάτω από τη
  // γεμισμένη περιοχή. Ο **ίδιος** `tableFillBadgeHitAtFrame` που ρωτά και το πάτημα, πάνω στα
  // **ίδια** όρια — ο άνθρωπος δείχνει με τον δείκτη αυτό που θα πατήσει (§31).
  const badge = tableFillBadgeHitAtFrame(
    geometry.layout,
    probe.frame,
    probe.pxPerMm,
    fillBadge,
  );
  // 🔴 ADR-833 Φάση 3 — **έβδομο κανάλι**: η καρτέλα φύλλου.
  //
  // **Χωρίς** φύλακα `mode`, σε αντίθεση με το `hit`/`remove`/`selectAll` και μαζί με το
  // `insert`: η αλλαγή φύλλου είναι **πλοήγηση**, όχι επεξεργασία — υπάρχει τη στιγμή που ο
  // πίνακας είναι απλώς **επιλεγμένος**, χωρίς να μπεις μέσα του. Ο ίδιος κανόνας ανακάλυψης
  // που έβγαλε το ⊕ έξω από τον δρομέα (§40): ένα χειριστήριο που φαίνεται μόνο αφού μπεις
  // στη λειτουργία το βρίσκει μόνο όποιος ήδη ξέρει ότι υπάρχει.
  const worksheetStrip = tableWorksheetStripAtWorld(entity, world, geometry, viewScale);
  return {
    worksheetStrip,
    // §40 — σε απλή επιλογή δεν υπάρχουν ζώνες να φωτιστούν. Ο φύλακας ζει εδώ και όχι στον
    // καλούντα, ώστε ένας δεύτερος καταναλωτής αύριο να μην μπορεί να τον ξεχάσει.
    hit:
      mode === 'table-mode'
        ? tableIndicatorHitAtFrame(geometry.layout, probe.frame, probe.bands)
        : null,
    cursor: tableIndicatorCursorRoleAtFrame(
      geometry.layout,
      probe.frame,
      probe.bands,
      range?.rectMm ?? null,
      intent,
      insert,
      mode,
      remove,
      fill,
      badge,
      // 🔴 ADR-833 Φάσεις 3+4 — **έβδομο όρισμα, ήδη απαντημένο.** Ο ρόλος δείκτη πρέπει να δει
      // τη λωρίδα, αλλιώς πάνω της μένει το σταυρόνημα — δηλαδή ο δείκτης υπόσχεται λάσο σε
      // pixel που το πάτημα καταναλώνει (§31). Σκέτο `boolean`: δες τη δήλωση της παραμέτρου.
      // **Καρτέλα και ⊕ μαζί**: και τα δύο είναι κουμπιά, και ο δείκτης δεν τα ξεχωρίζει.
      worksheetStrip !== null,
    ),
    insert,
    remove,
    // 🔴 §43 — **πέμπτο κανάλι της ίδιας σάρωσης**: το τετραγωνάκι της γωνίας κάτω από το χέρι.
    //
    // Μόνο σε λειτουργία πίνακα, με τον **ίδιο** φύλακα και για τον ίδιο λόγο με το `hit` από
    // πάνω: σε απλή επιλογή δεν υπάρχουν ζώνες, άρα δεν υπάρχει ούτε γωνία να φωτιστεί.
    //
    // ⚠️ Δεν είναι δεύτερη σάρωση: το `probe.frame`/`probe.bands` έχουν ήδη υπολογιστεί μία
    // φορά παραπάνω, και η ερώτηση είναι μια σύγκριση ορθογωνίου — δες
    // `isTableSelectAllCornerAtFrame`.
    selectAll:
      mode === 'table-mode' && isTableSelectAllCornerAtFrame(probe.frame, probe.bands),
  };
}

/** Ό,τι ξέρει ο hover για το σημείο κάτω από το ποντίκι — δες {@link tableIndicatorProbeAtWorld}. */
export interface TableIndicatorProbe {
  /** §30 — ποια υποδιαίρεση φωτίζεται· `null` = καμία. */
  readonly hit: TableIndicatorHit | null;
  /** §31 — ποιο σχήμα οφείλει ο δείκτης του ΟΣ· `null` = κανένα (μένει το σταυρόνημα). */
  readonly cursor: TableIndicatorCursorRole | null;
  /** §40 — ποιο ⊕ εισαγωγής ζωγραφίζεται και αν πατιέται· `null` = κανένα. */
  readonly insert: TableInsertControlHit | null;
  /** §42 — ποιο ⊖ διαγραφής ζωγραφίζεται και αν πατιέται· `null` = κανένα. */
  readonly remove: TableDeleteControlHit | null;
  /**
   * §43 — στέκεται το χέρι πάνω στο τετραγωνάκι «επιλογή όλων»;
   *
   * **Σκέτο `boolean`** και όχι αντικείμενο, σε αντίθεση με τα τέσσερα από πάνω: η γωνία είναι
   * **μία** και δεν έχει ούτε ταυτότητα (ποια;) ούτε φάση (πατιέται;). Ένα αντικείμενο εδώ θα
   * ήταν σχήμα που υπόσχεται διακρίσεις οι οποίες δεν υπάρχουν.
   */
  readonly selectAll: boolean;
  /**
   * 🔴 ADR-833 Φάσεις 3+4 — τι της **λωρίδας φύλλων** είναι κάτω από το χέρι: καρτέλα, το ⊕,
   * ή `null` = τίποτα.
   *
   * Κουβαλά ολόκληρο το `slot` (θέση στο βιβλίο + το ίδιο το φύλλο) και όχι σκέτη ταυτότητα:
   * ο ένας καταναλωτής το γράφει στον hover, ο άλλος το εκτελεί στο πάτημα, και **κανείς από
   * τους δύο δεν επιτρέπεται να ξαναψάξει** ποιο φύλλο ήταν — μια δεύτερη αναζήτηση ανάμεσα
   * στην κίνηση και το πάτημα μπορεί να απαντήσει αλλιώς (άλλαξε το zoom, το παράθυρο
   * υπερχείλισης μετακινήθηκε), δηλαδή ο χρήστης θα άλλαζε σε φύλλο που δεν στόχευσε.
   */
  readonly worksheetStrip: TableWorksheetStripHit | null;
}

/**
 * Κάτω από το LOD δεν υπάρχει τίποτα — ούτε φωτισμός, ούτε δείκτης, ούτε χειριστήριο. Σταθερό
 * αντικείμενο ώστε η συχνότερη διαδρομή (ποντίκι εκτός πίνακα) να μην κατανέμει μνήμη 60 φορές
 * το δευτερόλεπτο.
 */
const EMPTY_PROBE: TableIndicatorProbe = {
  hit: null,
  cursor: null,
  insert: null,
  remove: null,
  selectAll: false,
  worksheetStrip: null,
};

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
