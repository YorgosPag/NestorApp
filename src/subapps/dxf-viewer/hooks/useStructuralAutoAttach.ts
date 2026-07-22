/**
 * useStructuralAutoAttach — ADR-401 Phase D (auto-attach UX).
 *
 * Thin, decoupled bridge: listens for `drawing:entity-created` and, when the
 * created entity is a structural host (beam / slab) placed OVER `storey-ceiling`
 * walls, dispatches ONE undoable `AttachWallsTopCommand` so those walls attach
 * their top to the host from below (Revit auto-attach). Detection + Z-gate live
 * in the `wall-structural-attach-coordinator` SSoT; this hook only wires the
 * event → command history.
 *
 * Mounted once by the viewer shell (alongside `useDxfViewerNotifications`),
 * after `levelManager` is available so the command-history provider is in scope.
 *
 * @see bim/walls/wall-structural-attach-coordinator.ts — findWallsToAutoAttachToHost
 * @see core/commands/entity-commands/AttachWallsTopCommand.ts — the batch command
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §6 Phase D
 */

import { useEffect } from 'react';
import { EventBus } from '../systems/events/EventBus';
import { useCommandHistory } from '../core/commands/useCommandHistory';
import { createLevelSceneManagerAdapter } from '../systems/entity-creation/LevelSceneManagerAdapter';
import {
  findWallsToAutoAttachToHost,
  findWallsToAutoAttachBaseToHost,
  findHostsToAttachWallTop,
  findHostsToAttachWallBase,
} from '../bim/walls/wall-structural-attach-coordinator';
import {
  findColumnsToAutoAttachToHost,
  findColumnsToAutoAttachBaseToHost,
  findColumnsFramedByBeam,
} from '../bim/columns/column-structural-attach-coordinator';
// ADR-459 Phase 2 — αναλυτικό FK πεδίλου↔κολόνας (Structural Connectivity).
import {
  findColumnsOnFooting,
  findFootingForColumn,
} from '../bim/foundations/foundation-column-attach-coordinator';
import { isFootingElement } from '../bim/foundations/footing-element-summary';
import { AttachColumnFootingCommand } from '../core/commands/entity-commands/AttachColumnFootingCommand';
import {
  findStairsToAutoAttachToHost,
  findStairsToAutoAttachBaseToHost,
  findHostsToSeatStairBase,
} from '../bim/stairs/stair-structural-attach-coordinator';
import {
  AttachWallsTopCommand,
  type WallAttachTarget,
} from '../core/commands/entity-commands/AttachWallsTopCommand';
import { AttachWallsBaseCommand } from '../core/commands/entity-commands/AttachWallsBaseCommand';
import {
  AttachColumnsCommand,
  type ColumnAttachTarget,
} from '../core/commands/entity-commands/AttachColumnsCommand';
import {
  AttachStairsCommand,
  type StairAttachTarget,
} from '../core/commands/entity-commands/AttachStairsCommand';
import { isWallEntity, isColumnEntity, isStairEntity, isSlabEntity } from '../types/entities';
import type { Entity } from '../types/entities';
import type { ICommand, ISceneManager } from '../core/commands/interfaces';
import type { WallEntity } from '../bim/types/wall-types';
import type { ColumnEntity } from '../bim/types/column-types';
import type { StairEntity } from '../bim/types/stair-types';
import type { LevelSceneWriter } from '../systems/levels/level-scene-accessor';


/** Map wall ids → attach targets ({wallId, kind}) από το live scene. */
function buildAttachTargets(
  wallIds: readonly string[],
  entities: readonly Entity[],
): WallAttachTarget[] {
  const targets: WallAttachTarget[] = [];
  for (const id of wallIds) {
    const w = entities.find((e) => e.id === id);
    if (w && isWallEntity(w)) targets.push({ wallId: id, kind: (w as WallEntity).kind });
  }
  return targets;
}

/** Map column ids → attach targets ({columnId, kind}) από το live scene. */
function buildColumnAttachTargets(
  columnIds: readonly string[],
  entities: readonly Entity[],
): ColumnAttachTarget[] {
  const targets: ColumnAttachTarget[] = [];
  for (const id of columnIds) {
    const c = entities.find((e) => e.id === id);
    if (c && isColumnEntity(c)) targets.push({ columnId: id, kind: (c as ColumnEntity).kind });
  }
  return targets;
}

/** Map stair ids → attach targets ({stairId, kind}) από το live scene. */
function buildStairAttachTargets(
  stairIds: readonly string[],
  entities: readonly Entity[],
): StairAttachTarget[] {
  const targets: StairAttachTarget[] = [];
  for (const id of stairIds) {
    const s = entities.find((e) => e.id === id);
    if (s && isStairEntity(s)) targets.push({ stairId: id, kind: (s as StairEntity).kind });
  }
  return targets;
}

