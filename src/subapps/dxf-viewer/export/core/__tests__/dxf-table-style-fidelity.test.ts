/**
 * ADR-739 Φάση Ε · Φ1 — **τα δύο group codes που κάνουν τη διαφορά στο ίδιο το αρχείο.**
 *
 * Το `table-export-parity.test.ts` κλειδώνει ότι η **οντότητα** κουβαλά χρώμα/πάχος/έντονο.
 * Δεν αποδεικνύει ότι τα κουβαλά και το **αρχείο** — και ακριβώς εκεί χανόντουσαν:
 *
 * - **420 (αληθινό χρώμα)**: ο writer οντοτήτων έγραφε **μόνο** ACI 62, ενώ ο importer
 *   διάβαζε ήδη το 420 και ο LAYER writer το έγραφε ήδη. Η παλέτα ACI έχει έξι γκρι· το
 *   `#EDEDED` μιας γκρίζας κεφαλίδας πέφτει στο **ACI 7 — την κανονική λευκή/μαύρη πένα**.
 *   Δηλαδή η γκρίζα γραμμή έβγαινε λευκή ακόμα και με το γέμισμα παρόν.
 * - **1071 (extended font data)**: το DXF δεν έχει group code για «έντονο». Για TrueType το
 *   AutoCAD το γράφει σε XDATA του STYLE record. `34 + 0x2000000 = 33554466` — η τιμή
 *   επαληθεύεται από τον κώδικα του ezdxf **και** από χειροκίνητο πείραμα σε AutoCAD
 *   (QCAD FS#203).
 *
 * @see export/core/dxf-ascii-primitive-emitters.ts — `emitEntityStyle` (420)
 * @see export/core/dxf-ascii-tables-writer.ts — `emitTextStyle` (1071)
 */

import { writeDxfAscii } from '../dxf-ascii-writer';
import { extendedFontFlags } from '../dxf-ascii-tables-writer';
import { collectTextStyles } from '../dxf-ascii-writer-helpers';
import { textStyleName, resolveExportFont } from '../dxf-ascii-text-writer';
import { makeText, makeLine, makeSolidFill } from '../neutral-primitive-factory';
import type { Entity } from '../../../types/entities';

const LAYERS = { L: { name: 'TABLE' } };

/** Το επαγγελματικό μονοπάτι (handles + TABLES) — εκεί ζουν τα 420 και το STYLE table. */
const PRO = { layersById: LAYERS, acadVer: 'AC1032', insunits: 4, codepage: 'ANSI_1253' };

/** Οντότητα-πηγή με κληρονομημένο στυλ, όπως ένας `TableEntity` στη σκηνή. */
const SOURCE = {
  id: 'tbl', type: 'table', layerId: 'L', color: '#FF00FF', colorAci: 6, visible: true,
} as unknown as Entity;

function cellText(text: string, bold: boolean): Entity {
  return makeText(SOURCE, `t_${text}`, {
    position: { x: 0, y: 0 },
    text,
    height: 3,
    alignment: 'left',
    rotationDeg: 0,
    vBaseline: 'alphabetic',
    colorHex: '#111111',
    bold,
  });
}

