/**
 * 🔴 ADR-760 / ADR-739 §60 — **ΜΙΑ ΟΨΗ ΤΗΣ ΜΟΡΦΗΣ ΤΗ ΦΟΡΑ**: τι *είναι* και πώς *αλλάζει*
 * το είδος, τα δεκαδικά, η ομαδοποίηση, το νόμισμα, η μορφή ημερομηνίας, η μονάδα γωνίας.
 * Καθαρό· μηδέν React, μηδέν DOM.
 *
 * ## Γιατί ΔΕΥΤΕΡΟ αρχείο δίπλα στο `table-number-format-ops.ts`
 * Οι δύο απαντούν σε **διαφορετικές ερωτήσεις**, και η διαφορά γεννήθηκε με την **τρίτη**
 * επιφάνεια (τον διάλογο «Μορφοποίηση κελιών»):
 *
 * ```
 *   -ops.ts     «τι σημαίνει το ΠΑΤΗΜΑ;»   κουμπί χωρίς παράμετρο· εναλλαγή, ξεπάτωμα, σκαλί
 *   -facets.ts  «γράψε ΑΥΤΗ την τιμή»      πεδίο διαλόγου· ο χρήστης δηλώνει ρητά τι θέλει
 * ```
 *
 * Το `%` της κορδέλας **δεν** δέχεται τιμή — είναι διακόπτης, και ξεπατώνει όταν ξαναπατηθεί.
 * Το πτυσσόμενο «Κατηγορία» του διαλόγου δέχεται **ακριβώς** μία από τις οκτώ και δεν
 * ξεπατώνει ποτέ. Δύο σημασιολογίες, δύο υπογραφές.
 *
 * 🔑 **Και δεν είναι διπλότυπο — είναι ΕΞΑΓΩΓΗ** (N.0.2): τα `hasGrouping` / `decimalsOf` /
 * `withGrouping` / `withDecimals` / `localeOf` ζούσαν **ιδιωτικά** στο `-ops.ts`. Ο διάλογος τα
 * χρειάζεται αυτούσια· γραμμένα δεύτερη φορά εκεί θα ήταν ο κλασικός sibling clone που πιάνει
 * το CHECK 3.28 (N.18) — και, χειρότερα, δύο απαντήσεις στο «ομαδοποιεί αυτή η μορφή;», με τη
 * μία να ανάβει το κουμπί των χιλιάδων και την άλλη το κουτάκι του διαλόγου.
 *
 * ## 🔴 Η ΤΙΜΗ ΔΕΝ ΑΓΓΙΖΕΤΑΙ ΠΟΤΕ
 * Καμία συνάρτηση εδώ δεν επιστρέφει αριθμό κελιού — μόνο **μορφές**. Ο κανόνας «τιμή ≠
 * εμφάνιση» του `types/table-cell-format.ts` είναι εδώ **υπογραφή**, όχι σχόλιο.
 *
 * @module subapps/dxf-viewer/bim/table/table-number-format-facets
 * @see bim/table/table-number-format-ops.ts — τι σημαίνει το πάτημα (χτισμένο πάνω σε αυτό)
 * @see types/table-cell-format.ts — ο τύπος και ο κανόνας «τιμή ≠ εμφάνιση»
 */

import type { AngularUnitType, Precision } from '../../config/number-format-config';
import {
  DEFAULT_TABLE_CURRENCY,
  DEFAULT_TABLE_DATE_STYLE,
  type TableCellFormat,
  type TableCellFormatKind,
  type TableDateStyle,
  type TableFormatLocale,
} from '../../types/table-cell-format';

/**
 * Η προεπιλογή της μονάδας γωνίας — η ίδια που διαβάζει ο `renderAngle` του ADR-082.
 *
 * Ζει εδώ και όχι στο `-ops.ts` για τον ίδιο λόγο με τους υπόλοιπους κανονικοποιητές: η
 * σύγκριση «ίδια μορφή;» και η γραφή «βάλε αυτή τη μονάδα» **οφείλουν** να συμφωνούν στο τι
 * σημαίνει «απόν».
 */
export const DEFAULT_TABLE_ANGLE_UNIT: AngularUnitType = 'degrees';

/**
 * Τα σκαλιά ακρίβειας του ADR-082 (0-8), ως **πίνακας τιμών** και όχι ως όρια αριθμού.
 *
 * Έτσι το κόψιμο επιστρέφει `Precision` **χωρίς cast**: ένα `Math.min(...) as Precision` θα
 * ήταν υπόσχεση του συντάκτη προς τον μεταγλωττιστή, ενώ εδώ η τιμή έρχεται αποδεδειγμένα από
 * τον ίδιο τον τύπο. Η μέρα που το `Precision` αλλάξει εύρος, το λέει ο μεταγλωττιστής εδώ.
 */
