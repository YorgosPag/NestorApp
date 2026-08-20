/**
 * ADR-739 Φ.Ε (Α3) — **ο ζωγράφος ζωγραφίζει ό,τι λέει το στυλ**, και ό,τι μετρήθηκε.
 *
 * ## Τι κλείνει αυτή η σουίτα
 * Μέχρι τη Φ.Ε ο καμβάς έγραφε καρφωτά `arial` ενώ η μηχανή διάταξης μετρούσε το
 * `TableCellStyle.fontFamily`. Δύο απαντήσεις στην ίδια ερώτηση δεν δίνουν «λάθος
 * γραμματοσειρά» — δίνουν **κείμενο που κόβεται ή αφήνει κενό**, και μόνο σε όποιον
 * δηλώσει άλλη οικογένεια. Δηλαδή σφάλμα που γεννιέται τη μέρα που βγαίνει το χειριστήριο.
 *
 * 🔴 Η **υπογράμμιση** ελέγχεται μέσα στη **στροφή**: ένα `fillRect` γραμμένο έξω από το
 * `translate`+`rotate` του `stampFrameText` θα έμενε οριζόντιο κάτω από γερμένο κείμενο —
 * ακριβώς το ελάττωμα που το βήμα 8 έκλεισε για τα ίδια τα γράμματα, ξαναγεννημένο.
 *
 * @see rendering/entities/table/stamp-table-layout.ts
 */

import { stampTableText } from '../stamp-table-layout';
// 🔴 ADR-786 — η ΜΙΑ αυθεντία «ποιο face, ποιο em, ποιο shorthand», κοινή με τον επεξεργαστή.
import { tableTextFont } from '../../../../bim/table/table-text-font';
import {
  createPaintLog,
  createRc,
  RECORDER_CHAR_PX,
  type PaintLog,
} from './table-paint-recorder';
import { tableUnderlineGeometry } from '../../../../bim/table/table-text-decoration';
import type { TableCellLayout } from '../../../../bim/table/table-layout-types';
import type { TableCellStyle } from '../../../../bim/table/table-style';
import type { TableColumnId, TableRowId } from '../../../../types/table';

const INK = '#111111';
const TEXT = 'ΑΒΓΔ';
/** Το ίδιο `pxPerMm` με την προεπιλογή του καταγραφέα — ο ΕΝΑΣ αριθμός των υπολογισμών εδώ. */
const PX_PER_MM = 10;
const HEIGHT_MM = 3;
const FONT_PX = HEIGHT_MM * PX_PER_MM;

function style(over: Partial<TableCellStyle> = {}): TableCellStyle {
  return {
    textHeightMm: HEIGHT_MM,
    textColorHex: INK,
    bold: false,
    italic: false,
    underline: false,
    align: 'ML',
    indentLevel: 0,
    margins: { hMm: 1, vMm: 1 },
    ...over,
  };
}

function cell(over: Partial<TableCellStyle> = {}): TableCellLayout {
  const resolved = style(over);
  return {
    rowId: 'r1' as TableRowId,
    colId: 'c1' as TableColumnId,
    rect: { x: 0, y: 0, w: 40, h: 8 },
    style: resolved,
    hAlign: 'left',
    indentMm: 0,
    // ADR-739 §58 Γ2 — **πίνακας** γραμμών· ένα στοιχείο για κελί που δεν αναδιπλώνεται.
    texts: [
      {
        position: { x: 1, y: 6 },
        text: TEXT,
        heightMm: resolved.textHeightMm,
        colorHex: resolved.textColorHex,
        hAlign: 'left',
        bold: resolved.bold,
        italic: resolved.italic,
        ...(resolved.fontFamily !== undefined && { fontFamily: resolved.fontFamily }),
        // 🔴 ADR-739 Φ.Ε/Φ2 βήμα 4 — το `advanceMm` **δεν είναι προαιρετικό** όταν υπάρχει
        // υπογράμμιση: το `TableTextRun` είναι ένωση και ο μεταγλωττιστής το απαιτεί. Εδώ
        // αναπαράγεται ό,τι θα μετρούσε ο `TableTextMeasurer` της διάταξης, με το πλάτος
        // χαρακτήρα του καταγραφέα — άρα η δοκιμή ελέγχει τον ζωγράφο, όχι τη γραμματοσειρά.
        ...(resolved.underline
          ? { underline: true as const, advanceMm: TEXT.length * RECORDER_CHAR_PX / PX_PER_MM }
          : { underline: false as const }),
      },
    ],
    rowSpan: 1,
    colSpan: 1,
  };
}

