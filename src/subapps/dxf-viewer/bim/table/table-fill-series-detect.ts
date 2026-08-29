/**
 * 🔴 ADR-828 §2 — **ΕΙΝΑΙ ΑΥΤΟ ΣΕΙΡΑ, ΚΑΙ ΠΟΙΑ;** Καθαρή συνάρτηση πάνω σε μια **λωρίδα**
 * σπόρων: μηδέν μοντέλο, μηδέν γεωμετρία, μηδέν React.
 *
 * ## Η σειρά των ερωτήσεων ΕΙΝΑΙ ο αλγόριθμος
 * Πρώτα οι **απορρίψεις** (τι δεν επιτρέπεται καν να εξεταστεί), μετά η **ταξινόμηση** με
 * αυστηρή προτεραιότητα. Κάθε βήμα που αλλάζει θέση αλλάζει το κείμενο μέσα σε κελί χρήστη.
 *
 * ## ⚠️ Η ασυμμετρία που μοιάζει με σφάλμα και ΔΕΝ είναι
 * **Ένας** αριθμός δίνει **αντιγραφή** (`10` ⇒ `10 10 10`), αλλά **ένας** μήνας, μία ημέρα,
 * μία ημερομηνία και ένα `Στοιχείο 1` δίνουν **σειρά**. Οι δύο κανόνες ζουν λίγες γραμμές
 * μακριά και κάθε νέος αναγνώστης θα θελήσει να τους «ενοποιήσει».
 *
 * Η διαφορά είναι **η απόδειξη**: βήμα `1` πάνω σε έναν σκέτο αριθμό είναι μαντεψιά — το
 * `10` δεν λέει τίποτα για το τι έπεται. Ένα μέλος **διατεταγμένης λίστας** όμως *έχει*
 * ορισμένο επόμενο, και μια ημερομηνία είναι σημείο σε άξονα. Εκεί ο σπόρος **είναι** η
 * απόδειξη. Αυτή είναι και η πραγματική συμπεριφορά του Excel.
 *
 * @module subapps/dxf-viewer/bim/table/table-fill-series-detect
 * @see bim/table/table-fill-series-generate.ts — η άλλη μισή ερώτηση
 * @see docs/centralized-systems/reference/adrs/ADR-828-table-autofill-series.md §2
 */

import type { NameListCandidate } from '@/lib/string/name-list-match';
import { detectListSeries } from './table-fill-series-list-detect';
import type { DecimalSeparator } from '@/lib/number/locale-number';
import { cellText } from './table-cell-content';
import { cellValueToNumber } from './formula/table-formula-value';
import { dateFromExcelSerial } from './formula/excel-serial-date';
import { daysInMonth } from '@/lib/date/calendar-arithmetic';
import {
  NOT_A_SERIES,
  type NumericWrittenShape,
  type TableDateStepUnit,
  type TableFillSeed,
  type TableFillSeries,
} from './table-fill-series-types';

/** Κείμενο + αριθμητικά ψηφία στο τέλος: `Στοιχείο 001` ⇒ `['Στοιχείο ', '001', '']`. */
const TRAILING_NUMBER = /^(.*?)(\d+)(\D*)$/u;

/**
 * Τι επιτρέπεται να **υποθέσει** ο ανιχνευτής πέρα από όσα δείχνουν τα δεδομένα.
 *
 * Υπάρχει για **έναν** λόγο: το `Ctrl` του Excel. Χωρίς αυτό, ο ένας αριθμός δεν έχει βήμα —
 * και σωστά, γιατί κανείς δεν το δήλωσε. Με πατημένο το `Ctrl` όμως ο άνθρωπος **μόλις το
 * δήλωσε**, και η υπόθεση παύει να είναι μαντεψιά.
 */
export interface TableFillDetectOptions {
  /**
   * Βήμα για μονήρη αριθμό, όταν ο άνθρωπος ζήτησε **ρητά** σειρά. Απόν ⇒ αντιγραφή.
   *
   * ⚠️ Αφορά **μόνο** τον μονήρη αριθμό. Ό,τι δεν μπορεί να είναι σειρά (καθαρό κείμενο,
   * τύπος, δεμένο κελί) μένει αντιγραφή ακόμη και με ρητή εντολή: η εντολή δίνει βήμα εκεί
   * που λείπει, δεν εφευρίσκει διάταξη εκεί που δεν υπάρχει.
   */
  readonly forceNumericStep?: number;

