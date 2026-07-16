/**
 * EDGE TOOL SHARED — κοινά primitives για TRIM (ADR-350) / EXTEND (ADR-353).
 *
 * Τα δύο hooks (`useTrimTool` / `useExtendTool`) είναι γεωμετρικά αντίστροφα αλλά μοιράζονται
 * το ΙΔΙΟ keyword vocabulary, το ΙΔΙΟ pick preamble και τον ΙΔΙΟ undo-last handler. Εδώ ζουν
 * μία φορά — τα hooks κρατούν μόνο τη δική τους γεωμετρία.
 *
 * @see ../../stores/createEdgeToolStore.ts — το αντίστοιχο SSoT για το store shape
 * @see useTrimTool.ts / useExtendTool.ts — οι δύο consumers
 */

import i18next from 'i18next';
import type { MutableRefObject } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity, SceneModel } from '../../types/entities';
import type { ISceneManager } from '../../core/commands/interfaces';
import type { SceneAdapterLevelManager } from '../../systems/entity-creation/useSceneManagerAdapter';
import { toolHintOverrideStore } from '../toolHintOverrideStore';

// ── Keyword routing ──────────────────────────────────────────────────────────
// Ελληνικά + λατινικά, κεφαλαία + πεζά. TRIM-only το eRase (ζει στο useTrimTool).

export const EDGE_TOOL_KEYWORDS = {
  /** Ο/B — δήλωσε boundary/cutting edges (Standard mode). */
  BOUNDARY: new Set(['o', 'O', 'Ο', 'ο', 'b', 'B']),
  /** Α/U — undo της τελευταίας πράξης. */
  UNDO: new Set(['a', 'A', 'Α', 'α', 'u', 'U']),
  /** Λ/M — quick ↔ standard mode. */
  MODE: new Set(['l', 'L', 'Λ', 'λ', 'm', 'M']),
  /** Ε/E — EDGEMODE toggle (noExtend ↔ extend). */
  EDGE: new Set(['e', 'E', 'Ε', 'ε']),
} as const;

// ── Pick resolution ──────────────────────────────────────────────────────────

export interface EdgePickTarget {
  readonly sm: ISceneManager;
  readonly scene: SceneModel;
  readonly target: Entity;
}

/**
 * Το κοινό preamble κάθε pick: scene manager → ενεργό level scene → hit-test → entity.
 * `null` σε οποιοδήποτε βήμα αποτύχει — ο caller απλώς κάνει return.
 *
 * Positional args (όπως το sibling `resolveCornerTarget`) ώστε το call site να μένει μια
 * γραμμή — και τα δύο hooks το καλούν πανομοιότυπα.
 */
export function resolveEdgePickTarget(
  getSceneManager: () => ISceneManager | null,
  levelManager: SceneAdapterLevelManager,
  hitTestEntity: (worldPoint: Point2D) => string | null,
  worldPoint: Point2D,
): EdgePickTarget | null {
  const sm = getSceneManager();
  if (!sm || !levelManager.currentLevelId) return null;
  const scene = levelManager.getLevelScene(levelManager.currentLevelId);
  if (!scene) return null;

  const hitId = hitTestEntity(worldPoint);
  if (!hitId) return null;
  const target = scene.entities.find((e) => e.id === hitId);
  if (!target) return null;

  return { sm, scene, target };
}

// ── Undo-last keyword ────────────────────────────────────────────────────────

/** Ό,τι χρειάζεται ο undo handler — κάθε edge-tool command το ικανοποιεί. */
interface UndoableCommand {
  undo(): void;
}

/**
 * Χειρίζεται το Α/U keyword: undo της τελευταίας πράξης, αλλιώς ephemeral hint.
 * Καθαρίζει το ref ώστε το undo να μη ξαναπαίξει στο ίδιο command.
 *
 * @param undoEmptyKey full i18n key (π.χ. `tool-hints:trimTool.undoEmpty`)
 */
export function undoLastEdgeToolCommand<TCommand extends UndoableCommand>(
  lastCommandRef: MutableRefObject<TCommand | null>,
  undoEmptyKey: string,
): void {
  const last = lastCommandRef.current;
  if (last) {
    last.undo();
    lastCommandRef.current = null;
    return;
  }
  toolHintOverrideStore.setOverride(i18next.t(undoEmptyKey));
}
