/**
 * 🔴 ADR-739 §40 — **ΤΟ ⊕ ΤΗΣ ΕΙΣΑΓΩΓΗΣ**: πού κάθεται, ποιο σύνορο εκφράζει, και πότε
 * πατιέται. Καθαρή γεωμετρία — μηδέν DOM, μηδέν store, μηδέν React.
 *
 * Ο Giorgio το ζήτησε ως **full parity με το Word** (04/08): «*όταν επιλέγω έναν πίνακα, να
 * μπορώ πηγαίνοντας στην κορυφή του να εμφανίζεται σημάδι προσθήκης στήλης και γραμμής*».
 * Στο Word πλησιάζεις το πάνω χείλος, εμφανίζεται ένα ⊕ στο **πλησιέστερο σύνορο στήλης**,
 * και το κλικ εισάγει εκεί — χωρίς μενού, χωρίς δεξί κλικ, χωρίς να μάθεις ποτέ ότι υπάρχει
 * εντολή «Εισαγωγή».
 *
 * ## 🔴 ΓΙΑΤΙ ΔΥΟ ΚΑΤΑΣΤΑΣΕΙΣ ΚΑΙ ΟΧΙ ΜΙΑ — ο χώρος του Νέστορα ΔΕΝ είναι ο χώρος του Word
 * Στο Word πάνω από τον πίνακα δεν υπάρχει **τίποτα**, οπότε το ⊕ κάθεται όπου θέλει. Εδώ ο
 * ίδιος χώρος είναι κατειλημμένος **δύο φορές** μόλις μπεις σε λειτουργία πίνακα: η ζώνη
 * γραμμάτων `A B C` (§25) και, ακριβώς από πάνω της, η **γραμμή τύπων** (§27.13). Ένα ⊕ με
 * μία μοναδική θέση θα έπεφτε πάνω στη μία ή στην άλλη.
 *
 * Άρα η απόσταση από την ακμή **εξαρτάται από το τι άλλο ζωγραφίζεται τώρα**:
 *
 * | κατάσταση | τι υπάρχει ανάμεσα | που κάθεται το ⊕ |
 * |---|---|---|
 * | `'selection'` | μόνο οι **λαβές** στο `v = 0` | έξω από την οπή σύλληψης |
 * | `'table-mode'` | λαβές **και** ζώνη γραμμάτων | έξω από ολόκληρο τον δείκτη |
 *
 * ⚠️ **Η ΓΡΑΜΜΗ ΤΥΠΩΝ ΠΡΕΠΕΙ ΝΑ ΑΝΕΒΕΙ ΜΑΖΙ.** Αυτό δεν είναι προαιρετικό και δεν είναι
 * αισθητική: το §27.13 καταγράφει το **ίδιο ακριβώς** ελάττωμα, ήδη συμβάν μία φορά — η ζώνη
 * απέκτησε κενό, η γραμμή τύπων έμεινε στην παλιά της θέση και **σκέπασε τα γράμματα**, και
 * κανένα test δεν το είδε γιατί έλεγχε «είναι πιο ψηλά από τη ζώνη;» με **γνήσια** ανισότητα
 * που παρέμενε αληθής. Γι' αυτό το {@link tableInsertControlOuterPx} είναι η **μία** έκφραση
 * «πόσο τόπο πιάνει ό,τι κάθεται έξω από το πλέγμα», και τη διαβάζει και η γραμμή τύπων.
 * Κανείς έξω από αυτό το module δεν προσθέτει ακτίνα + κενό.
 *
 * ## 🔴 ΔΥΟ ΦΑΣΕΙΣ, ΚΑΙ Η ΔΕΥΤΕΡΗ ΕΙΝΑΙ ΠΟΥ ΚΑΝΕΙ ΤΟΝ ΔΕΙΚΤΗ ΝΑ ΜΗΝ ΨΕΥΔΕΤΑΙ
 * Το Word δείχνει το ⊕ **πριν** το στοχεύσεις: πλησιάζεις τη λωρίδα και εκείνο εμφανίζεται στο
 * κοντινότερο σύνορο. Αν το κλικ δρούσε σε **ολόκληρη** αυτή τη λωρίδα, ένα πάτημα 40 px
 * μακριά από τον δίσκο θα εισήγαγε στήλη — δηλαδή η εφαρμογή θα έκανε κάτι που ο χρήστης δεν
 * στόχευσε. Αν πάλι το ⊕ εμφανιζόταν **μόνο** ακριβώς από πάνω του, δεν θα το έβρισκε κανείς:
 * είναι ακριβώς η αστοχία που το §31.8 μέτρησε ζωντανά **δύο φορές** («ο ιδιοκτήτης δεν το
 * βρήκε ούτε ψάχνοντας»).
 *
 * Οι δύο φάσεις λύνουν και τα δύο με **έναν** κανόνα — *φαίνεται νωρίς, δρα ακριβώς*:
 *
 *  - `'nearby'` → το χέρι είναι στη λωρίδα· το ⊕ **ζωγραφίζεται** στο πλησιέστερο σύνορο.
 *  - `'armed'` → το χέρι είναι **πάνω στον δίσκο**· το ⊕ εντείνεται, εμφανίζεται η γραμμή
 *    προεπισκόπησης, ο δείκτης γίνεται `pointer` και **το κλικ δρα**.
 *
 * @module subapps/dxf-viewer/bim/table/table-insert-control
 * @see bim/table/table-axis-boundary.ts — ΠΟΙΟ σύνορο είναι πιο κοντά (SSoT, κοινό με τη σύρση)
 * @see bim/table/table-indicator-geometry.ts — ΤΙ άλλο κάθεται έξω από το πλέγμα
 * @see bim/table/table-entity-grips.ts — οι λαβές που πρέπει να μείνουν ελεύθερες
 * @see rendering/entities/table/stamp-table-insert-control.ts — ο ζωγράφος
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §40
 */