  /**
   * 🔴 ADR-828 §7.2 — **Η ΜΟΝΑΔΑ ΤΗΝ ΕΔΩΣΕ Ο ΑΝΘΡΩΠΟΣ** («Συμπλήρωση μηνών» κ.λπ.).
   *
   * Είναι ο **μόνος** τρόπος να υπάρξει `'weekday'`: «Δευτέρα, Τρίτη, Τετάρτη» είναι
   * αριθμητικά αδιάκριτο από «+1 ημέρα», άρα καμία ανίχνευση δεν επιτρέπεται να το
   * συμπεράνει (δες {@link TableDateStepUnit}). Οι άλλες τρεις μονάδες συμπεραίνονται μεν,
   * αλλά ο άνθρωπος έχει δικαίωμα να τις **ανατρέψει**: `31/1, 28/2` διαβάζεται ως μήνες,
   * και η «Συμπλήρωση ημερών» λέει «όχι, μέτρα ημέρες».
   *
   * ⚠️ **Δεν μετατρέπει σε ημερομηνία ό,τι δεν είναι.** Σπόροι που δεν περνούν τον έλεγχο
   * P1 (όλοι αριθμοί **και** όλοι με μορφή ημερομηνίας) γίνονται **αντιγραφή**, όχι
   * αριθμητική σειρά: η εντολή διάλεξε **μονάδα ημερολογίου**, και μια σιωπηλή υποχώρηση σε
   * «+1» πάνω σε κείμενο θα έγραφε κάτι που κανείς δεν ζήτησε. Ίδια αρχή με το
   * {@link TableFillDetectOptions.forceNumericStep}: η εντολή δίνει **βήμα ή μονάδα** εκεί
   * που λείπει, ποτέ **είδος** εκεί που δεν υπάρχει.
   */
  readonly forceDateUnit?: TableDateStepUnit;

  /**
   * 🔴 ADR-828 Φ4β — **ΟΙ ΛΙΣΤΕΣ ΠΟΥ ΕΓΡΑΨΕ Ο ΑΝΘΡΩΠΟΣ**, περασμένες από τον καλούντα.
   *
   * Έρχονται **από έξω** και όχι με ανάγνωση αποθετηρίου εδώ μέσα, με την **ίδια σύμβαση**
   * που έχουν ήδη τα δύο αδέλφια τους: **ο καλών δίνει, ο ανιχνευτής μένει καθαρός**. Η
   * εναλλακτική θα ήταν να διαβάζει αυτό το αρχείο κατάσταση χρήστη — δηλαδή μια καθαρή
   * συνάρτηση με κρυφή είσοδο, αδοκίμαστη χωρίς πλαστογράφηση αποθετηρίου.
   *
   * ⚠️ Ο καλών τις διαβάζει **τη στιγμή της χειρονομίας** (ADR-040 κανόνας #2), όχι από
   * στιγμιότυπο render που μπορεί να είναι παλιό: ο άνθρωπος μπορεί να έχει μόλις προσθέσει
   * μια λίστα και να τραβάει τη λαβή το επόμενο δευτερόλεπτο.
   */
  readonly customLists?: readonly NameListCandidate[];
}

/**
 * «Τι σειρά είναι αυτή η λωρίδα;» — οι σπόροι **με τη σειρά του άξονα γεμίσματος**.
 *
 * Η σειρά των σπόρων είναι σημασιολογία: `10, 20` σημαίνει βήμα `+10`, ενώ `20, 10` σημαίνει
 * `−10`. Ο καλών τους δίνει όπως τους διαβάζει το μάτι — πάνω προς τα κάτω, αριστερά προς τα
 * δεξιά — και η ανάστροφη σύρση **δεν** τους αντιστρέφει: εκείνη δίνει αρνητική θέση στην
 * παραγωγή, που είναι η ίδια σειρά διαβασμένη προς τα πίσω.
 */
