/**
 * 🔴 ADR-828 §3 — **ΤΙ ΓΡΑΦΕΙ Η ΣΕΙΡΑ ΣΤΗ ΘΕΣΗ k.** Καθαρή συνάρτηση: μηδέν μοντέλο, μηδέν
 * γεωμετρία, μηδέν React.
 *
 * ## 🔑 ΔΕΝ ΥΠΑΡΧΕΙ ΠΑΡΑΜΕΤΡΟΣ ΚΑΤΕΥΘΥΝΣΗΣ — και αυτό είναι το κεντρικό σχεδιαστικό γεγονός
 * Το γέμισμα προς τα **πάνω** ή **αριστερά** δίνει **αρνητική** θέση, και η ίδια έκφραση
 * `αρχή + βήμα·θέση` εξάγει προς τα πίσω μόνη της. Ένας κλάδος «αν ανάποδα» θα ήταν δεύτερο
 * σημείο που μπορεί να μάθει διαφορετικό πρόσημο — ακριβώς το σφάλμα που το
 * {@link positiveMod} υπάρχει για να αποκλείσει μια στάθμη πιο κάτω, και που θα χτυπούσε
 * **μόνο** τη μισή κίνηση του ποντικιού, δηλαδή θα επιβίωνε σε κάθε πρόχειρο έλεγχο.
 *
 * @module subapps/dxf-viewer/bim/table/table-fill-series-generate
 * @see bim/table/table-fill-series-detect.ts — η άλλη μισή ερώτηση
 * @see docs/centralized-systems/reference/adrs/ADR-828-table-autofill-series.md §3
 */

import { applyWrittenWordShape } from '@/utils/greek-text';
import { formatLocaleNumber } from '@/lib/number/locale-number';
import { positiveMod } from '@/lib/number/positive-mod';
import {
  addMonthsClampedUtc,
  addYearsClampedUtc,
} from '@/lib/date/calendar-arithmetic';
import { dateFromExcelSerial, excelSerialFromDate } from './formula/excel-serial-date';
import type { TableDateStepUnit, TableFillSeries } from './table-fill-series-types';

/**
 * Η τιμή της σειράς στη θέση `ordinal`, όπου **0 = ο πρώτος σπόρος** της λωρίδας.
 *
 * `null` σημαίνει «αυτό το κελί δεν παίρνει σειρά» — είτε επειδή δεν υπάρχει σειρά
 * (`kind: 'copy'`), είτε επειδή η συγκεκριμένη θέση βγαίνει **εκτός ημερολογίου**. Και στις
 * δύο περιπτώσεις ο καλών πέφτει πίσω στην κυκλική επανάληψη, ώστε το κελί να πάρει κάτι που
 * ο χρήστης **βλέπει ήδη** αντί για `NaN` ή `Invalid Date`.
 */
export function tableFillSeriesTextAt(series: TableFillSeries, ordinal: number): string | null {
  switch (series.kind) {
    case 'copy':
      return null;

    case 'numeric':
      return formatLocaleNumber(series.start + series.step * ordinal, series.written);

    case 'suffix-number': {
      const value = series.start + series.step * ordinal;
      return `${series.prefix}${padNumber(value, series.pad)}${series.suffix}`;
    }

    case 'list': {
      // Η **αναδίπλωση** μετακόμισε εδώ μαζί με τα ονόματα (Φ4β): `ΔΕΚΕΜΒΡΙΟΣ → ΙΑΝΟΥΑΡΙΟΣ`
      // προς τα εμπρός και `ΙΑΝΟΥΑΡΙΟΣ → ΔΕΚΕΜΒΡΙΟΣ` προς τα πίσω είναι η **ίδια** έκφραση,
      // όχι δύο κλάδοι — και ο `positiveMod` είναι ο **ένας**, ο ίδιος που χρησιμοποιεί το
      // λεξιλόγιο για τους ενσωματωμένους μήνες. Δεύτερο υπόλοιπο εδώ θα ήταν δεύτερο σημείο
      // που μπορεί να μάθει διαφορετικό πρόσημο (δες `lib/number/positive-mod.ts`).
      //
      // 🔑 Ο φρουρός `entries.length > 0` δεν χρειάζεται: ο τύπος είναι μη-κενή πλειάδα.
      const canonical = series.entries[
        positiveMod(series.start + series.step * ordinal, series.entries.length)
      ];
      return applyWrittenWordShape(canonical, series.shape);
    }

    case 'date': {
      const serial = dateSerialAt(series.start, series.step * ordinal, series.unit);
      return serial === null ? null : String(serial);
    }
  }
}

