/**
 * 🔴 ADR-739 §42 — **Ο ΖΩΓΡΑΦΟΣ ΤΟΥ ⊖**: ο δίσκος μέσα στη ζώνη, και — μόνο όταν το
 * χειριστήριο είναι οπλισμένο — το κόκκινο πλύσιμο πάνω σε **ό,τι θα φύγει**.
 *
 * Ζωγραφίζεται στο ίδιο overlay pass με τον δρομέα και τις ζώνες, **ποτέ** μέσα στο cached
 * raster της σκηνής (ADR-040 κανόνας #3): αλλιώς κάθε κίνηση ποντικιού πάνω από τη ζώνη θα
 * ακύρωνε ολόκληρο το bitmap.
 *
 * ## 🔴 ΤΟ ΠΛΥΣΙΜΟ ΕΙΝΑΙ Η ΑΠΑΝΤΗΣΗ ΣΤΟ «ΠΟΙΑ ΘΑ ΦΥΓΕΙ;» — και αντικαθιστά τα βελάκια
 * Ο ιδιοκτήτης ζήτησε αρχικά δύο βοηθητικά σηματάκια (Α)/(Δ) και (Π)/(Κ) ώστε να ξέρει ποια
 * στήλη/γραμμή αφαιρείται. Με το ⊖ πάνω στο **στοιχείο** (§42) η ερώτηση δεν γεννιέται· και
 * με το πλύσιμο απαντιέται **ρητά και ολόκληρη**, σε πλάτος ολόκληρου του άξονα αντί για δύο
 * γλυφές 10 px. Το ζητούμενο ήταν η γνώση, όχι τα βελάκια.
 *
 * ⚠️ **Το ορθογώνιο έρχεται έτοιμο** και δεν υπολογίζεται εδώ: καλύπτει **όλους** τους άξονες
 * του στόχου (§27.17 — με τρεις στήλες μαρκαρισμένες φεύγουν τρεις), και η γνώση «ποιοι
 * ακριβώς» ζει στο store που την απάντησε τη στιγμή του `mousemove`. Ένας δεύτερος υπολογισμός
 * εδώ θα ήταν δεύτερη ευκαιρία να βάψει άλλους άξονες από αυτούς που θα σβήσει το πάτημα.
 *
 * ## Γιατί πολύγωνο και όχι `fillRect`
 * Ο πίνακας **περιστρέφεται** (λαβή `table-rotation`). Ένα `fillRect` σε px οθόνης θα έμενε
 * ίσιο μέσα σε γερμένο πλαίσιο, δηλαδή θα έβαφε κελιά που δεν ανήκουν στον άξονα — και θα
 * άφηνε άβαφα κελιά που ανήκουν. Οι τέσσερις γωνίες προβάλλονται μία προς μία, ίδιος κανόνας
 * με κάθε άλλο σχήμα του πίνακα που κουβαλά κατεύθυνση.
 *
 * @module subapps/dxf-viewer/rendering/entities/table/stamp-table-delete-control
 * @see bim/table/table-delete-control.ts — ΠΟΥ κάθεται και ΤΙ υπόσχεται (η γεωμετρία)
 * @see rendering/entities/table/stamp-table-control-disc.ts — ο ΕΝΑΣ δίσκος (κοινός με το ⊕)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §42
 */

import {
  TABLE_DELETE_CONTROL_RADIUS_PX,
  type TableDeleteControlHit,
} from '../../../bim/table/table-delete-control';
import { TABLE_DELETE_CONTROL } from '../../../config/color-config';
import { stampTableControlDisc } from './stamp-table-control-disc';
import type { TableRectMm } from '../../../bim/table/table-layout-types';
import type { StampTableContext } from './stamp-table-layout';

/**
 * Ζωγραφίζει το χειριστήριο διαγραφής.
 *
 * Η σειρά είναι **πλύσιμο → δίσκος**: το πλύσιμο είναι φόντο και ο δίσκος κάθεται πάνω του.
 * Ανάποδα, η ημιδιαφανής κόκκινη επιφάνεια θα περνούσε πάνω από τον δίσκο και θα ξέπλενε
 * ακριβώς το χειριστήριο που ο χρήστης στοχεύει.
 */
export function stampTableDeleteControl(
  rc: StampTableContext,
  control: TableDeleteControlHit,
  spanRectMm: TableRectMm | null,
): void {
  if (control.phase === 'armed' && spanRectMm) stampDeleteWash(rc, spanRectMm);
  stampDeleteDisc(rc, control);
}

/** Η προεπισκόπηση της απώλειας: ό,τι θα σβηστεί, βαμμένο — ζώνη, κενό και πλέγμα μαζί. */
function stampDeleteWash(rc: StampTableContext, rectMm: TableRectMm): void {
  const { ctx } = rc;
  const { x, y, w, h } = rectMm;
  const corners = [
    rc.toScreen(x, y),
    rc.toScreen(x + w, y),
    rc.toScreen(x + w, y + h),
    rc.toScreen(x, y + h),
  ];

  ctx.save();
  ctx.fillStyle = TABLE_DELETE_CONTROL.washRgba;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Ο δίσκος με το `−` — τα χρώματα βγαίνουν από τη **φάση**, όχι από τον καλούντα.
 *
 * ⚠️ Το **περίγραμμα δεν αλλάζει με τη φάση**, σε αντίθεση με το ⊕ (που περνά σε λευκό όταν
 * οπλίζεται). Είναι μετρημένη απόφαση, όχι παράλειψη: ο δίσκος εδώ κάθεται μέσα στη ζώνη, της
 * οποίας η **ενεργή** κατάσταση είναι μπλε — και το κόκκινο έχει σχεδόν ίδια φωτεινότητα με
 * εκείνο το μπλε (1,26:1). Το σκούρο περίγραμμα είναι το μόνο που κρατά σχήμα και στις δύο
 * καταστάσεις ζώνης· δες την κεφαλίδα του `TABLE_DELETE_CONTROL` για τους μετρημένους λόγους.
 */
function stampDeleteDisc(rc: StampTableContext, control: TableDeleteControlHit): void {
  const armed = control.phase === 'armed';
  stampTableControlDisc(rc, control.centerMm, TABLE_DELETE_CONTROL_RADIUS_PX, 'minus', {
    fillHex: armed ? TABLE_DELETE_CONTROL.armedFillHex : TABLE_DELETE_CONTROL.fillHex,
    lineHex: TABLE_DELETE_CONTROL.lineHex,
    glyphHex: armed ? TABLE_DELETE_CONTROL.armedGlyphHex : TABLE_DELETE_CONTROL.glyphHex,
    lineWidthPx: TABLE_DELETE_CONTROL.lineWidthPx,
    glyphWidthPx: TABLE_DELETE_CONTROL.glyphWidthPx,
  });
}
