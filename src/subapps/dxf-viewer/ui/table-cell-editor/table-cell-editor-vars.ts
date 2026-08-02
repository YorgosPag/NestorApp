/**
 * ADR-739 Φ.Δ βήμα 3 — **το συμβόλαιο ανάμεσα στο ζωντανό κουτί και το `<input>`**.
 *
 * Το `TextEditorAnchorLayer` ενημερώνει το κουτί **επιτακτικά** σε κάθε tick (ADR-040:
 * μηδέν re-render σε pan/zoom). Το παιδί όμως — το πεδίο κειμένου — πρέπει να μάθει
 * γραμματοσειρά, γεμίσεις και χρώματα που αλλάζουν στο **ίδιο** tick. Ο δρόμος είναι CSS
 * custom properties: ο γονιός τις γράφει, το παιδί τις καταναλώνει με `var()`.
 *
 * 🔴 Τα ονόματα ζουν **εδώ και μόνο εδώ**. Ένα αλφαριθμητικό `--tce-font` γραμμένο στο ένα
 * αρχείο και διαβασμένο στο άλλο είναι διπλότυπο που **κανένας** μεταγλωττιστής δεν
 * ελέγχει: μια ορθογραφική διαφορά δεν σπάει το build — απλώς αφήνει το πεδίο με τη
 * γραμματοσειρά του λειτουργικού, δηλαδή ξαναφέρνει ακριβώς το ελάττωμα που διορθώνουμε.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-cell-editor-vars
 */

import type React from 'react';
import { TABLE_CELL_CURSOR } from '../../config/color-config';
import { hexToRgba } from '../../config/color-math';
import type { TableCellEditorFrame } from './table-cell-editor-frame';

/** Τα ονόματα των custom properties — ο ΕΝΑΣ ορισμός τους. */
export const TABLE_CELL_EDITOR_VARS = {
  font: '--tce-font',
  lineHeight: '--tce-line-height',
  padTop: '--tce-pad-top',
  padRight: '--tce-pad-right',
  padBottom: '--tce-pad-bottom',
  padLeft: '--tce-pad-left',
  color: '--tce-color',
  background: '--tce-bg',
  textAlign: '--tce-text-align',
  /**
   * ADR-739 Φ.Ε — υπογράμμιση. Ταξιδεύει **χωριστά** από το {@link font} επειδή το CSS
   * shorthand `font` δεν περιλαμβάνει το `text-decoration` — δεν είναι επιλογή μας.
   */
  decoration: '--tce-decoration',
  /** ADR-739 Φ.Δ βήμα 6 — πλάτος/ύψος της **ζώνης εκτύπωσης** μέσα στο επεκτεταμένο κουτί. */
  printWidth: '--tce-print-w',
  printHeight: '--tce-print-h',
  /** Το πέπλο πάνω σε ό,τι **δεν** θα τυπωθεί. `transparent` όταν δεν κόβεται τίποτα. */
  shade: '--tce-shade',
  /** Η κατακόρυφη γραμμή στο σημείο κοπής — δηλαδή η δεξιά ακμή του κελιού. */
  marker: '--tce-marker',
  /** Το περίγραμμα του επεκτεταμένου κουτιού. Μηδενικό πάχος όταν δεν είναι επεκτεταμένο. */
  outline: '--tce-outline',
  outlineWidth: '--tce-outline-width',
} as const;

/**
 * Πόσο βαρύ είναι το πέπλο πάνω στο μη-εκτυπώσιμο τμήμα.
 *
 * Χαμηλό επίτηδες: το κείμενο **από κάτω πρέπει να διαβάζεται** — ο χρήστης το διορθώνει
 * αυτή τη στιγμή. Το πέπλο απαντά «αυτό δεν θα τυπωθεί», δεν κρύβει.
 */
const SHADE_ALPHA = 0.1;

/** Διαφανές = «καμία ένδειξη»: ο ίδιος στατικός κανόνας ζωγραφίζει τότε το τίποτα. */
const NO_PAINT = 'transparent';

/**
 * Το κουτί ως τιμές custom properties — ό,τι γράφει ο γονιός σε κάθε tick.
 *
 * 🔴 Οι **ενδείξεις** (πέπλο, γραμμή κοπής, περίγραμμα) ταξιδεύουν από τον ίδιο δρόμο και όχι
 * ως className: αλλάζουν στο **ίδιο tick** με το μέγεθος (ένα zoom-out μπορεί να κάνει το
 * κείμενο να χωρέσει, άρα να σβήσει η ένδειξη) και ο ADR-040 απαγορεύει re-render εκεί. Το
 * «σβηστό» εκφράζεται ως `transparent`/μηδενικό πάχος, ώστε ο κανόνας CSS να μένει **ένας**
 * και σταθερός — καμία εναλλαγή κλάσης, καμία δεύτερη διαδρομή απόδοσης.
 */