/**
 * Ζωνάρωμα με μηδενικά, **μόνο** όταν ο σπόρος το είχε.
 *
 * ⚠️ Το πρόσημο μπαίνει **πριν** τα μηδενικά: `-007`, ποτέ `00-7`. Η σειρά μπορεί κάλλιστα να
 * περάσει στους αρνητικούς όταν ο χρήστης σέρνει προς τα πάνω.
 */
function padNumber(value: number, pad: number): string {
  const digits = Math.abs(value).toString().padStart(pad, '0');
  return value < 0 ? `-${digits}` : digits;
}

/**
 * Ο σειριακός `start` μετά από `offset` **μονάδες** — ή `null` αν βγει εκτός ημερολογίου.
 *
 * Οι μήνες και τα έτη περνούν από το **ψαλίδισμα** του {@link addMonthsClampedUtc}, ώστε το
 * «31 Ιανουαρίου + 1 μήνας» να μένει στον Φεβρουάριο. Οι ημέρες είναι σκέτη πρόσθεση: ο
 * σειριακός του Excel **είναι** μετρητής ημερών, οπότε οποιαδήποτε άλλη διαδρομή θα ήταν
 * μετατροπή χωρίς λόγο — και κάθε μετατροπή σε `Date` και πίσω είναι μια ευκαιρία να μπει
 * ζώνη ώρας εκεί που δεν υπάρχει ώρα.
 */
function dateSerialAt(start: number, offset: number, unit: TableDateStepUnit): number | null {
  if (unit === 'day') return validSerial(start + offset);

  const from = dateFromExcelSerial(start);
  if (from === null) return null;

  if (unit === 'weekday') return validSerial(addWeekdays(start, offset));
  const moved = unit === 'month' ? addMonthsClampedUtc(from, offset) : addYearsClampedUtc(from, offset);
  return validSerial(excelSerialFromDate(moved));
}

/** Ο φύλακας του ημερολογίου: ό,τι δεν γυρίζει σε ημερομηνία δεν γράφεται ως ημερομηνία. */
function validSerial(serial: number): number | null {
  return dateFromExcelSerial(serial) === null ? null : serial;
}

/**
 * `count` **εργάσιμες** ημέρες μπροστά ή πίσω, προσπερνώντας Σάββατο και Κυριακή.
 *
 * ⚠️ Το σαββατοκύριακο είναι **καρφωμένο** σε Σάββατο/Κυριακή, και αυτό δηλώνεται αντί να
 * ρυθμίζεται: η εναλλακτική είναι η ερώτηση «ποια είναι η πρώτη μέρα της εβδομάδας;», που
 * είναι **άλλη** ερώτηση — αφορά την **παρουσίαση** ενός ημερολογίου, όχι το ποιες μέρες
 * δουλεύει ένα εργοτάξιο. Η ελληνική κατασκευαστική πρακτική δεν χρειάζεται παραμετροποίηση
 * εδώ, και μια αχρησιμοποίητη ρύθμιση είναι επιφάνεια που κάποιος θα ρυθμίσει λάθος.
 *
 * ⚠️ Επίσης **δεν** γνωρίζει αργίες. Το ίδιο ισχύει για το Excel: η «συμπλήρωση καθημερινών»
 * μετρά μέρες της εβδομάδας, όχι εργάσιμες του ημερολογίου — για εκείνο υπάρχει `WORKDAY`.
 */
function addWeekdays(startSerial: number, count: number): number {
  if (count === 0) return startSerial;

  const direction = count > 0 ? 1 : -1;
  let remaining = Math.abs(count);
  let serial = startSerial;

  while (remaining > 0) {
    serial += direction;
    const date = dateFromExcelSerial(serial);
    if (date === null) return serial;
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return serial;
}
