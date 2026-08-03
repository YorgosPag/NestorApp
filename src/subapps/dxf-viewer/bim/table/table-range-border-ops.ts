/**
 * ADR-750 Φάση 2 — **οι 13 εντολές περιγράμματος του Excel ως καθαρές πράξεις**.
 *
 * Καθαρές συναρτήσεις: μηδέν React, μηδέν canvas, μηδέν UI, μηδέν i18n. Είσοδος ένα
 * `PersistedTableModel`, ένα ορθογώνιο σε δείκτες και το **τρέχον μολύβι**· έξοδος νέο
 * μοντέλο (ή το **ίδιο** by-reference, όταν τίποτα δεν αλλάζει).
 *
 * ## Δεδομένα, όχι δεκατρία σώματα
 * Οι 13 εντολές είναι **συνδυασμοί έξι πρωτόγονων πλευρών** × μολύβι. Δεκατρείς ξεχωριστές
 * συναρτήσεις θα ήταν δεκατρία αδέλφια-κλώνοι — ακριβώς ό,τι πιάνει το CHECK 3.28 (jscpd,
 * N.18) — και, χειρότερα, δεκατρία σημεία που μπορούν κάποτε να μάθουν διαφορετικό κανόνα
 * για το ίδιο ερώτημα. Εδώ υπάρχει **ένα μητρώο** ({@link TABLE_BORDER_COMMANDS}) και **ένας**
 * εφαρμοστής. Ίδιο μοτίβο με το `.ssot-registry.json` και το `jobs-registry.ts` του ADR-748.
 *
 * ## Οι έξι πλευρές δεν είναι νέο λεξιλόγιο
 * Ο τύπος {@link TableBorderSide} είναι `keyof TableBorders` — **οι ίδιες** έξι λέξεις που
 * χρησιμοποιούν ήδη οι κλάσεις γραμμής (`table-style.ts`, σημασιολογία AutoCAD). Γι' αυτό
 * ακριβώς «Όλα τα περιγράμματα» έχει νόημα: η εντολή του χρήστη μιλά τη γλώσσα του στυλ.
 *
 * ## Τι ΔΕΝ κάνει
 * Δεν ξέρει τίποτα για συγχωνεύσεις (Α16), για σειριοποίηση (το `setTableEdges` την κρύβει)
 * και για ονόματα εντολών σε οποιαδήποτε γλώσσα (Φ3). Είναι **γεωμετρία και μολύβι**.
 *
 * @module subapps/dxf-viewer/bim/table/table-range-border-ops
 * @see bim/table/table-edge-model.ts — ταυτότητα ακμής + ο μαζικός εγγραφέας
 * @see bim/table/table-axis-style-ops.ts — το ίδιο σχήμα καθαρής πράξης, σε επίπεδο άξονα
 * @see docs/centralized-systems/reference/adrs/ADR-750-table-cell-borders.md §5 (Α14–Α17) · §7 · §8.1
 */

import { createModuleLogger } from '@/lib/telemetry';
import { nearestIsoLineweight } from '../../config/lineweight-iso-catalog';
import { tableBorderDoubleGapMm } from './table-border-pencil';
import type { TableBorderSpec, TableEdgeKey, TableEdgeOrientation } from '../../types/table-edges';
import type { PersistedTableModel } from '../../types/table';
import type { CellOrderSource } from './table-cell-order';
import type { TableCellRangeBounds } from './table-cell-range';
import {
  HIDDEN_TABLE_EDGE,
  buildTableEdgeIndex,
  setTableEdges,
  tableEdgeKeyAt,
} from './table-edge-model';
import type { TableBorders } from './table-style';

const logger = createModuleLogger('TableBorderOps');

// ──────────────────────────────────────────────────────────────────────────────
// Το λεξιλόγιο
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Οι **έξι** πλευρές μιας περιοχής — παράγωγες του λεξιλογίου των κλάσεων γραμμής, ποτέ
 * δεύτερη χειρόγραφη λίστα. Την ημέρα που θα μετονομαστεί μία, ο μεταγλωττιστής θα μιλήσει
 * και εδώ· μια ανεξάρτητη ένωση `'top' | 'bottom' | …` θα έμενε πίσω σιωπηλά.
 */
export type TableBorderSide = keyof TableBorders;

