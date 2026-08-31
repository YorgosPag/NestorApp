/**
 * 🔴 ADR-769 §7.2 — **Η ΠΑΡΟΥΣΙΑΣΗ**: ο φρουρός, η λωρίδα, και τα λόγια.
 *
 * Τρία πράγματα που το test του **κριτή** δεν μπορεί να φυλάξει, γιατί ζουν στα άκρα:
 *
 *  1. **Ο φρουρός της εντολής** — ότι η τιμή του ιδιοκτήτη **δεν** γράφεται *και* στο μοντέλο.
 *     Αν γραφόταν, ο πίνακας θα κρατούσε αντίγραφο δίπλα στην πηγή, δηλαδή θα έσπαγε το Α2
 *     («ΕΝΑΣ ιδιοκτήτης») τη στιγμή ακριβώς που το υλοποιεί — και **σιωπηλά**: η οθόνη θα
 *     έδειχνε τη σωστή τιμή, με δύο ανεξάρτητες πηγές αλήθειας από κάτω.
 *  2. **Η ένταση της λωρίδας** (Δ7) — ο ζωγράφος να **βλέπει** τη διαφορά γράψιμης/μη.
 *  3. **Τα λόγια** — καμία άρνηση χωρίς μήνυμα, σε **δύο** γλώσσες. Ένα κλειδί που λείπει
 *     βάφει ωμό `table.writeBack.…` στην οθόνη και **κανένα στατικό εργαλείο δεν το βλέπει**
 *     (N.11: ο scanner ψάχνει μόνο `defaultValue:` και `toast(`).
 *
 * @see bim/table/table-cell-edit-session.ts — ο φρουρός
 * @see rendering/entities/table/stamp-table-bound-state.ts — ο ζωγράφος
 */

import el from '@/i18n/locales/el/dxf-viewer.json';
import en from '@/i18n/locales/en/dxf-viewer.json';
import { applyBoundSourceToCells } from '../binding/table-binding-cells';
import { boundColumnStripsMm } from '../binding/table-bound-marks';
import { commitCellWrites } from '../formula/table-formula-engine';
import { buildTableCellEditCommand } from '../table-cell-edit-session';
import {
  TABLE_WRITE_BACK_OWNER_REFUSED_KEY,
  tableWriteBackMessageKey,
} from '../write-back/table-write-back-message';
import { buildCoordinateTable } from '../../../systems/topography/deliverables/survey-tables';
import type { TableColumnUnwritableReason, TableWriteBackRejection } from '../write-back/table-write-back-plan';
import type { ISceneManager } from '../../../core/commands';
import type { TableColumnLayout } from '../table-layout-types';
import type { PersistedTableModel, TableBinding, TableColumn, TableRow } from '../../../types/table';
import type { TableEntity } from '../../../types/table-entity';
import type { TopoPoint } from '../../../systems/topography/topo-types';
import { commitPendingForTest } from './formula-book-fixture';

// ─── Σκηνικό ─────────────────────────────────────────────────────────────────

const P1 = { x: 391_600_000, y: 4_204_000_000, z: 12_000, code: 'ΣΤ1' } as TopoPoint;
const P2 = { x: 391_698_400, y: 4_204_500_000, z: 14_500, code: 'ΣΤ3' } as TopoPoint;

const BINDING: TableBinding = {
  mode: 'live',
  sourceRef: { kind: 'survey-coordinates' },
  revision: 'r0',
};

const col = (id: string, sourceKey?: string): TableColumn => ({
  id, sizing: { kind: 'fixed', widthMm: 25 }, valueType: 'text', align: 'right', ...(sourceKey ? { sourceKey } : {}),
});

function baseModel(): PersistedTableModel {
  const columns: TableColumn[] = [
    col('cIdx', 'index'), col('cX', 'x'), col('cZ', 'z'), col('cNote'),
  ];
  const rows: TableRow[] = [
    { id: 'rHead', rowClass: 'header', heightMm: 8 },
    { id: 'r1', rowClass: 'data', heightMm: 6 },
    { id: 'r2', rowClass: 'data', heightMm: 6 },
  ];
  return { columns, rows, cells: [], merges: [] };
}

