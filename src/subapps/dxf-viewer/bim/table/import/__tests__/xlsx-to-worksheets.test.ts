/**
 * ADR-833 §1.1 — άγκυρες του αναγνώστη `.xlsx`, με **πραγματικό** βιβλίο.
 *
 * Το βιβλίο φτιάχνεται από το ίδιο `exceljs` που θα το διαβάσει — δηλαδή η δοκιμή περνά από
 * τον **αληθινό** σειριοποιητή, όχι από επινοημένο σχήμα. Ένα χειροποίητο mock του `Workbook`
 * θα επιβεβαίωνε μόνο ότι ο κώδικας συμφωνεί με τη φαντασία μας για τη βιβλιοθήκη.
 *
 * 🔴 **Τα δύο πράγματα που ΠΡΕΠΕΙ να μην ξαναγίνουν**:
 *   1. Να διαβαστεί μόνο το **πρώτο** φύλλο (η σιωπηλή απώλεια του `topo-excel-reader.ts:41`).
 *   2. Να **συμπτυχθούν** οι κενές γραμμές (μετακινεί προς τα πάνω κάθε επόμενη γραμμή).
 */

import ExcelJS from 'exceljs';
import { readXlsxWorksheets } from '../xlsx-to-worksheets';

/** Βιβλίο τριών φύλλων με τιμή, τύπο, κενή γραμμή και ημερομηνία — τα σχήματα που πονάνε. */
async function buildWorkbook(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();

  const first = wb.addWorksheet('Πωλήσεις');
  first.getCell('A1').value = 'Είδος';
  first.getCell('B1').value = 'Ποσό';
  first.getCell('A2').value = 'Τσιμέντο';
  first.getCell('B2').value = 120;
  // Γραμμή 3 σκόπιμα ΚΕΝΗ — διαχωριστικό που έβαλε ο χρήστης.
  first.getCell('A4').value = 'Σίδερο';
  first.getCell('B4').value = { formula: 'B2*2', result: 240 };

  const second = wb.addWorksheet('Κόστη');
  second.getCell('A1').value = 'μόνο ένα κελί';

  const third = wb.addWorksheet('Τρίτο');
  third.getCell('A1').value = 'τρία';

  const buffer = await wb.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

describe('readXlsxWorksheets — ΟΛΑ τα φύλλα, όχι μόνο το πρώτο', () => {
  it('🔴 επιστρέφει ΚΑΙ ΤΑ ΤΡΙΑ φύλλα, με τα ονόματά τους, στη σειρά του βιβλίου', async () => {
    const sheets = await readXlsxWorksheets(await buildWorkbook());
    // Αν κάποιος «απλοποιήσει» σε `workbook.worksheets[0]`, εδώ γίνεται 1.
    expect(sheets).toHaveLength(3);
    expect(sheets.map((s) => s.name)).toEqual(['Πωλήσεις', 'Κόστη', 'Τρίτο']);
  });

  it('τα δεδομένα του πρώτου φύλλου φτάνουν κατά θέση', async () => {
    const [first] = await readXlsxWorksheets(await buildWorkbook());
    expect(first.grid[0][0]).toBe('Είδος');
    expect(first.grid[1][0]).toBe('Τσιμέντο');
    expect(first.grid[1][1]).toBe('120');
  });

  it('🔴 η ΚΕΝΗ γραμμή 3 επιβιώνει — το «Σίδερο» μένει στη γραμμή 4', async () => {
    const [first] = await readXlsxWorksheets(await buildWorkbook());
    // Αν οι κενές πέφτονταν (η παγίδα του `eachRow`), το «Σίδερο» θα καθόταν στο index 2.
    expect(first.grid[2].every((c) => c === '')).toBe(true);
    expect(first.grid[3][0]).toBe('Σίδερο');
  });

  it('ο τύπος `B2*2` δίνει το ΑΠΟΤΕΛΕΣΜΑ, όχι «[object Object]» ούτε το κείμενο του τύπου', async () => {
    const [first] = await readXlsxWorksheets(await buildWorkbook());
    // Η συνειδητή απόφαση 2 της κεφαλίδας: τιμές, όχι τύποι — αλλά ΠΟΤΕ σκουπίδια.
    expect(first.grid[3][1]).toBe('240');
    expect(first.grid[3][1]).not.toContain('object');
  });

  it('βιβλίο χωρίς φύλλα ⇒ κενός πίνακας, ΟΧΙ εξαίρεση', async () => {
    const wb = new ExcelJS.Workbook();
    const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    await expect(readXlsxWorksheets(buffer)).resolves.toEqual([]);
  });
});
