/**
 * IFC4 Entity Serializer — Shared Context (ADR-369 §Q8.4)
 *
 * Π Πέρασμα state ανάμεσα στους 5 element serializers. Κάθε serializer:
 *   1. Γράφει IFC entity records στο `IfcGraph`.
 *   2. Καταχωρεί το assigned expressID στο matching id-map (per-entity-type).
 *   3. Σπρώχνει το expressID στο `elementsByStorey` ώστε ο wrapper να γράψει
 *      ένα `IfcRelContainedInSpatialStructure` ανά storey στο τέλος.
 *
 * Openings ΔΕΝ συμμετέχουν στο `IfcRelContainedInSpatialStructure` —
 * συνδέονται στο host wall μέσω `IfcRelVoidsElement` (IFC4 §8.7.3.1).
 * Doors/Windows που τα γεμίζουν συμμετέχουν κανονικά.
 */

export interface SerializerContext {
  /** Nestor wall.id → IfcWall expressID. */
  readonly wallIDs: Map<string, number>;
  /** Nestor column.id → IfcColumn expressID. */
  readonly columnIDs: Map<string, number>;
  /** Nestor beam.id → IfcBeam expressID. */
  readonly beamIDs: Map<string, number>;
  /** Nestor slab.id → IfcSlab expressID. */
  readonly slabIDs: Map<string, number>;
  /** Nestor opening.id → IfcOpeningElement expressID. */
  readonly openingIDs: Map<string, number>;
  /**
   * IfcBuildingStorey expressID → list of element expressIDs to be
   * referenced from `IfcRelContainedInSpatialStructure.RelatedElements`.
   */
  readonly elementsByStorey: Map<number, number[]>;
}

export function createSerializerContext(): SerializerContext {
  return {
    wallIDs: new Map(),
    columnIDs: new Map(),
    beamIDs: new Map(),
    slabIDs: new Map(),
    openingIDs: new Map(),
    elementsByStorey: new Map(),
  };
}

export function pushElementForStorey(
  ctx: SerializerContext,
  storeyID: number,
  elementID: number,
): void {
  const list = ctx.elementsByStorey.get(storeyID);
  if (list) {
    list.push(elementID);
    return;
  }
  ctx.elementsByStorey.set(storeyID, [elementID]);
}
