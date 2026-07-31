/**
 * ADR-739 §12 — **ΧΑΡΑΚΤΗΡΙΣΜΟΣ πριν την απορρόφηση** του ADR-622.
 *
 * Η Φάση Β θα κάνει το `buildScheduleTable` / `buildFieldBlock` thin adapters πάνω στη
 * νέα μηχανή διάταξης (`bim/table/table-layout.ts`). Το ADR-739 απαιτεί η απορρόφηση να
 * **αποδεικνύεται** χωρίς οπτική μεταβολή — και *«χωρίς αυτό, "δεν άλλαξε τίποτα" είναι
 * ισχυρισμός, όχι απόδειξη»* (§12).
 *
 * Αυτό το αρχείο είναι το δίχτυ. Καταγράφει τα **ακριβή `DetailPrimitive[]`** — κάθε
 * συντεταγμένη, κάθε χρώμα, κάθε πάχος — και των **έξι** καταναλωτών:
 *
 *   1. `buildColumnScheduleRegion`  — 5-στηλος πίνακας (ο μόνος με δικό του column set)
 *   2. `buildBeamScheduleRegion`    — 4-στηλος μέσω `buildReinforcementSchedule`
 *   3. `buildFootingScheduleRegion` — 4-στηλος (πέδιλο + πεδιλοδοκός + συνδετήρια)
 *   4. `buildSlabScheduleRegion`    — 4-στηλος (σχάρες, χωρίς συνδετήρες)
 *   5. `buildSurveySheet`           — ADR-650 M7, ο μόνος καταναλωτής εκτός detail sheets
 *   6. `buildTitleBlockLayout` + τα 4 `build*TitleBlockRegion` — η πλευρά `buildFieldBlock`
 *
 * ## Πώς διαβάζεται μια αποτυχία
 * Κόκκινο snapshot **δεν** σημαίνει «ενημέρωσε το snapshot». Σημαίνει ότι η γεωμετρία
 * που φτάνει στο χαρτί, στην οθόνη και στη σκηνή **άλλαξε**. Είτε η αλλαγή ήταν σκόπιμη
 * (τότε τεκμηριώνεται στο ADR και ανανεώνεται ρητά) είτε η απορρόφηση χάλασε κάτι — και
 * αυτός ακριβώς είναι ο λόγος ύπαρξης του αρχείου. `jest -u` χωρίς εξήγηση ακυρώνει το
 * δίχτυ και επαναφέρει τον ισχυρισμό στη θέση της απόδειξης.
 *
 * Καθαρό (μηδέν canvas / WebGL): μόνο pure builders.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §12
 * @see ../detail-sheet-schedule-table.ts · ../detail-sheet-field-block.ts
 */

import { buildColumnScheduleRegion } from '../column-detail-schedule';
import { buildColumnTitleBlockRegion } from '../column-detail-titleblock';
import { buildBeamScheduleRegion } from '../beam-detail-schedule';
import { buildBeamTitleBlockRegion } from '../beam-detail-titleblock';
import { buildFootingScheduleRegion } from '../footing-detail-schedule';
import { buildFootingTitleBlockRegion } from '../footing-detail-titleblock';
import { buildSlabScheduleRegion } from '../slab-detail-schedule';
import { buildSlabTitleBlockRegion } from '../slab-detail-titleblock';
import {
  DEFAULT_DETAIL_SHEET_LAYOUT_INPUT,
  computeDetailSheetLayout,
} from '../detail-sheet-layout';
import { computeBeamGeometry } from '../../../geometry/beam-geometry';
import { buildTitleBlockLayout } from '../../../../text-engine/title-block/title-block-layout';
import { buildSurveySheet } from '../../../../systems/topography/deliverables/survey-sheet';
import type {
  BeamScheduleLabels,
  BeamTitleBlockLabels,
  DetailScheduleLabels,
  DetailTitleBlockLabels,
  FootingScheduleLabels,
  FootingTitleBlockLabels,
  RectMm,
  SlabScheduleLabels,
  SlabTitleBlockLabels,
} from '../detail-sheet-types';
import type { BeamEntity, BeamParams } from '../../../types/beam-types';
import type { BeamReinforcement } from '../../reinforcement/beam-reinforcement-types';
import type { ColumnParams } from '../../../types/column-types';
import type { FoundationEntity, PadFootingParams } from '../../../types/foundation-types';
import type { PadReinforcement } from '../../reinforcement/footing-reinforcement-types';
import type { SlabEntity } from '../../../types/slab-types';
import type { SlabFoundationReinforcement } from '../../reinforcement/slab-foundation-reinforcement-types';
import type { ExportableTableSection } from '../../../schedule/types';

