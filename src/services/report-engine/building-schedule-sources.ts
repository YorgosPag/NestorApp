/**
 * Building Schedule Sources — snapshots → the inputs of the EVM (ADR-265 §8.5)
 *
 * The ONE translation of a building's phases / tasks / milestones / BOQ query results
 * into domain objects, shared by every server reader that feeds `computeEVM`
 * (portfolio, schedule alerts). It was a copy-pasted block in both routes.
 *
 * BOQ goes through `normalizeBOQItem` — WITH its id: the EVM decides «does this line
 * count?» on parent ↔ child links (ADR-917 Λ7), which a bare `d.data()` cannot carry.
 *
 * @module services/report-engine/building-schedule-sources
 * @see ADR-265 · ADR-917 §2.4 Λ7
 */

import type { ConstructionPhase, ConstructionTask } from '@/types/building/construction';
import type { BuildingMilestone } from '@/types/building/milestone';
import type { BOQItem } from '@/types/boq';
import { normalizeBOQItem } from '@/services/measurements/boq-document-normalize';

/** The part of a query snapshot this module reads — SDK-independent */
interface SnapshotLike {
  readonly docs: ReadonlyArray<{ readonly id: string; data(): Record<string, unknown> }>;
}

interface BuildingScheduleSnapshots {
  readonly phasesSnap: SnapshotLike;
  readonly tasksSnap: SnapshotLike;
  readonly milestonesSnap: SnapshotLike;
  readonly boqSnap: SnapshotLike;
}

interface BuildingScheduleSources {
  phases: ConstructionPhase[];
  tasks: ConstructionTask[];
  milestones: BuildingMilestone[];
  boqItems: BOQItem[];
}

export function readBuildingScheduleSources(snaps: BuildingScheduleSnapshots): BuildingScheduleSources {
  return {
    phases: snaps.phasesSnap.docs.map(d => d.data() as unknown as ConstructionPhase),
    tasks: snaps.tasksSnap.docs.map(d => d.data() as unknown as ConstructionTask),
    milestones: snaps.milestonesSnap.docs.map(d => d.data() as unknown as BuildingMilestone),
    boqItems: snaps.boqSnap.docs.map(d => normalizeBOQItem(d.id, d.data())),
  };
}
