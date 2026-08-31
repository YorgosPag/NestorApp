/**
 * ADR-833 §5.7.1 — άγκυρες της **μηχανικής** του βιβλίου, και ιδίως του ευρήματος που κόστιζε:
 * τα διπλά ονόματα φύλλων **έριχναν** τον γονιό με εξαίρεση.
 *
 * @see bim/schedule/exporters/xlsx-workbook.ts
 */

import ExcelJS from 'exceljs';
import {
  XLSX_MIME_TYPE,
  XLSX_WORKSHEET_NAME_MAX,
  createXlsxWorkbook,
  xlsxWorkbookToBlob,
  xlsxWorksheetNames,
} from '../exporters/xlsx-workbook';

describe('ADR-833 §5.7.1 — ονόματα φύλλων: το Excel τα δέχεται ΟΛΑ', () => {
  it('🔴 διπλά ονόματα ⇒ σύμβαση (2)/(3), ΠΟΤΕ εξαίρεση', () => {
    expect(xlsxWorksheetNames(['Δοκοί', 'Δοκοί', 'Δοκοί'])).toEqual([
      'Δοκοί',
      'Δοκοί (2)',
      'Δοκοί (3)',
    ]);
  });

  it('🔴 η σύγκριση είναι case-insensitive — ΑΥΣΤΗΡΟΤΕΡΑ από τον exceljs, όπως το Excel', () => {
    // Ο `exceljs` συγκρίνει με `===` και θα δεχόταν και τα δύο· το **Excel** τα θεωρεί ίδιο
    // όνομα και θα αρνιόταν να ανοίξει το βιβλίο. Ισχύει ο αυστηρότερος.
    expect(xlsxWorksheetNames(['Φύλλο', 'φύλλο'])).toEqual(['Φύλλο', 'φύλλο (2)']);
    expect(xlsxWorksheetNames(['Beams', 'BEAMS', 'beams'])).toEqual([
      'Beams',
      'BEAMS (2)',
      'beams (3)',
    ]);
  });

  it('🔑 τα ΕΛΛΗΝΙΚΑ ΚΕΦΑΛΑΙΑ χάνουν τον τόνο — άρα «ΦΥΛΛΟ» ΔΕΝ είναι εκδοχή του «Φύλλο»', () => {
    // Μετρημένο, όχι υποτεθειμένο: `'ΦΥΛΛΟ'.toLowerCase() === 'φυλλο'` ενώ
    // `'Φύλλο'.toLowerCase() === 'φύλλο'` — **διαφορετικά** αλφαριθμητικά.
    expect('ΦΥΛΛΟ'.toLowerCase()).not.toBe('Φύλλο'.toLowerCase());
    // Και σωστά δεν συγκρούονται: ούτε το Excel τα ταυτίζει (η σύγκρισή του αγνοεί τα πεζά,
    // **όχι** τους τόνους). Ένα «έξυπνο» ξεγύμνωμα τόνων εδώ θα μετονόμαζε φύλλα που ο
    // χρήστης θεωρεί διαφορετικά.
    expect(xlsxWorksheetNames(['Φύλλο', 'ΦΥΛΛΟ'])).toEqual(['Φύλλο', 'ΦΥΛΛΟ']);
  });

  it('🔴 το όριο είναι ΤΟΥ EXCEL — 31, γραμμένο ως αριθμός, όχι ως ο εαυτός του', () => {
    // ⚠️ Εδώ έγραφε `expect(name.length).toBeLessThanOrEqual(XLSX_WORKSHEET_NAME_MAX)` —
    // **αυτοαναφορικό**: η σταθερά συγκρινόταν με τον εαυτό της, οπότε μια αλλαγή της σε 255
    // περνούσε άθικτη. Το έπιασε η μετάλλαξη M14 (ADR-833 §5.7.6).
    expect(XLSX_WORKSHEET_NAME_MAX).toBe(31);
  });

  it('🔴 η ΠΕΡΙΚΟΠΗ στο όριο δεν επιτρέπεται να ΓΕΝΝΗΣΕΙ σύγκρουση', () => {
    const base = 'Πίνακας ποσοτήτων σκυροδέματος';
    const names = xlsxWorksheetNames([`${base} Α`, `${base} Β`]);
    expect(new Set(names).size).toBe(2);
    // 31, ο αριθμός του Excel — όχι η σταθερά μας.
    names.forEach((name) => expect(name.length).toBeLessThanOrEqual(31));
  });

  it('απαγορευμένοι χαρακτήρες γίνονται κενό — ποτέ ένωση δύο λέξεων', () => {
    expect(xlsxWorksheetNames(['Α/Β'])).toEqual(['Α Β']);
    expect(xlsxWorksheetNames(['[Α]:Β*Γ?Δ'])).toEqual(['Α  Β Γ Δ']);
  });

  it('🔴 απόστροφος στην ΑΡΧΗ ή στο ΤΕΛΟΣ κόβεται — αλλιώς σπάει το `\'Φύλλο\'!A1` της Φ7', () => {
    expect(xlsxWorksheetNames(["'Δοκοί'"])).toEqual(['Δοκοί']);
    expect(xlsxWorksheetNames(["Δ'κοί"])).toEqual(["Δ'κοί"]);
  });

  it('κενό όνομα ⇒ η ΘΕΣΗ του (1-based), γιατί το Excel αρνείται το κενό', () => {
    expect(xlsxWorksheetNames(['', '   ', 'Γ'])).toEqual(['1', '2', 'Γ']);
  });

  it('🔴 …και το αποτέλεσμα το δέχεται ΠΡΑΓΜΑΤΙΚΑ ο exceljs, χωρίς να πετάξει', () => {
    const workbook = new ExcelJS.Workbook();
    const names = xlsxWorksheetNames(['Α/Β', 'Α Β', '', 'Α Β', "'Γ'"]);
    expect(() => names.forEach((name) => workbook.addWorksheet(name))).not.toThrow();
    expect(workbook.worksheets).toHaveLength(5);
  });
});

describe('ADR-833 §5.7.1 — το βιβλίο και το blob', () => {
  it('τα μεταδεδομένα του δημιουργού ταξιδεύουν', async () => {
    const workbook = await createXlsxWorkbook('ΝΕΣΤΩΡ · δοκιμή');
    workbook.addWorksheet('Φ').getCell('A1').value = 'x';
    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(await (await xlsxWorkbookToBlob(workbook)).arrayBuffer());
    expect(reloaded.creator).toBe('ΝΕΣΤΩΡ · δοκιμή');
  });

  it('🔴 ο τύπος MIME είναι του OOXML — αλλιώς το λειτουργικό ανοίγει λάθος εφαρμογή', async () => {
    // ⚠️ Εδώ συγκρινόταν με το `XLSX_MIME_TYPE`, δηλαδή με τον εαυτό του — μια αλλαγή σε
    // `application/octet-stream` περνούσε άθικτη (μετάλλαξη M15, ADR-833 §5.7.6). Ο σωστός
    // κριτής είναι η **προδιαγραφή**, γραμμένη αυτούσια.
    const expected = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    expect(XLSX_MIME_TYPE).toBe(expected);
    const workbook = await createXlsxWorkbook('x');
    workbook.addWorksheet('Φ');
    expect((await xlsxWorkbookToBlob(workbook)).type).toBe(expected);
  });
});