import { gripAperturePx } from '../../config/grip-aperture';
import { GRIP_SIZE_DEFAULT } from '../../config/grip-size-default';
import type { TableFramePoint } from '../../types/table-entity';
import {
  nearestTableAxisBoundary,
  tableAxisBoundaryMm,
  tableColumnBoundaryView,
  tableRowBoundaryView,
  type TableAxisBoundaryView,
} from './table-axis-boundary';
import {
  isTableIndicatorVisible,
  TABLE_INDICATOR_OUTER_PX,
} from './table-indicator-geometry';
import type { TableLayout } from './table-layout-types';

/**
 * Η ακτίνα του δίσκου σε **px οθόνης** — στοιχείο διεπαφής, όχι γεωμετρία σχεδίου (ίδιο
 * επιχείρημα με τις ζώνες του δείκτη: σε sheet-mm θα γινόταν αόρατο σε zoom-out και τεράστιο
 * σε zoom-in).
 *
 * Τα 7 px δίνουν στόχο 14 px. Το πρότυπο WCAG 2.2 SC 2.5.8 (Target Size, Minimum) ζητά 24 px
 * **ή** επαρκή απόσταση από γειτονικούς στόχους — εδώ ισχύει το δεύτερο σκέλος και ισχύει
 * δομικά: το {@link TABLE_INSERT_CONTROL_NEARBY_PX} κάνει ολόκληρη τη λωρίδα ενεργή για την
 * **εμφάνιση**, και δύο διαδοχικά ⊕ δεν συνυπάρχουν ποτέ (ζωγραφίζεται μόνο το πλησιέστερο).
 */
export const TABLE_INSERT_CONTROL_RADIUS_PX = 7;

/**
 * Πόσο μακριά από το κέντρο του δίσκου, κατά τον **κάθετο** άξονα, το χειριστήριο θεωρείται
 * «κοντά» — δηλαδή ζωγραφίζεται χωρίς να δρα.
 *
 * Γενναιόδωρο **επίτηδες**: η λωρίδα υπάρχει για να **βρεθεί** το χειριστήριο, όχι για να
 * πατηθεί. Το πάτημα ζητά τον δίσκο (δες την κεφαλίδα, δύο φάσεις).
 */
