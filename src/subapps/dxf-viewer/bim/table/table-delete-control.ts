/**
 * 🔴 ADR-739 §42 — **ΤΟ ⊖ ΤΗΣ ΔΙΑΓΡΑΦΗΣ**: πού κάθεται, ποιο **στοιχείο** εκφράζει, και πότε
 * πατιέται. Καθαρή γεωμετρία — μηδέν DOM, μηδέν store, μηδέν React.
 *
 * ## 🔴 ΤΟ ⊕ ΔΕΙΧΝΕΙ **ΣΥΝΟΡΟ**, ΤΟ ⊖ ΔΕΙΧΝΕΙ **ΣΤΟΙΧΕΙΟ** — και γι' αυτό δεν κάθονται μαζί
 * Ο ιδιοκτήτης ζήτησε αρχικά ένα δεύτερο σηματάκι **δίπλα** στο ⊕ (04/08), και μαζί δύο
 * βοηθητικά βελάκια «αριστερά/δεξιά» ώστε να ξέρει ο χρήστης **ποια** στήλη φεύγει. Η ανάγκη
 * για τα βελάκια ήταν η ίδια η απόδειξη ότι η θέση ήταν λάθος:
 *
 * | | τι δείχνει | πλήθος για `n` στήλες | αμφισημία |
 * |---|---|---|---|
 * | **⊕ εισαγωγή** | **ΣΥΝΟΡΟ** (`line`) | `n + 1` | **καμία** — το σύνορο *είναι* η θέση |
 * | **⊖ διαγραφή** | **ΣΤΟΙΧΕΙΟ** | `n` | **δομική** σε σύνορο: δύο γείτονες |
 *
 * Η έρευνα (04/08) βρήκε **ομόφωνη** πρακτική: κανείς δεν βάζει διαγραφή σε σύνορο. Το Word
 * δεν έχει καθόλου ⊖ (ribbon / δεξί κλικ)· το Google Docs βάζει το `+` πάνω στη **στήλη**·
 * το Sheets βγάζει chevron στο **γράμμα**· το Notion `⋮⋮` πάνω στη στήλη· το AutoCAD
 * contextual ribbon στο επιλεγμένο κελί. Άρα το ⊖ πάει **πάνω στο στοιχείο που θα φύγει**,
 * και τα βελάκια **παύουν να χρειάζονται**: η αμφισημία δεν γεννιέται ποτέ.
 *
 * ## 🔴 ΓΙΑΤΙ ΜΕΣΑ ΣΤΗ ΖΩΝΗ — τρία εμπόδια, μία θέση που τα λύνει και τα τρία
 *
 *  1. **WCAG 2.2 SC 2.5.8.** Ο δίσκος είναι 14 px < 24, άρα ισχύει **μόνο** το σκέλος
 *     απόστασης: δύο υπομεγέθεις στόχοι θέλουν **κέντρα ≥ 24 px**. Δύο δίσκοι σε επαφή δίνουν
 *     **14** ⇒ αποτυχία κατά 10 px. Το ⊖ **δεν** είναι δίπλα στο ⊕: εκείνο ζει **έξω** από τη
 *     ζώνη ({@link TABLE_INDICATOR_OUTER_PX} + κενό + ακτίνα), αυτό **μέσα** της.
 *  2. **Καταστροφή.** Το ⊖ κάθεται πάνω στο **ίδιο το στοιχείο** που φεύγει, και ο άξονας
 *     βάφεται κόκκινος όσο είναι οπλισμένο. Η απώλεια γίνεται **ορατή πριν** το κλικ — γι'
 *     αυτό δεν προστίθεται διάλογος (πρβλ. ADR-755, όπου ο διάλογος υπάρχει ακριβώς επειδή η
 *     συγχώνευση **δεν μπορεί** να δείξει τι θα χαθεί).
 *  3. **Χώρος.** Ο χώρος έξω από το πλέγμα είναι ήδη κατειλημμένος δύο φορές (§40.2) και το
 *     §27.13 έχει ήδη συμβεί **δύο φορές**. Η ζώνη **υπάρχει ήδη** ⇒ το
 *     `tableInsertControlOuterPx()` δεν μεγαλώνει ούτε κατά ένα pixel, και η γραμμή τύπων
 *     **δεν κουνιέται**.
 *
 * ## 🔴 ΤΟ ⊖ ΕΙΝΑΙ ΥΠΟΤΕΛΕΣ ΣΤΟ HIT-TEST ΤΗΣ ΖΩΝΗΣ — και αυτό σβήνει ολόκληρη μια κλάση
 * Δεν ρωτά «είμαι μέσα στη λωρίδα;» μόνο του: **καλεί** το {@link tableIndicatorHitAtFrame}.
 * Εκείνο παραιτείται ήδη πάνω στα **διαχωριστικά** (§31.9), όπου ζει η λαβή πλάτους. Ο δίσκος
 * ακουμπά τη ζώνη ανοχής του διαχωριστικού με την **εξωτερική** του ακμή· επειδή όμως η
 * ερώτηση περνά από εκεί, στα pixel του διαχωριστικού **δεν υπάρχει καν υποδιαίρεση**, άρα
 * ούτε ⊖. Ένα ανεξάρτητο hit-test θα γεννούσε λωρίδα όπου ο δείκτης υπόσχεται σύρσιμο και το
 * πάτημα σβήνει στήλη. *Ένα pixel, μία ερώτηση* — η αρχή του §27.11, δωρεάν.
 *
 * @module subapps/dxf-viewer/bim/table/table-delete-control
 * @see bim/table/table-indicator-geometry.ts — ΠΟΙΑ υποδιαίρεση (η ερώτηση που καταναλώνει)
 * @see bim/table/table-insert-control.ts — ο αδελφός του συνόρου (και η ΜΙΑ ακτίνα δίσκου)
 * @see bim/table/table-axis-action-target.ts — ΠΟΙΟΥΣ άξονες αφορά τελικά η πράξη (§27.17)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §42
 */

