/**
 * ADR-833 §3.1 — **CONTRACT TEST** του TABLE render-field passthrough (anti-drift).
 *
 * Ο σκοπός δεν είναι να ελέγξει «λειτουργεί ο mapper;» — είναι να κάνει **αδύνατο** να χαθεί
 * σιωπηλά μια ιδιότητα πίνακα στον δρόμο προς τον καμβά.
 *
 * 🔴 **Η μέτρηση που γέννησε αυτό το αρχείο** δεν είναι του πίνακα — είναι της **εικόνας**, και
 * γι' αυτό μετράει: το `sourcePath` (ADR-736 §2.Β) γράφτηκε σωστά στο **ένα** σημείο εγγραφής, ο
 * `ImageRenderer` το ζητούσε σωστά, **32/32 tests ήταν πράσινα** — και στην οθόνη χανόταν, στα
 * **δύο** ενδιάμεσα περάσματα που κανένα test δεν διέσχιζε. Ο πίνακας κρατούσε **τρία** χειρόγραφα
 * αντίγραφα της λίστας του (δύο προβολές + ο τύπος `DxfTable`), δηλαδή ήταν ο επόμενος στη σειρά.
 *
 * Το ADR-833 προσθέτει `worksheets`/`activeWorksheetId` στο `TableEntity`. Χωρίς αυτό το αρχείο,
 * τα νέα πεδία θα γράφονταν σωστά στη σκηνή και θα **έπεφταν πριν τον ζωγράφο** ⇒ οι καρτέλες
 * φύλλων θα εμφανίζονταν σε κάποιες διαδρομές και σε άλλες όχι, με πράσινα tests.
 *
 * Αν κάποιος προσθέσει πεδίο στο {@link TABLE_RENDER_FIELDS} χωρίς να το μεταφέρουν ΟΛΕΣ οι
 * προβολές, **αυτό το αρχείο κοκκινίζει**.
 *
 * @see bim/table/table-render-fields.ts
 * @see bim/image/__tests__/image-render-fields.test.ts — ο αδελφός contract test (ADR-736 §5.3)
 */