export const TABLE_INSERT_CONTROL_NEARBY_PX = 2 * TABLE_INSERT_CONTROL_RADIUS_PX;

/**
 * Το κενό ανάμεσα σε ό,τι υπάρχει ήδη έξω από το πλέγμα και την **εσωτερική** ακμή του δίσκου.
 *
 * Στην κατάσταση `'selection'` δεν γράφεται νέος αριθμός: είναι η **οπή σύλληψης λαβής**
 * ({@link gripAperturePx}), δηλαδή ο δίσκος αρχίζει ακριβώς εκεί που η λαβή σταματά να
 * πιάνεται. Ίδια αρχή με το κενό της ζώνης (§27.11) και για τον ίδιο ακριβώς λόγο: **ένα
 * pixel, μία ερώτηση**. Χωρίς αυτό, το ⊕ θα διεκδικούσε τα pixel της λαβής `table-column-edge`
 * και ο χρήστης που στοχεύει πλάτος στήλης θα εισήγαγε στήλη.
 *
 * ⚠️ Αποτιμάται στις **προεπιλογές** για τον ίδιο λόγο που το κάνει και το
 * `TABLE_INDICATOR_GRIP_CLEARANCE_PX`: το module είναι καθαρή γεωμετρία και η ζωντανή ανάγνωση
 * ρυθμίσεων (`gripStyleStore.get()`) πετά όταν είναι ενεργό override. Σε αμφισβήτηση νικά η
 * **λαβή** — έχει έναν μόνο δρόμο, ενώ η εισαγωγή έχει και δεύτερο (το δεξί κλικ στη ζώνη).
 */
const TABLE_INSERT_CONTROL_CLEARANCE_PX = gripAperturePx({ gripSize: GRIP_SIZE_DEFAULT });

/** Σε ποια από τις δύο καταστάσεις ζωγραφίζεται — δες τον πίνακα στην κεφαλίδα. */
export type TableInsertControlMode = 'selection' | 'table-mode';

/** Φαίνεται, ή φαίνεται **και** δρα; Δες την κεφαλίδα: *φαίνεται νωρίς, δρα ακριβώς*. */
export type TableInsertControlPhase = 'nearby' | 'armed';

/**
 * **Ποια εισαγωγή** υπόσχεται αυτό το ⊕.
 *
 * Το `line` είναι δείκτης **συνόρου**, όχι υποδιαίρεσης: για `n` στήλες υπάρχουν `n + 1`
 * σύνορα και το `line === n` σημαίνει «μετά την τελευταία». Είναι ακριβώς το όρισμα που
 * περιμένουν οι `insertTableColumn` / `insertTableRow`, χωρίς καμία μετάφραση ενδιάμεσα —
 * μια μετατόπιση κατά ένα εδώ θα εισήγαγε σταθερά στη **λάθος μεριά** του συνόρου.
 */
export interface TableInsertControlTarget {
  readonly axis: 'column' | 'row';
  readonly line: number;
}

/** Το χειριστήριο κάτω από (ή κοντά σε) τον δείκτη, έτοιμο και για ζωγραφική και για κλικ. */
export interface TableInsertControlHit {
  readonly target: TableInsertControlTarget;
  readonly phase: TableInsertControlPhase;
  /**
   * Το **κέντρο του δίσκου** σε sheet-mm του πλαισίου. Ταξιδεύει μαζί ώστε ο ζωγράφος να μην
   * ξαναλύσει τη γεωμετρία: η ερώτηση απαντήθηκε ήδη τη στιγμή του `mousemove`, και μια
   * δεύτερη απάντηση ανά καρέ θα ήταν δεύτερη ευκαιρία να αποκλίνει από την πρώτη.
   */
  readonly centerMm: TableFramePoint;
  /** Η θέση του **συνόρου** σε sheet-mm — η γραμμή προεπισκόπησης, χωρίς δεύτερη αναζήτηση. */
  readonly boundaryMm: number;
}