/**
 * Πώς προκύπτει το μολύβι μιας πλευράς από το **τρέχον** μολύβι του χρήστη.
 *
 * Κάθε τροποποιητής αλλάζει **μόνο ό,τι ονομάζει**: το `'thick'` αλλάζει πάχος και τίποτα
 * άλλο, το `'hidden'` αντικαθιστά ολόκληρο το μολύβι με την κανονική μορφή του σβησίματος.
 * Ένας τροποποιητής που «διορθώνει» και άλλα πεδία θα ήταν κρυφός κανόνας.
 */
export type TableBorderPen = 'base' | 'thick' | 'double' | 'hidden';

/** Ένα σκέλος εντολής: ποιες πλευρές, με ποιο μολύβι. */
export interface TableBorderCommandPart {
  readonly sides: readonly TableBorderSide[];
  readonly pen: TableBorderPen;
}

/**
 * Οι ταυτότητες των 13. Αγγλικές και σταθερές: είναι **κλειδιά**, όχι ετικέτες — τα ορατά
 * ονόματα ζουν στα locale JSON (Φ3, N.11) και δεν επιτρέπεται να διαρρεύσουν εδώ.
 */
export type TableBorderCommandId =
  | 'bottom'
  | 'top'
  | 'left'
  | 'right'
  | 'none'
  | 'all'
  | 'outside'
  | 'thickOutside'
  | 'doubleBottom'
  | 'thickBottom'
  | 'topAndBottom'
  | 'topAndThickBottom'
  | 'topAndDoubleBottom';

/**
 * Η ομάδα του μενού. **Μετρημένη** από το ελληνικό Excel (στιγμιότυπο, 2026-08-03), όχι
 * επινοημένη: το dropdown έχει διαχωριστικά μετά την 4η και μετά την 8η εντολή.
 *
 * ```
 *   'side'    →  μεμονωμένη πλευρά (Κάτω / Επάνω / Αριστερό / Δεξί)
 *   'range'   →  ολόκληρη η περιοχή (Χωρίς / Όλα / Εξωτερικά / Παχιά εξωτερικά)
 *   'accent'  →  συνδυασμοί έμφασης — οι συμβάσεις γραμμής-συνόλου των λογιστικών φύλλων
 * ```
 *
 * Ζει στα **δεδομένα** και όχι στο component της Φ3 για τον ίδιο λόγο με τη σειρά: μια
 * χειρόγραφη ομαδοποίηση στο UI θα ήταν δεύτερη δήλωση της ίδιας γνώσης, που θα αποκλίνει
 * την ημέρα που θα προστεθεί 14η εντολή.
 */
export type TableBorderCommandGroup = 'side' | 'range' | 'accent';

/**
 * Μία προκαθορισμένη εντολή. **Πολλαπλά σκέλη** επειδή τρεις από τις 13 δίνουν *διαφορετικό*
 * μολύβι σε *διαφορετικές* πλευρές: «Επάνω και **πλατύ** κάτω» είναι κανονική επάνω + παχιά
 * κάτω. Ένα μοντέλο «σύνολο πλευρών + ένα μολύβι» δεν θα μπορούσε καν να τις εκφράσει, και
 * θα γεννούσε ακριβώς τις τρεις χειρόγραφες εξαιρέσεις που το μητρώο ήρθε να εξαλείψει.
 */
