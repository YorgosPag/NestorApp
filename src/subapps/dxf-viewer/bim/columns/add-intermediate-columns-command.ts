/**
 * Add-intermediate-columns command builder — pure (ADR-504 Φ2 S6).
 *
 * Συνθέτει το **opt-in** action της practical-span πρότασης: `K` ενδιάμεσες κολώνες
 * στον άξονα του δοκού, ως **ΕΝΑ atomic** `CompoundCommand[CreateColumnsCommand]`
 * (ένα Ctrl+Z αναιρεί όλες). Μόλις εκτελεστεί, ο proactive κύκλος κάνει τα υπόλοιπα
 * **μόνος του** (πέδιλα μέσω reconciler + ο δοκός μικραίνει/οπλίζεται ως `'continuous'`)
 * — **μηδέν νέος reactive trigger** εδώ.
 *
 * Pure (no React/DOM): παίρνει level read/write surface ως deps· ο γράφος χτίζεται
 * **one-shot** στην ενέργεια του χρήστη (όχι reactive) μέσω του SSoT `buildStructuralGraph`
 * → η template διατομή = μια **στηρίζουσα** κολώνα (`beamSupportColumnIds`). Επιστρέφει
 * `null` όταν δεν βρεθεί στηρίζουσα κολώνα ή δεν παραχθεί καμία έγκυρη κολώνα.
 *
 * @see ./intermediate-column-placement.ts — build ColumnEntity[] (S4)
 * @see ./../structural/organism/structural-graph.ts — buildStructuralGraph (SSoT)
 * @see ../../core/commands/entity-commands/CreateColumnsCommand.ts — batch create + persist
 * @see docs/centralized-systems/reference/adrs/ADR-504-practical-span-intermediate-columns.md §5.1
 */

import type { BeamEntity } from '../types/beam-types';
import type { ColumnEntity } from '../types/column-types';
import type { SceneModel } from '../../types/scene';
import type { SceneUnits } from '../../utils/scene-units';
import { isColumnEntity } from '../../types/entities';
import { buildStructuralGraph } from '../structural/organism/structural-graph';
import { beamSupportColumnIds } from '../structural/loads/load-path-walk';
import { CompoundCommand } from '../../core/commands/CompoundCommand';
import { CreateColumnsCommand } from '../../core/commands/entity-commands/CreateColumnsCommand';
import { LevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { buildIntermediateColumns } from './intermediate-column-placement';

/** Level read/write surface (injected — ο builder μένει pure/jest-clean). */
export interface AddIntermediateColumnsDeps {
  readonly getLevelScene: (levelId: string) => SceneModel | null;
  readonly setLevelScene: (levelId: string, scene: SceneModel) => void;
  readonly levelId: string;
  readonly sceneUnits?: SceneUnits;
}

/** Αποτέλεσμα: το atomic command + οι κολώνες που θα μπουν (για το toast count). */
export interface AddIntermediateColumnsResult {
  readonly command: CompoundCommand;
  readonly columns: readonly ColumnEntity[];
}

/** Η πρώτη στηρίζουσα κολώνα του δοκού ως template διατομής (`null` αν καμία). */
function resolveTemplateColumn(
  beam: BeamEntity,
  entities: readonly SceneModel['entities'][number][],
): ColumnEntity | null {
  const graph = buildStructuralGraph(entities);
  const supportIds = new Set(beamSupportColumnIds(graph, beam.id));
  for (const e of entities) {
    if (isColumnEntity(e) && supportIds.has(e.id)) return e;
  }
  return null;
}

/**
 * Χτίσε το `CompoundCommand` που εισάγει `count` ενδιάμεσες κολώνες (κλωνοποιώντας τη
 * διατομή μιας στηρίζουσας κολώνας). `null` όταν λείπει στηρίζουσα κολώνα ή `count ≤ 0`
 * ή καμία έγκυρη κολώνα — ο caller δεν εκτελεί τίποτα (μηδέν σιωπηλό no-op command).
 */
export function buildAddIntermediateColumnsCommand(
  beam: BeamEntity,
  count: number,
  deps: AddIntermediateColumnsDeps,
): AddIntermediateColumnsResult | null {
  if (count <= 0) return null;
  const entities = deps.getLevelScene(deps.levelId)?.entities ?? [];
  const template = resolveTemplateColumn(beam, entities);
  if (!template) return null;
  const sceneUnits = deps.sceneUnits ?? beam.params.sceneUnits ?? 'mm';
  const columns = buildIntermediateColumns(beam, template, count, deps.levelId, sceneUnits);
  if (columns.length === 0) return null;
  const adapter = new LevelSceneManagerAdapter(deps.getLevelScene, deps.setLevelScene, deps.levelId);
  const command = new CompoundCommand('AddIntermediateColumns', [
    new CreateColumnsCommand(columns, adapter),
  ]);
  return { command, columns };
}
