'use client';

/**
 * ADR-396 P7 — Level ↔ ThermalEnvelopeSpec store sync.
 *
 * Watches (currentLevelId, levels) και καλεί `loadForLevel()` στο
 * `envelope-spec-store` όποτε αλλάζει ο ενεργός όροφος (ο χρήστης αλλάζει
 * πάτωμα), φορτώνοντας το persisted `level.thermalEnvelopeSpec` από το level
 * doc ώστε το ETICS κέλυφος να επιβιώνει reload.
 *
 * Quiet-window guard (mirror ADR-375 v2.11 `useBimRenderSettingsSync`): όταν ο
 * χρήστης πατήσει «Εφαρμογή Θερμοπρόσοψης», το store ενημερώνεται άμεσα αλλά το
 * Firestore PATCH είναι debounced. Στο μεσοδιάστημα η `levels` reference μπορεί
 * να αλλάξει (listener echo, sibling update) — naïve sync θα φόρτωνε stale
 * server data και θα έσβηνε την pending τοπική αλλαγή. Άρα: same-level reloads
 * παραλείπονται όσο `Date.now() - lastLocalMutationAt < QUIET_WINDOW_MS`.
 *
 * Mount once κοντά στο DXF viewer root (δίπλα στο `useBimRenderSettingsSync`).
 *
 * @see ../../bim/stores/envelope-spec-store (loadForLevel + quiet-window state)
 * @see ./useBimRenderSettingsSync (ADR-375 — pattern SSoT)
 */

import { useEffect } from 'react';
import type { Level } from '../../systems/levels/config';
import {
  loadForLevel,
  getCurrentLevelId,
  getLastLocalMutationAt,
} from '../../bim/stores/envelope-spec-store';

/** Min idle ms μετά την τελευταία τοπική εγγραφή πριν ξαναρχίσουν τα reloads. */
const LOCAL_WRITE_QUIET_WINDOW_MS = 2000;

interface UseThermalEnvelopeSyncParams {
  currentLevelId: string | null;
  levels: Level[];
}

export function useThermalEnvelopeSync({
  currentLevelId,
  levels,
}: UseThermalEnvelopeSyncParams): void {
  useEffect(() => {
    // Defense-in-depth (mirror useBimRenderSettingsSync): tolerate an undefined
    // `levels` from a caller mid-refactor instead of crashing on mount.
    if (!currentLevelId || !levels) return;
    const level = levels.find((l) => l.id === currentLevelId);
    const incoming = level?.thermalEnvelopeSpec ?? null;

    // Level switch always reloads — ο χρήστης πλοηγήθηκε ρητά σε νέο όροφο.
    if (getCurrentLevelId() !== currentLevelId) {
      loadForLevel(currentLevelId, incoming);
      return;
    }

    // Same level: σεβασμός quiet window για pending debounced PATCH.
    if (Date.now() - getLastLocalMutationAt() < LOCAL_WRITE_QUIET_WINDOW_MS) {
      return;
    }

    loadForLevel(currentLevelId, incoming);
  }, [currentLevelId, levels]);
}