export const TABLE_DECIMAL_STEPS: readonly Precision[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];

/**
 * 🔴 Η θέση κάθε κατηγορίας στη λίστα του διαλόγου — **η σειρά του Excel**, όσο μας αφορά.
 *
 * Το Excel δείχνει *Γενική · Αριθμός · Νόμισμα · Λογιστική · Ημερομηνία · Ώρα · Ποσοστό ·
 * Κλάσμα · Επιστημονική · Κείμενο · Ειδική · Προσαρμοσμένη*. Οι δικές μας οκτώ είναι το
 * **υποσύνολο που είναι εκφράσιμο** (`TableCellFormatKind`), στην ίδια ακολουθία: «καμία
 * γνώμη» πρώτη, «κείμενο» τελευταίο, οι αριθμητικές στη μέση.
 *
 * ⚠️ Η γωνία **δεν υπάρχει** στο Excel και μπαίνει στο τέλος των αριθμητικών: είναι η μία
 * κατηγορία που φέρνει το AutoCAD (`Angle`, με `AUNITS`) και που ένα σχέδιο χρειάζεται. Ίδια
 * αρχή με τη «σμίκρυνση» του §58 — καμία θέση του Excel δεν μετακινείται.
 *
 * ## 🔴 ΓΙΑΤΙ `Record` ΚΑΙ ΟΧΙ ΠΙΝΑΚΑΣ
 * Ένας πίνακας `['general', 'whole', …]` θα ήταν **δεύτερη λίστα** δίπλα στην ένωση, και θα
 * χρειαζόταν ξεχωριστό φύλακα πληρότητας — δηλαδή **τρίτη** δήλωση του ίδιου συνόλου. Ο
 * `Record<TableCellFormatKind, number>` είναι **εξαντλητικός από τον τύπο**: ένα ένατο είδος
 * **δεν μεταγλωττίζεται** χωρίς θέση εδώ, άρα δεν μπορεί να υπάρξει είδος που το μοντέλο
 * εκφράζει και ο διάλογος δεν προσφέρει. Είναι το σχήμα «τιμή που μπήκε στο union και ξεχάστηκε
 * από το σύνολο» που πλήρωσε το §58 (`SUPPORTED_OVERFLOW`) — κλεισμένο με τον μεταγλωττιστή.
 */
const KIND_ORDER: Readonly<Record<TableCellFormatKind, number>> = {
  general: 0,
  whole: 1,
  decimal: 2,
  currency: 3,
  percent: 4,
  angle: 5,
  date: 6,
  text: 7,
};

/**
 * Ο κατάλογος του διαλόγου — **παράγεται** από το {@link KIND_ORDER}, ποτέ γραμμένος ξανά.
 *
 * Η ρητή ταξινόμηση δεν στηρίζεται στη σειρά του `Object.keys`: εκείνη είναι μεν σειρά
 * εισαγωγής για κλειδιά-συμβολοσειρές, αλλά είναι **λεπτομέρεια της μηχανής** και όχι
 * συμβόλαιο — και η σειρά εδώ **είναι** προδιαγραφή (μνήμη χεριού του χρήστη του Excel).
 */
export const TABLE_NUMBER_FORMAT_KINDS: readonly TableCellFormatKind[] =
  (Object.keys(KIND_ORDER) as TableCellFormatKind[]).sort((a, b) => KIND_ORDER[a] - KIND_ORDER[b]);

// ──────────────────────────────────────────────────────────────────────────────
// ΑΝΑΓΝΩΣΗ — «τι λέει τώρα αυτή η μορφή;»
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Πόσα δεκαδικά δείχνει **τώρα** η μορφή· `null` ⇒ η ερώτηση δεν έχει νόημα γι' αυτήν.
 *
 * Ο `whole` απαντά `0` και όχι `null`: **έχει** ακρίβεια, απλώς είναι μηδενική. Η διάκριση
 * είναι που επιτρέπει στο `.00→` να τον μετατρέψει σε `decimal 1` αντί να τον προσπεράσει.
 */
export function tableNumberFormatDecimals(format: TableCellFormat | null): Precision | null {
  if (format === null) return null;
  switch (format.kind) {
    case 'decimal':
    case 'percent':
    case 'currency':
    case 'angle':
      return format.decimals;
    case 'whole':
      return 0;
    default:
      return null;
  }
}

