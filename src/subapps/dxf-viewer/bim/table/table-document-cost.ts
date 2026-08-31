/**
 * table-document-cost — **ΠΟΣΟ ΚΟΣΤΙΖΕΙ ΑΥΤΟΣ Ο ΠΙΝΑΚΑΣ ΣΤΟ ΕΓΓΡΑΦΟ ΠΟΥ ΣΩΖΕΤΑΙ;**
 *
 * ADR-833 Φάση 5Α — **το όργανο, όχι ο αριθμός**. Η Φάση 5 είναι «μέτρηση πρώτα, όριο
 * μετά»: τα σημερινά `256 × 1000` είναι όριο που **κανείς δεν μέτρησε**, και το ADR
 * απαγορεύει ρητά να αντικατασταθούν από δεύτερο τέτοιο. Αυτό το αρχείο δεν διαλέγει
 * κανένα νούμερο — **απαντά** ώστε να μπορεί κάποιος να διαλέξει.
 *
 * ## 🔴 Η προκείμενη που ήταν ΛΑΘΟΣ, και γιατί έπρεπε να διορθωθεί ΠΡΙΝ το όργανο
 *
 * Το ADR-833 δήλωνε σε **δύο** σημεία (§5.4.7, §5.5) ότι ο δεσμευτικός περιορισμός είναι
 * το *«σκληρό όριο 1 MiB/έγγραφο του Firestore»*. **Δεν είναι.** Η διαδρομή αποθήκευσης,
 * ιχνηλατημένη 2026-08-31:
 *
 * ```
 *   setLevelSceneWithAutoSave → executeSceneSave → DxfFirestoreService.autoSaveV2
 *     → saveToStorageImpl:  JSON.stringify(scene) → TextEncoder → uploadBytes(…)
 *                           ⇒ αντικείμενο Cloud STORAGE, όχι έγγραφο Firestore
 *     στο Firestore πηγαίνει ΜΟΝΟ metadata: storagePath, version, checksum
 * ```
 *
 * Άρα το ταβάνι δεν είναι 1 MiB αλλά το `MAX_FILE_SIZE_BYTES` του `DxfSecurityValidator`
 * — **25 MB**, με προειδοποίηση στα 10 MB. Ένα όργανο που μετρούσε απέναντι στο λάθος
 * όριο θα ήταν χειρότερο από κανένα όργανο: θα παρήγαγε «μετρημένο» αριθμό με **ψευδή
 * βάση**, δηλαδή ακριβώς την απαγορευμένη πράξη, αλλά με άλλοθι.
 *
 * ## Τι μετράει — και γιατί ΟΧΙ το `TableModel`
 *
 * Μετράει το σχήμα **που ταξιδεύει**: `TableWorksheet[]`, με `PersistedTableModel` μέσα.
 * Το runtime `TableModel` κρατά τα κελιά σε `Map`, και ο `Map` σειριοποιείται σε `{}`
 * **σιωπηλά** — ένα όργανο που δεχόταν `TableModel` θα ανέφερε σχεδόν **μηδέν** για κάθε
 * πίνακα του κόσμου, και θα ήταν πράσινο επειδή κανείς δεν κοίταξε. Η υπογραφή δέχεται
 * μόνο το persisted σχήμα, ώστε το λάθος να είναι **δομικά ανέφικτο** αντί για «σπάνιο».
 *
 * ## ⚠️ ΔΕΝ είναι για τον βρόχο ζωγραφικής
 *
 * Κάθε μέτρηση είναι ένα πλήρες `JSON.stringify` του υποδέντρου. Είναι φτηνό μία φορά
 * και **καταστροφικό** εξήντα φορές το δευτερόλεπτο. Ο προορισμός είναι: άγκυρες,
 * υπολογισμός ορίου (Φάση 5Β), και η στιγμή πριν την αποθήκευση. Ποτέ σε render, ποτέ
 * σε πληκτρολόγηση.
 *
 * @module subapps/dxf-viewer/bim/table/table-document-cost
 * @see lib/serialized-size — η μία αρχή του «πόσα bytes UTF-8»
 * @see security/DxfSecurityValidator — ο ιδιοκτήτης του ταβανιού (διαβάζεται, δεν αντιγράφεται)
 * @see docs/centralized-systems/reference/adrs/ADR-833-table-xlsx-import-and-worksheets.md §5.6
 */

import {
  serializedByteLength,
  checkSizeFits,
  type SizeFitVerdict,
} from '@/lib/serialized-size';
import { ENTERPRISE_LIMITS } from '../../security/DxfSecurityValidator';
import type { TableWorksheet, TableWorksheetId } from '../../types/table-worksheet';
import type { PersistedTableModel } from '../../types/table';

