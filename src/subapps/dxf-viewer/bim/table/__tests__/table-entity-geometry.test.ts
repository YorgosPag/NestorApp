/**
 * ADR-739 Φάση Γ — το **δίχτυ** της παράγωγης γεωμετρίας του `TableEntity`.
 *
 * Γραμμένο ΠΡΙΝ τον ζωγράφο και τις λαβές, με τη ρητή διδαχή της Φ.Β (§3.4 του handoff):
 * τα footers έβγαιναν 1,5mm χαμηλά επειδή το `y` ενός βρόχου ήταν η **γραμμή
 * περιεχομένου** και όχι η ακμή — καμία επιθεώρηση κώδικα δεν το έπιασε, μόνο ένα δίχτυ
 * με **αριθμούς υπολογισμένους στο χέρι**. Εδώ ισχύει διπλά: μια μετατοπισμένη
 * γεωμετρία «φαίνεται» σωστή και πιάνεται λάθος.
 *
 * Οι στήλες είναι όλες `fixed` και τα κελιά **κενά** επίτηδες: έτσι η διάταξη δεν καλεί
 * ποτέ τον πραγματικό μετρητή κειμένου, που δίνει άλλο πλάτος με/χωρίς φορτωμένη
 * γραμματοσειρά — τα νούμερα παρακάτω είναι συγκρίσιμα σε κάθε περιβάλλον.
 */

import {
  computeTableEntityGeometry,
  resolveTableLayout,
  resolveTableStyle,
  tableCellAtFrame,
  tableCellAtWorld,
  tableFrameToWorld,
  tableMmToWorld,
  tableWorldToFrame,
} from '../table-entity-geometry';
import { createTableModel } from '../table-model-helpers';
import { BUILTIN_TABLE_STYLE_IDS, BUILTIN_TABLE_STYLES } from '../table-style-presets';
import type { TableStyle } from '../table-style';
import type { TableColumn, TableRow } from '../../../types/table';
import type { TableEntity } from '../../../types/table-entity';

// ── Εργαλεία ────────────────────────────────────────────────────────────────

function styleById(id: string): TableStyle {
  const style = BUILTIN_TABLE_STYLES.find((s) => s.id === id);
  if (!style) throw new Error(`missing preset: ${id}`);
  return style;
}

const STANDARD = styleById(BUILTIN_TABLE_STYLE_IDS.STANDARD);

const COLUMNS: TableColumn[] = [
  { id: 'c1', sizing: { kind: 'fixed', widthMm: 40 }, valueType: 'text', align: 'left' },
  { id: 'c2', sizing: { kind: 'fixed', widthMm: 20 }, valueType: 'text', align: 'left' },
];

const ROWS: TableRow[] = [
  { id: 'r1', rowClass: 'header', heightMm: 8 },
  { id: 'r2', rowClass: 'data', heightMm: 8 },
];

/** 60mm × 16mm πίνακας, κενά κελιά — οι διαστάσεις επαληθεύονται ρητά παρακάτω. */
function makeEntity(overrides: Partial<TableEntity> = {}): TableEntity {
  return {
    id: 'tbl_1',
    type: 'table',
    layerId: 'lyr_test',
    position: { x: 100, y: 200 },
    angleRad: 0,
    styleId: BUILTIN_TABLE_STYLE_IDS.STANDARD,
    model: createTableModel({ columns: COLUMNS, rows: ROWS }),
    ...overrides,
  };
}

// ── 1. Η γέφυρα μονάδων ─────────────────────────────────────────────────────

describe('tableMmToWorld — η ΜΙΑ γέφυρα sheet-mm → σκηνή (§4.1)', () => {
  it('1:1 σε σκηνή mm ⇒ ταυτοτική', () => {
    expect(tableMmToWorld(1, 'mm')).toBe(1);
  });

  it('1:100 σε σκηνή mm ⇒ 100 μονάδες ανά sheet-mm', () => {
    expect(tableMmToWorld(100, 'mm')).toBe(100);
  });

  it('ίδιο ΦΥΣΙΚΟ μέγεθος σε κάθε σύστημα μονάδων (το μάθημα του ADR-344 Round 7)', () => {
    // 1 sheet-mm στο 1:100 = 100mm πραγματικά = 10cm = 0,1m.
    expect(tableMmToWorld(100, 'mm')).toBeCloseTo(100, 9);
    expect(tableMmToWorld(100, 'cm')).toBeCloseTo(10, 9);
    expect(tableMmToWorld(100, 'm')).toBeCloseTo(0.1, 9);
  });
});

// ── 2. Αναστροφή y + περιστροφή ─────────────────────────────────────────────