// ─── Κοινή περιοχή ───────────────────────────────────────────────────────────

const { regions } = computeDetailSheetLayout();
const { paper } = DEFAULT_DETAIL_SHEET_LAYOUT_INPUT;
const SCHEDULE: RectMm = regions.schedule;
const TITLE: RectMm = regions['title-block'];

// ─── 1. Κολώνα ───────────────────────────────────────────────────────────────

const COLUMN_PARAMS: ColumnParams = {
  kind: 'rectangular',
  position: { x: 0, y: 0, z: 0 },
  anchor: 'center',
  width: 400, depth: 400, height: 3000, rotation: 0,
  baseBinding: 'storey-floor', topBinding: 'storey-ceiling', baseOffset: 0, topOffset: 0,
  reinforcement: {
    longitudinal: { diameterMm: 16, count: 8 },
    stirrups: { diameterMm: 8, spacingMm: 200, spacingCriticalMm: 100, type: 'closed-hooked' },
    coverMm: 25,
  },
};

const COLUMN_SCHEDULE_LABELS: DetailScheduleLabels = {
  mark: 'Item', diameter: 'Ø', count: 'N', length: 'L', weight: 'W',
  longitudinal: 'Long', stirrups: 'Stir', spiral: 'Spiral', total: 'Total',
  ratio: 'ρ', confinement: 'α',
};

const COLUMN_TITLE_LABELS: DetailTitleBlockLabels = {
  section: 'Section', height: 'Height', concrete: 'Concrete', steel: 'Steel',
  cover: 'Cover', longitudinal: 'Long', stirrups: 'Stir',
};

// ─── 2. Δοκός ────────────────────────────────────────────────────────────────

const BEAM_R: BeamReinforcement = {
  bottom: { diameterMm: 16, count: 3 },
  top: { diameterMm: 14, count: 4 },
  stirrups: { diameterMm: 8, spacingMm: 200, spacingCriticalMm: 100, type: 'closed-hooked' },
  coverMm: 30,
};

const BEAM_ENTITY: BeamEntity = (() => {
  const params = {
    kind: 'straight',
    startPoint: { x: 0, y: 0, z: 0 }, endPoint: { x: 5000, y: 0, z: 0 },
    width: 300, depth: 600, topElevation: 3000, sceneUnits: 'mm',
    reinforcement: BEAM_R,
  } as unknown as BeamParams;
  return {
    id: 'beam-1', type: 'beam', kind: 'straight', params, geometry: computeBeamGeometry(params),
  } as unknown as BeamEntity;
})();

const BEAM_SCHEDULE_LABELS: BeamScheduleLabels = {
  item: 'Item', description: 'Reinf', length: 'L', weight: 'W',
  bottomLongitudinal: 'Bottom', topLongitudinal: 'Top', stirrups: 'Stir', total: 'Total', ratio: 'ρ',
};

const BEAM_TITLE_LABELS: BeamTitleBlockLabels = {
  section: 'Section', effectiveFlangeWidth: 'b_eff', span: 'Span', concrete: 'Concrete',
  steel: 'Steel', cover: 'Cover', longitudinal: 'Long', stirrups: 'Stir',
};