/**
 * 🔴 Η γωνία δίνεται **ως προβολή**, ποτέ ως ξεχωριστό όρισμα: το `createStampTableContext`
 * παράγει το `textAngleRad` από το `toScreen`, οπότε ένα test που τα δήλωνε χωριστά θα
 * μπορούσε να ζητά «στραμμένο πίνακα» και να μετρά οριζόντιο κείμενο (δες την κεφαλίδα του
 * `table-paint-recorder`).
 */
function rotatingProjection(angleRad: number) {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return (u: number, v: number) => ({ x: u * cos - v * sin, y: u * sin + v * cos });
}

function paint(over: Partial<TableCellStyle> = {}, angleRad = 0): PaintLog {
  const log: PaintLog = createPaintLog();
  const rc = createRc(log, {
    pxPerMm: PX_PER_MM,
    ...(angleRad !== 0 && { toScreen: rotatingProjection(angleRad) }),
  });
  stampTableText(rc, [cell(over)]);
  return log;
}

// ── Γραμματοσειρά (Α3) ──────────────────────────────────────────────────────

describe('🔴 Α3 — ο καμβάς σταμάτησε να ζωγραφίζει «πάντα Arial»', () => {
  it('η δηλωμένη οικογένεια φτάνει στο `ctx.font`', () => {
    // 🔴 ADR-786 — η διασταύρωση γίνεται με το `tableTextFont`, που είναι πλέον η αυθεντία και
    // για τον ζωγράφο και για τον επεξεργαστή. Το `tableCellFont` είναι ο **χαμηλού επιπέδου**
    // κατασκευαστής (τον καλεί απευθείας μόνο ο δείκτης ζωνών): μια άγκυρα πάνω του θα
    // κλείδωνε τη μορφή του αλφαριθμητικού, όχι τη **συμφωνία** των δύο επιφανειών.
    expect(paint({ fontFamily: 'verdana' }).texts[0].font).toBe(
      tableTextFont(FONT_PX, false, false, 'verdana').css,
    );
    expect(paint({ fontFamily: 'verdana' }).texts[0].font).toContain('verdana');
  });

  it('απούσα οικογένεια ⇒ arial — η ΙΔΙΑ προεπιλογή με τον μετρητή του text-engine', () => {
    expect(paint().texts[0].font).toContain('arial');
  });

  it('τα πλάγια φτάνουν στο `ctx.font` ως προθεματικό `italic`', () => {
    expect(paint({ italic: true }).texts[0].font).toMatch(/^italic /);
    expect(paint().texts[0].font).not.toMatch(/^italic /);
  });

  it('έντονα και πλάγια συνυπάρχουν χωρίς να ακυρώνει το ένα το άλλο', () => {
    const font = paint({ bold: true, italic: true }).texts[0].font;
    expect(font).toContain('italic');
    expect(font).toContain('bold');
  });

  it('🔴 το αλφαριθμητικό είναι ΤΟ ΙΔΙΟ που θα δώσει το `tableTextFont` στον επεξεργαστή', () => {
    // Αυτή είναι η εγγύηση «το κείμενο δεν αναπηδά στο διπλό κλικ»: μία συνάρτηση, δύο
    // καταναλωτές. Αν ο ζωγράφος αποκτήσει δικό του υπολογισμό, εδώ σπάει.
    //
    // ⚠️ **ΔΕΝ κρίνει τη μετατροπή ύψους→em**: εδώ δεν υπάρχει φορτωμένο face (jsdom), άρα οι
    // δύο μονάδες συμπίπτουν. Εκείνη την κρίνει το `bim/table/__tests__/table-text-font.test.ts`,
    // με ρητό `installStubFont()`. Δες ADR-786 §3(β).
    const over = { bold: true, italic: true, fontFamily: 'calibri' };
    expect(paint(over).texts[0].font).toBe(tableTextFont(FONT_PX, true, true, 'calibri').css);
  });
});