import { TABLE_RENDER_FIELDS, pickTableRenderFields } from '../table-render-fields';
import { TO_DXF_HANDLERS } from '../../../hooks/canvas/dxf-scene-entity-handlers';
import { buildEntityModelFromDxf } from '../../../canvas-v2/dxf-canvas/dxf-renderer-entity-model';
import { buildTableModel } from '../build-table-entity';
import { makePreWorksheetsTableEntity, tableWorksheetFields } from './make-table-entity';
import type { TableEntity } from '../../../types/table-entity';
import type { DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';

/**
 * Ένας πίνακας με **ΚΑΘΕ** πεδίο του συμβολαίου γεμάτο με ξεχωριστή, αναγνωρίσιμη τιμή.
 * Αν προστεθεί πεδίο στο `TABLE_RENDER_FIELDS` και ξεχαστεί εδώ, το πρώτο test το πιάνει.
 *
 * Το `model` έρχεται από τον **πραγματικό** εργοστασιάρχη (`buildTableModel`), όχι από
 * επινοημένο σχήμα: ένα ψεύτικο μοντέλο θα περνούσε τη μεταφορά και θα έκρυβε ασυμφωνία σχήματος.
 */
const FULL_TABLE = {
  id: 'tbl_contract',
  type: 'table',
  layerId: 'L',
  visible: true,
  position: { x: 19.0636, y: 1.2145 },
  angleRad: Math.PI / 4,
  styleId: 'table-style-default',
  // ADR-833 Φάση 2 — ο δεσμός ζει **μέσα στο φύλλο**, όχι πάνω στην οντότητα.
  ...tableWorksheetFields(
    buildTableModel({ columnCount: 3, dataRowCount: 2, columnWidthMm: 40 }),
    {
      mode: 'bound' as const,
      sourceRef: { kind: 'survey-coordinates' as const },
      revision: 'rev_contract_fixture',
    },
  ),
  breaking: { maxHeightMm: 250, gapMm: 10, repeatHeader: true },
} as unknown as TableEntity;

describe('TABLE_RENDER_FIELDS — το συμβόλαιο', () => {
  it('το δείγμα ελέγχου γεμίζει ΚΑΘΕ πεδίο της λίστας (αλλιώς ο έλεγχος είναι ψεύτικος)', () => {
    const missing = TABLE_RENDER_FIELDS.filter(
      (f) => (FULL_TABLE as unknown as Record<string, unknown>)[f] === undefined,
    );
    expect(missing).toEqual([]);
  });

  it('pickTableRenderFields ΠΑΡΑΛΕΙΠΕΙ τα απόντα optionals (ποτέ κλειδί με undefined)', () => {
    const picked = pickTableRenderFields({
      position: { x: 0, y: 0 },
      angleRad: 0,
      styleId: 's',
      ...tableWorksheetFields(buildTableModel({})),
    } as Partial<TableEntity>);
    expect(Object.keys(picked).sort()).toEqual(
      ['activeWorksheetId', 'angleRad', 'position', 'styleId', 'worksheets'],
    );
    expect('breaking' in picked).toBe(false);
    // 🔴 ADR-833 Φάση 2 — το `binding` **δεν** είναι πια πεδίο της οντότητας. Ένα κλειδί εδώ θα
    // σήμαινε ότι κάποιος ξανάφτιαξε τον καθρέφτη που το §5.2 απαγορεύει.
    expect('binding' in picked).toBe(false);
    expect('model' in picked).toBe(false);
  });

  it('🚫 το `geometry` μένει ΕΚΤΟΣ — είναι παράγωγο, ξαναφτιάχνεται στην απόδοση', () => {
    expect(TABLE_RENDER_FIELDS).not.toContain('geometry');
    const picked = pickTableRenderFields({
      position: { x: 0, y: 0 },
      angleRad: 0,
      styleId: 's',
      ...tableWorksheetFields(buildTableModel({})),
      geometry: { bbox: { minX: 0, minY: 0, maxX: 1, maxY: 1 } },
    } as unknown as Partial<TableEntity>);
    expect('geometry' in picked).toBe(false);
  });
});

describe('🔴 ΚΑΜΙΑ προβολή δεν ρίχνει πεδίο του συμβολαίου', () => {
  const base = { id: FULL_TABLE.id, layerId: 'L', visible: true };
  const dxf = TO_DXF_HANDLERS.table!(FULL_TABLE, base as never) as unknown as Record<string, unknown>;

  it('προβολή 1/2 — scene TableEntity → DxfTable', () => {
    expect(dxf).not.toBeNull();
    const dropped = TABLE_RENDER_FIELDS.filter((f) => dxf[f] === undefined);
    expect(dropped).toEqual([]);
  });

  it('προβολή 2/2 — DxfTable → render EntityModel', () => {
    const model = buildEntityModelFromDxf(
      dxf as unknown as DxfEntityUnion, false,
      { colorHex: '#fff', lineWidthPx: 1, alpha: 1 },
    ) as unknown as Record<string, unknown>;
    const dropped = TABLE_RENDER_FIELDS.filter((f) => model[f] === undefined);
    expect(dropped).toEqual([]);
  });

  it('🔴 end-to-end: τα κελιά φτάνουν ΑΥΤΟΥΣΙΑ στο μοντέλο που βλέπει ο TableRenderer', () => {
    const model = buildEntityModelFromDxf(
      dxf as unknown as DxfEntityUnion, false,
      { colorHex: '#fff', lineWidthPx: 1, alpha: 1 },
    ) as unknown as {
      worksheets?: readonly { model?: { columns?: readonly unknown[]; rows?: readonly unknown[] } }[];
    };
    // Το σχήμα, όχι μόνο η ύπαρξη: ένα `{}` θα περνούσε τον έλεγχο `!== undefined` παραπάνω.
    expect(model.worksheets?.[0]?.model?.columns).toHaveLength(3);
    // 2 σταθερές γραμμές (title + header) + 2 γραμμές δεδομένων.
    expect(model.worksheets?.[0]?.model?.rows).toHaveLength(4);
  });
});

/**
 * 🔴 ADR-833 Φάση 2 — **ΤΟ ΣΥΝΟΡΟ ΕΙΝΑΙ ΤΟ ΣΗΜΕΙΟ ΟΠΟΥ Η ΠΑΛΙΑ ΜΟΡΦΗ ΠΑΥΕΙ ΝΑ ΥΠΑΡΧΕΙ.**
 *
 * Η προβολή αντιγράφει **μόνο ό,τι έχει τιμή**, και μια οντότητα γραμμένη πριν από τη Φάση 2 δεν
 * έχει ούτε `worksheets` ούτε `activeWorksheetId` — ενώ το `model` δεν ταξιδεύει πια. Χωρίς τη
 * λύση στο σύνορο, **κάθε παλιός πίνακας** θα έφτανε στον ζωγράφο χωρίς κανένα σχήμα και θα
 * ζωγραφιζόταν **άδειος**: σιωπηλή απώλεια, ορατή μόνο σε πραγματικό αποθηκευμένο αρχείο.
 */
describe('🔴 παλιά οντότητα (πριν τα φύλλα) — φτάνει ΑΚΕΡΑΙΑ στον ζωγράφο', () => {
  const legacy = makePreWorksheetsTableEntity(
    buildTableModel({ columnCount: 3, dataRowCount: 2, columnWidthMm: 40 }),
  );
  const base = { id: legacy.id, layerId: 'L', visible: true };

  it('η προβολή σκηνής→DxfTable ΛΥΝΕΙ τα φύλλα αντί να τα ρίξει', () => {
    const dxf = TO_DXF_HANDLERS.table!(legacy, base as never) as unknown as Record<string, unknown>;
    // Μόνο τα **υποχρεωτικά** πεδία: το `breaking` λείπει νόμιμα από αυτό το δείγμα, και μια
    // απαίτηση «όλα» θα έλεγχε την πληρότητα του δείγματος αντί για τη λύση των φύλλων.
    const required = TABLE_RENDER_FIELDS.filter((f) => f !== 'breaking');
    const dropped = required.filter((f) => dxf[f] === undefined);
    expect(dropped).toEqual([]);
    expect(dxf.worksheets).toHaveLength(1);
  });

  it('…και τα κελιά του φτάνουν στο μοντέλο που βλέπει ο TableRenderer', () => {
    const dxf = TO_DXF_HANDLERS.table!(legacy, base as never) as unknown as Record<string, unknown>;
    const model = buildEntityModelFromDxf(
      dxf as unknown as DxfEntityUnion, false,
      { colorHex: '#fff', lineWidthPx: 1, alpha: 1 },
    ) as unknown as {
      worksheets?: readonly { model?: { columns?: readonly unknown[]; rows?: readonly unknown[] } }[];
    };
    expect(model.worksheets?.[0]?.model?.columns).toHaveLength(3);
    expect(model.worksheets?.[0]?.model?.rows).toHaveLength(4);
  });
});
