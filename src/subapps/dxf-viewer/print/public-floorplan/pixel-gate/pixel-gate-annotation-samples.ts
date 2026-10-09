/**
 * @fileoverview Τα δείγματα **σχολιασμού και σκέτου σχεδίου** της πύλης pixels (CHECK 3.101).
 * @related ADR-909 §6.7 · ./pixel-gate-samples · ./pixel-gate-sample-kit
 * @module subapps/dxf-viewer/print/public-floorplan/pixel-gate/pixel-gate-annotation-samples
 *
 * 🔑 Όπου υπάρχει εργοστάσιο της παραγωγής, το δείγμα το **καλεί** (πίνακας, διάσταση μέσω του reducer του εργαλείου,
 * βοηθητική γραμμή, ημιευθεία, εικόνα από τον κατάλογο). Όπου ο τύπος γεννιέται μόνο μέσα σε hook ή σε εισαγωγή DXF
 * (κείμενο, καμπύλη, γωνία, οδηγός, σύμβολο, τοπογραφική επιφάνεια), το δείγμα είναι αντικείμενο της διεπαφής — με
 * ό,τι SSoT υπάρχει για τα μέρη του (`parseText`, κατάλογος συμβόλων, `TOPO_SURFACE_COLOR`).
 *
 * ⚠️ `topo-surface`: το εργοστάσιο διαβάζει το **καθολικό** store της αποτύπωσης. Το δείγμα δεν γράφει εκεί· δίνει
 * το `footprint` απευθείας, που είναι το **μόνο** που διαβάζει ο ζωγράφος του.
 */

import type { RenderableEntityType } from '../../../rendering/contract/renderable-entity-type';
import type { Entity } from '../../../types/entities';
import { DEFAULT_ANNOTATION_SYMBOL_SIZE_MM } from '../../../types/annotation-symbol';
import { getAnnotationSymbol } from '../../../config/annotation-symbol-catalog';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { parseText } from '../../../text-engine/parser/mtext-parser';
import { BUILTIN_DIM_STYLE_IDS } from '../../../systems/dimensions/dim-style-templates';
import {
  dimensionCreateReducer,
  initialDimensionCreateState,
} from '../../../hooks/dimensions/dimension-create-state';
import { buildCommittedDimensionEntity } from '../../../hooks/dimensions/dimension-create-entity-builder';
import { buildXLineEntity } from '../../../hooks/drawing/drawing-entity-xline';
import { createEntityFromTool } from '../../../hooks/drawing/drawing-entity-builders';
import { buildTableEntity } from '../../../bim/table/build-table-entity';
import { createEntouragePlacer } from '../../../bim/entourage/place-entourage';
import { TOPO_SURFACE_COLOR } from '../../../systems/topography/topo-surface-entity';
import type { CellGeometry, SampleFactory } from './pixel-gate-sample-kit';
import { LAYER_ID, present, primitive } from './pixel-gate-sample-kit';

/** Ύψος γράμματος σε mm σχεδίου — αρκετό για να δώσει γραμμές που κρίνονται, μέσα σε κελί 5 m. */
const TEXT_HEIGHT_MM = 400;
const SAMPLE_TEXT = 'Aa 12';
const NORTH_ARROW_ID = 'northArrowSimple';
/** Δημόσιο στατικό αρχείο του έργου (same-origin, χωρίς σύνδεση) — **έγχρωμο**, ώστε το Κ1 να έχει τι να κρίνει. */
const SAMPLE_IMAGE_URL = '/textures/tile/albedo.jpg';
const SAMPLE_IMAGE_SIDE_MM = 3000;

type AnnotationSampleType =
  | 'text'
  | 'mtext'
  | 'spline'
  | 'dimension'
  | 'angle-measurement'
  | 'xline'
  | 'ray'
  | 'leader'
  | 'annotation-symbol'
  | 'table'
  | 'image'
  | 'topo-surface';

