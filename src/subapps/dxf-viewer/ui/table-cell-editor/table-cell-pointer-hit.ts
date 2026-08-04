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
import {
  tableFillHandleHitAtFrame,
  tableFillSourceBounds,
} from '../../bim/table/table-fill-handle';
import { resolveTableModel } from '../../bim/table/table-model-helpers';
import type { TableCellRef } from '../../bim/table/table-cell-range';
import type { TableCellSelection } from '../../state/table-cell-cursor-store';
import type { TableCellHit, TableEntity, TableEntityGeometry } from '../../types/table-entity';
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
  /**
   * 🔴 §40.8 — **ΤΟ ⊕ ΤΗΣ ΕΙΣΑΓΩΓΗΣ, ΟΠΛΙΣΜΕΝΟ** (2026-08-04).
   *
   * ## Το ελάττωμα που το γέννησε — «δουλεύει έξω από το edit mode, μέσα όχι»
   * Ο ιδιοκτήτης το μέτρησε στην οθόνη: **εκτός** λειτουργίας πίνακα το ⊕ εισάγει κανονικά·
   * **μέσα** ζωγραφίζεται, ο δείκτης γίνεται κουμπί, και το πάτημα δεν κάνει τίποτα.
   *
   * Η αιτία ήταν ακριβώς **η απουσία αυτής της περίπτωσης**. Ο φύλακας του §29 ρωτά αυτή τη
   * συνάρτηση «ανήκει το σημείο στον πίνακα;» και η απάντηση ήταν `null` — γιατί το ⊕ κάθεται
   * **πιο έξω από όλα** όσα ήξερε να ονομάσει (πιο έξω και από τη ζώνη γραμμάτων, §40). Άρα ο
   * φύλακας έκοβε το `mousedown` στο `document` σε **σύλληψη**, δηλαδή δομικά **πριν** τον
   * ακροατή του δοχείου που εκτελεί την εισαγωγή. Το ⊕ ήταν ορατό, οπλισμένο και άφταστο.
   *
   * 🔑 Η διόρθωση **δεν** είναι εξαίρεση στον φύλακα: είναι ότι η ερώτηση «πού έπεσε;»
   * απαντούσε λάθος. Ο φύλακας ήταν σωστός· του έλειπε **λέξη** για να ονομάσει το ⊕.
   *
   * ⚠️ **ΜΟΝΟ σε φάση `armed`** — δηλαδή μόνο ο δίσκος των 14 px, ποτέ η λωρίδα `nearby`. Η
   * λωρίδα είναι γενναιόδωρη επίτηδες ώστε το ⊕ να **βρεθεί** (§40, §31.8) και τυλίγει
   * ολόκληρη την ακμή του πίνακα· αν την ονομάζαμε κι εκείνη «πάνω στον πίνακα», ο καμβάς θα
   * ξαναποκτούσε δικαίωμα σε μια ζώνη πλάτους 14 px γύρω από κάθε πίνακα — δηλαδή lasso μέσα
   * σε edit mode, ακριβώς το ελάττωμα που το §29 έκλεισε.
   */
  | { readonly where: 'insert-control'; readonly control: TableInsertControlHit }
  /**
   * 🔴 §42 — **ΤΟ ⊖ ΤΗΣ ΔΙΑΓΡΑΦΗΣ, ΟΠΛΙΣΜΕΝΟ** (2026-08-04).
   *
   * Χωριστή περίπτωση από το `'band'` παρότι ζει **μέσα** στη ζώνη, και ο λόγος είναι ο ίδιος
   * που έκανε το `'column-edge'` χωριστό από το `'band'` (§31.9): ο pointer πρέπει να **μην**
   * επιλέξει τον άξονα εδώ. Αν το ⊖ ήταν υποείδος του `band`, το πάτημα πάνω στο κουμπί θα
   * μάρκαρε **και** ολόκληρη τη στήλη πριν τη σβήσει — δύο αποτελέσματα από μία χειρονομία.
   *
   * ⚠️ **ΜΟΝΟ φάση `armed`.** Στη φάση `nearby` το ⊖ φαίνεται αλλά το κουτί του γράμματος
   * ανήκει ακέραιο στη ζώνη: το πάτημα επιλέγει άξονα, όπως πάντα. Ίδια ασυμμετρία με το ⊕
   * (§40.8) και για τον ίδιο λόγο — η φάση εμφάνισης δεν διεκδικεί ποτέ pixel.
   *
   * 🔑 Σε αντίθεση με το ⊕, εδώ **δεν** χρειάστηκε να μάθει τίποτα ο φύλακας του §29: το ⊖
   * κάθεται μέσα στη ζώνη, που ήταν **ήδη** μη-`null` απάντηση. Το `mousedown` περνούσε ήδη.
   */
  | { readonly where: 'delete-control'; readonly control: TableDeleteControlHit }
  /**
   * 🔴 §43 — **ΤΟ ΤΕΤΡΑΓΩΝΑΚΙ ΤΗΣ ΓΩΝΙΑΣ**: το κουμπί «επιλογή όλων» του Excel (2026-08-04).
   *
   * ## Γιατί εδώ και ΟΧΙ τρίτη περίπτωση στο `TableIndicatorHit`
   * Ο πειρασμός είναι μια `{ axis: 'corner' }` δίπλα στο `'column'`/`'row'`. Το `axis` όμως
   * είναι **δανεικό λεξιλόγιο**: το μοιράζονται ήδη τουλάχιστον τέσσερα σχήματα
   * (`TableAxisTarget`, `TableSelectionKind`, `table-axis-action-target`, το μενού κεφαλίδας),
   * και τα περισσότερα το διαβάζουν ως `if (axis === 'column') … else …` — δηλαδή το `else` θα
   * κατάπινε σιωπηλά τη γωνία **ως γραμμή**, χωρίς ο tsc να πει τίποτα.
   *
   * Η γωνία είναι ό,τι το ⊕ και το ⊖: **χειριστήριο που δεν είναι ούτε κελί ούτε ζώνη**. Άρα
   * παίρνει ακριβώς ό,τι πήραν κι εκείνα — δική της περίπτωση στο `where`.
   *
   * 🔑 **Δεν κουβαλά φορτίο**, και είναι η μόνη περίπτωση εδώ που δεν κουβαλά: η ερώτηση «ποια
   * κελιά;» έχει **μία** απάντηση (`tableWholeGridRange`) και την ξέρει ήδη το `selectAll()`.
   * Ένα πεδίο `bounds` εδώ θα ήταν δεύτερος υπολογισμός του «όλα» — δηλαδή δεύτερη ευκαιρία να
   * διαφωνήσει με το `Ctrl+A` για το τι σημαίνει «όλα».
   */
  | { readonly where: 'select-all-corner' }
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
  // 🔴 ADR-739 §36 — **ΜΙΑ** ανάλυση της επιλογής, **δύο** καταναλωτές: το ορθογώνιο που
  // πιάνεται (`range-move`) και η πηγή της λαβής (ADR-754 §14). Εδώ έγραφε
  // `activeTableRange(...)?.rectMm ?? null` μέσα στην κλήση· με δεύτερο καταναλωτή, η ίδια
  // γραμμή θα έτρεχε **δύο φορές ανά κίνηση ποντικιού** — και το `resolveTableSelectionBounds`
  // κουμπώνει σε συγχωνεύσεις, δηλαδή δεν είναι φθηνό.
  const range = activeTableRange(entity, geometry, selection);
  // 🔴 ADR-754 §14 — **ο ΕΝΑΣ δρόμος**: η ίδια `tableFillSourceBounds` που ρωτούν ο ζωγράφος
  // και ο φρουρός του πατήματος, η ίδια `tableFillHandleHitAtFrame` που ρωτά το πάτημα. Ο
  // χρήστης δείχνει με τον δείκτη **αυτό που θα πιάσει**.
  const fill = fillAnchor
    ? tableFillHandleHitAtFrame(
        geometry.layout,
        probe.frame,
        probe.pxPerMm,
        tableFillSourceBounds(resolveTableModel(entity.model), fillAnchor, range?.bounds ?? null),
      )
    : null;
  return {
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