export interface TableBorderCommand {
  readonly id: TableBorderCommandId;
  readonly group: TableBorderCommandGroup;
  readonly parts: readonly TableBorderCommandPart[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Το μητρώο — η SSoT των 13 (και η σειρά τους στο dropdown)
// ──────────────────────────────────────────────────────────────────────────────

const PERIMETER: readonly TableBorderSide[] = ['top', 'bottom', 'left', 'right'];
const EVERY_SIDE: readonly TableBorderSide[] = [...PERIMETER, 'insideH', 'insideV'];

/**
 * Οι 13 εντολές, **στη σειρά του Excel** — η σειρά είναι μέρος των δεδομένων: το dropdown
 * της Φ3 τη διαβάζει, δεν την ξαναδηλώνει.
 *
 * ⚠️ **Α10 — «Εξωτερικά» δεν αγγίζει τις εσωτερικές.** Είναι ορατό εδώ ως *απουσία* των
 * `insideH`/`insideV` και είναι σκόπιμο (Excel parity, κλειδωμένο στο ADR): ο χρήστης που
 * θέλει πλαίσιο γύρω από πίνακα με δικό του εσωτερικό πλέγμα δεν πρέπει να το χάσει.
 */
export const TABLE_BORDER_COMMANDS: readonly TableBorderCommand[] = [
  { id: 'bottom', group: 'side', parts: [{ sides: ['bottom'], pen: 'base' }] },
  { id: 'top', group: 'side', parts: [{ sides: ['top'], pen: 'base' }] },
  { id: 'left', group: 'side', parts: [{ sides: ['left'], pen: 'base' }] },
  { id: 'right', group: 'side', parts: [{ sides: ['right'], pen: 'base' }] },
  { id: 'none', group: 'range', parts: [{ sides: EVERY_SIDE, pen: 'hidden' }] },
  { id: 'all', group: 'range', parts: [{ sides: EVERY_SIDE, pen: 'base' }] },
  { id: 'outside', group: 'range', parts: [{ sides: PERIMETER, pen: 'base' }] },
  { id: 'thickOutside', group: 'range', parts: [{ sides: PERIMETER, pen: 'thick' }] },
  { id: 'doubleBottom', group: 'accent', parts: [{ sides: ['bottom'], pen: 'double' }] },
  { id: 'thickBottom', group: 'accent', parts: [{ sides: ['bottom'], pen: 'thick' }] },
  { id: 'topAndBottom', group: 'accent', parts: [{ sides: ['top', 'bottom'], pen: 'base' }] },
  {
    id: 'topAndThickBottom',
    group: 'accent',
    parts: [
      { sides: ['top'], pen: 'base' },
      { sides: ['bottom'], pen: 'thick' },
    ],
  },
  {
    id: 'topAndDoubleBottom',
    group: 'accent',
    parts: [
      { sides: ['top'], pen: 'base' },
      { sides: ['bottom'], pen: 'double' },
    ],
  },
];

const COMMANDS_BY_ID: ReadonlyMap<TableBorderCommandId, TableBorderCommand> = new Map(
  TABLE_BORDER_COMMANDS.map((command) => [command.id, command]),
);

// ──────────────────────────────────────────────────────────────────────────────
// Οι πράξεις
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Εφαρμόζει μία από τις 13 σε μια περιοχή. Επιστρέφει το **ίδιο** μοντέλο by-reference όταν
 * δεν αλλάζει καμία τιμή — δηλαδή «ίδιο μολύβι δεύτερη φορά ⇒ κανένα βήμα undo».
 *
 * Το `pencil` είναι **παράμετρος**, ποτέ global (Α15): αυτό το αρχείο είναι καθαρές
 * συναρτήσεις, και ποιος κρατά το τρέχον μολύβι είναι απόφαση του toolbar (Φ3). Ένα store
 * εδώ θα έκανε την πράξη μη δοκιμάσιμη χωρίς στήσιμο και θα την έδενε με το React.
 *
 * Άγνωστη εντολή ⇒ το μοντέλο **αυτούσιο**, με ίχνος: κάθε ταυτότητα του τύπου
 * {@link TableBorderCommandId} υπάρχει στο μητρώο, οπότε αυτό το μονοπάτι σημαίνει σφάλμα
 * καλωδίωσης — και τα σφάλματα καλωδίωσης δεν πρέπει να είναι σιωπηλά.
 */
export function applyTableBorderCommand(
  model: PersistedTableModel,
  bounds: TableCellRangeBounds,
  commandId: TableBorderCommandId,
  pencil: TableBorderSpec,
): PersistedTableModel {
  const command = COMMANDS_BY_ID.get(commandId);
  if (!command) {
    logger.error('Άγνωστη εντολή περιγράμματος — το μοντέλο μένει αμετάβλητο', { commandId });
    return model;
  }

  const patches = new Map<TableEdgeKey, TableBorderSpec | null>();
  for (const part of command.parts) {
    const spec = resolvePen(pencil, part.pen);
    for (const side of part.sides) {
      for (const key of tableRangeSideEdges(model, bounds, side)) patches.set(key, spec);
    }
  }
  return setTableEdges(model, patches);
}

/**
 * «Επαναφορά στο στυλ» — **διαγράφει** τις ρητές ακμές της περιοχής αντί να τις σβήνει.
 *
 * 🔑 Είναι η **δεύτερη μισή** της απόφασης Α14 και δεν υπάρχει στο Excel. Το «Χωρίς
 * περίγραμμα» λέει «εδώ δεν θέλω γραμμή» (και μένει έτσι, ό,τι κι αν πει η κλάση)· αυτό εδώ
 * λέει «ξέχνα ό,τι όρισα, ισχύει το στυλ του σχεδίου». Είναι το `ByBlock` του AutoCAD και το
 * «By Category» του Revit σε κουμπί — και ο λόγος που δεν χρειάζεται να διαλέξουμε ποια από
 * τις δύο σημασίες θα δώσουμε στο ίδιο κουμπί, όπως αναγκάζεται το Excel.
 *
 * Ίδιο σχήμα με το `clearAxisStyleOverride` του `table-axis-style-ops.ts`.
 */
export function clearTableRangeBorders(
  model: PersistedTableModel,
  bounds: TableCellRangeBounds,
): PersistedTableModel {
  const patches = new Map<TableEdgeKey, TableBorderSpec | null>();
  for (const side of EVERY_SIDE) {
    for (const key of tableRangeSideEdges(model, bounds, side)) patches.set(key, null);
  }
  return setTableEdges(model, patches);
}

/**
 * Έχει η περιοχή **έστω μία** ρητή ακμή; — δηλαδή έχει νόημα η «Επαναφορά περιγραμμάτων»;
 *
 * Η ίδια ερώτηση με το `canReset` του άξονα (`resolveAxisFormatSnapshot`), στο επίπεδο της
 * ακμής: ένα κουμπί επαναφοράς που δεν έχει τι να επαναφέρει είναι ψεύτικη υπόσχεση — ο χρήστης
 * το πατά, δεν αλλάζει τίποτα, και δεν μαθαίνει ποτέ γιατί. Δηλώνεται **ανενεργό** αντί να
 * σιωπά (ADR-750 Α19).
 *
 * Σταματά στην **πρώτη** ακμή που βρίσκει: για την ερώτηση «υπάρχει;» δεν χρειάζεται πλήρης
 * διάσχιση, και μια περιοχή 20×10 έχει 430 ακμές να μετρήσει χωρίς λόγο.
 */
export function hasExplicitTableRangeBorders(
  model: PersistedTableModel,
  bounds: TableCellRangeBounds,
): boolean {
  const index = buildTableEdgeIndex(model.edges);
  if (index.size === 0) return false;

  for (const side of EVERY_SIDE) {
    for (const key of tableRangeSideEdges(model, bounds, side)) {
      if (index.has(key)) return true;
    }
  }
  return false;
}

/**
 * **Οι ακμές που καλύπτει μία πλευρά μιας περιοχής** — η γεωμετρία, χωριστά από το μολύβι.
 *
 * Ένα σώμα, δύο άξονες: ίδια αρχή με το `table-axis-style-ops.ts`. Δύο συμμετρικές
 * οικογένειες (μία για οριζόντιες, μία για κατακόρυφες) θα ήταν sibling clone — και, με τον
 * καιρό, δύο διαφορετικές απαντήσεις στο ίδιο ερώτημα.
 *
 * Το κλειδί προκύπτει **πάντα** από το `tableEdgeKeyAt`: εκείνο ξέρει πού πάει το sentinel
 * `$end`, οπότε περιοχή που ακουμπά το τέλος του πίνακα δεν χρειάζεται εδώ ούτε μία γραμμή
 * ειδικής λογικής. Θέση εκτός πλέγματος (μπαγιάτικα όρια μετά από undo) παραλείπεται — ο
 * χρήστης δεν πρέπει να χάσει τον πίνακα επειδή η επιλογή του έδειχνε σε σβησμένη γραμμή.
 *
 * ## Γιατί δημόσια και όχι ιδιωτική
 * Είναι η ερώτηση που κάνει το **proxy preview** των «Περισσότερων περιγραμμάτων» (Φ6, το
 * idiom InDesign/Revit): για να δείξει την κατάσταση κάθε πλευράς ξεχωριστά — ορισμένη,
 * μεικτή ή κληρονομημένη — πρέπει να ξέρει *ποιες* ακμές **είναι** αυτή η πλευρά. Το ίδιο
 * χρειάζεται το dropdown της Φ3 για να ανάψει το ενεργό εικονίδιο. Δεύτερη υλοποίηση εκεί θα
 * ήταν η κλασική σιωπηλή απόκλιση.
 *
 * Χάρη σε αυτήν, η αναλλοίωτη «οι έξι πλευρές είναι ανά δύο ξένες» είναι **άμεσα
 * ελέγξιμη** — μέσω των εντολών δεν είναι, γιατί μια διπλοεγγραφή στο ίδιο κλειδί απλώς
 * αντικαθιστά και δεν αφήνει κανένα ίχνος.
 */
export function tableRangeSideEdges(
  axes: CellOrderSource,
  bounds: TableCellRangeBounds,
  side: TableBorderSide,
): readonly TableEdgeKey[] {
  const orientation = tableBorderSideOrientation(side);
  const along =
    orientation === 'H'
      ? sequence(bounds.firstCol, bounds.lastCol)
      : sequence(bounds.firstRow, bounds.lastRow);

  const keys: TableEdgeKey[] = [];
  for (const cross of tableBorderSideCrossings(side, bounds)) {
    for (const at of along) {
      const key =
        orientation === 'H'
          ? tableEdgeKeyAt(axes, 'H', cross, at)
          : tableEdgeKeyAt(axes, 'V', at, cross);
      if (key !== undefined) keys.push(key);
    }
  }
  return keys;
}

// ──────────────────────────────────────────────────────────────────────────────
// Ιδιωτικά — γεωμετρία και μολύβι
// ──────────────────────────────────────────────────────────────────────────────

/**
 * ISO 128-20: κάθε ομάδα γραμμών ορίζεται ως ζεύγος **λεπτή : παχιά = 1 : 2**. Άρα η «παχιά»
 * δεν είναι πολλαπλασιαστής εικονοστοιχείων (το Excel βάζει ~3px, νούμερο χωρίς νόημα σε
 * φύλλο σχεδίου) αλλά **η επόμενη πένα της κλίμακας**.
 */
const THICK_PEN_RATIO = 2;

/**
 * Το μολύβι μιας πλευράς — **ολικό**: κάθε τροποποιητής έχει απάντηση.
 *
 * 🔑 Το `'thick'` **παράγεται** από τον κατάλογο ISO ({@link nearestIsoLineweight}), δεν
 * ταμπελώνεται: `0.13→0.25 · 0.18→0.35 · 0.25→0.50 · 0.35→0.70 · 0.50→1.00 · 0.70→1.40 ·
 * 1.00→2.00` — δηλαδή **ακριβώς** τα ζεύγη του ISO 128-20, χωρίς να γραφτεί κανένα από αυτά
 * τα νούμερα εδώ. Χειρόγραφος πίνακας ζευγών θα ήταν δεύτερη κλίμακα πένας δίπλα στην
 * υπάρχουσα SSoT (`config/lineweight-iso-catalog.ts`, με δικό της ratchet).
 *
 * Μολύβι χωρίς πάχος (μη πεπερασμένο ή ≤ 0) δεν έχει «διπλάσιο»: εκεί ο κατάλογος απαντά
 * `undefined` και κρατάμε το μολύβι αυτούσιο, αντί να εφεύρουμε πένα που ο χρήστης δεν ζήτησε.
 *
 * ## ✅ ADR-750 Φ5 — το `'double'` έπαψε να είναι τρύπα (Α17 → Α24)
 * Μέχρι τη Φ5 αυτό το σκέλος επέστρεφε `undefined` και οι δύο διπλές εντολές δηλώνονταν **μη
 * διαθέσιμες**. Τώρα δίνει το ίδιο μολύβι με απόσταση διπλής ({@link tableBorderDoubleGapMm}) —
 * και ο ζωγράφος δεν έμαθε τίποτα, γιατί η διάταξη αποσυνθέτει τη διπλή σε **δύο** τμήματα.
 *
 * ⚠️ Το `?? tableBorderDoubleGapMm(...)` δεν είναι δίχτυ: σέβεται μια απόσταση που **ήδη**
 * κουβαλά το μολύβι του χρήστη (τσεκαρισμένο «Διπλή γραμμή»), ώστε η εντολή «Κάτω διπλό
 * περίγραμμα» να μη γράψει *άλλη* διπλή από αυτήν που δείχνει η προεπισκόπηση δίπλα της.
 */
function resolvePen(base: TableBorderSpec, pen: TableBorderPen): TableBorderSpec {
  switch (pen) {
    case 'base':
      return base;
    case 'hidden':
      return HIDDEN_TABLE_EDGE;
    case 'thick': {
      const thicker = nearestIsoLineweight(base.widthMm * THICK_PEN_RATIO);
      return thicker === undefined ? base : { ...base, widthMm: thicker };
    }
    case 'double':
      return {
        ...base,
        doubleGapMm: base.doubleGapMm ?? tableBorderDoubleGapMm(base.widthMm),
      };
  }
}

/**
 * Οριζόντια ή κατακόρυφη; Η πλευρά το ξέρει· κανείς άλλος δεν χρειάζεται να το θυμάται.
 *
 * ## Γιατί δημόσια (ADR-750 Φ3)
 * Το **εικονίδιο** κάθε εντολής ζωγραφίζει τις ίδιες ακριβώς γραμμές που θα γράψει η εντολή —
 * σε πλέγμα 2×2 αντί για τον πίνακα του χρήστη. Αν το UI κρατούσε δική του αντιστοίχιση
 * «πλευρά → οριζόντια/κατακόρυφη», θα ήταν δεύτερη δήλωση της ίδιας γνώσης, και ένα εικονίδιο
 * θα μπορούσε κάποτε να **διαφωνήσει** με το κουμπί του χωρίς κανένα test να το δει.
 */
export function tableBorderSideOrientation(side: TableBorderSide): TableEdgeOrientation {
  return side === 'left' || side === 'right' || side === 'insideV' ? 'V' : 'H';
}

/**
 * Οι θέσεις της πλευράς στον άξονα που **διασχίζει** (γραμμή για οριζόντια, στήλη για
 * κατακόρυφη), σε δείκτες πλέγματος.
 *
 * 🔑 **Οι έξι πλευρές είναι ανά δύο ξένες μεταξύ τους, πάντα** — και αυτό δεν είναι τύχη:
 * η `top` κάθεται στο `firstRow` και η `bottom` στο `lastRow + 1` (με `lastRow ≥ firstRow`,
 * άρα ποτέ ίδιες), ενώ η `insideH` ζει αυστηρά ανάμεσά τους. Γι' αυτό το μητρώο μπορεί να
 * είναι επίπεδη λίστα σκελών **χωρίς κανόνα σύγκρουσης**: δύο σκέλη της ίδιας εντολής δεν
 * μπορούν να διεκδικήσουν την ίδια ακμή.
 *
 * Περιοχή 1×1: η `insideH`/`insideV` δίνει **κενό** χωρίς καμία ειδική περίπτωση — «Όλα τα
 * περιγράμματα» σε ένα κελί γράφει ακριβώς τις 4 πλευρές του.
 *
 * ## Γιατί δημόσια (ADR-750 Φ3)
 * Είναι **όλη** η γεωμετρία που χρειάζεται το εικονίδιο μιας εντολής: με `bounds` ένα πλέγμα
 * 2×2, δίνει κατευθείαν ποιες από τις τρεις γραμμές κάθε προσανατολισμού είναι ενεργές
 * (`top → [0]`, `insideH → [1]`, `bottom → [2]`). Δηλαδή το εικονίδιο δεν «μιμείται» την
 * εντολή — **εκτελεί την ίδια συνάρτηση** με άλλα όρια, και η απόκλιση γίνεται μη εκφράσιμη.
 * Δες {@link tableBorderSideOrientation} για το ίδιο σκεπτικό.
 */
export function tableBorderSideCrossings(
  side: TableBorderSide,
  bounds: TableCellRangeBounds,
): readonly number[] {
  switch (side) {
    case 'top':
      return [bounds.firstRow];
    case 'bottom':
      return [bounds.lastRow + 1];
    case 'insideH':
      return sequence(bounds.firstRow + 1, bounds.lastRow);
    case 'left':
      return [bounds.firstCol];
    case 'right':
      return [bounds.lastCol + 1];
    case 'insideV':
      return sequence(bounds.firstCol + 1, bounds.lastCol);
  }
}

/** Κλειστό διάστημα ακεραίων· **κενό** όταν `from > to` (περιοχή χωρίς εσωτερικές ακμές). */
function sequence(from: number, to: number): readonly number[] {
  const out: number[] = [];
  for (let i = from; i <= to; i++) out.push(i);
  return out;
}
