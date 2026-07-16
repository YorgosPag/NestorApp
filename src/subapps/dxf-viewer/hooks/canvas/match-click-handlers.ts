'use client';

/**
 * ADR-581 — Σταγονόμετρο/Σύριγγα click handler («Αντιγραφή Ιδιοτήτων» πινέλο).
 *
 * Καλείται από το `useCanvasClickHandler` σε νέα προτεραιότητα (ΠΡΙΝ grips/selection),
 * gated σε modifiers ή στο εργαλείο `match-properties`:
 *   - `Alt+click`          → σταγονόμετρο: φορτώνει την πηγή στο `MatchBrushStore`.
 *   - `Ctrl+Alt+click`     → σύριγγα: μεταφέρει τους default (habit) ρόλους στην οντότητα.
 *   - εργαλείο `match-properties` (πινέλο): 1ο κλικ = pick, επόμενα = inject.
 *
 * ADR-040: event-time read της οντότητας κάτω από τον κέρσορα μέσω `getHoveredEntity()`
 * (ίδια πηγή με το hover-highlight) — καμία subscription στον orchestrator. Το inject
 * τρέχει τον κοινό writer SSoT (`applyMatchTransfer`) → κοινό undo stack + emit + habit.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { EntityType } from '../../types/base-entity';
import type { UseCanvasClickHandlerParams } from './canvas-click-types';
import { getHoveredEntity } from '../../systems/hover/HoverStore';
import {
  getMatchBrushSource,
  setMatchBrushSource,
  getDefaultChecklist,
  resolveSemanticMapping,
} from '../../systems/match-properties';
import { applyMatchTransfer } from './apply-match-transfer';

/** Ο τύπος της οντότητας κάτω από τον κέρσορα (event-time), ή `null`. */
function hoveredEntityType(params: UseCanvasClickHandlerParams, id: string): EntityType | null {
  const levelId = params.levelManager.currentLevelId;
  const scene = levelId ? params.levelManager.getLevelScene(levelId) : null;
  const entity = scene?.entities.find((e) => e.id === id);
  return entity ? entity.type : null;
}

/**
 * Χειρίζεται ένα κλικ πινέλου. `true` → καταναλώθηκε το κλικ. Ο caller έχει ήδη
 * ελέγξει το `isMatchBrushGesture`.
 */
export function handleMatchBrushClick(
  _worldPoint: Point2D,
  altKey: boolean,
  ctrlKey: boolean,
  params: UseCanvasClickHandlerParams,
): boolean {
  const hoveredId = getHoveredEntity();
  if (!hoveredId) return false; // κενός χώρος → άφησε το κλικ να συνεχίσει (deselect κ.λπ.)
  const targetType = hoveredEntityType(params, hoveredId);
  if (!targetType) return false;

  const injectMode = ctrlKey && altKey;
  const source = getMatchBrushSource();

  // Σύριγγα: υπάρχει φορτωμένη πηγή → μεταφορά. (Ctrl+Alt, ή εργαλείο-πινέλο με πηγή.)
  if ((injectMode || params.activeTool === 'match-properties') && source && source.id !== hoveredId) {
    const roles = getDefaultChecklist(
      source.type,
      targetType,
      resolveSemanticMapping(source.type, targetType).map((m) => m.role),
    );
    applyMatchTransfer({
      levelManager: params.levelManager,
      sourceId: source.id,
      targetIds: [hoveredId],
      selectedRoles: roles,
    });
    return true;
  }

  // Σταγονόμετρο: φόρτωσε την πηγή (Alt, ή εργαλείο-πινέλο χωρίς πηγή).
  if (altKey || params.activeTool === 'match-properties') {
    setMatchBrushSource({ id: hoveredId, type: targetType });
    return true;
  }

  return false;
}