import {
  TABLE_INDICATOR_GRIP_CLEARANCE_PX,
  tableIndicatorHitAtFrame,
  type TableIndicatorBandsMm,
  type TableIndicatorHit,
} from './table-indicator-geometry';
// 🔴 §42 — **Η ΜΙΑ ΑΚΤΙΝΑ ΧΕΙΡΙΣΤΗΡΙΟΥ ΤΟΥ ΕΡΓΟΥ.** Το όνομα λέει «insert» επειδή εκεί
// γεννήθηκε· η ποσότητα είναι του **ΧΕΙΡΙΣΤΗΡΙΟΥ**, όχι της πράξης. Ένας δεύτερος αριθμός εδώ
// θα σήμαινε δύο δίσκους που μοιάζουν ίδιοι μέχρι τη μέρα που κάποιος αλλάξει τον έναν.
import { TABLE_INSERT_CONTROL_RADIUS_PX } from './table-insert-control';
import type { TableFramePoint } from '../../types/table-entity';
import type { TableLayout, TableRectMm } from './table-layout-types';

/** Φαίνεται, ή φαίνεται **και** δρα; Ίδιος κανόνας με το ⊕: *φαίνεται νωρίς, δρα ακριβώς*. */
export type TableDeleteControlPhase = 'nearby' | 'armed';

/**
 * Η **απόσταση του δίσκου από το τέλος** της υποδιαίρεσης, σε px οθόνης.
 *
 * Δεν γράφεται νέος αριθμός: είναι **η οπή σύλληψης λαβής**
 * ({@link TABLE_INDICATOR_GRIP_CLEARANCE_PX}), δηλαδή ο δίσκος σταματά ακριβώς εκεί που το
 * διαχωριστικό αρχίζει να πιάνεται. Ίδιο επιχείρημα, ίδια λέξη προς λέξη, με το
 * `TABLE_INSERT_CONTROL_CLEARANCE_PX` του αδελφού module — και εδώ έχει **δεύτερο** κέρδος:
 * κρατά τον δίσκο έξω από τη λωρίδα όπου νικά η λαβή πλάτους.
 */
