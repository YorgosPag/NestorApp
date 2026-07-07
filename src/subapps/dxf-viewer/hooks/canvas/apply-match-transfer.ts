/**
 * ADR-581 — Κοινός writer «Αντιγραφή Ιδιοτήτων» (SSoT execute path).
 *
 * ΕΝΑ σημείο που εκτελεί τη μεταφορά — το μοιράζονται ΚΑΙ το dialog Apply ΚΑΙ η
 * σύριγγα (Ctrl+Alt+click). Πρότυπο `apply-finish-face-override` (finish paint):
 * level-scene adapter + `getGlobalCommandHistory().execute` (κοινό undo stack).
 *
 * Ροή (ADR-581 §emit contract):
 *   build CompoundCommand → execute (αν μη-άδειο) → emit ανά BIM target → recordApply (habit).
 * Το emit ΜΕΤΑ το execute είναι υποχρεωτικό: τα `Update*ParamsCommand` είναι σιωπηλά,
 * αλλιώς persistence / auto-foundation / structural graph / BOQ χάνουν την αλλαγή.
 *
 * @see ../../bim-3d/ui/apply-finish-face-override — αδελφός writer (ίδιο execute pattern)
 */

import type { EntityType } from '../../types/entities';
import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { getGlobalCommandHistory } from '../../core/commands';
import { emitBimEntityParamsUpdated } from '../../systems/events/emit-bim-entity-params-updated';
import {
  buildMatchTransferCommand,
  resolveSemanticMapping,
  recordApply,
  type SemanticRole,
} from '../../systems/match-properties';

export interface ApplyMatchTransferArgs {
  readonly levelManager: LevelsHookReturn;
  readonly sourceId: string;
  readonly targetIds: readonly string[];
  readonly selectedRoles: ReadonlySet<SemanticRole>;
}

export interface ApplyMatchTransferResult {
  readonly applied: number;
  readonly emitted: number;
  readonly skipped: number;
}

const EMPTY: ApplyMatchTransferResult = { applied: 0, emitted: 0, skipped: 0 };

/** Εκτελεί τη μεταφορά ιδιοτήτων. Καθαρή συνάρτηση (zero React) — δουλεύει και σε event-time. */
export function applyMatchTransfer(args: ApplyMatchTransferArgs): ApplyMatchTransferResult {
  const { levelManager, sourceId, targetIds, selectedRoles } = args;
  const levelId = levelManager.currentLevelId ?? '';
  if (!levelId || targetIds.length === 0 || selectedRoles.size === 0) return EMPTY;

  const sceneManager = createLevelSceneManagerAdapter(
    levelManager.getLevelScene, levelManager.setLevelScene, levelId,
  );
  const source = sceneManager.getEntity(sourceId);
  if (!source) return EMPTY;
  const sourceType = source.type as EntityType;

  const { command, emit, skipped } = buildMatchTransferCommand({
    sourceId, targetIds, selectedRoles, sceneManager,
  });
  // 🔬 TEMP PROBE (ADR-581 Φ6 diag) — remove after verify.
  {
    const tgt0 = targetIds[0] ? sceneManager.getEntity(targetIds[0]) : null;
    const p0 = tgt0?.params as Record<string, unknown> | undefined;
    // eslint-disable-next-line no-console
    console.warn('[MTAPPLY] before', { sourceType, roles: [...selectedRoles], cmds: command.commands.length, emit: emit.length, skipped, targetWidth: p0?.width, targetDepth: p0?.depth });
  }
  if (command.commands.length > 0) getGlobalCommandHistory().execute(command);
  for (const e of emit) emitBimEntityParamsUpdated(e.type, e.id);
  {
    const tgt1 = targetIds[0] ? sceneManager.getEntity(targetIds[0]) : null;
    const p1 = tgt1?.params as Record<string, unknown> | undefined;
    const g1 = tgt1?.geometry as { footprint?: { vertices?: unknown[] } } | undefined;
    // eslint-disable-next-line no-console
    console.warn('[MTAPPLY] after', { targetWidth: p1?.width, targetDepth: p1?.depth, footprintVerts: g1?.footprint?.vertices?.length });
    // Detect async revert (emit-driven recompute writing back stale geometry).
    const tid = targetIds[0];
    if (tid) {
      setTimeout(() => {
        const late = levelManager.getLevelScene(levelId)?.entities.find((e) => e.id === tid) as { params?: Record<string, unknown> } | undefined;
        // eslint-disable-next-line no-console
        console.warn('[MTAPPLY] +600ms', { targetWidth: late?.params?.width, targetDepth: late?.params?.depth });
      }, 600);
    }
  }

  // Habit ανά διακριτό targetType (ό,τι προσφέρθηκε σε ΑΥΤΟΝ τον τύπο).
  const recorded = new Set<string>();
  for (const id of targetIds) {
    const target = sceneManager.getEntity(id);
    if (!target) continue;
    const targetType = target.type as EntityType;
    if (recorded.has(targetType)) continue;
    recorded.add(targetType);
    const perType = resolveSemanticMapping(sourceType, targetType).map((m) => m.role);
    recordApply(sourceType, targetType, perType, selectedRoles);
  }

  return { applied: command.commands.length, emitted: emit.length, skipped: skipped.length };
}