export function detectTableFillSeries(
  seeds: readonly TableFillSeed[],
  options: TableFillDetectOptions = {},
): TableFillSeries {
  if (seeds.length === 0 || !seeds.every(isEligibleSeed)) return NOT_A_SERIES;

  const texts = seeds.map((seed) => cellText(seed.cell).trim());
  const numbers = seeds.map((seed) => cellValueToNumber(seed.cell?.value ?? null));

  // P1 — ημερομηνία **πριν** αριθμό: κάθε ημερομηνία είναι αριθμός εκ κατασκευής, οπότε αν
  // η γενικότερη ανάγνωση προηγούνταν, καμία ημερομηνία δεν θα ήταν ποτέ ημερομηνία.
  if (isEveryNumber(numbers) && seeds.every((seed) => seed.format.kind === 'date')) {
    return detectDateSeries(numbers, options.forceDateUnit);
  }

  // 🔴 §7.2 — ζητήθηκε **μονάδα ημερολογίου** σε λωρίδα που δεν είναι ημερομηνία: αντιγραφή.
  // Δες {@link TableFillDetectOptions.forceDateUnit} — χωρίς αυτόν τον φρουρό, η «Συμπλήρωση
  // μηνών» πάνω σε `10, 20` θα κατέληγε σιωπηλά στο P2 και θα έγραφε `30, 40`.
  if (options.forceDateUnit !== undefined) return NOT_A_SERIES;

  // P2 — αριθμός **πριν** «κείμενο με ψηφία»: το `'12'` ταιριάζει και στα δύο, και μόνο εδώ
  // διατηρείται η γραμμένη μορφή του (δεκαδικό κόμμα, πλήθος δεκαδικών).
  if (isEveryNumber(numbers)) return detectNumericSeries(numbers, texts, options);

  const listSeries = detectListSeries(texts, options.customLists);
  if (listSeries !== null) return listSeries;

  return detectSuffixNumberSeries(texts);
}

/**
 * Οι απορρίψεις, όλες μαζί. Καθεμία στέλνει τη λωρίδα στην κυκλική επανάληψη.
 *
 * - **Κενό**: στο Excel το κενό **σπάει** τη σειρά (`1, ‹κενό›, 3` αντιγράφεται). Ένα κενό
 *   δεν είναι «άγνωστη τιμή προς παρεμβολή», είναι δήλωση του χρήστη ότι εκεί δεν υπάρχει
 *   δεδομένο.
 * - **Τύπος**: η «συνέχεια» ενός τύπου είναι η **ολίσθηση** των αναφορών του, ήδη λυμένη
 *   αλλού. Σειρά από πάνω θα έσβηνε τον τύπο και θα άφηνε αριθμό — απώλεια χωρίς μήνυμα.
 * - **Δεμένο κελί** (ADR-767): η τιμή του είναι ό,τι είπε η **πηγή** για εκείνη τη γραμμή.
 *   Ο όρος k+1 θα ήταν αριθμός που **καμία** γραμμή προέλευσης δεν ισχυρίστηκε — εφεύρεση
 *   μέσα σε κελί του οποίου όλο το νόημα είναι η προέλευση.
 * - **Πλούσιο κείμενο** (`runs`): οι δείκτες μορφοποίησης δείχνουν στο **παλιό** κείμενο. Αν
 *   η σειρά αλλάξει `'9'` σε `'10'`, βγαίνουν εκτός ορίων **σιωπηλά** — κανένας τύπος δεν το
 *   πιάνει. Η αντιγραφή είναι εδώ η τίμια απάντηση: ίδιο κείμενο, ίδιοι δείκτες.
 * - **Πεδίο / μπλοκ / εικόνα**: δεν έχουν ορισμένη κειμενική συνέχεια.
 */
function isEligibleSeed(seed: TableFillSeed): boolean {
  const cell = seed.cell;
  if (cell === undefined) return false;
  if (cell.kind !== 'text') return false;
  if (cell.bound !== undefined) return false;
  if (cell.runs !== undefined) return false;
  return cellText(cell).trim() !== '';
}

function isEveryNumber(numbers: readonly (number | null)[]): numbers is readonly number[] {
  return numbers.every((value) => value !== null);
}

// ─── Αριθμοί ────────────────────────────────────────────────────────────────────

/**
 * 🔴 **ΕΝΑΣ ΑΡΙΘΜΟΣ ΔΕΝ ΕΙΝΑΙ ΣΕΙΡΑ.** Δες την κεφαλίδα για το γιατί — και μην το
 * «διορθώσετε» σε βήμα 1 εδώ: αυτό είναι η δουλειά του
 * {@link TableFillDetectOptions.forceNumericStep}, δηλαδή του `Ctrl`.
 */
