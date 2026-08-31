/**
 * 🔴 ADR-833 Φάση 7 — **ΠΟΙΟ ΒΙΒΛΙΟ ΒΛΕΠΕΙ ΕΝΑΣ ΠΙΝΑΚΑΣ**, και **ΠΩΣ ΓΡΑΦΟΝΤΑΙ ΤΑ ΦΥΛΛΑ ΤΟΥ**.
 * Η γέφυρα ανάμεσα στην **οντότητα** (που ξέρει από φύλλα) και στη **μηχανή τύπων** (που ξέρει
 * μόνο από πλέγματα και ονόματα).
 *
 * ## Γιατί δύο ονοματοδοσίες, και γιατί ΔΕΝ είναι διπλότυπο
 * Ο φάκελος `formula/` είναι **καθαρός από i18n** επίτηδες: ο αναλυτής δεν επιτρέπεται να
 * μάθει γλώσσα. Δέχεται λοιπόν την ονοματοδοσία **ως παράμετρο**, όπως ακριβώς δέχεται τη
 * γραμματική (ADR-761). Και οι δύο υλοποιήσεις που υπάρχουν απαντούν σε **διαφορετική
 * ερώτηση**:
 *
 * ```
 *   ΟΘΟΝΗ    «πώς λέγεται στη ζωντανή γλώσσα;»   worksheetDisplayName → μοναδικοποίηση
 *   ΑΡΧΕΙΟ   «πώς λέγεται ΜΕΣΑ σε αυτό το .xlsx;» εξυγίανση OOXML     → μοναδικοποίηση
 * ```
 *
 * Η **μοναδικοποίηση** είναι κοινή και ζει σε ένα σημείο
 * (`@/lib/spreadsheet/unique-sheet-names`)· η **εξυγίανση** είναι όρος του μορφότυπου και
 * μένει στον γραφέα του. Είναι η ίδια γραμμή «μηχανική ↔ λεξιλόγιο» που τράβηξε το §5.7.1.
 *
 * ## 🔑 ΓΙΑΤΙ Η ΜΟΝΑΔΙΚΟΠΟΙΗΣΗ ΦΤΑΝΕΙ ΚΑΙ ΣΤΗΝ ΟΘΟΝΗ
 * Δύο φύλλα **επιτρέπεται** να λέγονται «Κόστη» (§5.4.4). Αν ο εκτυπωτής έγραφε σκέτο
 * `=Κόστη!A1` και για τα δύο, το ίδιο κείμενο θα ξαναδιαβαζόταν στο **πρώτο** — δηλαδή ένας
 * τύπος που ο χρήστης απλώς **άνοιξε και έκλεισε** θα άλλαζε σιωπηλά φύλλο. Σε πίνακα
 * ποσοτήτων αυτό είναι **σφάλμα τιμής σε παραδοτέο** (ADR-720/764).
 *
 * Η μοναδικοποίηση μπαίνει στο **σύνορο της γραφής** και **ποτέ στα δεδομένα**: οι καρτέλες
 * εξακολουθούν να λένε και οι δύο «Κόστη», γιατί εκεί η ταυτότητα είναι το `id` και ο χρήστης
 * βλέπει ποια πάτησε.
 *
 * @module subapps/dxf-viewer/bim/table/table-worksheet-book
 * @see bim/table/formula/table-formula-workbook.ts — ο τύπος και ο επιλυτής πλέγματος
 * @see bim/table/table-worksheet-name.ts — ο ΕΝΑΣ επιλυτής ονόματος καρτέλας
 * @see docs/centralized-systems/reference/adrs/ADR-833-table-xlsx-import-and-worksheets.md §5.9.1
 */

import { uniqueSheetNames } from '@/lib/spreadsheet/unique-sheet-names';
import type { TableEntity } from '../../types/table-entity';
import type { TableWorksheetId } from '../../types/table-ids';
import type { TableWorksheet } from '../../types/table-worksheet';
import type {
  TableFormulaWorkbook,
  TableWorksheetNaming,
} from './formula/table-formula-workbook';
import { resolveTableModel } from './table-model-helpers';
import { worksheetDisplayName } from './table-worksheet-name';
import { activeWorksheet, resolveWorksheets } from './table-worksheet-resolve';