type ExecuteFn = (command: ICommand) => void;

/**
 * ADR-401 Phase D/F.3/G.3 — όταν δημιουργείται structural **host** (δοκάρι/πλάκα/
 * στέγη), κάνε auto-attach όσους τοίχους/κολώνες/σκάλες κάθονται από κάτω (top)
 * ή πάνω (base) του. No-op όταν το νέο entity δεν είναι host (π.χ. τοίχος).
 */
function attachEntitiesUnderHost(
  host: Entity, entities: readonly Entity[], sm: ISceneManager, execute: ExecuteFn,
): void {
  const hostId = host.id;
  const topTargets = buildAttachTargets(findWallsToAutoAttachToHost(host, entities), entities);
  const baseTargets = buildAttachTargets(findWallsToAutoAttachBaseToHost(host, entities), entities);
  // ADR-441/401 — covering (slab → per-corner soffit) + framing (beam frames-into →
  // flat beam-top) κολώνες ενώνονται (dedup) στο ίδιο top-attach command.
  const colTopIds = [...new Set([
    ...findColumnsToAutoAttachToHost(host, entities),
    ...findColumnsFramedByBeam(host, entities),
  ])];
  const colTop = buildColumnAttachTargets(colTopIds, entities);
  const colBase = buildColumnAttachTargets(findColumnsToAutoAttachBaseToHost(host, entities), entities);
  const stairTop = buildStairAttachTargets(findStairsToAutoAttachToHost(host, entities), entities);
  const stairBase = buildStairAttachTargets(findStairsToAutoAttachBaseToHost(host, entities), entities);
  if (topTargets.length > 0) {
    execute(new AttachWallsTopCommand(hostId, topTargets, sm));
    EventBus.emit('bim:walls-auto-attached', { wallIds: topTargets.map((t) => t.wallId), hostId });
  }
  if (baseTargets.length > 0) {
    execute(new AttachWallsBaseCommand(hostId, baseTargets, sm));
    EventBus.emit('bim:walls-auto-attached-base', { wallIds: baseTargets.map((t) => t.wallId), hostId });
  }
  if (colTop.length > 0) {
    execute(new AttachColumnsCommand('top', hostId, colTop, sm));
    EventBus.emit('bim:columns-auto-attached', { columnIds: colTop.map((t) => t.columnId), hostId });
  }
  if (colBase.length > 0) {
    execute(new AttachColumnsCommand('base', hostId, colBase, sm));
    EventBus.emit('bim:columns-auto-attached-base', { columnIds: colBase.map((t) => t.columnId), hostId });
  }
  if (stairTop.length > 0) {
    execute(new AttachStairsCommand('top', hostId, stairTop, sm));
    EventBus.emit('bim:stairs-auto-attached', { stairIds: stairTop.map((t) => t.stairId), hostId });
  }
  if (stairBase.length > 0) {
    execute(new AttachStairsCommand('base', hostId, stairBase, sm));
    EventBus.emit('bim:stairs-auto-attached-base', { stairIds: stairBase.map((t) => t.stairId), hostId });
  }
}

/**
 * ADR-401 Phase D (αντίστροφη φορά) — όταν δημιουργείται **ΤΟΙΧΟΣ** (manual draw ή
 * «Τοίχοι από κάναβο»), κάνε auto-attach την κορυφή του στους hosts που τρέχουν
 * από πάνω (top) και τη βάση του στα θεμέλια από κάτω (base). Ένα command ανά
 * hostId (το `attachTopToIds` κάνει union → σκαλωτή κορυφή). Λύνει την ασυμμετρία
 * δοκάρι-πρώτα→τοίχος-μετά. Idempotent: ο detector φιλτράρει το ήδη-attached.
 */
function attachWallToSurroundingHosts(
  wall: Entity, entities: readonly Entity[], sm: ISceneManager, execute: ExecuteFn,
): void {
  const kind = (wall as WallEntity).kind;
  const topHostIds = findHostsToAttachWallTop(wall, entities);
  for (const hostId of topHostIds) {
    execute(new AttachWallsTopCommand(hostId, [{ wallId: wall.id, kind }], sm));
  }
  if (topHostIds.length > 0) {
    EventBus.emit('bim:walls-auto-attached', { wallIds: [wall.id], hostId: topHostIds[0] });
  }
  const baseHostIds = findHostsToAttachWallBase(wall, entities);
  for (const hostId of baseHostIds) {
    execute(new AttachWallsBaseCommand(hostId, [{ wallId: wall.id, kind }], sm));
  }
  if (baseHostIds.length > 0) {
    EventBus.emit('bim:walls-auto-attached-base', { wallIds: [wall.id], hostId: baseHostIds[0] });
  }
}

