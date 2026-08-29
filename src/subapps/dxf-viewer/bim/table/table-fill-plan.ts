/**
 * 🔴 ADR-828 §4 — **ΤΙ ΘΑ ΓΡΑΨΕΙ ΑΥΤΟ ΤΟ ΓΕΜΙΣΜΑ**, αποφασισμένο **μία φορά** πριν γραφτεί
 * το πρώτο κελί. Καθαρό: μηδέν εγγραφή, μηδέν React, μηδέν i18n.
 *
 * ## 🔴 Η ΑΝΙΧΝΕΥΣΗ ΤΡΕΧΕΙ ΑΝΑ **ΛΩΡΙΔΑ**, ΟΧΙ ΑΝΑ ΚΕΛΙ
 * Ένα γέμισμα 500 γραμμών έχει 500 στόχους αλλά **μία** πηγή. Ανίχνευση ανά κελί θα ήταν
 * O(εμβαδόν × πηγή) — το ίδιο σχήμα κόστους που πλήρωσε ο ADR-735 και που ο χάρτης του
 * `applyTableFill` υπάρχει για να αποφύγει. Εδώ η ερώτηση απαντιέται μία φορά ανά λωρίδα και
 * μετά διαβάζεται.
 *
 * ## Τι είναι «λωρίδα»
 * Η σειρά ζει κατά μήκος του **άξονα του γεμίσματος**. Πηγή δύο στηλών που τραβιέται προς τα
 * κάτω έχει **δύο ανεξάρτητες** σειρές, μία ανά στήλη — όχι μία σειρά που εναλλάσσεται. Αυτό
 * είναι και η συμπεριφορά του Excel, και είναι ο λόγος που το `lane` υπολογίζεται με το
 * **εγκάρσιο** υπόλοιπο ενώ η θέση με τον **κατά μήκος** δείκτη.
 *
 * ## Γιατί το σχέδιο **εξάγεται** αντί να μείνει ιδιωτικό
 * Το `Ctrl` και το μενού «Επιλογές Αυτόματης Συμπλήρωσης» ρωτούν «θα ήταν σειρά;» **πριν**
 * αποφασίσουν τι να προσφέρουν. Χωρίς το {@link TableFillPlan.isSeries} θα έπρεπε να τρέξουν
 * δεύτερη ανίχνευση — δηλαδή δεύτερη μηχανή που μπορεί να διαφωνήσει με την πρώτη ακριβώς
 * στα οριακά κελιά όπου η διαφωνία δεν φαίνεται.
 *
 * @module subapps/dxf-viewer/bim/table/table-fill-plan
 * @see bim/table/table-fill-series-detect.ts — η ανίχνευση
 * @see bim/table/table-fill-apply.ts — ο καταναλωτής
 * @see docs/centralized-systems/reference/adrs/ADR-828-table-autofill-series.md §4
 */

import { positiveMod } from '@/lib/number/positive-mod';
import type { TableModel } from '../../types/table';
import type { TableCellRangeBounds } from './table-cell-range';
import type { TableFillTarget } from './table-fill-handle';
import type { TableTransferParts } from './table-range-transfer';
import { resolveCellNumberFormat } from './table-cell-format';
import { cellText } from './table-cell-content';
import { getCell } from './table-model-helpers';
import {
  detectTableFillSeries,
  type TableFillDetectOptions,
} from './table-fill-series-detect';
import { tableFillSeriesTextAt } from './table-fill-series-generate';
import type {
  TableDateStepUnit,
  TableFillSeed,
  TableFillSeries,
} from './table-fill-series-types';

/**
 * Τι ζήτησε ο άνθρωπος.
 *
 * - `'auto'` — η προεπιλογή: σειρά όπου υπάρχει απόδειξη, αλλιώς επανάληψη μοτίβου.
 * - `'copy'` — επανάληψη μοτίβου, **ρητά**. Ό,τι έκανε η λαβή πριν από το ADR-828.
 * - `'series'` — σειρά, **ρητά**: ακόμη και εκεί που το `'auto'` θα αντέγραφε από έλλειψη
 *   απόδειξης (ο ένας αριθμός). Αυτό ακριβώς κάνει το `Ctrl`.
 * - `'formatOnly'` / `'noFormat'` — οι δύο μισές μεταφορές του μενού του Excel.
 * - `'days'` / `'weekdays'` / `'months'` / `'years'` — **η μονάδα ημερολογίου, δοσμένη από τον
 *   άνθρωπο** (ADR-828 §7.2). Είναι ο μόνος τρόπος να υπάρξει «καθημερινές», και ο τρόπος να
 *   **ανατραπεί** η συμπερασμένη μονάδα στις άλλες τρεις. Σε λωρίδα που δεν είναι ημερομηνία
 *   δίνουν **αντιγραφή** — δες `TableFillDetectOptions.forceDateUnit`.
 */