const TABLE_DELETE_CONTROL_INSET_PX = TABLE_INDICATOR_GRIP_CLEARANCE_PX;

/** Ίδιος δίσκος με το ⊕ — δες το σχόλιο της εισαγωγής για το γιατί δεν είναι δεύτερος αριθμός. */
export const TABLE_DELETE_CONTROL_RADIUS_PX = TABLE_INSERT_CONTROL_RADIUS_PX;

/**
 * **Ποια διαγραφή** υπόσχεται αυτό το ⊖ — και η απάντηση είναι η **ίδια** που δίνει ήδη η ζώνη
 * στο δεξί κλικ ({@link TableIndicatorHit}: άξονας + ταυτότητα + θέση).
 *
 * 🔑 Κανένας νέος τύπος στόχου. Αν το ⊖ κουβαλούσε δικό του `{axis, index}`, θα υπήρχαν **δύο**
 * λεξιλόγια για «ποια στήλη εννοεί ο χρήστης» — και το §27.17 κατέγραψε ήδη τι κοστίζει αυτό:
 * η οθόνη έδειχνε τρεις στήλες φωτισμένες και η διαγραφή έσβηνε **μία**.
 */
export interface TableDeleteControlHit {
  /** Η υποδιαίρεση κάτω από το χέρι — το ΙΔΙΟ σχήμα που δέχεται το `resolveTableAxisActionTarget`. */
  readonly hit: TableIndicatorHit;
  readonly phase: TableDeleteControlPhase;
  /**
   * Το **κέντρο του δίσκου** σε sheet-mm του πλαισίου. Ταξιδεύει μαζί ώστε ο ζωγράφος να μην
   * ξαναλύσει τη γεωμετρία: η ερώτηση απαντήθηκε ήδη τη στιγμή του `mousemove`, και μια
   * δεύτερη απάντηση ανά καρέ θα ήταν δεύτερη ευκαιρία να αποκλίνει από την πρώτη.
   */
  readonly centerMm: TableFramePoint;
}

/**
 * 🔴 **ΤΟ ΚΑΤΩΦΛΙ ΠΟΥ ΚΡΑΤΑ ΤΟ ⊖ ΑΠΟ ΤΟ ΝΑ ΣΚΕΠΑΣΕΙ ΤΟ ΓΡΑΜΜΑ**, σε sheet-mm.
 *
 * Το γράμμα/αριθμός είναι κεντραρισμένο στην υποδιαίρεση και ο δίσκος κάθεται στο **τέλος**
 * της. Για να μην ακουμπηθούν:
 *
 *     μισό πλάτος ≥ κενό + διάμετρος + μισή ετικέτα
 *     ⇒ πλάτος ≥ 2 · (inset + 2·radius + ετικέτα/2)
 *
 * Η **ετικέτα** δεν μετριέται εδώ (καθαρή γεωμετρία, μηδέν context καμβά): φράσσεται από το
 * **πάχος της ζώνης**, που είναι η ήδη υπάρχουσα δήλωση του έργου για «πόσο τόπο θέλει μια
 * ετικέτα άξονα» — το `rowBandPx` είναι ρητά διαστασιολογημένο ώστε να **χωρά τετραψήφια**.
 *
 * ⚠️ Είναι **συντηρητικό για τις στήλες** (τα γράμματα είναι στενότερα από τετραψήφιο αριθμό)
 * και αυτό είναι η **σωστή κατεύθυνση**: σε αμφισβήτηση κρύβουμε το ⊖ αντί να σκεπάσουμε την
 * ταυτότητα της στήλης ακριβώς τη στιγμή που ο χρήστης πάει να τη σβήσει. Ίδια στάση με το
 * «σε αμφισβήτηση νικά η λαβή» του §27.16 Ε4. Χαμένος δρόμος δεν υπάρχει: το δεξί κλικ στη
 * ζώνη δουλεύει ούτως ή άλλως.
 */