/**
 * Το διαχωριστικό χιλιάδων **δεν είναι δικό του πεδίο** — είναι ιδιότητα τριών μορφών, και
 * **απόν σημαίνει ναι** (δες `TableWholeFormat.grouping`). Άρα «ενεργό» = «η μορφή ομαδοποιεί
 * τώρα», ακόμη κι αν κανείς δεν το ζήτησε ρητά: το χειριστήριο δείχνει **τι βλέπει ο χρήστης**,
 * όχι τι γράφτηκε στο αρχείο. Η δεύτερη ερώτηση («ποιος το είπε») έχει τη δική της απάντηση —
 * την κουκκίδα του ρητού και, από το §60, την **προέλευση**.
 */
export function tableNumberFormatHasGrouping(format: TableCellFormat): boolean {
  switch (format.kind) {
    case 'whole':
    case 'decimal':
    case 'currency':
      return format.grouping !== false;
    default:
      return false;
  }
}

/** Δέχεται αυτό το είδος διαχωριστικό χιλιάδων; (Το κουτάκι σβήνει αντί να λέει ψέματα.) */
export function tableNumberFormatSupportsGrouping(format: TableCellFormat): boolean {
  return format.kind === 'whole' || format.kind === 'decimal' || format.kind === 'currency';
}

/** Το `locale` ως **προαιρετικό κομμάτι αντικειμένου**, ώστε να μη γεννιέται `locale: undefined`. */
export function tableNumberFormatLocalePart(
  current: TableCellFormat | null,
): { readonly locale?: TableFormatLocale } {
  return current?.locale === undefined ? {} : { locale: current.locale };
}

// ──────────────────────────────────────────────────────────────────────────────
// ΓΡΑΦΗ — «άλλαξε ΜΟΝΟ αυτή την όψη»
// ──────────────────────────────────────────────────────────────────────────────

/** Το κόψιμο στα σκαλιά του `Precision`, σε **ένα** σημείο και χωρίς cast. */
export function clampTableFormatDecimals(value: number): Precision {
  const index = Math.min(Math.max(Math.round(value), 0), TABLE_DECIMAL_STEPS.length - 1);
  return TABLE_DECIMAL_STEPS[index];
}

/** Το `switch` **είναι** η στένωση: χωρίς αυτό, το `grouping` θα ήταν πλεονάζον πεδίο. */
export function withTableNumberFormatGrouping(
  format: TableCellFormat,
  grouping: boolean,
): TableCellFormat {
  switch (format.kind) {
    case 'whole':
    case 'decimal':
    case 'currency':
      return { ...format, grouping };
    default:
      return format;
  }
}

/**
 * Γράφει την ακρίβεια **χωρίς να αλλάξει είδος**, όπου γίνεται.
 *
 * Ο `whole` είναι η μία εξαίρεση και δεν είναι αυθαίρετη: «ακέραιος με 2 δεκαδικά» δεν
 * υπάρχει ως μορφή — η αύξηση **οφείλει** να τον κάνει δεκαδικό, κρατώντας την ομαδοποίησή του.
 */
export function withTableNumberFormatDecimals(
  current: TableCellFormat | null,
  decimals: Precision,
): TableCellFormat {
  if (current === null) return { kind: 'decimal', decimals };

  const locale = tableNumberFormatLocalePart(current);
  switch (current.kind) {
    case 'decimal':
    case 'percent':
    case 'currency':
    case 'angle':
      return { ...current, decimals };
    case 'whole':
      return {
        kind: 'decimal',
        decimals,
        ...(current.grouping === undefined ? {} : { grouping: current.grouping }),
        ...locale,
      };
    default:
      return { kind: 'decimal', decimals, ...locale };
  }
}

/** Ο κωδικός ISO 4217 — μόνο στο νόμισμα· αλλού η ερώτηση δεν έχει νόημα. */
export function withTableNumberFormatCurrency(
  current: TableCellFormat,
  currency: string,
): TableCellFormat {
  return current.kind === 'currency' ? { ...current, currency } : current;
}

/** Η μορφή ημερομηνίας — από τον **κατάλογο**, ποτέ ελεύθερο μοτίβο (δες `TableDateStyle`). */
export function withTableNumberFormatDateStyle(
  current: TableCellFormat,
  style: TableDateStyle,
): TableCellFormat {
  return current.kind === 'date' ? { ...current, style } : current;
}