function detectNumericSeries(
  numbers: readonly number[],
  texts: readonly string[],
  options: TableFillDetectOptions,
): TableFillSeries {
  const written = writtenShapeOf(texts);

  if (numbers.length < 2) {
    if (options.forceNumericStep === undefined) return NOT_A_SERIES;
    return { kind: 'numeric', start: numbers[0], step: options.forceNumericStep, written };
  }

  const fit = fitLinear(numbers);
  return { kind: 'numeric', start: fit.start, step: fit.step, written };
}

/**
 * Πρώτη διαφορά όταν η πρόοδος είναι **ακριβής**, ελάχιστα τετράγωνα αλλιώς.
 *
 * ## Γιατί όχι σκέτα ελάχιστα τετράγωνα (που είναι αυτό που κάνει το Excel)
 * Είναι — αλλά η κοινή περίπτωση πρέπει να μείνει **ακριβής**. Το LSQ πάνω σε `1, 3, 5, 7`
 * δίνει μαθηματικά `2`, όμως μέσα από αθροίσματα κινητής υποδιαστολής βγάζει
 * `2.0000000000000004`, και ο χρήστης βλέπει `9.000000000000002` στην έβδομη γραμμή. Η
 * σύντμηση δεν αλλάζει **καμία** απάντηση: όταν η είσοδος είναι αριθμητική πρόοδος, το LSQ
 * εκφυλίζεται ακριβώς στην πρώτη διαφορά. Είναι η ίδια συνάρτηση, υπολογισμένη χωρίς θόρυβο.
 *
 * ## Γιατί όχι **μόνο** πρώτη διαφορά (που είναι απλούστερο)
 * Γιατί έχει κρυφή ελεύθερη παράμετρο: *ποια* διαφορά; Η πρώτη; Η τελευταία; Ο μέσος όρος;
 * Κάθε απάντηση είναι σιωπηλή συντακτική επιλογή, και η «τελευταία» — η φυσική υλοποίηση —
 * κάνει το αποτέλεσμα να εξαρτάται από το δεδομένο που ο χρήστης πιθανότατα θεωρεί εξαίρεση.
 * Τα ελάχιστα τετράγωνα δεν έχουν τέτοια παράμετρο.
 */
function fitLinear(values: readonly number[]): { readonly start: number; readonly step: number } {
  const first = values[1] - values[0];
  const isExact = values.every((value, i) => i === 0 || value - values[i - 1] === first);
  if (isExact) return { start: values[0], step: first };

  const n = values.length;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((sum, value) => sum + value, 0) / n;

  let covariance = 0;
  let variance = 0;
  values.forEach((value, x) => {
    covariance += (x - meanX) * (value - meanY);
    variance += (x - meanX) * (x - meanX);
  });

  const step = variance === 0 ? 0 : covariance / variance;
  return { start: meanY - step * meanX, step };
}

/**
 * Η γραμμένη μορφή των αριθμών: δεκαδικός διαχωριστής, πλήθος δεκαδικών, ομαδοποίηση.
 *
 * Τα δεκαδικά είναι το **μέγιστο** της λωρίδας, όχι του πρώτου σπόρου: σειρά `10 · 10,5` έχει
 * βήμα με δεκαδικό, και αν μετρούσαμε μόνο τον πρώτο θα στρογγυλοποιούσαμε τη συνέχεια σε
 * ακέραιους — δηλαδή θα σβήναμε το βήμα που μόλις ανιχνεύσαμε.
 */
function writtenShapeOf(texts: readonly string[]): NumericWrittenShape {
  let separator: DecimalSeparator = ',';
  let decimals = 0;
  let grouped = false;

  for (const text of texts) {
    const match = /^-?[\d.,]+$/u.test(text) ? /[.,](\d+)$/u.exec(text) : null;
    if (match !== null && match[1].length > decimals) {
      decimals = match[1].length;
      separator = text[match.index] === ',' ? ',' : '.';
    }
    const separatorCount = (text.match(/[.,]/gu) ?? []).length;
    if (separatorCount > (match === null ? 0 : 1)) grouped = true;
  }

  return { decimalSeparator: separator, decimals, grouped };
}

