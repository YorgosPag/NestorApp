/**
 * useSceneSnapTargetSync — SSoT hook (ADR-398 §3.10 / ADR-508).
 *
 * **Γιατί υπάρχει:** τα placement tools (τοίχος/δοκάρι/κολώνα) προ-συλλέγουν τους face-snap
 * στόχους της σκηνής στο preview store τους ώστε το ghost-before-click + το commit να
 * υπολογίζουν το snap **σύγχρονα** με έτοιμους στόχους. Το «re-sync όταν δημιουργείται οντότητα»
 * pattern (listener στο `drawing:entity-created` + **rAF defer**) ήταν **copy-pasted byte-for-byte**
 * σε `useWallTool` / `useBeamTool` / `useColumnTool` → εδώ ζει **μία φορά** (Giorgio SSoT audit).
 *
 * **rAF defer (κρίσιμο):** το `drawing:entity-created` εκπέμπεται ΣΥΓΧΡΟΝΑ μέσα στο
 * `appendEntityToScene` αμέσως μετά το `setLevelScene` → το React scene state ΔΕΝ έχει
 * commit-αριστεί ακόμη· σύγχρονο re-sync θα διάβαζε STALE σκηνή (χωρίς τη νέα οντότητα). Το rAF
 * τρέχει μετά το commit → φρέσκοι στόχοι ΠΡΙΝ το επόμενο hover (όχι μόνο στο κλικ).
 *
 * @param sync — σταθερός (`useCallback`) sync callback του tool (γράφει στο δικό του preview store).
 * @see ./useWallTool.ts / ./useBeamTool.ts / ./useColumnTool.ts — οι consumers
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md §3.10
 */

import { useEffect } from 'react';
import { EventBus } from '../../systems/events/EventBus';

export function useSceneSnapTargetSync(sync: () => void): void {
  useEffect(() => {
    let raf = 0;
    const unsub = EventBus.on('drawing:entity-created', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => sync());
    });
    return () => {
      cancelAnimationFrame(raf);
      unsub();
    };
  }, [sync]);
}
