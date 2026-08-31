/**
 * 🔴 ADR-833 §5.7.5 — **ΤΙ ΔΕΝ ΚΡΑΤΑΜΕ, ΜΕΤΡΗΜΕΝΟ, ΠΡΙΝ ΤΗΝ ΕΙΣΑΓΩΓΗ.**
 *
 * Η στάση αποφασίστηκε στο §5.6.5, μετά από έρευνα σε Revit / LibreOffice / Google Sheets:
 *
 * > **Ο αναγνώστης ΑΠΑΡΙΘΜΕΙ ό,τι δεν καταλαβαίνει, και ο διάλογος το λέει ΠΡΙΝ την εισαγωγή.**
 * > Καμία σιωπηλή απώλεια. Καμία υπόσχεση διατήρησης που δεν μπορούμε να τηρήσουμε.
 *
 * ## Το πρότυπο είναι ο **Compatibility Checker του ίδιου του Excel**, με δύο βαθμίδες
 * | Microsoft | ορισμός | η δική μας ανάγνωση |
 * |---|---|---|
 * | *significant loss of **functionality*** | «χάνονται δεδομένα ή λειτουργία» | κάτι που ο πίνακας δεν **ΚΑΝΕΙ** |
 * | *minor loss of **fidelity*** | «τίποτα δεν χάνεται, δεν δείχνει ίδιο» | κάτι που ο πίνακας δεν **ΔΕΙΧΝΕΙ** |
 *
 * 🔑 **Πού ο ΝΕΣΤΩΡ πάει παραπέρα**: η Microsoft το κάνει στην **αποθήκευση**· εμείς και στο
 * **άνοιγμα** — στην πόρτα που ελέγχουμε, τη στιγμή που ο χρήστης μπορεί ακόμη να πει «όχι».
 * Το Sheets αγνοεί σιωπηλά, το Revit δεν κάνει round-trip, η LibreOffice φυλάει αθόρυβα:
 * **κανένας από τους τρεις δεν ρωτά πριν.**
 *
 * ## 🔴 ΤΟ ΟΡΙΟ ΤΗΣ ΑΠΑΡΙΘΜΗΣΗΣ, ΓΡΑΜΜΕΝΟ ΓΙΑΤΙ ΕΙΝΑΙ ΑΛΗΘΕΙΑ
 * Ο `exceljs` **δεν έχει καθόλου αναλυτή** για γραφήματα, συγκεντρωτικούς πίνακες ή slicers —
 * επαληθεύτηκε στην πηγή (`lib/xlsx/xform/sheet/` δεν περιέχει `chart`/`pivot` xform). Δεν
 * είναι ότι τα χάνουμε: **δεν μπορούμε ούτε να τα μετρήσουμε.** Άρα η λίστα δηλώνεται ως *«όσα
 * βλέπει ο αναγνώστης»* και **ποτέ** ως *«όλα όσα έχει το αρχείο»* — μια πλήρης απαρίθμηση θα
 * ήταν η ίδια υπόσχεση-που-δεν-τηρείται που το §5.6.5 απαγόρευσε, με άλλο πρόσωπο.
 *
 * ⚠️ Η **μία** εξαίρεση που δίνεται δωρεάν: η κατάληξη `.xlsm` είναι **δήλωση του ίδιου του
 * αρχείου** ότι κουβαλά μακροεντολές. Δεν χρειάζεται αναλυτής για να ειπωθεί.
 *
 * @module subapps/dxf-viewer/bim/table/import/xlsx-unsupported-scan
 * @see bim/table/import/xlsx-worksheet-format.ts — από εκεί έρχονται οι μετρήσεις ανά κελί
 * @see ui/dialogs/TableXlsxOpenConfirmDialog.tsx — ποιος το λέει στον άνθρωπο
 */

import type ExcelJS from 'exceljs';
import type { ImportedWorksheetFormat } from './xlsx-worksheet-format';

/**
 * Οι δύο βαθμίδες του Compatibility Checker. **Ένωση και όχι boolean**: ο λόγος που ο χρήστης
 * τις ξεχωρίζει είναι ότι απαντούν σε **άλλη** ερώτηση («θα βγάλει λάθος νούμερα;» vs «θα
 * δείχνει αλλιώς;»), και μια σημαία `severe` θα άφηνε τον καθένα να επινοήσει τι σημαίνει.
 */
export type XlsxUnsupportedTier = 'functionality' | 'fidelity';

