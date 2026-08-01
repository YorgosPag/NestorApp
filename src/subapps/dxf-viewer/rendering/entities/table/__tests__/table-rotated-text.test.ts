/**
 * 🔴 ADR-739 Φ.Δ βήμα 8 — **ΟΘΟΝΗ === DXF: ΤΟ ΚΕΙΜΕΝΟ ΓΕΡΝΕΙ ΜΕ ΤΟΝ ΠΙΝΑΚΑ.**
 *
 * ## Το ελάττωμα που κλειδώνει (μετρημένο ζωντανά, 2026-08-01)
 * Πίνακας με `angleRad = 0.35` (≈20°). Στην οθόνη: πλέγμα γερμένο, **γράμματα ίσια**. Στο
 * εξαγόμενο `export.dxf` (AC1032, 667.767 bytes) τα ίδια κείμενα είχαν
 * `rot = 20.053523°`, και τα τρία `halign` σωστά (0/1/2 = αριστερά/κέντρο/δεξιά).
 *
 * Δηλαδή **τέσσερις μηχανές απαντούσαν στην ίδια ερώτηση και μία διαφωνούσε**:
 *
 * | μηχανή | έγερνε; |
 * |---|---|
 * | εξαγωγή DXF (`decomposeTable`)              | ✅ |
 * | εξαγωγή PDF (ίδια primitives)               | ✅ |
 * | επεξεργαστής κελιού (`rotate(-0.35rad)`)    | ✅ |
 * | **ζωγράφος καμβά** (`stampRun`)             | ❌ **καμία `ctx.rotate`** |
 *
 * ## Γιατί ΑΥΤΟ το αρχείο και όχι μια γραμμή σε υπάρχουσα σουίτα
 * Η ερώτηση δεν είναι «ζωγραφίστηκε το κείμενο;» (το καλύπτει το `stamp-table-layout.test`),
 * ούτε «πού πέφτει η γεωμετρία;» (το καλύπτει το `table-entity-geometry.test`). Είναι
 * **«συμφωνούν δύο ανεξάρτητα backends;»** — και μια τέτοια ερώτηση χρειάζεται να καλέσει
 * **και τα δύο** στο ίδιο test, αλλιώς το καθένα μένει εσωτερικά συνεπές και μεταξύ τους
 * ασύμφωνο. Ακριβώς αυτό συνέβη επί τρία βήματα.
 *
 * @see rendering/entities/table/stamp-table-layout.ts — `frameScreenAngleRad`, `stampFrameText`
 * @see export/core/table-to-primitives.ts — ο άλλος από τους δύο μάρτυρες
 */

import {
  frameScreenAngleRad,
  stampTableText,
  type StampTableContext,
} from '../stamp-table-layout';
import { stampTableIndicator } from '../stamp-table-indicator';
import { createPaintLog, createRc, type PaintLog } from './table-paint-recorder';
import {
  computeTableEntityGeometryLive,
  tableFrameToWorld,
} from '../../../../bim/table/table-entity-geometry';
import { createTableModel, toPersistedTableModel } from '../../../../bim/table/table-model-helpers';
import { BUILTIN_TABLE_STYLE_IDS } from '../../../../bim/table/table-style-presets';
import { decomposeTable } from '../../../../export/core/table-to-primitives';
import type { Point2D } from '../../../types/Types';
import type { TableColumn, TableRow } from '../../../../types/table';
import type { TableEntity } from '../../../../types/table-entity';

const RAD_TO_DEG = 180 / Math.PI;

/** Η γωνία του δοκιμαστικού πίνακα του Giorgio — 0,35 rad ≈ 20,05°. */
const TILT_RAD = 0.35;


const COLUMNS: TableColumn[] = [
  { id: 'c1', sizing: { kind: 'fixed', widthMm: 40 }, valueType: 'text', align: 'left' },
  { id: 'c2', sizing: { kind: 'fixed', widthMm: 20 }, valueType: 'text', align: 'left' },
];
const ROWS: TableRow[] = [{ id: 'r1', rowClass: 'data', heightMm: 8 }];

/**
 * Πίνακας **μακριά από την αρχή των αξόνων** (`x = 661.711`, όπως ο πραγματικός της
 * σκηνής): με άγκυρα στο `(0,0)` μια στροφή γύρω από λάθος κέντρο θα ήταν **αόρατη**, γιατί
 * το `(0,0)` είναι σταθερό σημείο κάθε περιστροφής. Ο πραγματικός πίνακας δεν είναι εκεί.
 */
function makeEntity(angleRad: number): TableEntity {
  return {
    id: 'tbl_rot',
    type: 'table',
    layerId: 'lyr_test',
    position: { x: 661711.85, y: 374619 },
    angleRad,
    styleId: BUILTIN_TABLE_STYLE_IDS.STANDARD,
    model: toPersistedTableModel(
      createTableModel({
        columns: COLUMNS,
        rows: ROWS,
        cells: [['r1', 'c1', { kind: 'text', value: 'ΔΟΚΙΜΗ' }]],
      }),
    ),
  };
}