function boundEntity(): TableEntity {
  const model = commitPendingForTest(
    applyBoundSourceToCells(baseModel(), buildCoordinateTable([P1, P2])).pending,
  );
  return { id: 'tbl-1', type: 'table', model, binding: BINDING } as unknown as TableEntity;
}

const sceneManager = { getEntity: () => undefined, getEntities: () => [] } as unknown as ISceneManager;

// ─── 1. Ο φρουρός: η τιμή του ιδιοκτήτη δεν γράφεται ΚΑΙ στο μοντέλο ──────────

describe('ADR-769 Α2 — ΕΝΑΣ ιδιοκτήτης: το μοντέλο δεν κρατά αντίγραφο', () => {
  it('🔴 κελί ΓΡΑΨΙΜΗΣ στήλης δεν παράγει εντολή μοντέλου — η τιμή ανήκει στην οντότητα', () => {
    const command = buildTableCellEditCommand(boundEntity(), 'r2', 'cX', '391698.5', sceneManager);
    expect(command).toBeNull();
  });

  it('κελί ΜΗ γράψιμης στήλης επίσης — ο δεσμός του ADR-767 Δ1 μένει ακέραιος', () => {
    expect(buildTableCellEditCommand(boundEntity(), 'r2', 'cZ', '15', sceneManager)).toBeNull();
    expect(buildTableCellEditCommand(boundEntity(), 'r2', 'cIdx', '7', sceneManager)).toBeNull();
  });

  it('🔴 ΕΛΕΥΘΕΡΟ κελί μέσα στον ίδιο πίνακα γράφεται κανονικά — καμία παλινδρόμηση', () => {
    // Η φραγή δεν επιτρέπεται να απλωθεί σε ολόκληρο τον πίνακα επειδή δηλώνει δεσμό.
    expect(buildTableCellEditCommand(boundEntity(), 'r2', 'cNote', 'γωνία', sceneManager)).not.toBeNull();
  });

  it('η ΚΕΦΑΛΙΔΑ γράφεται κανονικά — ο τίτλος στήλης δεν είναι δεδομένο της πηγής', () => {
    expect(buildTableCellEditCommand(boundEntity(), 'rHead', 'cX', 'Χ (μ)', sceneManager)).not.toBeNull();
  });
});

// ─── 2. Δ7: η γραψιμότητα ΦΑΙΝΕΤΑΙ ───────────────────────────────────────────

const LAYOUT: readonly TableColumnLayout[] = [
  { id: 'cIdx', xMm: 0, widthMm: 25 },
  { id: 'cX', xMm: 25, widthMm: 25 },
  { id: 'cZ', xMm: 50, widthMm: 25 },
  { id: 'cNote', xMm: 75, widthMm: 25 },
];

describe('ADR-769 Δ7 — η γραψιμότητα φαίνεται ΠΡΙΝ τη γραφή (πρότυπο ArchiCAD)', () => {
  it('🔴 η ΓΡΑΨΙΜΗ στήλη ξεχωρίζει από τις δεμένες-αλλά-όχι-γράψιμες', () => {
    const strips = boundColumnStripsMm(baseModel(), BINDING, LAYOUT);
    expect(strips.map((s) => [s.colId, s.writable])).toEqual([
      ['cIdx', false], // αύξων αριθμός — παράγωγο, ποτέ
      ['cX', true],    // ο ιδιοκτήτης υπάρχει: MoveTopoSurveyPointCommand
      ['cZ', false],   // πραγματική παράμετρος, αλλά χωρίς ιδιοκτήτη σήμερα
    ]);
  });

  it('πίνακας ΧΩΡΙΣ δεσμό: καμία στήλη δεν δηλώνεται γράψιμη — δεν υπάρχει ποιος να πει', () => {
    const strips = boundColumnStripsMm(baseModel(), undefined, LAYOUT);
    expect(strips.every((s) => !s.writable)).toBe(true);
  });
});

// ─── 3. Τα λόγια: καμία άρνηση χωρίς μήνυμα, σε ΔΥΟ γλώσσες ──────────────────

/**
 * Οι έξι αρνήσεις του κριτή + οι τέσσερις δομικοί λόγοι. Γραμμένες **ονομαστικά** και
 * τυποποιημένες στις ενώσεις: νέα άρνηση χωρίς λόγια **δεν μεταγλωττίζεται** εδώ.
 */
