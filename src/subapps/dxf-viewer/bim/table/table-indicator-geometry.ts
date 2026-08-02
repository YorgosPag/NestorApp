/**
 * ADR-739 Φ.Δ βήμα 9 — **ΠΟΥ βρίσκεται η ζώνη δείκτη**, σε sheet-mm του πλαισίου του πίνακα.
 *
 * Ο δείκτης (γράμματα στηλών πάνω, αριθμοί γραμμών αριστερά — η `TABLEINDICATOR` του
 * AutoCAD) απαντούσε μέχρι τώρα σε **δύο** ερωτήσεις σε ένα αρχείο:
 *
 *   - «πώς λέγεται η τρίτη στήλη;» → `table-cell-reference.ts` (ονομασία, ήδη SSoT)
 *   - «πού ακριβώς κάθεται το κουτί της;» → **μέσα** στον ζωγράφο `stamp-table-indicator.ts`
 *
 * Η δεύτερη έπρεπε να βγει, τη στιγμή που απέκτησε **δεύτερο** καταναλωτή: το κλικ. Δεν
 * είναι θέμα γραμμών (είναι λίγες) — είναι ότι δύο αντίγραφα της ίδιας αριθμητικής
 * αποκλίνουν με τον χειρότερο τρόπο που υπάρχει σε διεπαφή:
 *
 *  1. **Το LOD.** Ο ζωγράφος σταματά κάτω από {@link MIN_TABLE_SCREEN_PX}. Ένα hit-test που
 *     δεν ξέρει το κατώφλι θα έπιανε ζώνη **που δεν φαίνεται** — δηλαδή δεξί κλικ στο κενό
 *     θα άνοιγε μενού στήλης.
 *  2. **Το πάχος.** `columnBandPx / pxPerMm`: αν ο ένας ρωτούσε σε px και ο άλλος σε mm, το
 *     κουτί που πατάς δεν θα ήταν το κουτί που βλέπεις — και η διαφορά μεγαλώνει με το zoom.
 *
 * Το CHECK 3.28 (jscpd, N.18) θα το έπιανε ως sibling clone ούτως ή άλλως. Καλύτερα να μην
 * γεννηθεί: **μία** απάντηση, δύο καταναλωτές (ζωγράφος + hit-test).
 *
 * ## Το σύστημα συντεταγμένων — γιατί οι ζώνες ζουν σε ΑΡΝΗΤΙΚΑ mm
 * Η αρχή `(0,0)` είναι η πάνω-αριστερή γωνία του **πλέγματος**, `+v` προς τα κάτω. Οι ζώνες
 * είναι **έξω** από το πλέγμα, άρα (με το κενό του {@link TABLE_INDICATOR_GRIP_CLEARANCE_PX}):
 *
 *     v ∈ [-(gap + columnBandMm), -gap)  →  η πάνω ζώνη (γράμματα)
 *     u ∈ [-(gap + rowBandMm), -gap)     →  η αριστερή ζώνη (αριθμοί)
 *
 * Αυτός είναι και ο λόγος που το `tableCellAtFrame` δεν τις έβλεπε ποτέ: ελέγχει μόνο
 * `u, v ≥ 0`. Δεν ήταν παράλειψη — ένα κελί **είναι** μη αρνητικό.
 *
 * ## 🔴 ADR-739 §27.11 — ΤΟ ΚΕΝΟ: η ζώνη ΔΕΝ επιτρέπεται να ακουμπά τις λαβές
 * Οι λαβές του πίνακα κάθονται **ακριβώς** πάνω στην ακμή `v = 0` (`table-entity-grips`:
 * MOVE στην άγκυρα, ROTATION στο μέσο της πάνω ακμής, μία ανά **εσωτερικό όριο στήλης**).
 * Με τη ζώνη κολλητά στο `v = 0`, το μισό κάθε λαβής ζωγραφιζόταν **μέσα** στη ζώνη και —
 * χειρότερα — το ίδιο pixel απαντούσε σε **δύο** ερωτήσεις: «ποια στήλη επιλέγεται;» και
 * «ποια λαβή πιάνεται;». Ο χρήστης στόχευε τη λαβή πλάτους στήλης και έπαιρνε επιλογή
 * ολόκληρης στήλης — ή και τα δύο μαζί, αφού ο ακροατής του ποντικιού είναι **παθητικός**
 * (δεν καταναλώνει το συμβάν· δες `use-table-cell-pointer`).
 *
 * Το κενό **δεν** είναι αισθητική επιλογή και **δεν** είναι «2-3 px που φαίνονται καλά»:
 * είναι η **οπή σύλληψης της λαβής**. Γι' αυτό η τιμή του δεν γράφεται εδώ — **διαβάζεται**
 * από το {@link TOLERANCE_CONFIG}. Αν αύριο μεγαλώσει η οπή, το κενό μεγαλώνει μαζί της
 * χωρίς να το θυμηθεί κανείς.
 *
 * @module subapps/dxf-viewer/bim/table/table-indicator-geometry
 * @see bim/table/table-cell-reference.ts — ΠΩΣ λέγεται η κάθε υποδιαίρεση (ονομασία SSoT)
 * @see bim/table/table-entity-grips.ts — ΠΟΥ κάθονται οι λαβές που πρέπει να μείνουν ελεύθερες
 * @see rendering/entities/table/stamp-table-indicator.ts — ο ζωγράφος που καταναλώνει αυτά εδώ
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §27.3, §27.11
 */