/**
 * Η **πραγματική** αλυσίδα προβολής του `TableRenderer`: πλαίσιο → κόσμος → οθόνη, με τον
 * y της οθόνης **ανεστραμμένο** — η σύμβαση του `CoordinateTransforms` (`screenY = H − …`).
 * Αυτή η αναστροφή είναι όλο το ζήτημα: εκεί ακριβώς αλλάζει το πρόσημο της γωνίας.
 */
function projectionFor(entity: TableEntity): (u: number, v: number) => Point2D {
  const geometry = computeTableEntityGeometryLive(entity, 'mm');
  const scale = 0.05;
  const height = 900;
  return (u, v) => {
    const world = tableFrameToWorld(entity, u, v, geometry.mmToWorld);
    return { x: 30 + world.x * scale, y: height - 30 - world.y * scale };
  };
}

/** Η μοίρα στροφής που γράφει ο **exporter** για την πρώτη οντότητα κειμένου. */
function dxfTextRotationDeg(entity: TableEntity): number {
  const texts = decomposeTable(entity, 1, 'mm').filter((e) => e.type === 'text');
  expect(texts.length).toBeGreaterThan(0);
  return (texts[0] as { rotation: number }).rotation;
}

// ── 1. Η ΙΣΟΤΙΜΙΑ: δύο backends, μία απάντηση ───────────────────────────────

describe('🔴 ΙΣΟΤΙΜΙΑ — η γωνία της οθόνης ΕΙΝΑΙ η γωνία του DXF', () => {
  /**
   * Ο **πυρήνας**. Οι δύο αριθμοί γεννιούνται σε τελείως διαφορετικά μονοπάτια:
   *  - ο ένας από το `toScreen` του ζωγράφου (πλαίσιο → κόσμος → **ανεστραμμένη** οθόνη)·
   *  - ο άλλος από το `entity.angleRad` του exporter (κόσμος → DXF, y προς τα **πάνω**).
   *
   * Η αναστροφή του y είναι η **μόνη** διαφορά, άρα η σωστή σχέση είναι το πρόσημο.
   * Αν κάποιος «διορθώσει» το πρόσημο του `frameScreenAngleRad`, ή αν ο ζωγράφος
   * ξαναγυρίσει σε μηδενική στροφή, **αυτή η γραμμή** γίνεται κόκκινη.
   */
  it.each([TILT_RAD, -TILT_RAD, 0.9, Math.PI / 6])(
    'angleRad = %p ⇒ γωνία οθόνης (σε μοίρες, ανεστραμμένη) === rotation του DXF',
    (angleRad) => {
      const entity = makeEntity(angleRad);
      const screenAngleDeg = frameScreenAngleRad(projectionFor(entity)) * RAD_TO_DEG;
      expect(-screenAngleDeg).toBeCloseTo(dxfTextRotationDeg(entity), 9);
    },
  );

  it('η μετρημένη τιμή του Giorgio: 0,35 rad ⇒ 20,05° και στα δύο', () => {
    const entity = makeEntity(TILT_RAD);
    expect(dxfTextRotationDeg(entity)).toBeCloseTo(20.0535, 4);
    expect(-frameScreenAngleRad(projectionFor(entity)) * RAD_TO_DEG).toBeCloseTo(20.0535, 4);
  });

  it('πίνακας ΧΩΡΙΣ στροφή ⇒ ακριβώς μηδέν και στα δύο (καμία υποβάθμιση)', () => {
    const entity = makeEntity(0);
    expect(dxfTextRotationDeg(entity)).toBe(0);
    expect(frameScreenAngleRad(projectionFor(entity))).toBeCloseTo(0, 12);
  });
});

// ── 2. Ο ζωγράφος όντως την εφαρμόζει ───────────────────────────────────────