// ─── Ημερομηνίες ────────────────────────────────────────────────────────────────

/**
 * ⚠️ **ΜΙΑ** ημερομηνία δίνει σειρά `+1 ημέρα` — σε αντίθεση με τον έναν αριθμό. Δες την
 * κεφαλίδα: η ημερομηνία είναι σημείο σε άξονα με ορισμένο επόμενο.
 */
function detectDateSeries(
  serials: readonly number[],
  forced?: TableDateStepUnit,
): TableFillSeries {
  const dates = serials.map(dateFromExcelSerial);
  if (dates.some((date) => date === null)) return NOT_A_SERIES;
  const valid = dates as readonly Date[];

  // 🔴 §7.2 — η μονάδα δόθηκε· μένει **μόνο** το βήμα, μετρημένο σε **αυτήν** τη μονάδα.
  if (forced !== undefined) {
    return { kind: 'date', start: serials[0], step: forcedStep(serials, valid, forced), unit: forced };
  }

  if (valid.length < 2) return { kind: 'date', start: serials[0], step: 1, unit: 'day' };

  const unitStep = inferDateUnitStep(valid);
  if (unitStep !== null) {
    return { kind: 'date', start: serials[0], step: unitStep.step, unit: unitStep.unit };
  }

  const fit = fitLinear(serials);
  const step = Math.round(fit.step);
  if (step === 0) return NOT_A_SERIES;
  return { kind: 'date', start: serials[0], step, unit: 'day' };
}

/**
 * 🔴 ADR-828 §7.2 — **ΤΟ ΒΗΜΑ ΟΤΑΝ Η ΜΟΝΑΔΑ ΕΙΝΑΙ ΔΟΣΜΕΝΗ.**
 *
 * Ο άνθρωπος δήλωσε **μονάδα**, όχι βήμα — άρα το βήμα εξακολουθεί να το λένε οι σπόροι, απλώς
 * μετρημένο στη μονάδα που ζήτησε. `31/1, 28/2` με «Συμπλήρωση ημερών» δίνει `+28 ημέρες`
 * (η αριθμητική διαφορά, διαβασμένη σε ημέρες) — όχι `+1`, που θα ήταν αγνόηση του δεύτερου
 * σπόρου.
 *
 * **`1` όταν οι σπόροι δεν λένε βήμα σε αυτή τη μονάδα** — ένας μόνος σπόρος, ή πρόοδος μη
 * ακριβής σε αυτή τη μονάδα (`15/1, 15/2` σε «Συμπλήρωση ετών» δίνει βήμα ετών `0`, που δεν
 * είναι σειρά). Το `1` δεν είναι μαντεψιά εδώ: είναι η **ελάχιστη** έκφραση της εντολής που
 * μόλις δόθηκε ρητά — «προχώρα κατά μία τέτοια μονάδα».
 *
 * ⚠️ **`'weekday'`: πάντα `1`, δηλωμένη απόκλιση** (§6). Το βήμα σε εργάσιμες θα απαιτούσε
 * **δεύτερη** αρχή για το ποιες μέρες είναι σαββατοκύριακο — η μία ζει ήδη στο
 * `table-fill-series-generate.ts` — και «κάθε δύο εργάσιμες» δεν είναι πράξη που ζητά κανείς.
 */
function forcedStep(
  serials: readonly number[],
  dates: readonly Date[],
  unit: TableDateStepUnit,
): number {
  if (serials.length < 2 || unit === 'weekday') return 1;

  const step =
    unit === 'day'
      ? exactStep(serials)
      : exactStep(dates.map((date) => unitIndex(date, unit)));
  return step === null || step === 0 ? 1 : step;
}

/** Ο μονότονος δείκτης μιας ημερομηνίας στη μονάδα «μήνας» ή «έτος». */
function unitIndex(date: Date, unit: 'month' | 'year'): number {
  return unit === 'year'
    ? date.getUTCFullYear()
    : date.getUTCFullYear() * 12 + date.getUTCMonth();
}