import { TABLE_INDICATOR } from '../../config/color-config';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import type { TableColumnId, TableRowId } from '../../types/table';
import type { TableFramePoint } from '../../types/table-entity';
import type { TableIndicatorTick } from './table-cell-reference';
import type { TableLayout, TableRectMm } from './table-layout-types';

/**
 * Κάτω από αυτό το μέγεθος του **πίνακα** στην οθόνη, ο δείκτης δεν υπάρχει καθόλου — ούτε
 * ζωγραφίζεται, ούτε πιάνεται.
 *
 * Οι ζώνες έχουν σταθερό πάχος σε px· σε έντονο zoom-out θα ήταν **πλατύτερες από τον ίδιο
 * τον πίνακα**, δηλαδή ένα γκρίζο πλαίσιο γύρω από μια κουκκίδα. Ίδια λογική LOD με το
 * `MIN_CELL_TEXT_SCREEN_PX` του κειμένου κελιού.
 */
export const MIN_TABLE_SCREEN_PX = 48;

/**
 * Το **κενό** ανάμεσα στην ακμή του πλέγματος και την εσωτερική ακμή της ζώνης, σε px οθόνης.
 *
 * Δεν είναι διάκοσμος: είναι **ακριβώς** η οπή σύλληψης λαβής, ώστε η ζώνη να αρχίζει εκεί
 * που η λαβή σταματά να πιάνεται. Δες την κεφαλίδα (§27.11) για το γιατί.
 *
 * ⚠️ **Ειλικρινές όριο, μετρημένο**: ο ζωντανός δρόμος (`useUnifiedGripInteraction`) ανοίγει
 * την οπή σε `max(gripSize × dpiScale + 2, GRIP_CONFIG.HIT_TOLERANCE)` — με τις προεπιλογές
 * (`GRIP_SIZE_DEFAULT = 7`, `dpi = 1`) βγαίνει **9 px**, δηλαδή **1 px** παραπάνω από το
 * δηλωμένο δάπεδο των `8`. Αυτό το 1 px το κρατά η **λαβή**, όχι η ζώνη — κι έτσι το θέλουμε:
 * σε αμφισβήτηση νικά η λαβή, γιατί η επιλογή στήλης έχει **δεύτερο** δρόμο (κλικ στο γράμμα,
 * 18 px πιο πάνω) ενώ η λαβή δεν έχει κανέναν. Αν κάποιος ανεβάσει το `gripSize` στις
 * ρυθμίσεις, η επικάλυψη μεγαλώνει αναλογικά — **δεν** θεραπεύεται από σταθερά· θέλει η οπή
 * να γίνει συνάρτηση SSoT που θα καταναλώνουν και οι δύο. Καταγεγραμμένο, όχι σιωπηλό.
 */
export const TABLE_INDICATOR_GRIP_CLEARANCE_PX = TOLERANCE_CONFIG.GRIP_APERTURE;

