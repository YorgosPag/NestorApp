/**
 * 🔴 ADR-833 §5.7 — **ΣΤΥΛ ΠΕΡΙΓΡΑΜΜΑΤΟΣ ΤΟΥ EXCEL → ΜΟΛΥΒΙ**: η αντίστροφη του
 * `export/table-border-to-xlsx.ts`.
 *
 * ## 🔑 ΚΑΝΕΝΑΣ ΑΡΙΘΜΟΣ ΚΑΙ ΚΑΝΕΝΑ ΜΟΤΙΒΟ ΔΕΝ ΕΠΙΝΟΕΙΤΑΙ ΕΔΩ
 * Ο πειρασμός ήταν να γραφτεί ένας πίνακας τύπου *«dashed ⇒ `[2, -1]` mm»*. Θα ήταν **δεύτερο
 * λεξιλόγιο διακεκομμένων**, ασύνδετο με τα ISO μοτίβα που ζωγραφίζει ο καμβάς — δηλαδή ένα
 * εισαγόμενο περίγραμμα θα έμοιαζε **διαφορετικό** από το ταυτόσημο περίγραμμα που φτιάχνει το
 * ίδιο μας το widget. Αντ' αυτού κάθε τιμή διαβάζεται από τις υπάρχουσες αρχές:
 *
 * ```
 *   στυλ Excel  →  ταυτότητα του καταλόγου (τα ΙΔΙΑ 14 του listbox, ADR-750 Φ5)
 *                     ├── pen.widthMm        ← η κλίμακα ISO 128-20
 *                     ├── pen.linetypeName   → resolveLinetypePatternMm  (ο SSoT ονόματος→μοτίβου)
 *                     └── pen.double         → tableBorderDoubleGapMm    (η ΜΙΑ αναλογία)
 * ```
 *
 * ## ⚠️ Τα δύο σημεία που το Excel ΔΕΝ έχει αντίστοιχο, δηλωμένα
 * - **`hair` (συνεχής τρίχα)**: ο κατάλογος έχει τρίχα μόνο ως *διάστικτη* (θέση 2 του
 *   listbox). Συντίθεται: **πάχος** από την τρίχα, **μοτίβο** συνεχές. Η μόνη σύνθεση.
 * - **`slantDashDot`**: λοξή παύλα-τελεία — αποκλειστικότητα του Excel, χωρίς ISO αντίστοιχο.
 *   Πέφτει στην **ίδια οικογένεια** (παύλα-τελεία), γιατί η οικογένεια είναι το σήμα· η κλίση
 *   είναι διακόσμηση. Δηλωμένο, όχι σιωπηλό.
 *
 * ## Χρώμα που δεν δηλώθηκε ⇒ `'auto'`, ΟΧΙ μαύρο
 * Το Excel γράφει χρώμα περιγράμματος μόνο όταν ο χρήστης το άλλαξε. Ένα σκληρό `#000000`
 * θα **κάρφωνε** μαύρο σε κάθε εισαγόμενη ακμή και θα ακύρωνε για πάντα το «Από το στυλ»
 * (Α20). Το `AUTOMATIC_TABLE_INK` είναι η υπάρχουσα, σωστή απάντηση στο «δεν είπε κανείς».
 *
 * @module subapps/dxf-viewer/bim/table/import/xlsx-border-to-spec
 * @see bim/table/export/table-border-to-xlsx.ts — η άλλη κατεύθυνση
 * @see bim/table/table-border-style-catalog.ts — οι 14 θέσεις του listbox του Excel
 */

import type ExcelJS from 'exceljs';
import type { TableBorderSpec } from '../../../types/table-edges';
import { resolveLinetypePatternMm } from '../../../rendering/linetype-dash-resolver';
import { AUTOMATIC_TABLE_INK } from '../table-ink';
import { tableBorderDoubleGapMm } from '../table-border-pencil';
import { tableBorderStylePreset, type TableBorderStyleId } from '../table-border-style-catalog';

/** Το συνεχές μοτίβο — ονομασμένο, γιατί «κενό» και «άγνωστο» δεν είναι το ίδιο. */
const CONTINUOUS_LINETYPE = 'Continuous';

/**
 * Ποια θέση του καταλόγου δανείζει τι, ανά στυλ του OOXML.
 *
 * `pen` = η ταυτότητα που δίνει **και** πάχος **και** μοτίβο. `weightFrom`/`linetype` = η μία
 * περίπτωση όπου χρειάζεται σύνθεση (δες την κεφαλίδα).
 */
const BY_EXCEL_STYLE: Readonly<
  Record<string, { readonly pen: TableBorderStyleId; readonly linetype?: string }>
> = {
  hair: { pen: 'hairlineDotted', linetype: CONTINUOUS_LINETYPE },
  thin: { pen: 'thinSolid' },
  medium: { pen: 'mediumSolid' },
  thick: { pen: 'thickSolid' },
  double: { pen: 'double' },
  dotted: { pen: 'hairlineDotted' },
  dashed: { pen: 'thinDashed' },
  mediumDashed: { pen: 'mediumDashed' },
  dashDot: { pen: 'thinDashDot' },
  mediumDashDot: { pen: 'mediumDashDot' },
  dashDotDot: { pen: 'thinDashDotDot' },
  mediumDashDotDot: { pen: 'mediumDashDotDot' },
  // Λοξή παύλα-τελεία: αποκλειστικότητα του Excel — ίδια οικογένεια, χωρίς την κλίση.
  slantDashDot: { pen: 'thinDashDot' },
};

/** `AARRGGBB` του OOXML → `#RRGGBB`· απών ⇒ «από το στυλ». */
function hexFromArgb(argb: string | undefined): string {
  if (argb === undefined || argb.length < 6) return AUTOMATIC_TABLE_INK;
  return `#${argb.slice(-6).toUpperCase()}`;
}

/**
 * Μία πλευρά περιγράμματος του Excel → **μολύβι του πίνακα**, ή `undefined` όταν το Excel δεν
 * δηλώνει καμία γραμμή εκεί.
 *
 * 🔑 `undefined` σημαίνει «**κληρονόμησε**», όχι «καμία γραμμή» — ίδια σύμβαση με το
 * `TableEdgeIndex`, όπου η απουσία στέλνει την ερώτηση στα επίπεδα 2-4. Ένα ρητό
 * `visible: false` εδώ θα **έσβηνε** το πλέγμα του στυλ σε κάθε κελί που το Excel απλώς δεν
 * σχολίασε, δηλαδή θα εισήγαγε κάθε φύλλο **χωρίς πλέγμα**.
 */
export function tableBorderFromXlsx(border: Partial<ExcelJS.Border> | undefined): TableBorderSpec | undefined {
  if (border?.style === undefined) return undefined;
  const entry = BY_EXCEL_STYLE[border.style];
  if (entry === undefined) return undefined;

  const pen = tableBorderStylePreset(entry.pen)?.pen;
  if (pen === undefined) return undefined;

  const dashMm = resolveLinetypePatternMm(entry.linetype ?? pen.linetypeName);
  return {
    visible: true,
    colorHex: hexFromArgb(border.color?.argb),
    widthMm: pen.widthMm,
    ...(dashMm.length > 0 ? { dashMm: [...dashMm] } : {}),
    ...(pen.double === true ? { doubleGapMm: tableBorderDoubleGapMm(pen.widthMm) } : {}),
  };
}