describe('tableFrameToWorld — η ΜΟΝΗ αναστροφή y και η ΜΟΝΗ περιστροφή', () => {
  it('χωρίς περιστροφή: +u δεξιά, +v ΚΑΤΩ (δηλαδή −y στη σκηνή)', () => {
    const e = makeEntity();
    expect(tableFrameToWorld(e, 10, 5, 1)).toEqual({ x: 110, y: 195 });
  });

  it('η άγκυρα (0,0) πέφτει ΑΚΡΙΒΩΣ στο position, σε κάθε γωνία και κλίμακα', () => {
    for (const angleRad of [0, 0.7, Math.PI / 2, -2.3]) {
      const e = makeEntity({ angleRad });
      expect(tableFrameToWorld(e, 0, 0, 100)).toEqual({ x: 100, y: 200 });
    }
  });

  it('η κλίμακα πολλαπλασιάζει ΜΟΝΟ την απόσταση από την άγκυρα', () => {
    const e = makeEntity();
    expect(tableFrameToWorld(e, 10, 5, 100)).toEqual({ x: 1100, y: -300 });
  });

  it('στροφή 90°: ο άξονας u ανεβαίνει, ο άξονας v γέρνει δεξιά', () => {
    const e = makeEntity({ angleRad: Math.PI / 2 });
    const p = tableFrameToWorld(e, 10, 5, 1);
    expect(p.x).toBeCloseTo(105, 9);
    expect(p.y).toBeCloseTo(210, 9);
  });
});

describe('tableWorldToFrame — αυστηρό αντίστροφο', () => {
  it('round-trip για κάθε γωνία, κλίμακα και σημείο', () => {
    for (const angleRad of [0, 0.3, Math.PI / 2, 2.1, -1.4]) {
      const e = makeEntity({ angleRad });
      for (const mmToWorld of [1, 50, 100]) {
        for (const [u, v] of [[0, 0], [12.5, 0], [0, 7.25], [-3, 41], [60, 16]]) {
          const world = tableFrameToWorld(e, u, v, mmToWorld);
          const back = tableWorldToFrame(e, world, mmToWorld);
          expect(back.u).toBeCloseTo(u, 8);
          expect(back.v).toBeCloseTo(v, 8);
        }
      }
    }
  });

  it('εκφυλισμένη κλίμακα ⇒ (0,0), ΟΧΙ NaN που θα έκανε κάθε σύγκριση σιωπηλά ψευδή', () => {
    const e = makeEntity();
    expect(tableWorldToFrame(e, { x: 500, y: 500 }, 0)).toEqual({ u: 0, v: 0 });
    expect(tableWorldToFrame(e, { x: 500, y: 500 }, -1)).toEqual({ u: 0, v: 0 });
  });
});

// ── 3. Η πλήρης γεωμετρία ───────────────────────────────────────────────────

describe('computeTableEntityGeometry', () => {
  it('οι διαστάσεις της διάταξης είναι το άθροισμα των δηλωμένων (60mm × 16mm)', () => {
    const geo = computeTableEntityGeometry(makeEntity(), 1, 'mm');
    expect(geo.layout.widthMm).toBeCloseTo(60, 9);
    expect(geo.layout.heightMm).toBeCloseTo(16, 9);
  });

  it('οι γωνίες είναι TL → TR → BR → BL, με το TL ΠΑΝΩ στην άγκυρα', () => {
    const geo = computeTableEntityGeometry(makeEntity(), 1, 'mm');
    expect(geo.worldCorners).toEqual([
      { x: 100, y: 200 }, // TL = position
      { x: 160, y: 200 }, // TR
      { x: 160, y: 184 }, // BR (+v κάτω ⇒ −y)
      { x: 100, y: 184 }, // BL
    ]);
  });

  it('το bbox χωρίς περιστροφή ταυτίζεται με το ορθογώνιο', () => {
    const geo = computeTableEntityGeometry(makeEntity(), 1, 'mm');
    expect(geo.bbox).toEqual({ minX: 100, minY: 184, maxX: 160, maxY: 200 });
  });

  it('η κλίμακα σχεδίασης μεγεθύνει τον πίνακα στη σκηνή, ΟΧΙ τη διάταξή του', () => {
    const geo = computeTableEntityGeometry(makeEntity(), 100, 'mm');
    // Η διάταξη μένει σε sheet-mm — αυτό ακριβώς επιτρέπει να μοιράζεται η μνήμη.
    expect(geo.layout.widthMm).toBeCloseTo(60, 9);
    expect(geo.worldWidth).toBeCloseTo(6000, 9);
    expect(geo.worldHeight).toBeCloseTo(1600, 9);
  });

  it('στραμμένος πίνακας: το bbox μεγαλώνει και ΠΕΡΙΕΧΕΙ και τις 4 γωνίες', () => {
    const geo = computeTableEntityGeometry(makeEntity({ angleRad: Math.PI / 4 }), 1, 'mm');
    for (const c of geo.worldCorners) {
      expect(c.x).toBeGreaterThanOrEqual(geo.bbox.minX - 1e-9);
      expect(c.x).toBeLessThanOrEqual(geo.bbox.maxX + 1e-9);
      expect(c.y).toBeGreaterThanOrEqual(geo.bbox.minY - 1e-9);
      expect(c.y).toBeLessThanOrEqual(geo.bbox.maxY + 1e-9);
    }
    // Στις 45° η διαγώνιος 60×16 προβάλλεται σε (60+16)/√2 ≈ 53,74 και στους δύο άξονες.
    expect(geo.bbox.maxX - geo.bbox.minX).toBeCloseTo(76 / Math.SQRT2, 6);
    expect(geo.bbox.maxY - geo.bbox.minY).toBeCloseTo(76 / Math.SQRT2, 6);
  });
});