/**
 * 🔴 **ΠΟΣΟ ΤΟΠΟ ΠΙΑΝΕΙ ΤΟ ⊕ ΕΞΩ ΑΠΟ ΤΟ ΠΛΕΓΜΑ**, σε px οθόνης, ανά άξονα.
 *
 * Η **μία** έκφραση — δες την προειδοποίηση της κεφαλίδας για το τι έγινε την προηγούμενη
 * φορά που δύο σημεία υπολόγισαν χωριστά «κενό + ζώνη». Καταναλωτές: ο ζωγράφος, το hit-test
 * και η **γραμμή τύπων**.
 */
export function tableInsertControlOuterPx(mode: TableInsertControlMode): {
  readonly top: number;
  readonly left: number;
} {
  const center = tableInsertControlOffsetPx(mode);
  return {
    top: center.top + TABLE_INSERT_CONTROL_RADIUS_PX,
    left: center.left + TABLE_INSERT_CONTROL_RADIUS_PX,
  };
}

/**
 * Η απόσταση του **κέντρου** του δίσκου από την ακμή του πλέγματος, σε px οθόνης.
 *
 * Στη λειτουργία πίνακα ξεκινά από το `TABLE_INDICATOR_OUTER_PX` — δηλαδή **διαβάζει** πόσο
 * πιάνει ο δείκτης αντί να το ξαναμετρήσει. Αν αύριο παχύνει η ζώνη γραμμάτων, το ⊕ βγαίνει
 * μαζί της χωρίς να το θυμηθεί κανείς.
 */
function tableInsertControlOffsetPx(mode: TableInsertControlMode): {
  readonly top: number;
  readonly left: number;
} {
  const clearance = TABLE_INSERT_CONTROL_CLEARANCE_PX + TABLE_INSERT_CONTROL_RADIUS_PX;
  if (mode === 'selection') return { top: clearance, left: clearance };
  return {
    top: TABLE_INDICATOR_OUTER_PX.top + clearance,
    left: TABLE_INDICATOR_OUTER_PX.left + clearance,
  };
}

/**
 * 🔴 **ΤΟ HIT-TEST**: ποιο ⊕ οφείλεται σε αυτό το σημείο· `null` παντού αλλού.
 *
 * ## Η σειρά: πρώτα οι στήλες, μετά οι γραμμές
 * Οι δύο λωρίδες τέμνονται **μόνο** στο τετράγωνο πάνω-αριστερά, έξω από τις δύο ακμές. Εκεί
 * καμία από τις δύο απαντήσεις δεν είναι πιο σωστή — αλλά μία πρέπει να είναι **σταθερή**,
 * αλλιώς το ⊕ θα ταλαντωνόταν ανάμεσα σε «στήλη» και «γραμμή» με αριθμητικό σφάλμα. Νικούν οι
 * στήλες, για τον ίδιο λόγο που το `tableRangeInsertBoundaryAtFrame` σπάει την ισοπαλία υπέρ
 * του οριζόντιου συνόρου: μία ρητή απάντηση αντί για δύο εξίσου σωστές.
 *
 * ## Το LOD δεν ξαναγράφεται
 * Το **ίδιο** κατώφλι με τον δείκτη ({@link isTableIndicatorVisible}). Ένα ⊕ πάνω από μια
 * κουκκίδα θα ήταν πλατύτερο από τον πίνακα που υπόσχεται να μεγαλώσει — και, χειρότερα,
 * πατήσιμο εκεί που δεν φαίνεται τίποτα.
 */
export function tableInsertControlAtFrame(
  layout: TableLayout,
  frame: TableFramePoint,
  pxPerMm: number,
  mode: TableInsertControlMode,
): TableInsertControlHit | null {
  if (!(pxPerMm > 0) || !Number.isFinite(pxPerMm)) return null;
  if (!isTableIndicatorVisible(layout.widthMm, layout.heightMm, pxPerMm)) return null;
  if (layout.columns.length === 0 || layout.rows.length === 0) return null;

  const offset = tableInsertControlOffsetPx(mode);
  const column = axisControlAt(
    tableColumnBoundaryView(layout),
    frame.u,
    frame.v,
    layout.widthMm,
    -offset.top / pxPerMm,
    pxPerMm,
  );
  if (column) return toHit('column', column);

  const row = axisControlAt(
    tableRowBoundaryView(layout),
    frame.v,
    frame.u,
    layout.heightMm,
    -offset.left / pxPerMm,
    pxPerMm,
  );
  return row ? toHit('row', row) : null;
}