/** Γραμμική διάσταση όπως τη γεννά το εργαλείο: έναρξη + τρία κλικ στον **ίδιο** reducer, μετά ο builder του. */
function dimensionOf(c: CellGeometry): Entity[] {
  const placement = { x: c.centre.x, y: c.ring[2].y };
  let state = dimensionCreateReducer(initialDimensionCreateState, {
    kind: 'start',
    mode: 'manual',
    styleId: BUILTIN_DIM_STYLE_IDS.NESTOR_DEFAULT,
    manualOverride: 'linear',
  });
  for (const world of [c.from, c.to, placement]) state = dimensionCreateReducer(state, { kind: 'click', world });
  const result = buildCommittedDimensionEntity(state, { id: generateEntityId(), layerId: LAYER_ID });
  return [present('dimension', result).entity];
}

/**
 * Εικόνα όπως την εισάγει ο άνθρωπος (`IMAGEATTACH`): το **ίδιο** εργοστάσιο τοποθέτησης με την παραγωγή, και το
 * μέγεθος το δίνει η επιλογή — μια φωτογραφία δεν έχει μέγεθος καταλόγου. Τα sprites του καταλόγου δεν γίνονται
 * δείγμα: σερβίρονται από proxy με σύνδεση, και η γυμνή σελίδα της πύλης δεν έχει άνθρωπο συνδεδεμένο.
 */
const sampleImagePlacer = createEntouragePlacer({
  getSizeMm: () => ({ widthMm: SAMPLE_IMAGE_SIDE_MM, heightMm: SAMPLE_IMAGE_SIDE_MM }),
  layerId: LAYER_ID,
});

function imageOf(c: CellGeometry): Entity[] {
  const params = { position: c.centre, itemId: SAMPLE_IMAGE_URL, url: SAMPLE_IMAGE_URL };
  return [present('image', sampleImagePlacer.buildEntity(params))];
}

function rayOf(c: CellGeometry): Entity[] {
  const ray = present('ray', createEntityFromTool('ray', [c.from, c.to], generateEntityId(), false));
  return [{ ...ray, layerId: LAYER_ID }];
}

export const PIXEL_GATE_ANNOTATION_SAMPLES: Readonly<
  Record<Extract<RenderableEntityType, AnnotationSampleType>, SampleFactory>
> = {
  text: (c) => [
    {
      ...primitive('text'),
      position: c.from,
      text: SAMPLE_TEXT,
      height: TEXT_HEIGHT_MM,
      textNode: parseText(SAMPLE_TEXT, { height: TEXT_HEIGHT_MM }),
    },
  ],
  mtext: (c) => [
    {
      ...primitive('mtext'),
      position: c.from,
      text: SAMPLE_TEXT,
      width: c.to.x - c.from.x,
      textNode: parseText(SAMPLE_TEXT, { height: TEXT_HEIGHT_MM }),
    },
  ],
  spline: (c) => [{ ...primitive('spline'), controlPoints: [c.from, c.ring[3], c.ring[1], c.to], degree: 3 }],
  dimension: dimensionOf,
  'angle-measurement': (c) => [
    { ...primitive('angle-measurement'), vertex: c.ring[0], point1: c.ring[1], point2: c.ring[3], angle: 90 },
  ],
  xline: (c) => [present('xline', buildXLineEntity([c.from, c.to], generateEntityId(), LAYER_ID))],
  ray: rayOf,
  leader: (c) => [
    {
      ...primitive('leader'),
      vertices: [c.ring[0], c.centre, c.to],
      arrowHead: { type: 'closed', size: TEXT_HEIGHT_MM },
      annotationText: SAMPLE_TEXT,
    },
  ],
  'annotation-symbol': (c) => [
    {
      ...primitive('annotation-symbol'),
      position: c.centre,
      kind: getAnnotationSymbol(NORTH_ARROW_ID).kind,
      symbolId: NORTH_ARROW_ID,
      sizeMm: DEFAULT_ANNOTATION_SYMBOL_SIZE_MM,
      rotation: 0,
    },
  ],
  table: (c) => [buildTableEntity(c.ring[3], {}, generateEntityId(), LAYER_ID)],
  image: imageOf,
  'topo-surface': (c) => [
    { ...primitive('topo-surface'), color: TOPO_SURFACE_COLOR, surfaceId: 'existing', footprint: [c.ring] },
  ],
};