describe('ADR-739 Φ1 — group 420: το γκρι επιβιώνει της παλέτας ACI', () => {
  it('γράφεται 420 με το πακεταρισμένο 0xRRGGBB όταν η οντότητα κουβαλά αληθινό χρώμα', () => {
    const grey = makeLine(SOURCE, 'ln', { x: 0, y: 0 }, { x: 10, y: 0 }, { colorHex: '#EDEDED' });
    const dxf = writeDxfAscii([grey], PRO);
    expect(dxf).toContain(`420\n${0xededed}\n`);
  });

  it('🔴 η ίδια γραμμή ΧΩΡΙΣ 420 θα διαβαζόταν λευκή — το 62 μόνο του δεν αρκεί', () => {
    // Τεκμηριώνει ΓΙΑΤΙ υπάρχει ο κωδικός. Το ACI που γράφει ο writer για το #EDEDED είναι
    // το **7** — και δεν είναι απλώς «ένα λευκό»: το 7 είναι η κανονική λευκή/μαύρη πένα του
    // AutoCAD, αυτή που το ίδιο μας το plot-style policy (`applyPlotColor`, `ACI_WHITE`)
    // μετατρέπει ρητά σε **μαύρο μελάνι**. Δηλαδή η γκρίζα κεφαλίδα δεν θα γινόταν απλώς
    // αχνή — θα γινόταν λευκή στην οθόνη του CAD και **μαύρη** στην εκτύπωση.
    //
    // (Το 7 κερδίζει έναντι του 255, που είναι κι αυτό #FFFFFF και ισαπέχει: ο
    // `findClosestAci` κρατά το ΠΡΩΤΟ ελάχιστο.)
    const grey = makeLine(SOURCE, 'ln', { x: 0, y: 0 }, { x: 10, y: 0 }, { colorHex: '#EDEDED' });
    const dxf = writeDxfAscii([grey], PRO);
    expect(dxf).toContain('62\n7\n');
    // ...και γι' αυτό το 420 πρέπει να συνυπάρχει (το AutoCAD το προτιμά).
    expect(dxf).toContain('420\n');
  });

  it('χωρίς αληθινό χρώμα → κανένα 420 (μηδέν μεταβολή στα υπάρχοντα αρχεία)', () => {
    const plain = makeLine(SOURCE, 'ln', { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(writeDxfAscii([plain], PRO)).not.toContain('420\n');
  });
});

describe('ADR-739 Φ1 — XDATA 1071: το έντονο ταξιδεύει στο text style', () => {
  it('οι σημαίες είναι ΑΚΡΙΒΩΣ 33554466 για έντονο (ezdxf + QCAD, ανεξάρτητα)', () => {
    expect(extendedFontFlags(true, false)).toBe(33554466);
    expect(extendedFontFlags(false, true)).toBe(16777250);
    expect(extendedFontFlags(true, true)).toBe(50331682);
    expect(extendedFontFlags(false, false)).toBe(34);
  });

  it('έντονο και κανονικό κείμενο παράγουν ΔΥΟ ξεχωριστά STYLE records', () => {
    const styles = collectTextStyles([cellText('Κεφαλίδα', true), cellText('δεδομένα', false)]);
    const names = styles.map((s) => s.name).sort();
    expect(names).toEqual(['Arial', 'Arial-Bold']);
    // Το ίδιο αρχείο γραμματοσειράς — διαφέρουν ΜΟΝΟ στις σημαίες, όπως στο AutoCAD.
    expect(new Set(styles.map((s) => s.fontFile)).size).toBe(1);
  });

  it('μόνο το έντονο record κουβαλά XDATA — το κανονικό μένει byte-identical', () => {
    const styles = collectTextStyles([cellText('Κεφαλίδα', true), cellText('δεδομένα', false)]);
    const bold = styles.find((s) => s.name === 'Arial-Bold');
    const plain = styles.find((s) => s.name === 'Arial');
    expect(bold?.extendedFont).toEqual({ family: 'Arial', bold: true, italic: false });
    expect(plain?.extendedFont).toBeUndefined();
  });

  it('το αρχείο περιέχει 1001 ACAD / 1000 Arial / 1071 33554466, με αυτή τη σειρά', () => {
    const dxf = writeDxfAscii([cellText('Κεφαλίδα', true)], PRO);
    const appid = dxf.indexOf('1001\nACAD\n');
    const family = dxf.indexOf('1000\nArial\n');
    const flags = dxf.indexOf('1071\n33554466\n');
    expect(appid).toBeGreaterThan(-1);
    expect(family).toBeGreaterThan(appid);
    expect(flags).toBeGreaterThan(family);
  });

  it('η οντότητα δείχνει στο ΕΝΤΟΝΟ style μέσω group 7 — αλλιώς το XDATA είναι ορφανό', () => {
    const dxf = writeDxfAscii([cellText('Κεφαλίδα', true)], PRO);
    expect(dxf).toContain('7\nArial-Bold\n');
  });

  it('κείμενο χωρίς textNode → STANDARD, κανένα record, κανένα XDATA (zero regression)', () => {
    const bare = makeText(SOURCE, 'bare', {
      position: { x: 0, y: 0 }, text: 'x', height: 3,
      alignment: 'left', rotationDeg: 0, vBaseline: 'middle',
    });
    expect(bare.textNode).toBeUndefined();
    expect(collectTextStyles([bare])).toHaveLength(0);
    expect(writeDxfAscii([bare], PRO)).not.toContain('1071');
  });

  it('textStyleName: χωρίς οικογένεια δεν εφευρίσκεται παραλλαγή', () => {
    expect(textStyleName('Arial', true)).toBe('Arial-Bold');
    expect(textStyleName('Arial', false)).toBe('Arial');
    expect(textStyleName('', true)).toBe('STANDARD');
    expect(textStyleName(undefined, true)).toBe('STANDARD');
  });

  it('🔴 το group 3 είναι ΑΡΧΕΙΟ, όχι οικογένεια — γυμνό «Arial» = Arial.shx (ανύπαρκτο)', () => {
    // Μετρημένο στο `Ισόγειο_Ισόγειο (5).dxf`: τα νέα styles έγραφαν σκέτο `Arial` ⇒ το
    // AutoCAD ζητούσε `Arial.shx`, υποκαθιστούσε γραμματοσειρά, και το έντονο του 1071
    // δεν μπορούσε καν να εφαρμοστεί.
    expect(resolveExportFont('Arial')).toBe('Arial.ttf');
    expect(resolveExportFont('arial')).toBe('Arial.ttf');
    // Αμετάβλητα: ήδη-αρχείο, και ο ιστορικός κλάδος txt/standard.
    expect(resolveExportFont('Arial.ttf')).toBe('Arial.ttf');
    expect(resolveExportFont('txt')).toBe('Arial.ttf');
    expect(resolveExportFont('romans')).toBe('romans');
  });

  it('και τα δύο STYLE records του πίνακα δείχνουν σε ΥΠΑΡΚΤΟ αρχείο γραμματοσειράς', () => {
    const styles = collectTextStyles([cellText('Κεφαλίδα', true), cellText('δεδομένα', false)]);
    for (const s of styles) expect(s.fontFile).toBe('Arial.ttf');
  });
});

describe('ADR-739 Φ1 — το γέμισμα πρέπει να είναι ΟΡΑΤΟ σε 2D Wireframe', () => {
  /** Το γέμισμα ενός κελιού: τετράπλευρο δαχτυλίδι, όπως το παράγει το `fillPrimitive`. */
  const RECT = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 0, y: 5 }];

  it('🔴 τετράπλευρο γέμισμα → native SOLID, ΟΧΙ 3DFACE', () => {
    // Το `3DFACE` είναι επιφάνεια 3Δ: στα wireframe visual styles δείχνει μόνο ακμές. Ο
    // μηχανικός σχεδιάζει σε 2D Wireframe ⇒ το γέμισμα ήταν αόρατο ακριβώς εκεί που υπάρχει.
    const dxf = writeDxfAscii([makeSolidFill(SOURCE, 'f', RECT, '#EDEDED')], PRO);
    expect(dxf).toContain('\nSOLID\n');
    expect(dxf).not.toContain('\n3DFACE\n');
  });

  it('το SOLID κουβαλά το χρώμα του κελιού ως αληθινό χρώμα (420)', () => {
    const dxf = writeDxfAscii([makeSolidFill(SOURCE, 'f', RECT, '#EDEDED')], PRO);
    expect(dxf).toContain(`420\n${0xededed}\n`);
  });

  it('ring με >4 κορυφές μένει 3DFACE — το SOLID δέχεται το πολύ 4 γωνίες', () => {
    const hexagon = [
      { x: 0, y: 0 }, { x: 5, y: -2 }, { x: 10, y: 0 },
      { x: 10, y: 5 }, { x: 5, y: 7 }, { x: 0, y: 5 },
    ];
    const fill = makeSolidFill(SOURCE, 'h', hexagon, '#EDEDED');
    expect(fill.dxfSourceType).toBeUndefined();
    expect(writeDxfAscii([fill], PRO)).toContain('\n3DFACE\n');
  });
});