/**
 * Μήνας ή έτος — όταν οι ημερομηνίες το **λένε**, όχι όταν το επιτρέπουν.
 *
 * 🔑 **Δύο** υπογραφές δηλώνουν σειρά μηνών, όχι μία:
 * 1. **ίδια ημέρα του μήνα** (`15/1, 15/2`) — η προφανής,
 * 2. **τελευταία ημέρα του μήνα** (`31/1, 28/2`) — η μη προφανής, και η πιο συχνή σε πίνακες
 *    λογιστικής. Χωρίς αυτήν, το `31/1, 28/2` θα διαβαζόταν ως «κάθε 28 ημέρες» και η στήλη
 *    θα ξέφευγε από τα τέλη των μηνών ήδη στην τρίτη γραμμή.
 *
 * Ο έλεγχος του μήνα προηγείται του έτους χωρίς κίνδυνο: όταν ο μήνας δεν αλλάζει, η δική του
 * πρόοδος έχει βήμα `0` και απορρίπτεται εδώ, οπότε η ερώτηση φτάνει άθικτη στο έτος.
 */
function inferDateUnitStep(
  dates: readonly Date[],
): { readonly unit: TableDateStepUnit; readonly step: number } | null {
  const sameDayOfMonth = dates.every((date) => date.getUTCDate() === dates[0].getUTCDate());
  const everyMonthEnd = dates.every(
    (date) => date.getUTCDate() === daysInMonth(date.getUTCFullYear(), date.getUTCMonth() + 1),
  );

  if (sameDayOfMonth || everyMonthEnd) {
    const months = dates.map((date) => date.getUTCFullYear() * 12 + date.getUTCMonth());
    const step = exactStep(months);
    if (step !== null && step !== 0) {
      // Ίδιος μήνας κάθε φορά ⇒ η πρόοδος είναι στα **έτη**, και το βήμα των μηνών είναι
      // πολλαπλάσιο του 12· αφήνεται στον μήνα επίτηδες — «+12 μήνες» και «+1 έτος» είναι
      // η ίδια πράξη, και η μία μονάδα λιγότερο σημαίνει έναν κλάδο λιγότερο.
      return { unit: 'month', step };
    }
  }
  return null;
}

// ─── Λίστες (μήνες, ημέρες) ─────────────────────────────────────────────────────

/** `Στοιχείο 1` ⇒ `Στοιχείο 2`. Το πρόθεμα και το επίθεμα πρέπει να είναι **ταυτόσημα**. */
function detectSuffixNumberSeries(texts: readonly string[]): TableFillSeries {
  const parts = texts.map((text) => TRAILING_NUMBER.exec(text));
  if (parts.some((part) => part === null)) return NOT_A_SERIES;
  const matched = parts as readonly RegExpExecArray[];

  const [, prefix, firstDigits, suffix] = matched[0];
  const uniform = matched.every((part) => part[1] === prefix && part[3] === suffix);
  if (!uniform) return NOT_A_SERIES;

  const numbers = matched.map((part) => Number(part[2]));
  const step = matched.length === 1 ? 1 : exactStep(numbers);
  if (step === null) return NOT_A_SERIES;

  // Ζωνάρωμα **μόνο** όταν ο σπόρος το είχε: `007` συνεχίζει `008`, αλλά το `7` δεν αποκτά
  // ξαφνικά μηδενικά επειδή έτυχε να έχει ένα ψηφίο.
  const pad = firstDigits.startsWith('0') ? firstDigits.length : 0;
  return { kind: 'suffix-number', prefix, suffix, start: numbers[0], step, pad };
}

// ─── Ακριβή βήματα ──────────────────────────────────────────────────────────────

/**
 * Το κοινό βήμα μιας **ακριβούς** αριθμητικής προόδου, ή `null`.
 *
 * Χρησιμοποιείται εκεί όπου κλασματικό βήμα δεν σημαίνει τίποτα: μια λίστα δεν έχει μήνα
 * `1,5` και ένα `Στοιχείο 1,83` δεν είναι όνομα. Εκεί η μη ακριβής πρόοδος **δεν**
 * προσαρμόζεται με ελάχιστα τετράγωνα — απορρίπτεται, και το γέμισμα επαναλαμβάνει.
 */
function exactStep(values: readonly number[]): number | null {
  const step = values[1] - values[0];
  const isExact = values.every((value, i) => i === 0 || value - values[i - 1] === step);
  return isExact ? step : null;
}
