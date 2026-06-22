/**
 * useSceneSnapTargetSync — SSoT hook (ADR-398 §3.10 / ADR-508).
 *
 * **Γιατί υπάρχει:** τα placement tools (τοίχος/δοκάρι/κολώνα) προ-συλλέγουν τους face-snap
 * στόχους της σκηνής στο **κοινό** `sceneSnapTargetsStore` ώστε το ghost-before-click + το commit
 * να υπολογίζουν το snap **σύγχρονα** με έτοιμους στόχους. Όλη η λογική «refresh + re-sync on
 * entity-created» ζει **εδώ, μία φορά** (Giorgio SSoT audit) — αλλιώς το ταυτόσημο block θα ήταν
 * copy-pasted σε 3 tools. Ο hook:
 *   · κρατά listener στο `drawing:entity-created` (rAF defer) → `sceneSnapTargetsStore.refresh`·
 *   · επιστρέφει σταθερό `refresh()` που το tool καλεί on `activate` (στόχοι έτοιμοι πριν το 1ο ghost).
 *
 * **rAF defer (κρίσιμο):** το `drawing:entity-created` εκπέμπεται ΣΥΓΧΡΟΝΑ μέσα στο
 * `appendEntityToScene` αμέσως μετά το `setLevelScene` → το React scene state ΔΕΝ έχει
 * commit-αριστεί ακόμη· σύγχρονο re-sync θα διάβαζε STALE σκηνή. Το rAF τρέχει μετά το commit.
 *
 * @param getEntities — getter των live scene entities (μπορεί να είναι inline arrow· κρατιέται σε ref).
 * @returns σταθερό `refresh()` (το tool το καλεί on activate).
 * @see ../../bim/framing/scene-snap-targets.ts — το κοινό store + collector
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md §3.10
 */

import { useCallback, useEffect, useRef } from 'react';
import type { Entity } from '../../types/entities';
import { EventBus } from '../../systems/events/EventBus';
import { sceneSnapTargetsStore } from '../../bim/framing/scene-snap-targets';

export function useSceneSnapTargetSync(getEntities: () => readonly Entity[]): () => void {
  const getRef = useRef(getEntities);
  getRef.current = getEntities;

  const refresh = useCallback(() => {
    sceneSnapTargetsStore.refresh(getRef.current());
  }, []);

  useEffect(() => {
    let raf = 0;
    const unsub = EventBus.on('drawing:entity-created', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => refresh());
    });
    return () => {
      cancelAnimationFrame(raf);
      unsub();
    };
  }, [refresh]);

  return refresh;
}
