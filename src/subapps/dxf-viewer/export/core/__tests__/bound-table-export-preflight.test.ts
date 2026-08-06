/**
 * 🔴 ADR-767 Δ4 — **Η ΕΜΒΕΛΕΙΑ ΤΟΥ ΦΡΑΓΜΟΥ ΕΙΝΑΙ Η ΕΜΒΕΛΕΙΑ ΤΗΣ ΕΞΑΓΩΓΗΣ.**
 *
 * Ο φραγμός μπορεί να αποτύχει με **δύο** τρόπους, και οι δύο είναι σιωπηλοί:
 *
 * | αστοχία | τι βλέπει ο χρήστης |
 * |---|---|
 * | σαρώνει **όλους** τους ορόφους πάντα | εξαγωγή **μόνο** του ισογείου μπλοκάρει επειδή ο 3ος όροφος έχει μπαγιάτικο πίνακα ⇒ θόρυβος ⇒ μαθαίνει να προσπερνά τον φραγμό |
 * | σαρώνει **μόνο** τον ενεργό πάντα | εξαγωγή **όλων** των ορόφων περνά με μπαγιάτικα νούμερα μέσα ⇒ ο φραγμός είναι διακοσμητικός ακριβώς στη βαρύτερη περίπτωση |
 *
 * Η μόνη άμυνα είναι να καλείται το **ίδιο** `resolveExportFloors` που εκτελεί η εξαγωγή. Αυτό
 * το αρχείο το επιβάλλει με **αντίθεση**: η ίδια σκηνή, δύο εμβέλειες, δύο απαντήσεις.
 *
 * @see export/core/bound-table-export-preflight.ts
 * @see docs/centralized-systems/reference/adrs/ADR-767-table-bound-mode.md §4 Δ4
 */

import { assessExportBoundTables } from '../bound-table-export-preflight';
import { fingerprintExportableTable } from '../../../bim/table/binding/table-binding-fingerprint';
import { buildCoordinateTable } from '../../../systems/topography/deliverables/survey-tables';
import type { TableSourceContext } from '../../../bim/table/binding/table-source-resolver';
import type { TopoPoint } from '../../../systems/topography/topo-types';
import type { ExportLevelScene } from '../../types';
import type { TableEntity } from '../../../types/table-entity';
import type { Entity, SceneModel } from '../../../types/entities';
import type { Level } from '../../../systems/levels/config';

// ─── Σκηνικό ──────────────────────────────────────────────────────────────────

const P1: TopoPoint = { x: 1000, y: 2000, z: 3000, code: 'Κ1' };
const P2: TopoPoint = { x: 4000, y: 5000, z: 6000, code: 'Κ2' };

const context = (points: readonly TopoPoint[]): TableSourceContext => ({ topoPoints: points });

/** Το αποτύπωμα που κάνει έναν πίνακα **ενημερωμένο** για αυτά τα σημεία. */
const revisionFor = (points: readonly TopoPoint[]): string =>
  fingerprintExportableTable(buildCoordinateTable(points));

function boundTable(id: string, revision: string): TableEntity {
  return {
    id,
    type: 'table',
    layerId: 'lyr',
    position: { x: 0, y: 0 },
    angleRad: 0,
    styleId: 'standard',
    model: {
      columns: [
        { id: 'cX', sizing: { kind: 'fixed', widthMm: 20 }, valueType: 'text', align: 'right', sourceKey: 'x' },
      ],
      rows: [{ id: 'r1', rowClass: 'data', heightMm: 6 }],
      cells: [],
      merges: [],
    },
    binding: { mode: 'bound', sourceRef: { kind: 'survey-coordinates' }, revision },
  } as TableEntity;
}

/** Πίνακας δεμένος σε κλάδο **χωρίς παραγωγό** — ανέλεγκτος, όχι μπαγιάτικος. */
function notWiredTable(id: string): TableEntity {
  return {
    ...boundTable(id, 'irrelevant'),
    binding: { mode: 'bound', sourceRef: { kind: 'survey-volumes' }, revision: 'irrelevant' },
  } as TableEntity;
}

function level(id: string, order: number): Level {
  return { id, name: id, order } as Level;
}

function scene(entities: readonly Entity[]): SceneModel {
  return { entities: entities as Entity[] } as SceneModel;
}

function levelScenes(...pairs: readonly (readonly [string, number, readonly Entity[]])[]): ExportLevelScene[] {
  return pairs.map(([id, order, entities]) => ({ level: level(id, order), scene: scene(entities) }));
}

// ─── 1. 🔴 Η εμβέλεια είναι η εμβέλεια ────────────────────────────────────────