// ── Υπογράμμιση ─────────────────────────────────────────────────────────────

describe('υπογράμμιση — γραμμή, όχι δεύτερη πηγή αριθμών', () => {
  it('χωρίς υπογράμμιση δεν ζωγραφίζεται κανένα ορθογώνιο', () => {
    expect(paint().rects).toHaveLength(0);
  });

  it('με υπογράμμιση ζωγραφίζεται ΕΝΑ ορθογώνιο, στο χρώμα του κειμένου', () => {
    const log = paint({ underline: true });
    expect(log.rects).toHaveLength(1);
    expect(log.rects[0].color).toBe(INK);
  });

  it('το μήκος της είναι το μετρημένο πλάτος του κειμένου', () => {
    expect(paint({ underline: true }).rects[0].widthPx).toBe(TEXT.length * RECORDER_CHAR_PX);
  });

  it('🔴 θέση και πάχος έρχονται από το TEXT_DECORATION_RATIOS, όχι από τοπικούς αριθμούς', () => {
    const log = paint({ underline: true });
    const text = log.texts[0];
    const rect = log.rects[0];
    // 🔴 ADR-739 Φ.Ε/Φ2 βήμα 4 — η αναμονή **δεν ξαναγράφει τον τύπο**: ρωτά το ΙΔΙΟ SSoT με
    // τον κώδικα. Η προηγούμενη εκδοχή αντέγραφε το `(UNDERLINE_EM − 1)` του ζωγράφου, οπότε
    // κλείδωνε τη συμπεριφορά αντί να τη διασταυρώνει — και έτσι έμεινε πράσινη ενώ η γραμμή
    // έπεφτε 0,2·em **πάνω** από τη βάση (δες `table-text-decoration.ts`).
    const g = tableUnderlineGeometry(FONT_PX, TEXT.length * RECORDER_CHAR_PX, 'left');
    expect(rect.at.y - text.at.y).toBeCloseTo(g.y, 6);
    expect(rect.heightPx).toBeCloseTo(g.thickness, 6);
  });

  it('🔴 η γραμμή πέφτει ΚΑΤΩ από τη γραμμή βάσης — όχι πάνω από αυτήν', () => {
    // Ο έλεγχος του πρόσημου χωριστά, γιατί ακριβώς αυτό ήταν το ελάττωμα: με άγκυρα τη
    // γραμμή καθόδου (`− 1`) αντί τη γραμμή βάσης, η «υπογράμμιση» έβγαινε αρνητική, δηλαδή
    // πάνω από τα γράμματα. Ένας έλεγχος που περνά από τον ίδιο τύπο δεν το βλέπει ποτέ.
    const log = paint({ underline: true });
    expect(log.rects[0].at.y - log.texts[0].at.y).toBeGreaterThan(0);
  });

  it('🔴 σε γερμένο πίνακα η γραμμή γέρνει ΜΑΖΙ με το κείμενο', () => {
    const angleRad = 0.35;
    const log = paint({ underline: true }, angleRad);
    expect(log.rects[0].angleRad).toBeCloseTo(log.texts[0].angleRad, 9);
    expect(Math.abs(log.rects[0].angleRad)).toBeGreaterThan(0.1);
  });
});