export type TableFillMode =
  | 'auto'
  | 'copy'
  | 'series'
  | 'formatOnly'
  | 'noFormat'
  | 'days'
  | 'weekdays'
  | 'months'
  | 'years';

export interface TableFillPlan {
  /** Ο άξονας κατά μήκος του οποίου προχωρά η σειρά. */
  readonly axis: 'row' | 'column';
  /** Μία σειρά ανά λωρίδα της πηγής, με τη σειρά του εγκάρσιου άξονα. */
  readonly lanes: readonly TableFillSeries[];
  readonly parts: TableTransferParts;
  /** 🔑 Η ερώτηση του `Ctrl` και του μενού: **θα** έβγαινε σειρά με `'auto'`; */
  readonly isSeries: boolean;
  /**
   * Το κείμενο αυτού του κελιού — ή `null` για «αντίγραψε το μοτίβο».
   *
   * 🔑 Δέχεται **θέσεις**, όχι ολόκληρο κελί: το `TableTiledCell` ταιριάζει δομικά, αλλά η
   * ετικέτα-φάντασμα της σύρσης **δεν έχει** τέτοιο κελί — έχει μόνο πού βρίσκεται το χέρι.
   * Ζητώντας το ελάχιστο, η ίδια συνάρτηση εξυπηρετεί και τον γραφέα και την προεπισκόπηση,
   * που είναι ο μόνος τρόπος να μη διαφωνήσουν.
   */
  readonly textAt: (ordinals: TableFillOrdinals) => string | null;
}

/** Πού βρίσκεται ένα κελί **σε σχέση με την αρχή του μοτίβου**. Αρνητικά προς τα πάνω/αριστερά. */
export interface TableFillOrdinals {
  readonly rowOrdinal: number;
  readonly colOrdinal: number;
}

const PARTS_BY_MODE: Record<TableFillMode, TableTransferParts> = {
  auto: 'all',
  copy: 'all',
  series: 'all',
  formatOnly: 'format',
  noFormat: 'content',
  days: 'all',
  weekdays: 'all',
  months: 'all',
  years: 'all',
};

/**
 * 🔴 ADR-828 §7.2 — οι τέσσερις εντολές μονάδας, μεταφρασμένες σε **μονάδα ανιχνευτή**.
 *
 * Χάρτης και όχι τέσσερις κλάδοι: ο τύπος `Partial<Record<…>>` κάνει το «ποιες καταστάσεις
 * είναι ημερολογιακές» **μία** δήλωση, και ο έλεγχος `!== undefined` παρακάτω είναι ο ίδιος
 * ένας φρουρός για όλες. Πέντε καταστάσεις που **δεν** είναι εδώ παίρνουν σιωπηλά και σωστά
 * `undefined` — δηλαδή «καμία αναγκαστική μονάδα».
 */
const DATE_UNIT_BY_MODE: Readonly<Partial<Record<TableFillMode, TableDateStepUnit>>> = {
  days: 'day',
  weekdays: 'weekday',
  months: 'month',
  years: 'year',
};

