/**
 * Footing tributary load takedown — entity-aware orchestration (ADR-464, Slice 4).
 *
 * Γεφυρώνει τον pure `load-takedown` SSoT με τη σκηνή: από τα entities ενός ορόφου
 * παράγει το προτεινόμενο service φορτίο **ανά πέδιλο (pad)** μέσω της στηρίζουσας
 * κολώνας (organism FK `ColumnParams.footingId`, ίδια χαρτογράφηση με
 * `resolveSupportingColumnDims`) + grid half-spacing tributary area. Καθαρό —
 * επιστρέφει patches· η εφαρμογή/undo γίνεται στο `ComputeTakedownLoadsCommand`.
 *
 * ΚΑΝΟΝΑΣ (manual vs auto): γράφει ΜΟΝΟ όπου `isTakedownWritable` — ΠΟΤΕ δεν
 * αντικαθιστά χειροκίνητο φορτίο (mirror auto-reinforce). Self-weight κατακόρυφου
 * μέλους = ίδιο βάρος στηρίζουσας κολώνας × όροφοι (στοιβαγμένες κολόνες).
 *
 * geometry-is-SSoT· zero React/DOM/Firestore.
 *
 * @see ../loads/load-takedown.ts — pure tributary/area-load math
 * @see ./footing-design-input.ts — resolveSupportingColumnDims (ίδιο FK pattern)
 * @see docs/centralized-systems/reference/adrs/ADR-464-advanced-footing-reinforcement.md
 */

import type { Entity } from '../../../types/entities';
import { isColumnEntity, isFoundationEntity } from '../../../types/entities';
import type { ColumnEntity } from '../../types/column-types';
import type { AppliedMemberLoad } from '../loads/structural-loads-types';
import { isTakedownWritable } from '../loads/structural-loads-types';
import {
  computeGridTributaryAreas,
  computeMemberTakedown,
  toAppliedTakedownLoad,
  type TributaryColumn,
} from '../loads/load-takedown';
import { buildColumnSectionContext } from '../section-context';
import { concreteWeightKg } from '../concrete-grades';
import { mmToSceneUnits } from '../../../utils/scene-units';

/** Επιτάχυνση βαρύτητας (m/s²) — μάζα σκυροδέματος → φορτίο. */
const GRAVITY_MS2 = 9.81;
const MM2_MM_TO_M3 = 1 / 1e9;

/** Building-level παράμετροι takedown (storey count + area loads). */
export interface TakedownSettings {
  readonly storeyCount: number;
  readonly deadAreaLoadKpa: number;
  readonly liveAreaLoadKpa: number;
}

/** Προτεινόμενο φορτίο πεδίλου (source='takedown') έτοιμο για persist. */
export interface FootingTakedownLoad {
  readonly footingId: string;
  readonly appliedLoad: AppliedMemberLoad;
}

/** Κέντρο διατομής κολώνας (m) από το bbox του footprint (canvas units → m). */
function columnCenterM(c: ColumnEntity): TributaryColumn | null {
  const verts = c.geometry?.footprint?.vertices;
  if (!verts || verts.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of verts) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }
  const perScene = mmToSceneUnits(c.params.sceneUnits ?? 'mm');
  const toM = (canvas: number): number => canvas / perScene / 1000;
  return { id: c.id, xM: toM((minX + maxX) / 2), yM: toM((minY + maxY) / 2) };
}

/** Ίδιο βάρος μίας κολώνας ανά όροφο (kN) από τη διατομή × ύψος της. */
function columnSelfWeightPerStoreyKn(c: ColumnEntity): number {
  const s = buildColumnSectionContext(c);
  const volumeM3 = Math.max(0, s.grossAreaMm2) * Math.max(0, s.heightMm) * MM2_MM_TO_M3;
  return (concreteWeightKg(volumeM3) * GRAVITY_MS2) / 1000;
}

/**
 * Υπολόγισε τα προτεινόμενα φορτία takedown για όλα τα εγγράψιμα πέδιλα (pad) της
 * σκηνής. ΕΝΑ tributary pass για όλες τις κολώνες· κάθε πέδιλο φορτίζεται από τη
 * στηρίζουσα κολώνα του (FK). Επιστρέφει κενό όταν λείπουν area loads/όροφοι.
 */
export function computeFootingTakedownLoads(
  entities: readonly Entity[],
  settings: TakedownSettings,
): FootingTakedownLoad[] {
  const { storeyCount, deadAreaLoadKpa, liveAreaLoadKpa } = settings;
  if (storeyCount <= 0 || (deadAreaLoadKpa <= 0 && liveAreaLoadKpa <= 0)) return [];

  const columns = entities.filter(isColumnEntity);
  const tributaryColumns = columns.map(columnCenterM).filter((c): c is TributaryColumn => c !== null);
  const tributaryById = computeGridTributaryAreas(tributaryColumns);

  const out: FootingTakedownLoad[] = [];
  for (const footing of entities) {
    if (!isFoundationEntity(footing) || footing.params.kind !== 'pad') continue;
    if (!isTakedownWritable(footing.params.appliedLoad)) continue;
    const column = columns.find((c) => c.params.footingId === footing.id);
    if (!column) continue; // χωρίς στηρίζουσα κολώνα → καμία πηγή φορτίου (skip)
    const tributaryAreaM2 = tributaryById.get(column.id) ?? 0;
    const load = computeMemberTakedown({
      tributaryAreaM2,
      storeyCount,
      deadAreaLoadKpa,
      liveAreaLoadKpa,
      extraDeadAxialKn: columnSelfWeightPerStoreyKn(column) * Math.floor(storeyCount),
    });
    out.push({ footingId: footing.id, appliedLoad: toAppliedTakedownLoad(load) });
  }
  return out;
}