// ─── 3. Πέδιλο ───────────────────────────────────────────────────────────────

const PAD_R: PadReinforcement = {
  kind: 'pad',
  bottomMeshX: { diameterMm: 12, spacingMm: 200 },
  bottomMeshY: { diameterMm: 12, spacingMm: 200 },
  coverMm: 50,
};

const PAD_ENTITY: FoundationEntity = {
  id: 'fnd-pad', type: 'foundation', kind: 'pad',
  params: {
    kind: 'pad', topElevationMm: -1000, thicknessMm: 500,
    position: { x: 0, y: 0, z: 0 }, width: 1500, length: 1500, rotation: 0,
    anchor: 'center', profile: 'flat', sceneUnits: 'mm', reinforcement: PAD_R,
  } as PadFootingParams,
} as unknown as FoundationEntity;

const FOOTING_SCHEDULE_LABELS: FootingScheduleLabels = {
  item: 'Item', description: 'Reinf', length: 'L', weight: 'W',
  main: 'Main', secondary: 'Sec', stirrups: 'Stir', total: 'Total', ratio: 'ρ',
};

const FOOTING_TITLE_LABELS: FootingTitleBlockLabels = {
  kind: 'Type', section: 'Section', thickness: 'Depth', concrete: 'Concrete',
  steel: 'Steel', cover: 'Cover', main: 'Main', secondary: 'Secondary',
};

const FOOTING_KIND_VALUES = { 'pad': 'Pad', 'strip': 'Strip', 'tie-beam': 'Tie' } as const;

// ─── 4. Πλάκα ────────────────────────────────────────────────────────────────

const RECT_OUTLINE = (w: number, h: number) => [
  { x: 0, y: 0, z: 0 }, { x: w, y: 0, z: 0 }, { x: w, y: h, z: 0 }, { x: 0, y: h, z: 0 },
];

const SLAB_R: SlabFoundationReinforcement = {
  bottomMeshX: { diameterMm: 12, spacingMm: 200 },
  bottomMeshY: { diameterMm: 12, spacingMm: 200 },
  topMeshX: { diameterMm: 10, spacingMm: 250 },
  topMeshY: { diameterMm: 10, spacingMm: 250 },
  coverMm: 25,
};

const SLAB_ENTITY: SlabEntity = {
  id: 'slab-floor', type: 'slab', kind: 'floor',
  params: {
    kind: 'floor', outline: { vertices: RECT_OUTLINE(4000, 3000) }, thickness: 200,
    levelElevation: 3000, sceneUnits: 'mm', structuralReinforcement: SLAB_R,
  },
  geometry: { polygon: { vertices: RECT_OUTLINE(4000, 3000) }, maxFreeSpanM: 3 },
} as unknown as SlabEntity;

const SLAB_SCHEDULE_LABELS: SlabScheduleLabels = {
  item: 'Item', description: 'Reinf', length: 'L', weight: 'W',
  bottomMesh: 'Bottom', topMesh: 'Top', total: 'Total', ratio: 'ρ',
};

const SLAB_TITLE_LABELS: SlabTitleBlockLabels = {
  kind: 'Type', section: 'Section', thickness: 'Thickness', concrete: 'Concrete',
  steel: 'Steel', cover: 'Cover', bottomMesh: 'Bottom', topMesh: 'Top',
  span: 'Span', designLoad: 'Load',
};