/** Το σχέδιο για μια σύρση: ποιος άξονας, ποιες σειρές, τι ταξιδεύει. */
export function buildTableFillPlan(
  model: TableModel,
  source: TableCellRangeBounds,
  target: TableFillTarget,
  mode: TableFillMode,
): TableFillPlan {
  const axis: 'row' | 'column' =
    target.direction === 'down' || target.direction === 'up' ? 'row' : 'column';
  const parts = PARTS_BY_MODE[mode];

  // «Μόνο μορφοποίηση» και «αντιγραφή» δεν ρωτούν καν: καμία σειρά δεν πρόκειται να γραφτεί,
  // και μια ανίχνευση της οποίας το αποτέλεσμα πετιέται είναι σάρωση χωρίς αφορμή.
  if (mode === 'copy' || mode === 'formatOnly') {
    return { axis, lanes: [], parts, isSeries: false, textAt: () => null };
  }

  // 🔑 Το `'series'` δεν είναι φίλτρο πάνω στο αποτέλεσμα — είναι **άλλη ερώτηση**. Ο μονήρης
  // αριθμός δεν έχει βήμα να «ξεκλειδώσει» εκ των υστέρων: η αντιγραφή έχει ήδη πετάξει τον
  // αριθμό. Η ρητή εντολή πρέπει να φτάσει **μέσα** στην ανίχνευση, όσο οι σπόροι είναι ακόμη
  // εκεί.
  //
  // 🔴 §7.2 — **η ίδια αρχή, δεύτερη φορά**: η αναγκαστική μονάδα ημερολογίου φτάνει κι αυτή
  // **μέσα** στην ανίχνευση, όσο οι σπόροι είναι ακόμη εκεί. Φίλτρο πάνω στο αποτέλεσμα θα
  // ήταν αδύνατο για τον ίδιο λόγο: μια λωρίδα που διαβάστηκε ως «κάθε 28 ημέρες» έχει ήδη
  // πετάξει την πληροφορία ότι οι σπόροι ήταν τέλη μηνών.
  const options: TableFillDetectOptions =
    mode === 'series'
      ? { forceNumericStep: 1 }
      : DATE_UNIT_BY_MODE[mode] === undefined
        ? {}
        : { forceDateUnit: DATE_UNIT_BY_MODE[mode] };
  const lanes = laneSeeds(model, source, axis).map((seeds) =>
    detectTableFillSeries(seeds, options),
  );
  const laneCount = axis === 'row' ? width(source) : height(source);

  return {
    axis,
    lanes,
    parts,
    isSeries: lanes.some((series) => series.kind !== 'copy'),
    textAt: (fill) => textAt(lanes, laneCount, axis, fill),
  };
}

function textAt(
  lanes: readonly TableFillSeries[],
  laneCount: number,
  axis: 'row' | 'column',
  at: TableFillOrdinals,
): string | null {
  if (lanes.length === 0 || laneCount <= 0) return null;

  // Η **λωρίδα** διαλέγεται με το εγκάρσιο υπόλοιπο (το μοτίβο επαναλαμβάνεται πλαγίως), ενώ
  // η **θέση** είναι ο κατά μήκος δείκτης — που μεγαλώνει μονότονα και γίνεται αρνητικός
  // προς τα πάνω/αριστερά. Δύο διαφορετικές ερωτήσεις, δύο διαφορετικοί αριθμοί.
  const laneIndex = positiveMod(axis === 'row' ? at.colOrdinal : at.rowOrdinal, laneCount);
  const ordinal = axis === 'row' ? at.rowOrdinal : at.colOrdinal;
  return tableFillSeriesTextAt(lanes[laneIndex], ordinal);
}

/**
 * 🔴 ADR-828 §5 — **ΤΟ `Ctrl` ΑΝΤΙΣΤΡΕΦΕΙ ΤΗΝ ΠΡΟΕΠΙΛΟΓΗ**, δεν επιβάλλει σειρά.
 *
 * Είναι η συμπεριφορά του Excel και είναι πιο χρήσιμη από ένα σκέτο «κάνε σειρά»: ο άνθρωπος
 * που τραβά μήνες και θέλει **αντιγραφή** έχει την ίδια ανάγκη με εκείνον που τραβά έναν
 * αριθμό και θέλει **σειρά**. Ένα πλήκτρο που σημαίνει πάντα «σειρά» θα εξυπηρετούσε τον έναν
 * και θα άφηνε τον άλλον χωρίς τρόπο.
 *
 * ⚠️ Ρωτά **πρώτα** τι θα έκανε το `'auto'`, γιατί «το αντίθετο» δεν ορίζεται χωρίς το αρχικό.
 * Η επιπλέον ανίχνευση κοστίζει όσο η **πηγή** (συνήθως ένα κελί) — όχι όσο ο στόχος — και
 * τρέχει μόνο όσο το πλήκτρο είναι πατημένο.
 */
export function tableFillModeFor(
  model: TableModel,
  source: TableCellRangeBounds,
  target: TableFillTarget,
  modifiers: { readonly ctrlKey: boolean },
): TableFillMode {
  if (!modifiers.ctrlKey) return 'auto';
  return buildTableFillPlan(model, source, target, 'auto').isSeries ? 'copy' : 'series';
}

