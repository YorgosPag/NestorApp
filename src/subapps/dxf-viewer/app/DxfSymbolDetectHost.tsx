'use client';

/**
 * ADR-533 — Always-on host: ακούει `drawing:entity-created` {tool:'wall'}, μαζεύει
 * τα DXF σύμβολα (γραμμές + τόξα) κοντά στον νέο τοίχο, τρέχει τον καθαρό
 * {@link detectSymbolsOnWall}, και — αν βρει κάτι — προτείνει **ένα-ένα** τη
 * δημιουργία BIM ανοίγματος (πόρτα/παράθυρο) μέσω confirm dialog.
 *
 * Στο «Ναι» δημιουργεί το `OpeningEntity` με reuse του SSoT:
 *   - {@link completeOpeningFromHostClick} (build params + geometry + validate)
 *   - `buildOpeningResolvers(...).onOpeningCreated` (scene-add + wall mirror +
 *     `drawing:entity-created` → `OpeningPersistenceHost` αναλαμβάνει persistence).
 *
 * Renders `null`. Mounted στο `DxfViewerTopBar` δίπλα στους υπόλοιπους hosts.
 * ΔΕΝ αγγίζει κανένα CHECK-6D-protected αρχείο.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-533-dxf-symbol-to-opening-detector.md
 */

import { useEffect, useRef } from 'react';
import type { LevelsHookReturn } from '../systems/levels';
import type { WallEntity } from '../bim/types/wall-types';
import { isWallEntity } from '../types/entities';
import { EventBus } from '../systems/events/EventBus';
import { resolveSceneUnits, mmToSceneUnits } from '../utils/scene-units';
import { gatherSymbolCandidates } from '../bim/walls/dxf-symbol-gatherer';
import { detectSymbolsOnWall } from '../bim/walls/dxf-symbol-detector';
import { requestDxfSymbolDetectConfirm } from '../bim/walls/dxf-symbol-detect-confirm-store';
import { completeOpeningFromHostClick, type OpeningParamOverrides } from '../hooks/drawing/opening-completion';
import { buildOpeningResolvers } from '../hooks/tools/useSpecialTools-opening';

/** Πλάτος band αναζήτησης γύρω από τον τοίχο = πάχος × αυτό (scene units). */
const GATHER_MARGIN_RATIO = 1.5;

export interface DxfSymbolDetectHostProps {
  readonly levelManager: LevelsHookReturn;
}

export function DxfSymbolDetectHost({ levelManager }: DxfSymbolDetectHostProps): null {
  // Stable ref ώστε ο EventBus callback να βλέπει πάντα τον τρέχοντα levelManager.
  const lmRef = useRef(levelManager);
  lmRef.current = levelManager;

  useEffect(() => {
    return EventBus.on('drawing:entity-created', (payload) => {
      if (payload.tool !== 'wall') return;
      // ADR-533 — μόνο σε ΠΡΑΓΜΑΤΙΚΑ νέο τοίχο (`origin:'create'`/undefined). Τα
      // `origin:'retrim'` re-emits (recompute miters μετά από move/rotate ΟΠΟΙΟΥΔΗΠΟΤΕ
      // entity) είναι persistence-only → αλλιώς το dialog «Εντοπίστηκε κούφωμα»
      // εμφανιζόταν ενώ ο χρήστης απλώς περιέστρεψε μια άσχετη γραμμή.
      if (payload.origin === 'retrim') return;
      const wall = payload.entity;
      if (!isWallEntity(wall)) return;
      void detectAndPropose(wall, lmRef.current);
    });
  }, []);

  return null;
}

/** Διαβάζει τη σκηνή, ανιχνεύει σύμβολα, και προτείνει ένα-ένα τα κουφώματα. */
async function detectAndPropose(wall: WallEntity, lm: LevelsHookReturn): Promise<void> {
  const levelId = lm.currentLevelId;
  if (!levelId) return;
  const scene = lm.getLevelScene(levelId);
  if (!scene) return;

  const units = resolveSceneUnits(scene);
  const mmFactor = mmToSceneUnits(units);
  const thicknessScene = wall.params.thickness * mmFactor;
  const margin = thicknessScene * GATHER_MARGIN_RATIO;

  const candidates = gatherSymbolCandidates(wall, scene, margin);
  const detected = detectSymbolsOnWall(
    { x: wall.params.start.x, y: wall.params.start.y },
    { x: wall.params.end.x, y: wall.params.end.y },
    thicknessScene,
    candidates,
  );
  if (detected.length === 0) return;

  const resolvers = buildOpeningResolvers(lm);
  let index = 0;
  for (const det of detected) {
    index += 1;
    const widthMm = Math.round(det.widthScene / mmFactor);
    const action = await requestDxfSymbolDetectConfirm({
      opening: det,
      index,
      total: detected.length,
      widthMm,
    });
    if (action !== 'add') continue;

    // Σημείο άξονα στο tCenter (scene coords) — ο builder το προβάλλει σε offset.
    const axisPoint = {
      x: wall.params.start.x + det.tCenter * (wall.params.end.x - wall.params.start.x),
      y: wall.params.start.y + det.tCenter * (wall.params.end.y - wall.params.start.y),
    };
    const overrides: OpeningParamOverrides = {
      kind: det.kind,
      width: widthMm,
      ...(det.handing ? { handing: det.handing } : {}),
      ...(det.openDirection ? { openDirection: det.openDirection } : {}),
    };
    const result = completeOpeningFromHostClick(wall, axisPoint, resolvers.currentLevelId, overrides, units);
    if (result.ok) resolvers.onOpeningCreated(result.entity);
  }
}