/** Ό,τι το αρχείο δηλώνει και ο πίνακας **δεν** κρατά — με τη βαθμίδα του και το πλήθος του. */
export interface XlsxUnsupportedFinding {
  /**
   * Σταθερό αναγνωριστικό, **ποτέ κείμενο**: ο διάλογος το μεταφράζει με `t()`. Ένα έτοιμο
   * μήνυμα εδώ θα ήταν σκληροκωδικωμένο ορατό κείμενο σε `.ts` (κανόνας N.11) και θα πάγωνε τη
   * γλώσσα μέσα σε καθαρή συνάρτηση.
   */
  readonly key: XlsxUnsupportedKey;
  readonly tier: XlsxUnsupportedTier;
  /** Πόσα βρέθηκαν — ο αριθμός **είναι** το μήνυμα (NN/g), όχι διακόσμηση. */
  readonly count: number;
}

/** Το κλειστό σύνολο των πραγμάτων που ξέρουμε να μετρήσουμε. */
export type XlsxUnsupportedKey =
  | 'formulas'
  | 'conditionalFormatting'
  | 'dataValidation'
  | 'macros'
  | 'numberFormats'
  | 'images'
  | 'definedNames'
  | 'excelTables';

/** Η βαθμίδα καθενός — δηλωμένη **μία** φορά, ώστε κανείς να μην την ξαναποφασίσει. */
const TIER: Readonly<Record<XlsxUnsupportedKey, XlsxUnsupportedTier>> = {
  formulas: 'functionality',
  conditionalFormatting: 'functionality',
  dataValidation: 'functionality',
  macros: 'functionality',
  numberFormats: 'fidelity',
  images: 'fidelity',
  definedNames: 'fidelity',
  excelTables: 'fidelity',
};

/** Η κατάληξη που **το ίδιο το αρχείο** δηλώνει ότι κουβαλά μακροεντολές. */
const MACRO_EXTENSION = '.xlsm';

/**
 * Πόσα από αυτά δηλώνει το φύλλο. Τα τρία διαβάζονται από **δημόσιες** ιδιότητες του
 * `exceljs` που επαληθεύτηκαν με εκτέλεση (§5.7.5) — καμία δεν αντιγράφηκε από τεκμηρίωση.
 */
function perSheetCounts(sheet: ExcelJS.Worksheet): Partial<Record<XlsxUnsupportedKey, number>> {
  const conditional = (sheet as { conditionalFormattings?: readonly unknown[] }).conditionalFormattings;
  const validations = (sheet as { dataValidations?: { model?: Record<string, unknown> } }).dataValidations;
  const tables = (sheet as { tables?: Record<string, unknown> }).tables;
  return {
    conditionalFormatting: Array.isArray(conditional) ? conditional.length : 0,
    dataValidation: Object.keys(validations?.model ?? {}).length,
    excelTables: Object.keys(tables ?? {}).length,
    images: sheet.getImages().length,
  };
}

/**
 * **Η απαρίθμηση ενός βιβλίου.** Επιστρέφει **μόνο** ό,τι πράγματι βρέθηκε (πλήθος > 0), με τη
 * βαθμίδα «λειτουργίας» πρώτη: ο χρήστης διαβάζει από πάνω προς τα κάτω και το ακριβότερο
 * οφείλει να το συναντήσει πρώτο.
 *
 * @param formats Οι μορφοποιήσεις **στη σειρά των φύλλων** — από εκεί έρχονται οι δύο
 *   μετρήσεις που μόνο η σάρωση κελιών ξέρει (τύποι, μη αναγνωρίσιμες μορφές).
 * @param fileName Το όνομα που διάλεξε ο χρήστης· η κατάληξή του είναι δήλωση, όχι εικασία.
 */
export function scanXlsxUnsupported(
  workbook: ExcelJS.Workbook,
  formats: readonly ImportedWorksheetFormat[],
  fileName: string,
): readonly XlsxUnsupportedFinding[] {
  const counts = new Map<XlsxUnsupportedKey, number>();
  const add = (key: XlsxUnsupportedKey, n: number): void => {
    if (n > 0) counts.set(key, (counts.get(key) ?? 0) + n);
  };

  for (const sheet of workbook.worksheets) {
    const perSheet = perSheetCounts(sheet);
    for (const [key, value] of Object.entries(perSheet)) {
      add(key as XlsxUnsupportedKey, value ?? 0);
    }
  }
  for (const format of formats) {
    add('formulas', format.formulaCells);
    add('numberFormats', format.unrecognizedNumberFormats);
  }
  add('definedNames', workbook.definedNames.model.length);
  if (fileName.toLowerCase().endsWith(MACRO_EXTENSION)) add('macros', 1);

  return [...counts.entries()]
    .map(([key, count]) => ({ key, tier: TIER[key], count }))
    .sort((a, b) => (a.tier === b.tier ? a.key.localeCompare(b.key) : a.tier === 'functionality' ? -1 : 1));
}