/**
 * 🔴 ADR-828 §7.2 — **ΠΟΙΕΣ ΕΝΤΟΛΕΣ ΤΟΥ ΜΕΝΟΥ ΕΧΟΥΝ ΝΟΗΜΑ σε αυτό το γέμισμα.**
 *
 * Οι δύο ερωτήσεις που δεν είναι πάντα ναι. «Αντιγραφή κελιών», «μόνο μορφοποίηση» και
 * «χωρίς μορφοποίηση» δεν ρωτιούνται: ισχύουν πάντα, γιατί δεν εξαρτώνται από το περιεχόμενο.
 */
export interface TableFillMenuOffer {
  /** Θα έγραφε **κάτι διαφορετικό** η «Συμπλήρωση σειράς» από την αντιγραφή; */
  readonly series: boolean;
  /** Είναι ημερολόγιο, δηλαδή έχουν αντικείμενο οι τέσσερις εντολές μονάδας; */
  readonly date: boolean;
}

/**
 * 🔴 **ΜΙΑ** ανίχνευση απαντά **και τα δύο** — και είναι η ίδια μηχανή που θα εκτελέσει.
 *
 * Ρωτιέται με `'series'` και όχι με `'auto'`, και η διαφορά είναι ορατή στην οθόνη: ο μονήρης
 * αριθμός `10` δίνει `isSeries: false` στο `'auto'` (σωστά — καμία απόδειξη βήματος), αλλά η
 * εντολή «Συμπλήρωση σειράς» **υπάρχει ακριβώς γι' αυτόν**. Με το `'auto'` το item θα ήταν
 * γκρίζο ακριβώς στην περίπτωση όπου το Excel το θέλει ενεργό.
 *
 * Το `'series'` είναι **υπερσύνολο**: το `forceNumericStep` μόνο προσθέτει σειρές, ποτέ δεν
 * αφαιρεί, και δεν αγγίζει καθόλου τις ημερομηνίες. Άρα η ίδια σάρωση απαντά και το `date`
 * χωρίς δεύτερο πέρασμα — που είναι όλος ο λόγος ύπαρξης του {@link TableFillPlan.isSeries}.
 */
export function tableFillMenuOffer(
  model: TableModel,
  source: TableCellRangeBounds,
  target: TableFillTarget,
): TableFillMenuOffer {
  const plan = buildTableFillPlan(model, source, target, 'series');
  return {
    series: plan.isSeries,
    date: plan.lanes.some((lane) => lane.kind === 'date'),
  };
}

/**
 * 🔴 ADR-828 §5 — **ΤΙ ΘΑ ΔΕΙ Ο ΧΡΗΣΤΗΣ σε αυτό το κελί.** Η ερώτηση της ετικέτας-φαντάσματος.
 *
 * ## Γιατί ΔΕΝ είναι το {@link TableFillPlan.textAt}
 * Εκείνο απαντά στον **γραφέα**, και το `null` του σημαίνει «μη γράψεις τίποτα ιδιαίτερο —
 * αντίγραψε το μοτίβο». Είναι σωστή απάντηση για μηχανή και **άχρηστη** για άνθρωπο: η
 * ετικέτα θα εξαφανιζόταν μόλις πατηθεί το `Ctrl`, δηλαδή ακριβώς τη στιγμή που ο χρήστης
 * χρειάζεται επιβεβαίωση ότι η πρόθεσή του καταγράφηκε. Ένα στοιχείο που σβήνει τη στιγμή που
 * πατάς ένα πλήκτρο **διαβάζεται ως σφάλμα**, όχι ως πληροφορία.
 *
 * Εδώ το «αντίγραψε το μοτίβο» **επιλύεται**: επιστρέφεται η τιμή που πράγματι θα αντιγραφεί.
 * Η ετικέτα λέει πάντα κάτι αληθινό, όποια κι αν είναι η πρόθεση.
 *
 * `null` μόνο για «μόνο μορφοποίηση», όπου το περιεχόμενο **δεν αλλάζει** — εκεί οποιαδήποτε
 * τιμή θα ήταν ψέμα.
 */
