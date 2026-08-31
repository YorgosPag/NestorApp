/**
 * 🔴 ADR-833 §5.7 — **ΜΟΛΥΒΙ → ΣΤΥΛ ΠΕΡΙΓΡΑΜΜΑΤΟΣ ΤΟΥ EXCEL**: `TableBorderSpec` → `ExcelJS.Border`.
 *
 * ## 🔑 Η αντιστοίχιση ΔΕΝ επινοήθηκε — υπήρχε ήδη, μετρημένη από ελληνικό Excel
 * Το `table-border-style-catalog.ts` είναι **ρητά** ο καθρέφτης του listbox περιγραμμάτων του
 * Excel: *«Οι 14 θέσεις, στη σειρά του Excel … Μετρημένες από στιγμιότυπο ελληνικού Excel
 * (2026-08-04), όχι επινοημένες»*. Άρα ο πίνακας μετάφρασης δεν είναι δική μας εικασία: είναι οι
 * **ίδιες** 14 θέσεις, διαβασμένες αντίστροφα.
 *
 * ```
 *   Excel:  none | dotted | dashed | dashDot | dashDotDot | solid          × {hair,thin,medium,thick}
 *   εμείς:  visible=false | dashMm (σύμβαση DXF) | widthMm (κλίμακα ISO 128-20)
 * ```
 *
 * ## Γιατί η οικογένεια διαβάζεται από το **μοτίβο**, όχι από το όνομα του linetype
 * Ένα `TableBorderSpec` είναι **λυμένο μολύβι**: κουβαλά `dashMm` (θετικό = παύλα, αρνητικό =
 * κενό, `0` = στιγμή — η σύμβαση του `LinetypeDef.pattern`), όχι το όνομα από το οποίο
 * προήλθε. Και σωστά: το ίδιο μοτίβο μπορεί να έχει έρθει από τον κατάλογο, από ρητή
 * παράκαμψη ή από DXF ξένου γραφείου. Μια αντίστροφη αναζήτηση κατά **όνομα** θα απαντούσε
 * «άγνωστο» σε κάθε τρίτη προέλευση — δηλαδή θα έδινε **συνεχή** γραμμή σε διακεκομμένο
 * περίγραμμα, σιωπηλά.
 *
 * ## ⚠️ Πού το Excel ΔΕΝ φτάνει, και τι κρατάμε αντ' αυτού
 * - **Διπλή**: το Excel έχει **μία** διπλή, χωρίς απόσταση. Το `doubleGapMm` χάνεται· η
 *   *διπλότητα* διασώζεται (`'double'`).
 * - **Παχιά διακεκομμένη**: το Excel σταματά στη «μεσαία» για κάθε μοτίβο εκτός της συνεχούς.
 *   Μια παχιά παύλα πέφτει στη **μεσαία** παύλα — ποτέ σε συνεχή, γιατί η *διακεκομμένη* είναι
 *   το σήμα (τι είναι η γραμμή) και το *πάχος* η έμφαση (πόσο φωνάζει).
 * - **Χρώμα**: ταξιδεύει ακέραιο, σε κάθε περίπτωση.
 *
 * @module subapps/dxf-viewer/bim/table/export/table-border-to-xlsx
 * @see bim/table/table-border-style-catalog.ts — οι ίδιες 14 θέσεις, από την άλλη πλευρά
 * @see types/table-edges.ts — η σύμβαση προσήμου του `dashMm`
 */

import type ExcelJS from 'exceljs';
import type { TableBorderSpec } from '../../../types/table-edges';
import { hexToArgb } from './table-xlsx-color';

/**
 * Τα κατώφλια των τεσσάρων βαθμίδων, στα **μεσοδιαστήματα** της κλίμακας ISO 128-20 που
 * χρησιμοποιεί ο κατάλογος (`0,13 · 0,25 · 0,50 · 1,00`).
 *
 * Μεσοδιάστημα και όχι «ίσο με»: ένα μολύβι 0,20 mm από ξένο DXF δεν είναι καμία από τις
 * τέσσερις, αλλά είναι **πιο κοντά** στη λεπτή παρά στην τρίχα — και μια ισότητα εδώ θα το
 * έστελνε στην προεπιλογή, δηλαδή θα έκανε κάθε μη-ISO πάχος να δείχνει το ίδιο.
 */
const HAIRLINE_MAX_MM = 0.19;
const THIN_MAX_MM = 0.375;
const MEDIUM_MAX_MM = 0.75;