/**
 * Το ταβάνι της σκηνής, **διαβασμένο από τον ιδιοκτήτη του**.
 *
 * 🔴 Δεν αντιγράφεται εδώ αριθμός. Το `CLAUDE.md` (N.12) έχει μετρήσει **τέσσερις** φορές
 * το σχήμα «μπαγιάτικος αριθμός σε δεύτερη κατοικία»· μια σταθερά `25 * 1024 * 1024`
 * γραμμένη σε αυτό το αρχείο θα ήταν η πέμπτη.
 */
export const SCENE_DOCUMENT_LIMIT_BYTES = ENTERPRISE_LIMITS.MAX_FILE_SIZE_BYTES;

/** Το κατώφλι προειδοποίησης της ίδιας αρχής — η ζώνη «χωράει, αλλά κοίταξέ το». */
export const SCENE_DOCUMENT_WARN_BYTES = ENTERPRISE_LIMITS.WARN_FILE_SIZE_MB * 1024 * 1024;

/** Τι κοστίζει **ένα** φύλλο, με τα μεγέθη που εξηγούν το νούμερο. */
export interface WorksheetCost {
  readonly worksheetId: TableWorksheetId;
  /** Το φύλλο ολόκληρο όπως ταξιδεύει — όνομα, δεσμός, δρομέας, μοντέλο. */
  readonly bytes: number;
  /** Μόνο το `model` του. */
  readonly modelBytes: number;
  /** **Μόνο τα κελιά** — το κομμάτι που κλιμακώνεται με το περιεχόμενο. */
  readonly cellsBytes: number;
  /** **Μόνο οι στήλες** — πληρώνεται ανά στήλη, ανεξάρτητα από το πόσες γραμμές υπάρχουν. */
  readonly columnsBytes: number;
  /** **Μόνο οι γραμμές** — πληρώνεται ανά γραμμή, ακόμη κι αν είναι όλη κενή. */
  readonly rowsBytes: number;
  readonly rowCount: number;
  readonly columnCount: number;
  /** Τα **γραμμένα** κελιά. Ο χάρτης είναι αραιός: τα κενά δεν ταξιδεύουν. */
  readonly cellCount: number;
}

/**
 * Τι κοστίζει **το βιβλίο** — και, κυρίως, **το μοντέλο κόστους** που επιτρέπει πρόβλεψη.
 *
 * ## 🔴 Γιατί ΤΡΕΙΣ οριακές τιμές και όχι ένας μέσος όρος
 *
 * Η πρώτη γραφή αυτού του αρχείου διαιρούσε **ολόκληρο** το μοντέλο με το πλήθος των
 * κελιών. Η άγκυρα «*το σημερινό 256×1000 χωράει;*» το έπιασε **αμέσως**: σε δείγμα
 * 3 στηλών × 1 γραμμής, οι ορισμοί των στηλών κυριαρχούν, άρα το «κόστος κελιού» έβγαινε
 * φουσκωμένο και η απάντηση ήταν **163.160 κελιά** — δηλαδή «το σημερινό όριο δεν
 * χωράει», που είναι **ψέμα** παραγμένο από το ίδιο το όργανο.
 *
 * Ένα πραγματικό φύλλο πληρώνει τρία **διαφορετικά** πράγματα, με διαφορετικό ρυθμό:
 *
 * ```
 *   bytes ≈ πάγιο + (στήλες × bytesPerColumn) + (γραμμές × bytesPerRow)
 *                 + (γραμμένα κελιά × bytesPerCell)
 * ```
 *
 * Ένας μέσος όρος τα ανακατεύει και **αλλάζει τιμή ανάλογα με το σχήμα του δείγματος** —
 * δηλαδή δεν είναι μέτρηση, είναι τύχη. Οι τρεις οριακές τιμές μετριούνται **χωριστά**,
 * καθεμιά από τη δική της ακολουθία, και γι' αυτό επεκτείνονται.
 */
