/**
 * IFC4 Property Set Emission Helpers — ADR-396 P10
 *
 * Reusable builders για `IfcPropertySet` + `IfcRelDefinesByProperties`.
 * Σήμερα χρησιμοποιείται από `ifc-wall-serializer` (Pset_WallCommon).
 * Μελλοντικά: slab/column/beam (DRY, SSOT για Pset emission).
 *
 * IFC4 schema references:
 *   - `IfcPropertySingleValue` (§IfcMeasureResource) — ένα property με ένα value
 *   - `IfcPropertySet` (§IfcKernel) — named bag of properties
 *   - `IfcRelDefinesByProperties` — link τύπου object→pset
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §7 (P10)
 */

import { generateIfcGuid } from '@/services/enterprise-id-convenience';
import {
  IfcGraph,
  lbl,
  ref,
  type IfcValue,
} from '../ifc-entity-graph';

// ─── Property emission ───────────────────────────────────────────────────────

/**
 * Προσθέτει `IfcPropertySingleValue` και επιστρέφει το expressID του.
 * `nominalValue` = typed value (π.χ. `typed('IfcThermalTransmittanceMeasure', real(u))`),
 * ή `bool(true)`, κ.λπ.
 */
export function appendPropertySingleValue(
  graph: IfcGraph,
  name: string,
  nominalValue: IfcValue,
): number {
  return graph.add('IFCPROPERTYSINGLEVALUE', [lbl(name), null, nominalValue, null]);
}

// ─── PropertySet emission ────────────────────────────────────────────────────

/**
 * Προσθέτει `IfcPropertySet` (named, με GUID) και επιστρέφει το expressID.
 * `propIDs` = expressIDs από `appendPropertySingleValue` calls.
 */
export function appendPropertySet(
  graph: IfcGraph,
  name: string,
  propIDs: readonly number[],
): number {
  return graph.add('IFCPROPERTYSET', [
    lbl(generateIfcGuid()),
    null,
    lbl(name),
    null,
    propIDs.map((id) => ref(id)),
  ]);
}

// ─── RelDefinesByProperties ──────────────────────────────────────────────────

/**
 * Προσθέτει `IfcRelDefinesByProperties` που συνδέει το pset σε ένα ή
 * περισσότερα BIM objects (one-pset-per-element pattern).
 */
export function appendRelDefinesByProperties(
  graph: IfcGraph,
  objectIDs: readonly number[],
  psetID: number,
): void {
  graph.add('IFCRELDEFINESBYPROPERTIES', [
    lbl(generateIfcGuid()),
    null,
    null,
    null,
    objectIDs.map((id) => ref(id)),
    ref(psetID),
  ]);
}