/**
 * 🔴 ADR-739 §27.13 — **ΠΟΣΟ ΤΟΠΟ ΠΙΑΝΕΙ Ο ΔΕΙΚΤΗΣ ΕΞΩ ΑΠΟ ΤΟ ΠΛΕΓΜΑ**, σε px οθόνης.
 *
 * Κενό **συν** ζώνη, ανά άξονα. Υπάρχει επειδή ο δείκτης απέκτησε **τρίτο** καταναλωτή που
 * δεν είναι ούτε ζωγράφος ούτε hit-test: η **γραμμή τύπων**, που πρέπει να καθίσει από πάνω
 * του χωρίς να τον ακουμπήσει.
 *
 * ⚠️ **Γεννήθηκε από πραγματικό σφάλμα, την ίδια μέρα (§27.11 → §27.13).** Η γραμμή τύπων
 * υπολόγιζε μόνη της `TABLE_INDICATOR.columnBandPx + …`. Τη στιγμή που η ζώνη απέκτησε κενό,
 * η γραμμή έμεινε στην παλιά της θέση και **σκέπασε τα γράμματα** — και κανένα test δεν το
 * είδε, γιατί έλεγχε «είναι πιο ψηλά από τη ζώνη;» με **γνήσια** ανισότητα, που παρέμενε
 * αληθής. Η αναζήτηση διπλοτύπων του §27.11 δεν το βρήκε επειδή έψαξε τα ονόματα σε `…Mm`
 * ενώ αυτό εδώ μιλά σε `…Px`: **δύο λεξιλόγια της ίδιας ποσότητας**.
 *
 * Κανόνας από εδώ και πέρα: **κανείς έξω από αυτό το module δεν προσθέτει ζώνη + κενό**.
 */
export const TABLE_INDICATOR_OUTER_PX = {
  /** Από την πάνω ακμή του πλέγματος ως την πάνω ακμή της ζώνης γραμμάτων. */
  top: TABLE_INDICATOR_GRIP_CLEARANCE_PX + TABLE_INDICATOR.columnBandPx,
  /** Από την αριστερή ακμή του πλέγματος ως την αριστερή ακμή της ζώνης αριθμών. */
  left: TABLE_INDICATOR_GRIP_CLEARANCE_PX + TABLE_INDICATOR.rowBandPx,
} as const;

/** Το πάχος των δύο ζωνών σε **sheet-mm**, στην τρέχουσα κλίμακα οθόνης. */
export interface TableIndicatorBandsMm {
  /** Ύψος της πάνω ζώνης (γράμματα). */
  readonly columnBandMm: number;
  /** Πλάτος της αριστερής ζώνης (αριθμοί) — πλατύτερη: χωρά τετραψήφια. */
  readonly rowBandMm: number;
  /** Το κενό ως προς την ακμή του πλέγματος — δες {@link TABLE_INDICATOR_GRIP_CLEARANCE_PX}. */
  readonly gapMm: number;
}

/**
 * Η **εξωτερική** ακμή της πάνω ζώνης (πιο αρνητικό `v`). Μία έκφραση, τρεις καταναλωτές:
 * το ορθογώνιο στήλης, το ορθογώνιο γωνίας και το hit-test.
 */
function columnBandTopMm(bands: TableIndicatorBandsMm): number {
  return -(bands.gapMm + bands.columnBandMm);
}

/** Η **εξωτερική** ακμή της αριστερής ζώνης (πιο αρνητικό `u`) — συμμετρικά. */
function rowBandLeftMm(bands: TableIndicatorBandsMm): number {
  return -(bands.gapMm + bands.rowBandMm);
}

/**
 * Η **μία** μετατροπή px→mm του δείκτη. Τα μεγέθη ζουν σε px οθόνης επίτηδες
 * ({@link TABLE_INDICATOR}): είναι στοιχείο διεπαφής, όχι γεωμετρία σχεδίου — μια ζώνη σε mm
 * χαρτιού θα γινόταν αδιάβαστη σε zoom-out και τεράστια σε zoom-in.
 */
export function tableIndicatorBandsMm(pxPerMm: number): TableIndicatorBandsMm {
  return {
    columnBandMm: TABLE_INDICATOR.columnBandPx / pxPerMm,
    rowBandMm: TABLE_INDICATOR.rowBandPx / pxPerMm,
    gapMm: TABLE_INDICATOR_GRIP_CLEARANCE_PX / pxPerMm,
  };
}

/** Φαίνεται ο δείκτης σε αυτό το μέγεθος; Η **μία** έκφραση του LOD — δες την κεφαλίδα. */
export function isTableIndicatorVisible(
  widthMm: number,
  heightMm: number,
  pxPerMm: number,
): boolean {
  return widthMm * pxPerMm >= MIN_TABLE_SCREEN_PX && heightMm * pxPerMm >= MIN_TABLE_SCREEN_PX;
}

/** Το ορθογώνιο μιας υποδιαίρεσης της **πάνω** ζώνης (γράμμα στήλης). */
export function tableColumnTickRectMm(
  tick: TableIndicatorTick,
  bands: TableIndicatorBandsMm,
): TableRectMm {
  return { x: tick.startMm, y: columnBandTopMm(bands), w: tick.sizeMm, h: bands.columnBandMm };
}