export interface TableDocumentCost {
  readonly bytes: number;
  readonly worksheets: readonly WorksheetCost[];
  readonly worksheetCount: number;
  readonly cellCount: number;
  /**
   * Bytes ανά **γραμμένο** κελί — μετρημένα από την ακολουθία των κελιών **και μόνο**.
   *
   * `0` όταν δεν υπάρχει γραμμένο κελί: χωρίς δείγμα δεν υπάρχει οριακή τιμή, και ένα
   * νούμερο βγαλμένο από διαίρεση με το μηδέν θα ήταν ακριβώς ο «αριθμός που κανείς δεν
   * μέτρησε», ντυμένος μέτρηση.
   */
  readonly bytesPerCell: number;
  /** Bytes ανά **στήλη** — ο ορισμός της στήλης, όχι το περιεχόμενό της. `0` χωρίς δείγμα. */
  readonly bytesPerColumn: number;
  /** Bytes ανά **γραμμή** — ο ορισμός της γραμμής, όχι το περιεχόμενό της. `0` χωρίς δείγμα. */
  readonly bytesPerRow: number;
}

/** Το σχήμα ενός **υποθετικού** πίνακα, για πρόβλεψη κόστους. */
export interface TableShape {
  readonly columnCount: number;
  readonly rowCount: number;
  /** Πόσα κελιά είναι **γραμμένα**. Ο χάρτης είναι αραιός: τα κενά δεν κοστίζουν. */
  readonly filledCellCount: number;
}

/**
 * Πόσα bytes πιάνει **αυτό το μοντέλο** όπως γράφεται.
 *
 * @param model Το σχήμα που ταξιδεύει — ποτέ το runtime `TableModel`.
 */
export function measureModelBytes(model: PersistedTableModel): number {
  return serializedByteLength(model);
}

/**
 * Πόσο κοστίζει **ένα** φύλλο.
 *
 * ⚠️ Το `bytes` μετρά το φύλλο **ολόκληρο**, όχι μόνο το μοντέλο του: το όνομα, ο δεσμός
 * και ο δρομέας ταξιδεύουν κι αυτά. Η διαφορά `bytes − modelBytes` είναι το **πάγιο** του
 * φύλλου — το κόστος που πληρώνεται μία φορά επειδή το φύλλο υπάρχει, και το νούμερο που
 * απαντά «πόσο κοστίζει ένα φύλλο παραπάνω» όταν έρθει η ώρα του ορίου φύλλων.
 */
export function measureWorksheetCost(worksheet: TableWorksheet): WorksheetCost {
  const model = worksheet.model;
  return {
    worksheetId: worksheet.id,
    bytes: serializedByteLength(worksheet),
    modelBytes: measureModelBytes(model),
    // Οι τρεις ακολουθίες μετριούνται **χωριστά**: μόνο έτσι η κάθε οριακή τιμή είναι
    // ανεξάρτητη από το σχήμα του δείγματος (δες την κεφαλίδα του `TableDocumentCost`).
    cellsBytes: serializedByteLength(model.cells),
    columnsBytes: serializedByteLength(model.columns),
    rowsBytes: serializedByteLength(model.rows),
    rowCount: model.rows.length,
    columnCount: model.columns.length,
    cellCount: model.cells.length,
  };
}

/** Οριακή τιμή από μια ακολουθία: `0` χωρίς δείγμα — «δεν ξέρω», όχι «μηδενικό κόστος». */
function marginal(totalBytes: number, count: number): number {
  return count === 0 ? 0 : totalBytes / count;
}

/**
 * Πόσο κοστίζει **το βιβλίο** — η ακολουθία φύλλων όπως κάθεται πάνω στην οντότητα.
 *
 * 🔑 Το `bytes` μετρά την **ακολουθία**, όχι το άθροισμα των φύλλων: τα κόμματα και οι
 * αγκύλες του πίνακα είναι κι αυτά bytes που γράφονται. Η διαφορά είναι μικρή και
 * σταθερή — αλλά ένα άθροισμα θα ήταν **εκτίμηση**, και αυτό το αρχείο υπάρχει ακριβώς
 * για να μη χρειάζεται κανείς να εκτιμά.
 *
 * @param worksheets Τα φύλλα της οντότητας (`TableEntity.worksheets`).
 */
export function measureTableDocumentCost(
  worksheets: readonly TableWorksheet[],
): TableDocumentCost {
  const perWorksheet = worksheets.map(measureWorksheetCost);
  const sum = (pick: (w: WorksheetCost) => number): number =>
    perWorksheet.reduce((total, w) => total + pick(w), 0);

  const cellCount = sum((w) => w.cellCount);
  return {
    bytes: serializedByteLength(worksheets),
    worksheets: perWorksheet,
    worksheetCount: worksheets.length,
    cellCount,
    bytesPerCell: marginal(sum((w) => w.cellsBytes), cellCount),
    bytesPerColumn: marginal(sum((w) => w.columnsBytes), sum((w) => w.columnCount)),
    bytesPerRow: marginal(sum((w) => w.rowsBytes), sum((w) => w.rowCount)),
  };
}

