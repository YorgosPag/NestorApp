/**
 * ADR-441 Slice GEN-TIE — orchestrator για το «Συνδετήριες δοκοί από κάναβο».
 *
 * Γέφυρα ανάμεσα στον pure builder (`buildStripGridFromGuides` με `kind='tie-beam'`)
 * και στο command history. **Idempotent create + auto-junction (mirror GEN-WALL +
 * εσχάρας):** χτίζει το target (μία born-bound συνδετήρια ανά segment άξονα,
 * κεντραρισμένη), παραλείπει segments με ήδη grid-managed **tie-beam**, δημιουργεί τα
 * missing, και τρέχει το **ίδιο junction-miter** των πεδιλοδοκών (`computeGridJunctionExtends`,
 * kind-aware ήδη) ώστε οι **γωνίες να κλείνουν** (αλλιώς κεντραρισμένες συνδετήριες
 * αφήνουν κενό w/2×w/2 στις 4 άκρες). Όλο το delta = ΕΝΑ atomic step (1 undo).
 *
 * **Kind-partition (ΚΡΙΣΙΜΟ):** οι συνδετήριες συνυπάρχουν με τις πεδιλοδοκούς στον
 * ΙΔΙΟ άξονα (Revit). Το idempotent skip + το junction κοιτούν **ΜΟΝΟ** tie-beams — και
 * η «Εσχάρα πεδιλοδοκών» reconcile-άρει **ΜΟΝΟ** strips (kind-filtered). Ανεξάρτητα
 * overlays, μηδέν cross-delete.
 *
 * Migration: re-run πάνω σε υπάρχουσες συνδετήριες χωρίς miter → τους προσθέτει το
 * extend (γωνίες κλείνουν), `created=0` αλλά `jointed>0`. Follow-move δωρεάν μέσω
 * `foundationHostingStrategy`. Full reconcile/auto-resplit = DEFER (όπως GEN-WALL).
 *
 * @see ./foundation-from-grid.ts — buildStripGridFromGuides (kind-param target builder)
 * @see ./foundation-grid-segments.ts — segmentKeyFromBindings (SSoT idempotent key)
 * @see ./foundation-grid-junctions.ts — computeGridJunctionExtends (kind-aware miter)
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §8
 */