/** Το ορθογώνιο μιας υποδιαίρεσης της **αριστερής** ζώνης (αριθμός γραμμής). */
export function tableRowTickRectMm(
  tick: TableIndicatorTick,
  bands: TableIndicatorBandsMm,
): TableRectMm {
  return { x: rowBandLeftMm(bands), y: tick.startMm, w: bands.rowBandMm, h: tick.sizeMm };
}

/**
 * Το κενό τετράγωνο πάνω-αριστερά που **ενώνει** τις δύο ζώνες.
 *
 * Χωρίς αυτό φαίνεται μια τρύπα ακριβώς εκεί που το μάτι περιμένει τη γωνία του πλέγματος.
 * Το Excel βάζει εκεί το γκρίζο τρίγωνο «επιλογή όλων»· εδώ μένει **κενό** και το hit-test
 * επιστρέφει ρητά `null` γι' αυτό — δεν υπάρχει τέτοια εντολή, άρα δεν υπάρχει τέτοιο κλικ.
 */
export function tableIndicatorCornerRectMm(bands: TableIndicatorBandsMm): TableRectMm {
  return {
    x: rowBandLeftMm(bands),
    y: columnBandTopMm(bands),
    w: bands.rowBandMm,
    h: bands.columnBandMm,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Hit-test
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Ποια υποδιαίρεση ζώνης χτυπήθηκε. Κουβαλά **και** ταυτότητα **και** δείκτη θέσης επειδή
 * οι δύο καταναλωτές ρωτούν διαφορετικά: η επιλογή/διαγραφή θέλει ταυτότητα (σταθερή σε
 * αναδιατάξεις), η **εισαγωγή** θέλει θέση («πριν από ποια;»).
 */
export type TableIndicatorHit =
  | { readonly axis: 'column'; readonly colId: TableColumnId; readonly index: number }
  | { readonly axis: 'row'; readonly rowId: TableRowId; readonly index: number };

/**
 * Το σημείο πλαισίου → υποδιαίρεση ζώνης· `null` παντού αλλού (μέσα στο πλέγμα, στη γωνία,
 * ή εντελώς έξω).
 *
 * Γραμμική σάρωση, ίδια επιλογή με το `tableCellAtFrame`: τρέχει **μία φορά ανά κλικ**, όχι
 * ανά καρέ, και ένας πίνακας έχει δεκάδες στήλες. Η δυαδική αναζήτηση του ζωγράφου υπάρχει
 * επειδή εκείνος τρέχει ανά καρέ πάνω σε 500 γραμμές — άλλη ερώτηση, άλλη απάντηση.
 */
export function tableIndicatorHitAtFrame(
  layout: TableLayout,
  frame: TableFramePoint,
  bands: TableIndicatorBandsMm,
): TableIndicatorHit | null {
  const { u, v } = frame;

  // Πάνω ζώνη: πάνω από το πλέγμα, αλλά **μέσα** στο πλάτος του. Το `u` πρέπει να είναι
  // μη αρνητικό — αλλιώς είμαστε στη γωνία, που δεν είναι εντολή.
  //
  // 🔴 §27.11 — το εσωτερικό όριο είναι **γνήσια** ανισότητα (`v < -gapMm`, όχι `≤`): η
  // λωρίδα του κενού ανήκει στις **λαβές** και η οπή τους είναι κλειστός δίσκος
  // (`distance <= tolerance`). Με `≤` και στα δύο, το ένα pixel της ακμής θα απαντούσε
  // «ναι» σε αμφότερα — ακριβώς το σφάλμα που το κενό ήρθε να σβήσει.
  if (v < -bands.gapMm && v >= columnBandTopMm(bands) && u >= 0 && u <= layout.widthMm) {
    for (let i = 0; i < layout.columns.length; i++) {
      const column = layout.columns[i];
      if (u >= column.xMm && u <= column.xMm + column.widthMm) {
        return { axis: 'column', colId: column.id, index: i };
      }
    }
    return null;
  }

  // Αριστερή ζώνη, συμμετρικά — ίδιο κενό, ίδια γνήσια ανισότητα.
  if (u < -bands.gapMm && u >= rowBandLeftMm(bands) && v >= 0 && v <= layout.heightMm) {
    for (let i = 0; i < layout.rows.length; i++) {
      const row = layout.rows[i];
      if (v >= row.yMm && v <= row.yMm + row.heightMm) {
        return { axis: 'row', rowId: row.id, index: i };
      }
    }
    return null;
  }

  return null;
}