/** Η μονάδα γωνίας — αυτούσιος ο `AngularUnitType` του ADR-082. */
export function withTableNumberFormatAngleUnit(
  current: TableCellFormat,
  unit: AngularUnitType,
): TableCellFormat {
  return current.kind === 'angle' ? { ...current, unit } : current;
}

/**
 * 🔴 **Η ΑΛΛΑΓΗ ΚΑΤΗΓΟΡΙΑΣ** — και ο κανόνας «ό,τι μεταφέρεται, μεταφέρεται».
 *
 * ## Γιατί δεν ξεκινά από το μηδέν κάθε φορά
 * Ο χρήστης που έχει `1.234,50 €` και διαλέγει «Δεκαδικός» περιμένει `1.234,50` — όχι
 * `1234,5`. Το Excel κάνει ακριβώς αυτό: οι επιλογές που **υπάρχουν και στις δύο** κατηγορίες
 * επιβιώνουν, οι υπόλοιπες πέφτουν στην προεπιλογή τους. Μια «καθαρή» εκκίνηση θα ήταν
 * σιωπηλή απώλεια ρύθμισης σε κάθε περιήγηση της λίστας — και η λίστα **είναι** για περιήγηση.
 *
 * ⚠️ Το `locale` επιβιώνει **πάντα**: είναι η σύμβαση αριθμών του **σχεδίου**
 * (`types/table-cell-format.ts`), όχι μέρος του «τι είδους αριθμός». Χαμένο σε κάθε αλλαγή
 * κατηγορίας, ο πίνακας θα άλλαζε σιωπηλά υποδιαστολή.
 *
 * 🔑 Τα `general` / `text` **δεν κρατούν τίποτα**, και σωστά: δηλώνουν ρητά «καμία αριθμητική
 * γνώμη». Ένα `{ kind: 'text', decimals: 2 }` δεν είναι καν εκφράσιμο — το επιβάλλει η
 * διακριτή ένωση, όχι αυτή η συνάρτηση.
 */
export function withTableNumberFormatKind(
  current: TableCellFormat | null,
  kind: TableCellFormatKind,
): TableCellFormat {
  const locale = tableNumberFormatLocalePart(current);
  const decimals = tableNumberFormatDecimals(current) ?? DEFAULT_KIND_DECIMALS[kind];
  const grouping = current !== null && tableNumberFormatSupportsGrouping(current)
    ? { grouping: tableNumberFormatHasGrouping(current) }
    : {};

  switch (kind) {
    case 'general':
      return { kind: 'general', ...locale };
    case 'text':
      return { kind: 'text', ...locale };
    case 'whole':
      return { kind: 'whole', ...grouping, ...locale };
    case 'decimal':
      return { kind: 'decimal', decimals, ...grouping, ...locale };
    case 'percent':
      return { kind: 'percent', decimals, ...locale };
    case 'currency':
      return {
        kind: 'currency',
        decimals,
        currency: current?.kind === 'currency' ? current.currency ?? DEFAULT_TABLE_CURRENCY : DEFAULT_TABLE_CURRENCY,
        ...grouping,
        ...locale,
      };
    case 'angle':
      return {
        kind: 'angle',
        decimals,
        unit: current?.kind === 'angle' ? current.unit ?? DEFAULT_TABLE_ANGLE_UNIT : DEFAULT_TABLE_ANGLE_UNIT,
        ...locale,
      };
    case 'date':
      return {
        kind: 'date',
        style: current?.kind === 'date' ? current.style ?? DEFAULT_TABLE_DATE_STYLE : DEFAULT_TABLE_DATE_STYLE,
        ...locale,
      };
  }
}

/**
 * Η ακρίβεια που παίρνει μια κατηγορία **όταν δεν υπάρχει τι να μεταφερθεί**.
 *
 * Οι τιμές είναι του Excel, μετρημένες: το «%» δίνει **ακέραιο** ποσοστό, το νόμισμα και ο
 * δεκαδικός **δύο** δεκαδικά. Η γωνία ακολουθεί τον δεκαδικό — είναι κι αυτή μέτρηση.
 * Τα είδη χωρίς ακρίβεια δηλώνουν `0` ώστε ο χάρτης να είναι **ολικός**: ένα
 * `Partial<Record<…>>` θα επέτρεπε σε ένα ένατο είδος να λείπει σιωπηλά.
 */
const DEFAULT_KIND_DECIMALS: Readonly<Record<TableCellFormatKind, Precision>> = {
  general: 0,
  text: 0,
  whole: 0,
  decimal: 2,
  percent: 0,
  currency: 2,
  angle: 2,
  date: 0,
};