const SLAB_KIND_VALUES = {
  floor: 'Floor', ceiling: 'Ceiling', roof: 'Roof', ground: 'Ground', foundation: 'Foundation',
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// buildScheduleTable — οι 5 καταναλωτές πίνακα
// ══════════════════════════════════════════════════════════════════════════════

describe('ADR-622 χαρακτηρισμός — buildScheduleTable', () => {
  it('κολώνα: 5-στηλος πίνακας (το μόνο δικό του column set)', () => {
    expect(buildColumnScheduleRegion(COLUMN_PARAMS, SCHEDULE, COLUMN_SCHEDULE_LABELS).primitives)
      .toMatchSnapshot();
  });

  it('δοκός: 4-στηλος μέσω buildReinforcementSchedule', () => {
    expect(buildBeamScheduleRegion(BEAM_ENTITY, BEAM_R, SCHEDULE, BEAM_SCHEDULE_LABELS).primitives)
      .toMatchSnapshot();
  });

  it('πέδιλο: 4-στηλος μέσω buildReinforcementSchedule', () => {
    expect(buildFootingScheduleRegion(PAD_ENTITY, SCHEDULE, FOOTING_SCHEDULE_LABELS).primitives)
      .toMatchSnapshot();
  });

  it('πλάκα: 4-στηλος μέσω buildReinforcementSchedule', () => {
    expect(buildSlabScheduleRegion(SLAB_ENTITY, SCHEDULE, SLAB_SCHEDULE_LABELS).primitives)
      .toMatchSnapshot();
  });

  it('τοπογραφικό φύλλο (ADR-650 M7): ισοκατανεμημένες στήλες, χωρίς γραμμή συνόλου', () => {
    const sections: readonly ExportableTableSection[] = [
      {
        title: 'ΣΥΝΤΕΤΑΓΜΕΝΕΣ ΕΓΣΑ87',
        table: {
          columns: [
            { key: 'name', i18nKey: 'point', valueType: 'text', align: 'left' },
            { key: 'e', i18nKey: 'east', valueType: 'number', align: 'right' },
            { key: 'n', i18nKey: 'north', valueType: 'number', align: 'right' },
          ],
          rows: [
            { cells: { name: 'Κ1', e: 312450.125, n: 4201330.5 } },
            { cells: { name: 'Κ2', e: 312470.875, n: 4201355.25 } },
          ],
        },
      },
    ];
    expect(buildSurveySheet(sections, (key) => `[${key}]`)).toMatchSnapshot();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// buildFieldBlock — οι 5 καταναλωτές πεδίων
// ══════════════════════════════════════════════════════════════════════════════

describe('ADR-622 χαρακτηρισμός — buildFieldBlock', () => {
  it('πινακίδα κολώνας', () => {
    expect(buildColumnTitleBlockRegion(COLUMN_PARAMS, TITLE, COLUMN_TITLE_LABELS).primitives)
      .toMatchSnapshot();
  });

  it('πινακίδα δοκού', () => {
    expect(buildBeamTitleBlockRegion(BEAM_ENTITY, BEAM_R, TITLE, BEAM_TITLE_LABELS).primitives)
      .toMatchSnapshot();
  });

  it('πινακίδα πεδίλου', () => {
    expect(buildFootingTitleBlockRegion(PAD_ENTITY, TITLE, FOOTING_TITLE_LABELS, FOOTING_KIND_VALUES).primitives)
      .toMatchSnapshot();
  });

  it('πινακίδα πλάκας', () => {
    expect(buildSlabTitleBlockRegion(SLAB_ENTITY, TITLE, SLAB_TITLE_LABELS, SLAB_KIND_VALUES).primitives)
      .toMatchSnapshot();
  });

  it('αυτόματη πινακίδα σχεδίου (ADR-651): κορνίζα + επικεφαλίδα + πεδία', () => {
    const layout = buildTitleBlockLayout(
      {
        heading: 'ΣΤΟΙΧΕΙΑ ΣΧΕΔΙΟΥ',
        rows: [
          { label: 'Έργο', value: 'Πολυκατοικία' },
          { label: 'Κλίμακα', value: '1:50' },
          { label: 'Ημερομηνία', value: '2026-07-31' },
        ],
      },
      { paper, withFrame: true, withStampBox: true, stampLabel: 'ΣΦΡΑΓΙΔΑ', origin: 'sheet' },
    );
    expect(layout).toMatchSnapshot();
  });
});