// ── 4. Απομνημόνευση — «διάταξη ΠΟΤΕ ανά καρέ» (§6) ─────────────────────────

describe('resolveTableLayout — απομνημόνευση', () => {
  it('ίδιο μοντέλο + ίδιο στυλ ⇒ Η ΙΔΙΑ ΑΝΑΦΟΡΑ (όχι απλώς ίση)', () => {
    const model = createTableModel({ columns: COLUMNS, rows: ROWS });
    expect(resolveTableLayout(model, STANDARD)).toBe(resolveTableLayout(model, STANDARD));
  });

  it('νέο αντικείμενο μοντέλου ⇒ νέα διάταξη (η ταυτότητα ΕΙΝΑΙ η έκδοση)', () => {
    const a = createTableModel({ columns: COLUMNS, rows: ROWS });
    const b = createTableModel({ columns: COLUMNS, rows: ROWS });
    expect(resolveTableLayout(a, STANDARD)).not.toBe(resolveTableLayout(b, STANDARD));
  });

  it('ίδιο μοντέλο, ΑΛΛΟ στυλ ⇒ άλλη διάταξη (το στυλ είναι μέρος του κλειδιού)', () => {
    const model = createTableModel({ columns: COLUMNS, rows: ROWS });
    const detail = styleById(BUILTIN_TABLE_STYLE_IDS.DETAIL_SHEET);
    expect(resolveTableLayout(model, STANDARD)).not.toBe(resolveTableLayout(model, detail));
  });
});

describe('resolveTableStyle', () => {
  it('γνωστό styleId ⇒ το στυλ του', () => {
    expect(resolveTableStyle({ styleId: BUILTIN_TABLE_STYLE_IDS.STANDARD }).id).toBe(
      BUILTIN_TABLE_STYLE_IDS.STANDARD,
    );
  });

  it('ΑΓΝΩΣΤΟ styleId ⇒ το ενεργό, ποτέ σφάλμα: αόρατος πίνακας είναι χειρότερος από λάθος μολύβι', () => {
    expect(resolveTableStyle({ styleId: 'tblstyle_deleted' }).isBuiltIn).toBe(true);
  });
});

// ── 5. Ερώτημα κελιού ───────────────────────────────────────────────────────

describe('hit-test κελιού', () => {
  it('σημείο πλαισίου μέσα στην 1η στήλη/1η γραμμή ⇒ (r1, c1)', () => {
    const geo = computeTableEntityGeometry(makeEntity(), 1, 'mm');
    expect(tableCellAtFrame(geo.layout, { u: 5, v: 2 })).toMatchObject({ rowId: 'r1', colId: 'c1' });
  });

  it('σημείο στη 2η στήλη/2η γραμμή ⇒ (r2, c2) με το ΣΩΣΤΟ ορθογώνιο', () => {
    const geo = computeTableEntityGeometry(makeEntity(), 1, 'mm');
    const hit = tableCellAtFrame(geo.layout, { u: 50, v: 12 });
    expect(hit).toMatchObject({ rowId: 'r2', colId: 'c2' });
    expect(hit?.rectMm).toEqual({ x: 40, y: 8, w: 20, h: 8 });
  });

  it('έξω από τον πίνακα ⇒ null', () => {
    const geo = computeTableEntityGeometry(makeEntity(), 1, 'mm');
    expect(tableCellAtFrame(geo.layout, { u: -1, v: 2 })).toBeNull();
    expect(tableCellAtFrame(geo.layout, { u: 5, v: 20 })).toBeNull();
  });

  it('από ΣΗΜΕΙΟ ΣΚΗΝΗΣ, με περιστροφή και κλίμακα — η διαδρομή του inline editor', () => {
    const e = makeEntity({ angleRad: 0.6 });
    const geo = computeTableEntityGeometry(e, 100, 'mm');
    // Κέντρο του κελιού (r2, c2) = (50, 12) σε sheet-mm.
    const world = tableFrameToWorld(e, 50, 12, geo.mmToWorld);
    expect(tableCellAtWorld(e, world, geo)).toMatchObject({ rowId: 'r2', colId: 'c2' });
  });
});