export function tableCellEditorCssVars(frame: TableCellEditorFrame): Record<string, string> {
  const V = TABLE_CELL_EDITOR_VARS;
  const printable = frame.printablePx;
  return {
    [V.font]: frame.font,
    [V.lineHeight]: `${frame.lineHeightPx}px`,
    [V.padTop]: `${frame.paddingTopPx}px`,
    [V.padRight]: `${frame.paddingRightPx}px`,
    [V.padBottom]: `${frame.paddingBottomPx}px`,
    [V.padLeft]: `${frame.paddingLeftPx}px`,
    [V.color]: frame.colorHex,
    [V.background]: frame.backgroundHex,
    [V.textAlign]: frame.textAlign,
    // `'none'` και όχι απουσία κλειδιού: ίδια αρχή με το πέπλο και τον δείκτη — ένας
    // σταθερός κανόνας CSS, καμία εναλλαγή κλάσης, καμία δεύτερη διαδρομή απόδοσης.
    [V.decoration]: frame.underline ? 'underline' : 'none',
    [V.printWidth]: `${printable?.widthPx ?? 0}px`,
    [V.printHeight]: `${printable?.heightPx ?? 0}px`,
    // Το πέπλο είναι το **μελάνι** του κελιού αραιωμένο, όχι τρίτο χρώμα: έτσι δουλεύει σωστά
    // και σε σκούρο και σε ανοιχτό γέμισμα, χωρίς κανένα ερώτημα θέματος.
    [V.shade]: printable ? hexToRgba(frame.colorHex, SHADE_ALPHA) : NO_PAINT,
    // Ίδιο λεξιλόγιο δείκτη με τον δρομέα κελιού του καμβά — κανένα τέταρτο χρώμα
    // (δες `stampTableCellCursor`: «συμπαγές = εδώ πάει το πλήκτρο»).
    [V.marker]: printable ? TABLE_CELL_CURSOR.colorHex : NO_PAINT,
    [V.outline]: frame.expanded ? TABLE_CELL_CURSOR.colorHex : NO_PAINT,
    [V.outlineWidth]: frame.expanded ? `${EXPANDED_OUTLINE_PX}px` : '0px',
  };
}

/**
 * Πάχος περιγράμματος του επεκτεταμένου κουτιού, σε px οθόνης.
 *
 * ⚠️ Μπαίνει ως `outline` και **ποτέ** ως `border`: το `border` είναι μέρος του box model
 * και θα έτρωγε 1 px από το content box, μετακινώντας κάθε γράμμα — δηλαδή θα χαλούσε την
 * ακρίβεια pixel που ολόκληρο το βήμα 3 υπάρχει για να πετύχει. Το `outline` δεν συμμετέχει
 * στη διάταξη.
 */
const EXPANDED_OUTLINE_PX = 1;

/**
 * Το style του `<input>` — **σταθερό αντικείμενο**, καμία τιμή μέσα του δεν αλλάζει ποτέ.
 *
 * Αυτό είναι το κέρδος: το πεδίο κειμένου δεν ξαναποδίδεται ΠΟΤΕ λόγω zoom. Οι τιμές
 * ζουν στις custom properties του γονιού και ενημερώνονται επιτακτικά.
 *
 * ⚠️ Η **σειρά** `font` → `lineHeight` είναι σημασιολογική, όχι αισθητική: το shorthand
 * `font` **μηδενίζει** το `line-height` σε `normal`. Αν το `lineHeight` έμπαινε πρώτο θα
 * σβηνόταν, και μαζί του η εγγύηση «κουτί γραμμής = content box» πάνω στην οποία στηρίζεται
 * ολόκληρος ο υπολογισμός της γραμμής βάσης (δες `table-cell-editor-frame.ts`).
 */
