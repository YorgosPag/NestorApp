/**
 * IFC4 Combined Entity Serializer (ADR-369 §Q8.4 — TASK F)
 *
 * Public-facing `IfcEntitySerializer` που συντονίζει όλους τους 5 element
 * serializers (walls / columns / beams / slabs / openings). Σειρά:
 *   1. Walls — πρώτα, ώστε openings να μπορούν να κάνουν lookup στο ctx.wallIDs.
 *   2. Columns / Beams / Slabs — independent, σειρά δεν έχει σημασία.
 *   3. Openings — τελευταία, χρησιμοποιεί `ctx.wallIDs` για IfcRelVoidsElement.
 *
 * Στο τέλος γράφει 1 `IfcRelContainedInSpatialStructure` ανά storey, με όλα τα
 * elements του storey σαν `RelatedElements` list. Σύμφωνα με IFC4 §8.7.3.4
 * κάθε element ΟΦΕΙΛΕΙ να ανήκει σε ακριβώς ένα `IfcRelContainedInSpatialStructure`.
 */

import { generateIfcGuid } from '@/services/enterprise-id-convenience';

import {
  IfcGraph,
  lbl,
  ref,
} from '../ifc-entity-graph';
import type {
  IfcEntitySerializer,
  IfcExportParams,
} from '../ifc-exporter.service';
import type { SpatialHierarchyOutput } from '../ifc-spatial-hierarchy';

import {
  createSerializerContext,
  type SerializerContext,
} from './serializer-context';
import { serializeWalls } from './ifc-wall-serializer';
import { serializeColumns } from './ifc-column-serializer';
import { serializeBeams } from './ifc-beam-serializer';
import { serializeSlabs } from './ifc-slab-serializer';
import { serializeOpenings } from './ifc-opening-serializer';

export { serializeWalls } from './ifc-wall-serializer';
export { serializeColumns } from './ifc-column-serializer';
export { serializeBeams } from './ifc-beam-serializer';
export { serializeSlabs } from './ifc-slab-serializer';
export { serializeOpenings } from './ifc-opening-serializer';
export type { SerializerContext } from './serializer-context';

export class CombinedEntitySerializer implements IfcEntitySerializer {
  serializeEntities(
    graph: IfcGraph,
    spatial: SpatialHierarchyOutput,
    params: IfcExportParams,
  ): void {
    const ctx = createSerializerContext();

    serializeWalls(graph, spatial, params, ctx);
    serializeColumns(graph, spatial, params, ctx);
    serializeBeams(graph, spatial, params, ctx);
    serializeSlabs(graph, spatial, params, ctx);
    serializeOpenings(graph, spatial, params, ctx);

    writeStoreyContainments(graph, ctx);
  }
}

// ─── Per-storey containment ─────────────────────────────────────────────────

function writeStoreyContainments(graph: IfcGraph, ctx: SerializerContext): void {
  for (const [storeyID, elementIDs] of ctx.elementsByStorey) {
    if (elementIDs.length === 0) continue;
    graph.add('IFCRELCONTAINEDINSPATIALSTRUCTURE', [
      lbl(generateIfcGuid()),
      null,
      null,
      null,
      elementIDs.map((id) => ref(id)),
      ref(storeyID),
    ]);
  }
}