/** Οι τέσσερις βαθμίδες, όπως τις λέει αυτό το αρχείο. */
type Weight = 'hair' | 'thin' | 'medium' | 'thick';

/** Οι πέντε οικογένειες μοτίβου που διακρίνει το Excel. */
type DashFamily = 'solid' | 'dotted' | 'dashed' | 'dashDot' | 'dashDotDot';

function weightOf(widthMm: number): Weight {
  if (!Number.isFinite(widthMm) || widthMm <= HAIRLINE_MAX_MM) return 'hair';
  if (widthMm <= THIN_MAX_MM) return 'thin';
  if (widthMm <= MEDIUM_MAX_MM) return 'medium';
  return 'thick';
}

/**
 * Η οικογένεια μοτίβου, διαβασμένη από τα **σημάδια** του `dashMm`.
 *
 * Τα αρνητικά είναι κενά και δεν μετρούν — μετρούν μόνο τα **σημάδια που αφήνει το μολύβι**:
 * θετικό = παύλα, μηδέν = στιγμή. Δύο στιγμές ανά περίοδο είναι το `Divide` («παύλα-τελεία-
 * τελεία»), μία είναι το `DashDot` — ακριβώς η διάκριση που ο κατάλογος προειδοποιεί ότι
 * είναι η παγίδα των ονομάτων (`Divide` vs `Border`).
 */
function dashFamilyOf(dashMm: readonly number[] | undefined): DashFamily {
  if (dashMm === undefined || dashMm.length === 0) return 'solid';
  const marks = dashMm.filter((segment) => segment >= 0);
  if (marks.length === 0) return 'solid';
  const dots = marks.filter((segment) => segment === 0).length;
  const dashes = marks.length - dots;
  if (dashes === 0) return 'dotted';
  if (dots === 0) return 'dashed';
  return dots === 1 ? 'dashDot' : 'dashDotDot';
}

/**
 * Οι ονομασίες του OOXML ανά οικογένεια, στις **δύο** βαθμίδες που το Excel πράγματι έχει για
 * τα διακεκομμένα. Το `null` σημαίνει «αυτή η βαθμίδα δεν υπάρχει, πέσε στη διπλανή».
 */
const DASH_STYLE: Readonly<Record<Exclude<DashFamily, 'solid'>, Readonly<Record<'light' | 'heavy', ExcelJS.BorderStyle>>>> = {
  dotted: { light: 'dotted', heavy: 'dotted' },
  dashed: { light: 'dashed', heavy: 'mediumDashed' },
  dashDot: { light: 'dashDot', heavy: 'mediumDashDot' },
  dashDotDot: { light: 'dashDotDot', heavy: 'mediumDashDotDot' },
};

/** Η συνεχής γραμμή είναι η μόνη οικογένεια με **και τις τέσσερις** βαθμίδες. */
const SOLID_STYLE: Readonly<Record<Weight, ExcelJS.BorderStyle>> = {
  hair: 'hair',
  thin: 'thin',
  medium: 'medium',
  thick: 'thick',
};

/**
 * Ένα περίγραμμα του πίνακα, γραμμένο στη γλώσσα του Excel — ή `undefined` όταν η ακμή είναι
 * **ρητά αόρατη** (`visible: false`, DXF group code 288).
 *
 * 🔑 Το `undefined` **δεν** είναι το ίδιο με «μηδενικό πάχος»: το δεύτερο αφήνει hairline σε
 * ορισμένα backends — ρητά γραμμένο στο `types/table-edges.ts`, και ισχύει και εδώ. Ο καλών
 * που παίρνει `undefined` **παραλείπει** την πλευρά, δεν γράφει άδειο στυλ.
 */
export function xlsxBorderFor(spec: TableBorderSpec | undefined): Partial<ExcelJS.Border> | undefined {
  if (spec === undefined || !spec.visible) return undefined;
  const weight = weightOf(spec.widthMm);
  const family = dashFamilyOf(spec.dashMm);
  const style: ExcelJS.BorderStyle =
    spec.doubleGapMm !== undefined
      ? 'double'
      : family === 'solid'
        ? SOLID_STYLE[weight]
        : DASH_STYLE[family][weight === 'hair' || weight === 'thin' ? 'light' : 'heavy'];
  return { style, color: { argb: hexToArgb(spec.colorHex) } };
}