/**
 * Τι θα κόστιζε ένα φύλλο **αυτού** του σχήματος, με τις οριακές τιμές αυτής της μέτρησης.
 *
 * Είναι η συνάρτηση που απαντά στη Φάση 5Β: *«αν επιτρέψουμε 512 στήλες, τι πληρώνουμε;»* —
 * χωρίς να χρειαστεί να κατασκευαστεί πίνακας 512 στηλών.
 *
 * ⚠️ **Πρόβλεψη, όχι μέτρηση.** Αγνοεί το πάγιο του φύλλου (id, όνομα, περιτύλιγμα), που
 * είναι σταθερό και μικρό, και υποθέτει ότι το **μέσο** κελί του δείγματος εκπροσωπεί τα
 * υπόλοιπα. Για δείγμα με ελληνικά κελιά η πρόβλεψη είναι ρεαλιστική· για δείγμα με κενά
 * κελιά είναι αισιόδοξη. Όποιος τη χρησιμοποιεί για να **κλειδώσει** όριο οφείλει να
 * τρέξει τη μέτρηση σε αντιπροσωπευτικό δείγμα — γι' αυτό η συνάρτηση δέχεται `cost`
 * μετρημένο και όχι σταθερές.
 */
export function projectTableBytes(cost: TableDocumentCost, shape: TableShape): number {
  return (
    shape.columnCount * cost.bytesPerColumn +
    shape.rowCount * cost.bytesPerRow +
    shape.filledCellCount * cost.bytesPerCell
  );
}

/**
 * Χωράει αυτός ο πίνακας στο μερίδιο που του δίνεται;
 *
 * @param cost Μετρημένο κόστος (από {@link measureTableDocumentCost}).
 * @param limitBytes Το **μερίδιο** του πίνακα, σε bytes.
 *
 * 🔴 **Το μερίδιο δίνεται ρητά και ΔΕΝ έχει προεπιλογή — επίτηδες.** Ο πίνακας
 * μοιράζεται το έγγραφο με ολόκληρη τη σκηνή (τοίχους, υποστυλώματα, τη γεωμετρία του
 * DXF)· ένα κλάσμα γραμμένο εδώ θα ήταν **ακριβώς** ο αυθαίρετος αριθμός που η Φάση 5
 * υπάρχει για να εξαλείψει, και θα τον νομιμοποιούσε επειδή θα καθόταν μέσα στο όργανο
 * μέτρησης. Το μερίδιο το αποφασίζει η **Φάση 5Β**, με τις μετρήσεις στο τραπέζι.
 */
export function checkTableFits(cost: TableDocumentCost, limitBytes: number): SizeFitVerdict {
  return checkSizeFits(cost.bytes, limitBytes);
}

/**
 * Πόσα **γραμμένα κελιά** χωράνε σε αυτό το μερίδιο, με βάση το μετρημένο κόστος ανά κελί.
 *
 * Είναι η ερώτηση της Φάσης 5Β αντεστραμμένη: όχι «χωράει αυτό;» αλλά «πόσο μεγάλο
 * επιτρέπεται να γίνει;». Το σχήμα ορίου που προκύπτει είναι **γινόμενο** (κελιά), όχι
 * διαστάσεις — το ίδιο που επιλέγουν τα Google Sheets (10.000.000 κελιά ανά βιβλίο)
 * και για τον ίδιο λόγο: το έγγραφο πληρώνει για τα **κελιά**, και ένα ζεύγος ορίων
 * `γραμμές × στήλες` απαγορεύει τον στενό-ψηλό πίνακα που χωράει άνετα.
 *
 * @param cost Μετρημένο κόστος — **με πραγματικό περιεχόμενο μέσα**. Πίνακας χωρίς
 *   γραμμένα κελιά δεν έχει μέση τιμή να δώσει.
 * @param limitBytes Το μερίδιο του πίνακα, σε bytes.
 * @returns Πλήθος κελιών, ή `null` όταν δεν υπάρχει δείγμα να εξαχθεί μέση τιμή.
 *   **`null`, ποτέ `Infinity`**: το «δεν ξέρω» και το «άπειρα» είναι διαφορετικές
 *   απαντήσεις, και ένα `Infinity` εδώ θα διάβαζε ως άδεια.
 */
export function affordableCellCount(
  cost: TableDocumentCost,
  limitBytes: number,
): number | null {
  if (cost.bytesPerCell <= 0) return null;
  return Math.floor(limitBytes / cost.bytesPerCell);
}