describe('🔴 assessExportBoundTables — εξετάζει ΑΚΡΙΒΩΣ ό,τι θα εξαχθεί', () => {
  const scenes = levelScenes(
    ['lvl_ground', 0, [boundTable('tbl_ok', revisionFor([P1, P2]))]],
    ['lvl_third', 2, [boundTable('tbl_stale', 'ΠΑΛΙΟ_ΑΠΟΤΥΠΩΜΑ')]],
  );

  it('🔴 «ΕΝΕΡΓΟΣ ΟΡΟΦΟΣ»: ο μπαγιάτικος ΑΛΛΟΥ ορόφου ΔΕΝ μπλοκάρει — αλλιώς ο φραγμός γίνεται θόρυβος', () => {
    const verdict = assessExportBoundTables({
      levelScenes: scenes,
      activeLevelId: 'lvl_ground',
      floorScope: 'active',
      context: context([P1, P2]),
    });

    expect(verdict.blocked).toBe(false);
    expect(verdict.examined).toBe(1);
  });

  it('🔴 «ΟΛΟΙ ΟΙ ΟΡΟΦΟΙ»: ο ΙΔΙΟΣ μπαγιάτικος ΤΩΡΑ μπλοκάρει — αλλιώς είναι διακοσμητικός', () => {
    const verdict = assessExportBoundTables({
      levelScenes: scenes,
      activeLevelId: 'lvl_ground',
      floorScope: 'all-zip',
      context: context([P1, P2]),
    });

    expect(verdict.blocked).toBe(true);
    expect(verdict.stale.map((t) => t.entityId)).toEqual(['tbl_stale']);
    expect(verdict.examined).toBe(2);
  });

  it('το `all-single` κρίνει το ίδιο με το `all-zip` — ίδιο περιεχόμενο, άλλη συσκευασία', () => {
    const zip = assessExportBoundTables({
      levelScenes: scenes, activeLevelId: 'lvl_ground', floorScope: 'all-zip', context: context([P1, P2]),
    });
    const single = assessExportBoundTables({
      levelScenes: scenes, activeLevelId: 'lvl_ground', floorScope: 'all-single', context: context([P1, P2]),
    });

    expect(single.blocked).toBe(zip.blocked);
    expect(single.examined).toBe(zip.examined);
  });
});

// ─── 2. «Δεν ξέρω» ≠ «διαφέρει» ───────────────────────────────────────────────

describe('ο ανέλεγκτος δηλώνεται χωριστά και μπλοκάρει κι αυτός', () => {
  it('🔴 ΚΛΑΔΟΣ ΧΩΡΙΣ ΠΑΡΑΓΩΓΟ ⇒ `unchecked` ΜΕ ΛΟΓΟ, ποτέ σιωπηλό πέρασμα', () => {
    const verdict = assessExportBoundTables({
      levelScenes: levelScenes(['lvl_a', 0, [notWiredTable('tbl_nw')]]),
      activeLevelId: 'lvl_a',
      floorScope: 'active',
      context: context([P1]),
    });

    expect(verdict.blocked).toBe(true);
    expect(verdict.unchecked).toEqual([{ entityId: 'tbl_nw', reason: 'source-not-wired' }]);
    expect(verdict.stale).toEqual([]);
  });
});

// ─── 3. Ο αποτυχημένος έλεγχος ────────────────────────────────────────────────

describe('εμβέλεια που δεν λύνεται — «τίποτα να εξεταστεί», όχι ψεύτικο πράσινο', () => {
  it('🔴 «ΕΝΕΡΓΟΣ» ΧΩΡΙΣ ΦΟΡΤΩΜΕΝΗ ΣΚΗΝΗ: δεν πετά, και ΔΗΛΩΝΕΙ `examined: 0`', () => {
    const verdict = assessExportBoundTables({
      levelScenes: levelScenes(['lvl_a', 0, [boundTable('tbl_stale', 'ΠΑΛΙΟ')]]),
      activeLevelId: 'lvl_ΑΝΥΠΑΡΚΤΟ',
      floorScope: 'active',
      context: context([P1]),
    });

    // `blocked: false` **επειδή** το `runExport` θα πετάξει το ίδιο σφάλμα αμέσως μετά και
    // κανένα αρχείο δεν παράγεται — το `examined: 0` το λέει ρητά αντί να το υπονοεί.
    expect(verdict).toEqual({ blocked: false, stale: [], unchecked: [], examined: 0 });
  });
});

// ─── 4. Το καθαρό έργο ────────────────────────────────────────────────────────

describe('καθαρό έργο — ο φραγμός ΣΙΩΠΑ', () => {
  it('κανένας δεμένος πίνακας ⇒ `blocked: false` και `examined: 0`', () => {
    const verdict = assessExportBoundTables({
      levelScenes: levelScenes(['lvl_a', 0, []]),
      activeLevelId: 'lvl_a',
      floorScope: 'active',
      context: context([P1]),
    });

    expect(verdict).toEqual({ blocked: false, stale: [], unchecked: [], examined: 0 });
  });

  it('🔴 ΚΕΝΗ ΑΠΟΤΥΠΩΣΗ ΔΕΝ ΕΙΝΑΙ «ΑΓΝΩΣΤΗ ΠΗΓΗ» — `[]` επιλύεται κανονικά', () => {
    // Η γέφυρα δίνει πάντα πίνακα· ένα έργο χωρίς σημεία είναι **γεγονός**, όχι άγνοια. Ο
    // πίνακας που έχει το αποτύπωμα του κενού είναι ενημερωμένος.
    const verdict = assessExportBoundTables({
      levelScenes: levelScenes(['lvl_a', 0, [boundTable('tbl_empty', revisionFor([]))]]),
      activeLevelId: 'lvl_a',
      floorScope: 'active',
      context: context([]),
    });

    expect(verdict.blocked).toBe(false);
    expect(verdict.examined).toBe(1);
  });
});
