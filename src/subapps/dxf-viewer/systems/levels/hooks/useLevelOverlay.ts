'use client';

/**
 * useLevelOverlay — το στρώμα «ό,τι ξέρουμε πριν από την ηχώ» πάνω στη λίστα της συνδρομής
 * (ADR-914 §2.9). Κρατά την κατάσταση· οι κανόνες ζουν στο pure `level-optimistic-overlay`.
 *
 * @module subapps/dxf-viewer/systems/levels/hooks/useLevelOverlay
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Level } from '../config';
import {
  EMPTY_LEVEL_OVERLAY,
  applyLevelOverlay,
  isAwaitingEcho,
  settleLevelOverlay,
  withBornLevel,
  withLevelPatch,
  withoutLevel,
  withoutLevelPatch,
  type LevelPatch,
} from '../level-optimistic-overlay';

/** Οι πράξεις του στρώματος — σταθερές αναφορές για όλη τη ζωή του provider. */
export interface LevelOverlayActions {
  /** Ο διακομιστής απάντησε ότι το επίπεδο γεννήθηκε. */
  readonly registerBorn: (level: Level) => void;
  /** Ο άνθρωπος άλλαξε πεδία· φαίνονται αμέσως. */
  readonly patch: (levelId: string, patch: LevelPatch) => void;
  /** Η εγγραφή της διόρθωσης απέτυχε. */
  readonly revertPatch: (levelId: string, failed: LevelPatch) => void;
  /** Το επίπεδο διαγράφηκε από αυτή τη συνεδρία. */
  readonly forget: (levelId: string) => void;
  /** Ανάγνωση τη στιγμή του γεγονότος (όχι snapshot — ADR-040). */
  readonly isAwaitingEcho: (levelId: string) => boolean;
}

export interface LevelOverlayResult {
  /** Η λίστα που βλέπει ο viewer: συνδρομή + στρώμα. */
  readonly levels: Level[];
  readonly actions: LevelOverlayActions;
}

export function useLevelOverlay(baseLevels: Level[]): LevelOverlayResult {
  const [overlay, setOverlay] = useState(EMPTY_LEVEL_OVERLAY);
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;

  // Κάθε νέα λίστα της συνδρομής συμφιλιώνει το στρώμα: ό,τι αντήχησε φεύγει.
  useEffect(() => {
    setOverlay((prev) => settleLevelOverlay(baseLevels, prev));
  }, [baseLevels]);

  const levels = useMemo(() => applyLevelOverlay(baseLevels, overlay), [baseLevels, overlay]);

  const actions = useMemo<LevelOverlayActions>(
    () => ({
      registerBorn: (level) => setOverlay((prev) => withBornLevel(prev, level)),
      patch: (levelId, patch) => setOverlay((prev) => withLevelPatch(prev, levelId, patch)),
      revertPatch: (levelId, failed) => setOverlay((prev) => withoutLevelPatch(prev, levelId, failed)),
      forget: (levelId) => setOverlay((prev) => withoutLevel(prev, levelId)),
      isAwaitingEcho: (levelId) => isAwaitingEcho(overlayRef.current, levelId),
    }),
    [],
  );

  return { levels, actions };
}