describe('🔴 stampTableText — τα ΓΡΑΜΜΑΤΑ γέρνουν, όχι μόνο το πλέγμα', () => {
  function paintCells(entity: TableEntity): { log: PaintLog; rc: StampTableContext } {
    const log = createPaintLog();
    const toScreen = projectionFor(entity);
    const rc = createRc(log, { pxPerMm: 10, toScreen });
    const geometry = computeTableEntityGeometryLive(entity, 'mm');
    stampTableText(rc, geometry.layout.cells);
    return { log, rc };
  }

  it('η στροφή που εφαρμόστηκε ΕΙΝΑΙ η γωνία του πλαισίου — όχι μηδέν', () => {
    const entity = makeEntity(TILT_RAD);
    const { log, rc } = paintCells(entity);

    expect(log.texts.length).toBeGreaterThan(0);
    for (const painted of log.texts) {
      expect(painted.angleRad).toBeCloseTo(rc.textAngleRad, 12);
    }
    // Η ρητή διατύπωση «όχι μηδέν»: χωρίς αυτήν, ένα `textAngleRad` που κατέρρευσε σε 0
    // θα ικανοποιούσε τον παραπάνω βρόχο τετριμμένα.
    expect(Math.abs(rc.textAngleRad)).toBeGreaterThan(0.3);
  });

  /**
   * ⚠️ Η **θέση** είναι το δεύτερο μισό της διόρθωσης, και το πιο εύκολο να χαλάσει: με
   * `rotate` **πριν** το `translate`, το κείμενο εκτοξεύεται κατά `|άγκυρα| · sin(γωνία)`
   * px μακριά — δεκάδες χιλιάδες pixel για πίνακα στο `x = 661.711`. Ο πίνακας θα φαινόταν
   * απλώς **χωρίς κείμενο**, χωρίς κανένα σφάλμα πουθενά.
   */
  it('η άγκυρα ΔΕΝ κουνήθηκε: κάθε κείμενο πέφτει ακριβώς στο `toScreen` της θέσης του', () => {
    const entity = makeEntity(TILT_RAD);
    const geometry = computeTableEntityGeometryLive(entity, 'mm');
    const toScreen = projectionFor(entity);
    const { log } = paintCells(entity);

    const expected = geometry.layout.cells
      .filter((c) => c.text)
      .map((c) => toScreen(c.text!.position.x, c.text!.position.y));

    expect(log.texts).toHaveLength(expected.length);
    log.texts.forEach((painted, i) => {
      expect(painted.at.x).toBeCloseTo(expected[i].x, 9);
      expect(painted.at.y).toBeCloseTo(expected[i].y, 9);
    });
  });

  it('πίνακας χωρίς στροφή ⇒ καμία στροφή στο μελάνι (μηδέν οπισθοδρόμηση)', () => {
    const { log } = paintCells(makeEntity(0));
    expect(log.texts.length).toBeGreaterThan(0);
    for (const painted of log.texts) expect(painted.angleRad).toBeCloseTo(0, 12);
  });
});

// ── 3. Οι ζώνες A B C / 1 2 3 — ΕΝΑ σημείο, δύο καταναλωτές ────────────────

describe('🔴 stampTableIndicator — οι ετικέτες των ζωνών ακολουθούν ΤΟΝ ΙΔΙΟ κανόνα', () => {
  it('τα γράμματα των ζωνών γέρνουν με την ίδια γωνία που γέρνει το κείμενο κελιού', () => {
    const entity = makeEntity(TILT_RAD);
    const log = createPaintLog();
    const rc = createRc(log, { pxPerMm: 10, toScreen: projectionFor(entity) });

    stampTableIndicator(rc, {
      columns: [{ label: 'A', startMm: 0, sizeMm: 40, active: false }],
      rows: [{ label: '1', startMm: 0, sizeMm: 8, active: true }],
      widthMm: 60,
      heightMm: 8,
    });

    expect(log.texts.map((p) => p.text)).toEqual(['A', '1']);
    for (const painted of log.texts) {
      expect(painted.angleRad).toBeCloseTo(rc.textAngleRad, 12);
    }
  });
});

// ── 4. Η παραγωγή της γωνίας — γιατί ΔΕΝ είναι παράμετρος ──────────────────

describe('frameScreenAngleRad — η γωνία ΠΑΡΑΓΕΤΑΙ από την προβολή', () => {
  it('ταυτοτική προβολή ⇒ μηδέν', () => {
    expect(frameScreenAngleRad((u, v) => ({ x: u, y: v }))).toBe(0);
  });

  it('προβολή στροφής 90° ⇒ π/2 (ο άξονας +u δείχνει «κάτω» στην οθόνη)', () => {
    expect(frameScreenAngleRad((u, v) => ({ x: -v, y: u }))).toBeCloseTo(Math.PI / 2, 12);
  });

  it('εκφυλισμένη προβολή (μηδενική κλίμακα) ⇒ 0, ΠΟΤΕ NaN', () => {
    const angle = frameScreenAngleRad(() => ({ x: 7, y: 7 }));
    expect(Number.isNaN(angle)).toBe(false);
    expect(angle).toBe(0);
  });

  it('αναλλοίωτη σε ομοιόμορφη κλίμακα — ένα mm λέει ό,τι και χίλια', () => {
    const tilt = (k: number) => (u: number, v: number) => ({
      x: k * (u * Math.cos(0.4) - v * Math.sin(0.4)),
      y: k * (u * Math.sin(0.4) + v * Math.cos(0.4)),
    });
    expect(frameScreenAngleRad(tilt(0.001))).toBeCloseTo(frameScreenAngleRad(tilt(1000)), 12);
  });
});