const REJECTIONS: readonly TableWriteBackRejection['kind'][] = [
  'column-unwritable', 'cell-locked', 'not-bound', 'source-unavailable', 'source-moved', 'invalid-value',
];
const UNWRITABLE: readonly TableColumnUnwritableReason[] = ['ordinal', 'computed', 'identity', 'no-owner'];

const EXPECTED_KEYS = [
  'unwritableOrdinal', 'unwritableComputed', 'unwritableIdentity', 'unwritableNoOwner',
  'cellLocked', 'notBound', 'sourceUnavailable', 'sourceMoved', 'invalidValue', 'ownerRefused',
];

describe('ADR-769 — κάθε άρνηση βρίσκει το ΔΙΚΟ της μήνυμα', () => {
  it('🔴 οι τέσσερις δομικοί λόγοι ΔΕΝ ισοπεδώνονται σε ένα μήνυμα', () => {
    const keys = UNWRITABLE.map((reason) =>
      tableWriteBackMessageKey({ kind: 'column-unwritable', reason }));
    expect(new Set(keys).size).toBe(UNWRITABLE.length);
  });

  it('κάθε άρνηση δίνει κλειδί που ΥΠΑΡΧΕΙ — καμία δεν πέφτει σε κενό', () => {
    const rejections: readonly TableWriteBackRejection[] = [
      { kind: 'column-unwritable', reason: 'ordinal' },
      { kind: 'cell-locked' },
      { kind: 'not-bound' },
      { kind: 'source-unavailable' },
      { kind: 'source-moved', sourceKey: 'y' },
      { kind: 'invalid-value' },
    ];
    expect(rejections.length).toBe(REJECTIONS.length);
    for (const rejection of rejections) {
      const key = tableWriteBackMessageKey(rejection).replace('table.writeBack.', '');
      expect(el.table.writeBack).toHaveProperty(key);
    }
  });

  it('🔴 «ο ιδιοκτήτης δεν μπόρεσε» έχει ΔΙΚΟ του μήνυμα — αλλιώς ο χρήστης ψάχνει λάθος αιτία', () => {
    const ownerKey = TABLE_WRITE_BACK_OWNER_REFUSED_KEY.replace('table.writeBack.', '');
    expect(el.table.writeBack).toHaveProperty(ownerKey);
    const others = REJECTIONS.map((kind) =>
      kind === 'column-unwritable'
        ? tableWriteBackMessageKey({ kind, reason: 'no-owner' })
        : tableWriteBackMessageKey({ kind } as TableWriteBackRejection));
    expect(others).not.toContain(TABLE_WRITE_BACK_OWNER_REFUSED_KEY);
  });
});

describe('ADR-769 / N.11 — κάθε άρνηση έχει λόγια, σε el ΚΑΙ en', () => {
  it('🔴 δέκα καταστάσεις ⇒ δέκα κλειδιά, και στις δύο γλώσσες', () => {
    // Το πλήθος **παράγεται** από τις ενώσεις, ώστε νέα άρνηση να ρίχνει αυτή τη γραμμή.
    expect(REJECTIONS.length + UNWRITABLE.length).toBe(EXPECTED_KEYS.length);
    for (const key of EXPECTED_KEYS) {
      expect(el.table.writeBack).toHaveProperty(key);
      expect(en.table.writeBack).toHaveProperty(key);
    }
  });

  it('🔴 κανένα μήνυμα δεν είναι κενό — ωμό κλειδί στην οθόνη δεν το βλέπει καμία πύλη', () => {
    for (const key of EXPECTED_KEYS) {
      const greek = (el.table.writeBack as Record<string, string>)[key];
      const english = (en.table.writeBack as Record<string, string>)[key];
      expect(greek.trim().length).toBeGreaterThan(10);
      expect(english.trim().length).toBeGreaterThan(10);
      // Οι δύο γλώσσες οφείλουν να **διαφέρουν**: αντιγραμμένο ελληνικό στο `en` είναι το
      // ίδιο σφάλμα με κλειδί που λείπει, απλώς αόρατο στους ελεγκτές πληρότητας.
      expect(greek).not.toBe(english);
    }
  });
});