export const TABLE_CELL_EDITOR_INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  height: '100%',
  font: `var(${TABLE_CELL_EDITOR_VARS.font}, inherit)`,
  lineHeight: `var(${TABLE_CELL_EDITOR_VARS.lineHeight}, normal)`,
  paddingTop: `var(${TABLE_CELL_EDITOR_VARS.padTop}, 0)`,
  paddingRight: `var(${TABLE_CELL_EDITOR_VARS.padRight}, 0)`,
  paddingBottom: `var(${TABLE_CELL_EDITOR_VARS.padBottom}, 0)`,
  paddingLeft: `var(${TABLE_CELL_EDITOR_VARS.padLeft}, 0)`,
  textAlign: `var(${TABLE_CELL_EDITOR_VARS.textAlign}, left)` as React.CSSProperties['textAlign'],
  textDecoration: `var(${TABLE_CELL_EDITOR_VARS.decoration}, none)`,
  // ── ADR-739 Φ.Δ βήμα 6 — το `<textarea>` πρέπει να συμπεριφέρεται σαν κελί, όχι σαν φόρμα ──
  // Χειροκίνητη αλλαγή μεγέθους: **όχι** — το μέγεθος είναι παράγωγο του κειμένου και της
  // κλίμακας· μια λαβή στη γωνία θα υποσχόταν κάτι που το επόμενο tick θα ακύρωνε.
  resize: 'none',
  // Κρυφή υπερχείλιση **χωρίς** μπάρα κύλισης: το κουτί υπολογίζεται ώστε να χωρά όλες τις
  // γραμμές (και υπολογίζεται **συντηρητικά** — δες `WRAP_SAFETY_PX`). Μια μπάρα εδώ θα ήταν
  // ομολογία ότι ο υπολογισμός απέτυχε, και θα έκλεβε πλάτος από το κείμενο.
  overflow: 'hidden',
  // Η αναδίπλωση που **μιμείται** ο υπολογισμός γραμμών: σπάσιμο σε κενά, και μέσα σε λέξη
  // μόνο όταν η λέξη δεν χωρά μόνη της. Δηλώνεται ρητά ώστε να μην εξαρτάται από το UA
  // stylesheet — αν το πρόγραμμα περιήγησης άλλαζε γνώμη, το ύψος θα έβγαινε λάθος.
  whiteSpace: 'pre-wrap',
  overflowWrap: 'break-word',
  outlineStyle: 'solid',
  outlineOffset: 0,
  outlineWidth: `var(${TABLE_CELL_EDITOR_VARS.outlineWidth}, 0px)`,
  outlineColor: `var(${TABLE_CELL_EDITOR_VARS.outline}, transparent)`,
};

/**
 * Ό,τι φαίνεται **μόνο** σε κατάσταση γραφής: μελάνι + αδιαφανές φόντο του κελιού + οι δύο
 * ενδείξεις του βήματος 6 (**τι θα τυπωθεί**).
 *
 * ## Οι τρεις στρώσεις, από πάνω προς τα κάτω
 *  1. **η γραμμή κοπής** — μία κατακόρυφη γραμμή στο `print-w`, ύψους **ενός κελιού**: δηλαδή
 *     ακριβώς η δεξιά ακμή του κελιού, εκεί που το βήμα 5 θα βάλει «…»·
 *  2. **το πέπλο κάτω** — ό,τι πέρασε σε δεύτερη γραμμή· περιορισμένο στο `print-w`, ώστε να
 *     μην πέσει δεύτερη φορά πάνω στο (3) και σκουρύνει διπλά τη γωνία·
 *  3. **το πέπλο δεξιά** — ό,τι ξεπέρασε το κελί οριζόντια, σε όλο το ύψος.
 *
 * Οι (2) και (3) εφάπτονται και δεν επικαλύπτονται **εξ ορισμού**: το (2) σταματά όπου
 * αρχίζει το (3).
 */
export const TABLE_CELL_EDITOR_WRITING_STYLE: React.CSSProperties = {
  color: `var(${TABLE_CELL_EDITOR_VARS.color}, inherit)`,
  backgroundColor: `var(${TABLE_CELL_EDITOR_VARS.background}, transparent)`,
  caretColor: `var(${TABLE_CELL_EDITOR_VARS.color}, inherit)`,
  backgroundImage: [
    clipMarkerLayer(),
    shadeLayer('to bottom', TABLE_CELL_EDITOR_VARS.printHeight),
    shadeLayer('to right', TABLE_CELL_EDITOR_VARS.printWidth),
  ].join(', '),
  backgroundSize: [
    `100% var(${TABLE_CELL_EDITOR_VARS.printHeight}, 0px)`,
    `var(${TABLE_CELL_EDITOR_VARS.printWidth}, 0px) 100%`,
    '100% 100%',
  ].join(', '),
  backgroundRepeat: 'no-repeat',
  // Το κείμενο ζωγραφίζεται **πάνω** από τις στρώσεις — το πέπλο τις σκιάζει, δεν τις σβήνει.
  backgroundOrigin: 'border-box',
};

/** Ένα πέπλο που ξεκινά ακριβώς στο όριο της ζώνης εκτύπωσης — μηδενικό πλάτος μετάβασης. */
function shadeLayer(direction: string, edgeVar: string): string {
  const edge = `var(${edgeVar}, 0px)`;
  return `linear-gradient(${direction}, transparent ${edge}, var(${TABLE_CELL_EDITOR_VARS.shade}, transparent) ${edge})`;
}

/** Η γραμμή κοπής: `EXPANDED_OUTLINE_PX` πλάτος, ακριβώς πριν το όριο της ζώνης. */
function clipMarkerLayer(): string {
  const edge = `var(${TABLE_CELL_EDITOR_VARS.printWidth}, 0px)`;
  const start = `calc(${edge} - ${EXPANDED_OUTLINE_PX}px)`;
  const color = `var(${TABLE_CELL_EDITOR_VARS.marker}, transparent)`;
  return `linear-gradient(to right, transparent ${start}, ${color} ${start}, ${color} ${edge}, transparent ${edge})`;
}
