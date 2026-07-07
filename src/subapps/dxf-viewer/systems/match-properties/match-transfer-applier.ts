/**
 * ADR-581 — Transfer applier: source + targets + επιλεγμένοι ρόλοι → ΕΝΑ undoable
 * `CompoundCommand` (single undo step) που αναμιγνύει:
 *   - scene κανάλι  → `UpdateEntityCommand` (raw style / BIM styleOverride)
 *   - params κανάλι → κοινός `buildParamsUpdateCommand` (per-kind Update*ParamsCommand)
 *
 * Ο applier ΜΟΝΟ χτίζει το command· ο caller (hook) το εκτελεί ΚΑΙ μετά καλεί
 * `emitBimEntityParamsUpdated` για κάθε BIM target (βλ. `emit`), αλλιώς
 * persistence/auto-foundation/structural-graph/BOQ χάνουν την αλλαγή.
 */

import type { EntityType } from '../../types/entities';
import type { ISceneManager, ICommand, SceneEntity } from '../../core/commands/interfaces';
import { CompoundCommand } from '../../core/commands/CompoundCommand';
import { UpdateEntityCommand } from '../../core/commands/entity-commands/UpdateEntityCommand';
import { COERCE_SKIP, type SemanticRole } from './match-types';
import { getDescriptorByKey } from './match-registry';
import { resolveSemanticMapping } from './semantic-mapping-resolver';
import { coerceValue } from './match-value-coercion';
import { buildParamsUpdateCommand, isParamsCommandKind } from './match-params-command-builder';

export interface MatchTransferRequest {
  readonly sourceId: string;
  readonly targetIds: readonly string[];
  /** Έξοδος του checklist — ποιοι σημασιολογικοί ρόλοι μεταφέρονται. */
  readonly selectedRoles: ReadonlySet<SemanticRole>;
  readonly sceneManager: ISceneManager;
}

export interface MatchTransferEmit {
  readonly type: string;
  readonly id: string;
}

export interface MatchTransferResult {
  /** ΕΝΑ undo step. Άδειο αν τίποτα δεν εφαρμόστηκε. */
  readonly command: CompoundCommand;
  /** BIM targets που άλλαξαν params → ο caller κάνει emit ΜΕΤΑ το execute. */
  readonly emit: readonly MatchTransferEmit[];
  /** Targets που παραλείφθηκαν (π.χ. params σε μη-υποστηριζόμενο kind). */
  readonly skipped: readonly { readonly targetId: string; readonly reason: string }[];
}

interface Channelled {
  readonly scenePatch: Record<string, unknown>;
  readonly paramsPatch: Record<string, unknown>;
}

/** Μαζεύει τα coerced fragments ενός target σε scene + params patches. */
function collectPatches(
  source: SceneEntity,
  sourceType: EntityType,
  target: SceneEntity,
  targetType: EntityType,
  selectedRoles: ReadonlySet<SemanticRole>,
): Channelled {
  const scenePatch: Record<string, unknown> = {};
  const paramsPatch: Record<string, unknown> = {};
  for (const m of resolveSemanticMapping(sourceType, targetType)) {
    if (!selectedRoles.has(m.role)) continue;
    const srcDesc = getDescriptorByKey(sourceType, m.sourceKey);
    const tgtDesc = getDescriptorByKey(targetType, m.targetKey);
    if (!srcDesc || !tgtDesc || tgtDesc.readOnly) continue;
    const coerced = coerceValue(srcDesc.read(source), srcDesc, tgtDesc);
    if (coerced === COERCE_SKIP) continue;
    const fragment = tgtDesc.buildFragment(coerced);
    const bucket = fragment.channel === 'scene' ? scenePatch : paramsPatch;
    Object.assign(bucket, fragment.patch);
  }
  return { scenePatch, paramsPatch };
}

/** Χτίζει το Match/Transfer command (δεν το εκτελεί). */
export function buildMatchTransferCommand(req: MatchTransferRequest): MatchTransferResult {
  const { sourceId, targetIds, selectedRoles, sceneManager } = req;
  const commands: ICommand[] = [];
  const emit: MatchTransferEmit[] = [];
  const skipped: { targetId: string; reason: string }[] = [];

  const source = sceneManager.getEntity(sourceId);
  if (!source) {
    return { command: new CompoundCommand('Match Properties (0)', []), emit, skipped };
  }
  const sourceType = source.type as EntityType;

  for (const targetId of targetIds) {
    if (targetId === sourceId) continue;
    const target = sceneManager.getEntity(targetId);
    if (!target) continue;
    const targetType = target.type as EntityType;

    const { scenePatch, paramsPatch } = collectPatches(
      source, sourceType, target, targetType, selectedRoles,
    );

    if (Object.keys(scenePatch).length > 0) {
      commands.push(new UpdateEntityCommand(targetId, scenePatch, sceneManager, 'Match Properties'));
    }
    if (Object.keys(paramsPatch).length > 0) {
      if (!isParamsCommandKind(targetType)) {
        skipped.push({ targetId, reason: 'unsupported-params-kind' });
      } else {
        const cmd = buildParamsUpdateCommand(target, paramsPatch, sceneManager);
        if (cmd) {
          commands.push(cmd);
          emit.push({ type: targetType, id: targetId });
        }
      }
    }
  }

  return {
    command: new CompoundCommand(`Match Properties (${commands.length})`, commands),
    emit,
    skipped,
  };
}
