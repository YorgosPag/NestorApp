/**
 * Foundation ↔ Column Attach Coordinator — ADR-459 Phase 2 (explicit FK).
 *
 * Mirror του `column-structural-attach-coordinator` για τη σχέση **πέδιλο↔κολόνα**.
 * Pure detection (μηδέν mutation): βρίσκει ποιες κολόνες εδράζονται σε ποιο
 * footing element, ώστε ο καλών (`useStructuralAutoAttach`) να εκτελέσει
 * `AttachColumnFootingCommand` και να εδραιώσει το **persisted** αναλυτικό FK
 * `ColumnParams.footingId` (Revit Structural Connectivity).
 *
 * Κριτήριο έδρασης = το ΕΝΑ SSoT `footingSupportsColumnBase` (μοιράζεται με τον
 * `structural-graph.ts` — μηδέν duplicate, N.0.2). Footing recognition + geometry
 * summary = το ΕΝΑ SSoT `resolveFootingSummary`.
 *
 * Idempotent: αγγίζει ΜΟΝΟ κολόνες χωρίς `footingId` (δεν «κλέβει» ήδη-εδρασμένες).
 *
 * @see footing-column-coverage.ts — το bearing κριτήριο SSoT
 * @see footing-element-summary.ts — footing recognition + summary SSoT
 * @see core/commands/entity-commands/AttachColumnFootingCommand.ts — ο executor
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 2
 */

import type { Entity } from '../../types/entities';
import { isColumnEntity } from '../../types/entities';
import { resolveColumnBaseZmm } from '../geometry/column-vertical-profile';
import { footingSupportsColumnBase, polygonCentroid, type CoveragePoint } from './footing-column-coverage';
import { isFootingElement, resolveFootingSummary } from './footing-element-summary';
import type { ColumnEntity } from '../types/column-types';

/**
 * Active level scene σύμβαση: όλα τα elevations είναι level-relative με datum 0
 * (ίδιο με `column-structural-attach-coordinator`). Άρα `floorElevationMm: 0`.
 */
const ACTIVE_LEVEL_FLOOR_MM = 0;

/** Plan-centroid βάσης + absolute mm baseZmm μιας κολόνας, ή null αν εκφυλισμένη. */
function columnBaseInput(c: ColumnEntity): { baseCentroid: CoveragePoint; baseZmm: number } | null {
  const verts = c.geometry?.footprint?.vertices;
  if (!verts || verts.length < 3) return null;
  return {
    baseCentroid: polygonCentroid(verts),
    baseZmm: resolveColumnBaseZmm(c.params, { floorElevationMm: ACTIVE_LEVEL_FLOOR_MM }),
  };
}

/**
 * Νέα κολόνα → βρες το footing element που στηρίζει τη βάση της (το πρώτο που
 * ικανοποιεί το κριτήριο). `null` αν η κολόνα έχει ήδη `footingId` (idempotent)
 * ή δεν εδράζεται πουθενά. Ο καλών εδραιώνει το FK.
 */
export function findFootingForColumn(column: Entity, entities: readonly Entity[]): string | null {
  if (!isColumnEntity(column) || column.params.footingId !== undefined) return null;
  const base = columnBaseInput(column);
  if (!base) return null;
  for (const e of entities) {
    if (!isFootingElement(e)) continue;
    const footing = resolveFootingSummary(e);
    if (footing && footingSupportsColumnBase(footing, base)) return e.id;
  }
  return null;
}

/**
 * Νέο footing element → βρες τις κολόνες (χωρίς `footingId`) που εδράζονται πάνω
 * του. Pure detection — ο καλών εκτελεί ΕΝΑ batch `AttachColumnFootingCommand`.
 */
export function findColumnsOnFooting(footing: Entity, entities: readonly Entity[]): string[] {
  const summary = resolveFootingSummary(footing);
  if (!summary) return [];
  const out: string[] = [];
  for (const e of entities) {
    if (!isColumnEntity(e) || e.params.footingId !== undefined) continue;
    const base = columnBaseInput(e);
    if (base && footingSupportsColumnBase(summary, base)) out.push(e.id);
  }
  return out;
}