export function tableDeleteControlMinTickMm(bandMm: number, pxPerMm: number): number {
  const insetMm = TABLE_DELETE_CONTROL_INSET_PX / pxPerMm;
  const radiusMm = TABLE_DELETE_CONTROL_RADIUS_PX / pxPerMm;
  return 2 * (insetMm + 2 * radiusMm + bandMm / 2);
}

/**
 * 🔴 **ΤΟ HIT-TEST**: ποιο ⊖ οφείλεται σε αυτό το σημείο· `null` παντού αλλού.
 *
 * Δεν υπάρχει «σειρά αξόνων» να λυθεί όπως στο ⊕ (§40): η ερώτηση **είναι** το
 * {@link tableIndicatorHitAtFrame}, που έχει ήδη αποφασίσει πάνω ζώνη ⇒ αριστερή ζώνη ⇒
 * τίποτα, και η γωνία επιστρέφει ήδη ρητά `null` (δεν υπάρχει τέτοια εντολή).
 *
 * ## Ο έλεγχος του δίσκου είναι **κυκλικός**, όχι κουτί — και η διαφορά με το ⊕ είναι σκόπιμη
 * Το ⊕ ελέγχει τετράγωνο γιατί γύρω του υπάρχει **κενό**: μια γενναιοδωρία στις γωνίες δεν
 * κλέβει τίποτα από κανέναν. Εδώ ο δίσκος έχει **νόμιμους γείτονες μέσα στο ίδιο κουτί** — το
 * γράμμα και η επιλογή ολόκληρου του άξονα. Ένα τετράγωνο θα διεκδικούσε ~3 px στις γωνίες
 * όπου ο χρήστης στοχεύει **επιλογή στήλης**, δηλαδή θα άλλαζε το πάτημα σε διαγραφή.
 */
export function tableDeleteControlAtFrame(
  layout: TableLayout,
  frame: TableFramePoint,
  bands: TableIndicatorBandsMm,
  pxPerMm: number,
): TableDeleteControlHit | null {
  if (!(pxPerMm > 0) || !Number.isFinite(pxPerMm)) return null;

  // 🔴 Η υποτέλεια της κεφαλίδας: το LOD, το κενό, τα διαχωριστικά και η γωνία απαντιούνται
  // **εκεί**, μία φορά, για όλους. Εδώ δεν ξαναρωτιέται τίποτα από αυτά.
  const hit = tableIndicatorHitAtFrame(layout, frame, bands);
  if (!hit) return null;

  const span = tickSpanMm(layout, hit);
  if (!span) return null;

  const bandMm = hit.axis === 'column' ? bands.columnBandMm : bands.rowBandMm;
  if (span.sizeMm < tableDeleteControlMinTickMm(bandMm, pxPerMm)) return null;

  const insetMm = TABLE_DELETE_CONTROL_INSET_PX / pxPerMm;
  const radiusMm = TABLE_DELETE_CONTROL_RADIUS_PX / pxPerMm;
  // Κατά μήκος: στο **τέλος** της υποδιαίρεσης (δεξιά για στήλες, κάτω για γραμμές) — η θέση
  // του chevron του Google Sheets, και για τον ίδιο λόγο: αφήνει την ετικέτα πατήσιμη για
  // επιλογή άξονα αντί να καταπιεί ολόκληρο το κουτί.
  const alongMm = span.startMm + span.sizeMm - insetMm - radiusMm;
  // Κάθετα: στο **μέσο** της ζώνης. Ο δίσκος (14 px) μέσα σε ζώνη 28 px αφήνει 7 px πάνω και
  // κάτω, άρα δεν ακουμπά ούτε το περίγραμμα της ζώνης ούτε τη λωρίδα του κενού (όπου ζουν οι
  // λαβές, §27.11).
  const acrossMm = -(bands.gapMm + bandMm / 2);

  const along = hit.axis === 'column' ? frame.u : frame.v;
  const across = hit.axis === 'column' ? frame.v : frame.u;
  const armed = Math.hypot(along - alongMm, across - acrossMm) <= radiusMm;

  return {
    hit,
    phase: armed ? 'armed' : 'nearby',
    centerMm: hit.axis === 'column' ? { u: alongMm, v: acrossMm } : { u: acrossMm, v: alongMm },
  };
}