/**
 * Ονοματοδοσία από **παράλληλους** πίνακες φύλλων και ονομάτων — η μία σύνθεση, δύο πελάτες.
 *
 * ⚠️ Τα ονόματα πρέπει να είναι ήδη **μοναδικά**: η αντίστροφη κατεύθυνση (`idOf`) κρατά το
 * **πρώτο** που συνάντησε, οπότε δύο ίδια ονόματα θα έκαναν το δεύτερο φύλλο **απροσπέλαστο**
 * από πληκτρολόγηση. Γι' αυτό η μοναδικοποίηση δεν είναι επιλογή του καλούντος αλλά μέρος
 * και των δύο εργοστασιαρχών από κάτω.
 *
 * Η αναζήτηση κατά όνομα είναι **χωρίς διάκριση πεζών/κεφαλαίων**, όπως στο Excel — και με
 * τον **ίδιο** μετασχηματισμό (`toLowerCase`) που χρησιμοποιεί η μοναδικοποίηση, ώστε οι δύο
 * πλευρές να μη μπορούν να διαφωνήσουν για το τι είναι «ίδιο όνομα».
 */
export function worksheetNamingFrom(
  worksheets: readonly TableWorksheet[],
  names: readonly string[],
): TableWorksheetNaming {
  const byId = new Map<TableWorksheetId, string>();
  const byName = new Map<string, TableWorksheetId>();
  worksheets.forEach((worksheet, index) => {
    const name = names[index];
    if (name === undefined) return;
    byId.set(worksheet.id, name);
    if (!byName.has(name.toLowerCase())) byName.set(name.toLowerCase(), worksheet.id);
  });
  return {
    nameOf: (id) => byId.get(id) ?? null,
    idOf: (name) => byName.get(name.toLowerCase()) ?? null,
  };
}

/**
 * **Η ονοματοδοσία της ΟΘΟΝΗΣ**: ζωντανή γλώσσα, μοναδικοποιημένη για τη γραμμή τύπων.
 *
 * ⚠️ Διαβάζει το singleton `i18n` **τη στιγμή της κλήσης**, μέσω του `worksheetDisplayName` —
 * το ίδιο ιδίωμα με κάθε imperative ετικέτα του καμβά (ADR-040: *getter τη στιγμή του
 * συμβάντος, ποτέ στιγμιότυπο*). Άρα ο ίδιος τύπος γράφεται `=Φύλλο2!A1` σε ελληνικό UI και
 * `=Sheet2!A1` σε αγγλικό, **χωρίς** τίποτα αποθηκευμένο να μπορεί να παλιώσει.
 */
export function screenWorksheetNaming(
  worksheets: readonly TableWorksheet[],
): TableWorksheetNaming {
  return worksheetNamingFrom(
    worksheets,
    uniqueSheetNames(worksheets.map((worksheet, index) => worksheetDisplayName(worksheet, index))),
  );
}

/**
 * **Το βιβλίο ενός πίνακα φύλλων**, με σπίτι το φύλλο που δηλώνεται.
 *
 * Το `naming` είναι παράμετρος ώστε η **εξαγωγή** να δίνει τα δικά της ονόματα χωρίς δεύτερο
 * εργοστασιάρχη βιβλίου. Απόν ⇒ η ονοματοδοσία της οθόνης, που είναι ό,τι θέλει κάθε
 * διαδρομή του καμβά.
 */
export function worksheetsFormulaBook(
  worksheets: readonly TableWorksheet[],
  homeId: TableWorksheetId,
  naming: TableWorksheetNaming = screenWorksheetNaming(worksheets),
): TableFormulaWorkbook {
  const sheets = new Map(
    worksheets.map((worksheet) => [worksheet.id, resolveTableModel(worksheet.model)] as const),
  );
  // ⚠️ Το σπίτι **πρέπει** να υπάρχει στον χάρτη: ο επιλυτής πλέγματος είναι μία αναζήτηση
  // χωρίς ειδική περίπτωση, και ένα βιβλίο χωρίς σπίτι θα έδινε `#REF!` σε **κάθε** αναφορά.
  // Συμβαίνει μόνο για ταυτότητα που δεν ανήκει σε αυτόν τον πίνακα — δηλαδή για σφάλμα
  // καλούντος — και το κενό βιβλίο το λέει, αντί να το κρύψει πίσω από την πρώτη καρτέλα.
  return { homeId, sheets, naming };
}

/**
 * 🔑 **ΤΟ ΒΙΒΛΙΟ ΜΙΑΣ ΟΝΤΟΤΗΤΑΣ** — η μία κλήση που κάνει κάθε πόρτα του καμβά.
 *
 * Σπίτι είναι το **ενεργό** φύλλο, γιατί αυτό γράφει και αυτό διαβάζει ο άνθρωπος. Κάθε πόρτα
 * που **γράφει** εγκαθιστά μετά το δικό της ζωντανό πλέγμα (`bookWithHome`), οπότε το μοντέλο
 * που κάθεται εδώ μέσα είναι απλώς η αφετηρία.
 */
export function tableEntityFormulaBook(entity: TableEntity): TableFormulaWorkbook {
  return worksheetsFormulaBook(resolveWorksheets(entity), activeWorksheet(entity).id);
}