/**
 * ADR-685 Φ1 (αντίστροφη φορά) — όταν δημιουργείται **ΣΚΑΛΑ** πάνω σε υπάρχον
 * δάπεδο/θεμέλιο, κάνε auto-attach/seat τη βάση της στους hosts από κάτω. Λύνει την
 * ασυμμετρία πλάκα-πρώτα→σκάλα-μετά (το host-created path πιάνει μόνο την αντίστροφη).
 * Ένα command ανά hostId. Idempotent: ο detector φιλτράρει το ήδη-attached.
 */
function attachStairBaseToSurroundingHosts(
  stair: Entity, entities: readonly Entity[], sm: ISceneManager, execute: ExecuteFn,
): void {
  const kind = (stair as StairEntity).kind;
  const hostIds = findHostsToSeatStairBase(stair, entities);
  for (const hostId of hostIds) {
    execute(new AttachStairsCommand('base', hostId, [{ stairId: stair.id, kind }], sm));
  }
  if (hostIds.length > 0) {
    EventBus.emit('bim:stairs-auto-attached-base', { stairIds: [stair.id], hostId: hostIds[0] });
  }
}

/**
 * ADR-459 Phase 2 (αμφίδρομα) — εδραίωση του αναλυτικού FK `footingId`:
 *   (α) νέο **footing element** (πέδιλο/πεδιλοδοκός/εδαφόπλακα) → attach όσες
 *       κολόνες (χωρίς footingId) εδράζονται από πάνω.
 *   (β) νέα **κολόνα** πάνω σε υπάρχον footing → attach στο footing από κάτω.
 * Geometry-neutral (αναλυτική σύνδεση)· detection στον foundation-column-attach-
 * coordinator. No-op όταν το νέο entity δεν είναι footing/κολόνα.
 */
function attachFootingColumnFK(
  created: Entity, entities: readonly Entity[], sm: ISceneManager, execute: ExecuteFn,
): void {
  if (isFootingElement(created)) {
    const columnIds = findColumnsOnFooting(created, entities);
    if (columnIds.length > 0) {
      execute(new AttachColumnFootingCommand(created.id, columnIds, sm));
      EventBus.emit('bim:column-footing-attached', { columnIds, footingId: created.id });
    }
    return;
  }
  if (isColumnEntity(created)) {
    const footingId = findFootingForColumn(created, entities);
    if (footingId) {
      execute(new AttachColumnFootingCommand(footingId, [created.id], sm));
      EventBus.emit('bim:column-footing-attached', { columnIds: [created.id], footingId });
    }
  }
}

export function useStructuralAutoAttach(props: { levelManager: LevelSceneWriter }): void {
  const { levelManager } = props;
  const { execute } = useCommandHistory();

  useEffect(() => {
    const unsub = EventBus.on('drawing:entity-created', ({ entity }) => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;

      const entities = scene.entities as unknown as readonly Entity[];
      const created = entity as unknown as Entity;
      const sm = createLevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelId,
      );
      // ADR-441 GEN-SLAB — η εδαφόπλακα-θεμελίωσης (raft/κοιτόστρωση, kind='foundation')
      // ΔΕΝ είναι auto-attach host: κάθεται στη στάθμη θεμελίωσης, οπότε οι βάσεις
      // τοίχων/κολωνών/σκαλών ισογείου δεν «πέφτουν» αυτόματα πάνω της (Revit: το
      // foundation slab ΔΕΝ τραβά τα storey-floor στοιχεία· attach σε αυτήν = explicit).
      const isFoundationRaft = isSlabEntity(created) && created.kind === 'foundation';
      // Φορά 1: νέος host → attach τα entities από κάτω/πάνω του (no-op αν όχι host).
      if (!isFoundationRaft) attachEntitiesUnderHost(created, entities, sm, execute);
      // Φορά 2 (αντίστροφη): νέος τοίχος → attach κορυφή/βάση στους γύρω hosts.
      if (isWallEntity(created)) attachWallToSurroundingHosts(created, entities, sm, execute);
      // ADR-685 Φ1 (αντίστροφη): νέα σκάλα → seat/attach βάση στο δάπεδο από κάτω.
      if (isStairEntity(created)) attachStairBaseToSurroundingHosts(created, entities, sm, execute);
      // ADR-459 Phase 2 — αναλυτικό FK πεδίλου↔κολόνας (αμφίδρομα).
      attachFootingColumnFK(created, entities, sm, execute);
    });
    return () => unsub();
  }, [levelManager, execute]);
}