/** Η αρχή και το μέγεθος της υποδιαίρεσης, σε αδιάφορο άξονα· `null` σε μπαγιάτικο δείκτη. */
function tickSpanMm(
  layout: TableLayout,
  hit: TableIndicatorHit,
): { readonly startMm: number; readonly sizeMm: number } | null {
  if (hit.axis === 'column') {
    const column = layout.columns[hit.index];
    return column ? { startMm: column.xMm, sizeMm: column.widthMm } : null;
  }
  const row = layout.rows[hit.index];
  return row ? { startMm: row.yMm, sizeMm: row.heightMm } : null;
}

/**
 * 🔴 **ΤΟ ΟΡΘΟΓΩΝΙΟ ΠΟΥ ΘΑ ΦΥΓΕΙ** — ζώνη **και** πλέγμα, από τον πρώτο ως τον τελευταίο άξονα
 * του στόχου· `null` σε μπαγιάτικους δείκτες.
 *
 * Δέχεται **διάστημα** και όχι έναν άξονα, επειδή η πράξη δέχεται διάστημα (§27.17): με τρεις
 * στήλες μαρκαρισμένες, το ⊖ σβήνει **τρεις** — άρα η προεπισκόπηση οφείλει να βάψει τρεις.
 * Ένα ορθογώνιο ενός άξονα θα ξαναγεννούσε ακριβώς το ελάττωμα που το §27.17 έκλεισε, αυτή τη
 * φορά στη **ζωγραφική** αντί στην πράξη: η οθόνη θα υποσχόταν μία και θα έφευγαν τρεις.
 *
 * Καλύπτει **και** τη λωρίδα του κενού ανάμεσα σε ζώνη και πλέγμα: το κενό ανήκει οπτικά στον
 * άξονα, και μια προεπισκόπηση με τρύπα στη μέση διαβάζεται ως δύο διαφορετικά πράγματα.
 */
export function tableDeleteSpanRectMm(
  layout: TableLayout,
  axis: 'column' | 'row',
  firstIndex: number,
  lastIndex: number,
  bands: TableIndicatorBandsMm,
): TableRectMm | null {
  if (axis === 'column') {
    const first = layout.columns[firstIndex];
    const last = layout.columns[lastIndex];
    if (!first || !last) return null;
    return {
      x: first.xMm,
      y: -(bands.gapMm + bands.columnBandMm),
      w: last.xMm + last.widthMm - first.xMm,
      h: bands.gapMm + bands.columnBandMm + layout.heightMm,
    };
  }
  const first = layout.rows[firstIndex];
  const last = layout.rows[lastIndex];
  if (!first || !last) return null;
  return {
    x: -(bands.gapMm + bands.rowBandMm),
    y: first.yMm,
    w: bands.gapMm + bands.rowBandMm + layout.widthMm,
    h: last.yMm + last.heightMm - first.yMm,
  };
}

/** Ίδιο χειριστήριο; Σύγκριση **κατά ταυτότητα**, για τον φύλακα του καρέ στο store. */
export function sameTableDeleteControl(
  a: TableDeleteControlHit | null,
  b: TableDeleteControlHit | null,
): boolean {
  if (a === null || b === null) return a === b;
  if (a.phase !== b.phase || a.hit.axis !== b.hit.axis) return false;
  return a.hit.axis === 'column' && b.hit.axis === 'column'
    ? a.hit.colId === b.hit.colId
    : a.hit.axis === 'row' && b.hit.axis === 'row' && a.hit.rowId === b.hit.rowId;
}