export function tableFillPreviewText(
  model: TableModel,
  source: TableCellRangeBounds,
  target: TableFillTarget,
  mode: TableFillMode,
  at: TableFillOrdinals,
): string | null {
  const plan = buildTableFillPlan(model, source, target, mode);
  const series = plan.textAt(at);
  if (series !== null) return series;
  if (plan.parts === 'format') return null;

  // Το κελί-πηγή που αναλογεί: ο **ίδιος** κυκλικός κανόνας που θα εφαρμόσει ο γραφέας.
  const row = model.rows[source.firstRow + positiveMod(at.rowOrdinal, height(source))];
  const column = model.columns[source.firstCol + positiveMod(at.colOrdinal, width(source))];
  if (row === undefined || column === undefined) return null;
  return cellText(getCell(model, row.id, column.id));
}

/**
 * Οι θέσεις του **πιο μακρινού** κελιού του γεμίσματος — αυτό που κρατά ο δείκτης.
 *
 * Είναι το κελί που η ετικέτα-φάντασμα οφείλει να δείχνει: ο άνθρωπος ρωτά «πού θα φτάσω αν
 * αφήσω **εδώ**», όχι «τι θα μπει στο πρώτο κελί». Στο Excel η ετικέτα δείχνει ακριβώς αυτό.
 *
 * ⚠️ Η «άκρη» εξαρτάται από την **κατεύθυνση**: προς τα κάτω/δεξιά είναι το `last`, προς τα
 * πάνω/αριστερά το `first`. Χωρίς αυτή τη διάκριση η ανάστροφη σύρση θα διαφήμιζε το κελί που
 * είναι **κολλητά** στην πηγή, δηλαδή θα έμενε παγωμένη ενώ το χέρι απομακρύνεται.
 */
export function tableFillFrontier(
  source: TableCellRangeBounds,
  target: TableFillTarget,
): TableFillOrdinals {
  const { bounds, direction } = target;
  const rowEdge = direction === 'up' ? bounds.firstRow : bounds.lastRow;
  const colEdge = direction === 'left' ? bounds.firstCol : bounds.lastCol;
  return {
    rowOrdinal: rowEdge - source.firstRow,
    colOrdinal: colEdge - source.firstCol,
  };
}

/**
 * Οι σπόροι κάθε λωρίδας, **με τη σειρά του άξονα** — και με την επιλυμένη μορφή τους.
 *
 * Η μορφή δεν είναι προαιρετική: χωρίς αυτήν ο ανιχνευτής δεν μπορεί να ξεχωρίσει ημερομηνία
 * από αριθμό, και το `46239` θα γινόταν πότε 5 Αυγούστου και πότε 46 χιλιάδες ευρώ ανάλογα με
 * το ποιος κοιτάζει (ADR-760).
 */
function laneSeeds(
  model: TableModel,
  source: TableCellRangeBounds,
  axis: 'row' | 'column',
): readonly (readonly TableFillSeed[])[] {
  const lanes: TableFillSeed[][] = [];
  const laneCount = axis === 'row' ? width(source) : height(source);
  const laneLength = axis === 'row' ? height(source) : width(source);

  for (let lane = 0; lane < laneCount; lane += 1) {
    const seeds: TableFillSeed[] = [];
    for (let step = 0; step < laneLength; step += 1) {
      const rowIndex = source.firstRow + (axis === 'row' ? step : lane);
      const colIndex = source.firstCol + (axis === 'row' ? lane : step);
      seeds.push(seedAt(model, rowIndex, colIndex));
    }
    lanes.push(seeds);
  }
  return lanes;
}

function seedAt(model: TableModel, rowIndex: number, colIndex: number): TableFillSeed {
  const row = model.rows[rowIndex];
  const column = model.columns[colIndex];
  // Μπαγιάτικα όρια μετά από undo ή διαγραφή γραμμής είναι φυσιολογικό ενδιάμεσο στάδιο, όχι
  // σφάλμα — ίδια σύμβαση ανοχής με το `tileTableTarget`. Κελί που δεν υπάρχει είναι κενό,
  // και το κενό ήδη σπάει την ανίχνευση.
  if (row === undefined || column === undefined) {
    return { cell: undefined, format: { kind: 'general' } };
  }

  const cell = getCell(model, row.id, column.id);
  return {
    cell,
    format: resolveCellNumberFormat(
      { cell: cell?.styleOverride, row: row.styleOverride, column: column.styleOverride },
      column.valueType,
    ),
  };
}

const width = (bounds: TableCellRangeBounds): number => bounds.lastCol - bounds.firstCol + 1;
const height = (bounds: TableCellRangeBounds): number => bounds.lastRow - bounds.firstRow + 1;