/** Ό,τι βρήκε η σάρωση ενός άξονα, πριν μάθει ποιος άξονας ήταν. */
interface AxisControl {
  readonly line: number;
  readonly phase: TableInsertControlPhase;
  /** Κατά μήκος του άξονα των συνόρων — δηλαδή η θέση του ίδιου του συνόρου. */
  readonly alongMm: number;
  /** Κάθετα — η σταθερή απόσταση του κέντρου έξω από το πλέγμα. */
  readonly acrossMm: number;
}

/**
 * Η **μία** γεωμετρία «είμαι πάνω σε ⊕;», σε αδιάφορο άξονα.
 *
 * `along` = η συντεταγμένη κατά μήκος του άξονα των συνόρων (διαλέγει **ποιο** σύνορο)·
 * `across` = η κάθετη, που περιορίζεται στη λωρίδα (διαλέγει **αν** υπάρχει χειριστήριο).
 * Δύο αντίγραφα, ένα ανά άξονα, θα ήταν sibling clone με δύο ανοχές που αποκλίνουν σιωπηλά —
 * ακριβώς το σχήμα που ο N.18 απαγορεύει και που το `axisEdgeAtFrame` απέφυγε ήδη μία φορά.
 */
function axisControlAt(
  view: TableAxisBoundaryView,
  alongMm: number,
  acrossMm: number,
  spanMm: number,
  centerAcrossMm: number,
  pxPerMm: number,
): AxisControl | null {
  const radiusMm = TABLE_INSERT_CONTROL_RADIUS_PX / pxPerMm;
  const nearbyMm = TABLE_INSERT_CONTROL_NEARBY_PX / pxPerMm;

  // Κάθετα: μέσα στη λωρίδα του χειριστηρίου; Η λωρίδα είναι κεντραρισμένη στον δίσκο, οπότε
  // ένα χέρι που ανεβαίνει από το πλέγμα προς τα έξω συναντά πρώτα τη λωρίδα και μετά τον δίσκο.
  if (Math.abs(acrossMm - centerAcrossMm) > nearbyMm) return null;
  // Κατά μήκος: **μέσα** στον πίνακα, με ανοχή μιας ακτίνας στα δύο άκρα — αλλιώς το ⊕ της
  // πρώτης και της τελευταίας θέσης θα ήταν μισοπιασμένο ακριβώς εκεί που το σύνορο ταυτίζεται
  // με την ακμή του πίνακα.
  if (alongMm < -radiusMm || alongMm > spanMm + radiusMm) return null;

  const nearest = nearestTableAxisBoundary(view, alongMm);
  const withinDisc =
    Math.abs(alongMm - nearest.atMm) <= radiusMm && Math.abs(acrossMm - centerAcrossMm) <= radiusMm;

  return {
    line: nearest.line,
    phase: withinDisc ? 'armed' : 'nearby',
    alongMm: tableAxisBoundaryMm(view, nearest.line),
    acrossMm: centerAcrossMm,
  };
}

/** Ο ένας τόπος όπου το «αδιάφορος άξονας» ξαναγίνεται `u`/`v` — μία αντιστροφή, όχι δύο. */
function toHit(axis: 'column' | 'row', found: AxisControl): TableInsertControlHit {
  const centerMm: TableFramePoint =
    axis === 'column'
      ? { u: found.alongMm, v: found.acrossMm }
      : { u: found.acrossMm, v: found.alongMm };
  return {
    target: { axis, line: found.line },
    phase: found.phase,
    centerMm,
    boundaryMm: found.alongMm,
  };
}

/** Ίδιο χειριστήριο; Σύγκριση **κατά ταυτότητα**, για τον φύλακα του καρέ στο store. */
export function sameTableInsertControl(
  a: TableInsertControlHit | null,
  b: TableInsertControlHit | null,
): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.target.axis === b.target.axis && a.target.line === b.target.line && a.phase === b.phase
  );
}