import type { ICommand } from '../../core/commands/interfaces';
import type { SceneModel } from '../../types/scene';
import { LevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { CreateFoundationsCommand } from '../../core/commands/entity-commands/CreateFoundationsCommand';
import { RehostFoundationsCommand } from '../../core/commands/entity-commands/RehostFoundationsCommand';
import { CompoundCommand } from '../../core/commands/CompoundCommand';
import { isFoundationEntity } from '../../types/entities';
import { hasGuideBindings } from '../hosting/guide-binding-types';
import type { FoundationEntity } from '../types/foundation-types';
import type { FoundationParamOverrides, SceneUnits } from '../../hooks/drawing/foundation-completion';
import { buildStripGridFromGuides, type AxisGuideReader } from './foundation-from-grid';
import { segmentKeyFromBindings } from './foundation-grid-segments';
import { computeGridJunctionExtends } from './foundation-grid-junctions';
import type { RehostedStrip } from './foundation-grid-rehost';

export interface TieBeamGridCommitDeps {
  /** Read-surface του κανάβου (guide-store singleton ή test double). */
  readonly guideReader: AxisGuideReader;
  readonly getLevelScene: (levelId: string) => SceneModel | null;
  readonly setLevelScene: (levelId: string, scene: SceneModel) => void;
  readonly levelId: string;
  readonly sceneUnits: SceneUnits;
  readonly executeCommand: (command: ICommand) => void;
  /** Προαιρετικά param overrides (v1: tie-beam defaults). */
  readonly overrides?: FoundationParamOverrides;
}

export interface TieBeamGridCommitResult {
  readonly ok: boolean;
  readonly reason?: 'insufficient-guides' | 'up-to-date';
  /** Νέες συνδετήριες που δημιουργήθηκαν. */
  readonly created: number;
  /** Segments που παραλείφθηκαν (υπήρχε ήδη grid-managed συνδετήρια). */
  readonly skipped: number;
  /** Υπάρχουσες συνδετήριες που έκλεισαν γωνία (miter extend άλλαξε). */
  readonly jointed: number;
}

/** Οι grid-managed **συνδετήριες** της σκηνής (kind-partition). */
function existingGridTieBeams(
  getLevelScene: (levelId: string) => SceneModel | null,
  levelId: string,
): FoundationEntity[] {
  return (getLevelScene(levelId)?.entities ?? [])
    .filter(isFoundationEntity)
    .filter((f) => f.params.kind === 'tie-beam' && hasGuideBindings(f));
}

/** Segment-keys ενός συνόλου συνδετήριων (idempotent skip). */
function tieBeamSegmentKeys(ties: readonly FoundationEntity[]): Set<string> {
  const keys = new Set<string>();
  for (const f of ties) {
    const key = segmentKeyFromBindings(f.guideBindings ?? []);
    if (key) keys.add(key);
  }
  return keys;
}

/**
 * Fold των junction-miter extends μέσα στα creates (παίρνουν miter απευθείας) και
 * ξεχώρισε τα updates των ΥΠΑΡΧΟΥΣΩΝ συνδετήριων (γωνίες που έκλεισαν). Mirror του
 * `foldJunctions` της εσχάρας — εδώ μόνο create + existing-update (μηδέν delete).
 */
function foldTieJunctions(
  junctions: readonly RehostedStrip[],
  toCreate: readonly FoundationEntity[],
): { readonly create: FoundationEntity[]; readonly updates: RehostedStrip[] } {
  const jById = new Map(junctions.map((j) => [j.rehosted.id, j.rehosted]));
  const createIds = new Set(toCreate.map((c) => c.id));
  const create = toCreate.map((c) => jById.get(c.id) ?? c);
  const updates = junctions.filter((j) => !createIds.has(j.rehosted.id));
  return { create, updates };
}

/** Χτίσε το atomic command (update υπαρχόντων + create νέων, ή το μοναδικό μη-κενό). */
function buildTieCommand(
  updates: readonly RehostedStrip[],
  toCreate: readonly FoundationEntity[],
  adapter: LevelSceneManagerAdapter,
): ICommand {
  const cmds: ICommand[] = [];
  if (updates.length > 0) cmds.push(new RehostFoundationsCommand(updates, adapter));
  if (toCreate.length > 0) cmds.push(new CreateFoundationsCommand(toCreate, adapter));
  return cmds.length === 1 ? cmds[0] : new CompoundCommand('Tie-beam grid', cmds);
}

/**
 * Δημιούργησε/ενημέρωσε τις born-bound συνδετήριες στα segments του κανάβου, με
 * γωνίες κλεισμένες (junction-miter). No-op (`up-to-date`) όταν κάθε segment έχει ήδη
 * συνδετήρια ΚΑΙ καμία γωνία δεν χρειάζεται miter· `insufficient-guides` όταν λείπουν
 * άξονες (<2 ανά διεύθυνση).
 */
export function commitTieBeamGridFromGuides(
  deps: TieBeamGridCommitDeps,
): TieBeamGridCommitResult {
  // Κεντραρισμένες (mode='center'): η διατομή κάθεται στον άξονα· οι γωνίες κλείνουν
  // μέσω junction-miter (όχι μέσω inward justification όπως οι πεδιλοδοκοί).
  const target = buildStripGridFromGuides(
    deps.guideReader,
    deps.overrides ?? {},
    deps.levelId,
    deps.sceneUnits,
    'center',
    'tie-beam',
  );
  if (!target.ok) {
    return { ok: false, reason: 'insufficient-guides', created: 0, skipped: 0, jointed: 0 };
  }

  const existing = existingGridTieBeams(deps.getLevelScene, deps.levelId);
  const existingKeys = tieBeamSegmentKeys(existing);
  const toCreate = target.strips.filter((t) => {
    const key = segmentKeyFromBindings(t.guideBindings ?? []);
    return key !== null && !existingKeys.has(key);
  });
  const skipped = target.strips.length - toCreate.length;

  // Junction-miter στο ΤΕΛΙΚΟ σύνολο (existing + new) → γωνίες κλείνουν μεταξύ ΟΛΩΝ.
  const finalSet = [...existing, ...toCreate];
  const junctions = computeGridJunctionExtends(finalSet);
  const { create, updates } = foldTieJunctions(junctions, toCreate);

  if (create.length === 0 && updates.length === 0) {
    return { ok: false, reason: 'up-to-date', created: 0, skipped, jointed: 0 };
  }

  const adapter = new LevelSceneManagerAdapter(deps.getLevelScene, deps.setLevelScene, deps.levelId);
  deps.executeCommand(buildTieCommand(updates, create, adapter));
  return { ok: true, created: toCreate.length, skipped, jointed: updates.length };
}
