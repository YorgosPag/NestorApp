/**
 * Scene BIM load policy (ADR-390 Phase 4 — active-floor SSoT load).
 *
 * ΓΙΑΤΙ: Τα BIM entities έχουν **dual persistence** — (α) per-entity Firestore
 * collections (`floorplan_*`) = **SSoT**, (β) ολόκληρο το scene σειριοποιείται στο
 * DXF JSON snapshot (`.scene.json`) μέσω `autoSaveV2` = **παράγωγο cache** (βλ.
 * `hooks/scene/scene-write-origin.ts`). Στο load του active floor ζωγραφίζει το
 * snapshot, οπότε **stale BIM state του snapshot νικά** τα authoritative per-entity
 * docs (π.χ. κολόνα `attached` στο snapshot ενώ το DB doc είναι `storey-ceiling`).
 *
 * Πολιτική: στο apply ενός φορτωμένου scene, **πέτα το BIM του snapshot** (παράγωγο
 * cache) και κράτα μόνο τα pure-DXF entities· τα per-entity subscriptions
 * (`useXPersistence`) θα γεμίσουν το BIM από το DB (SSoT). **Διατήρησε** όποιο BIM
 * υπάρχει ΗΔΗ in-memory (από subscription που πρόλαβε πριν το load) ώστε να μη χαθεί
 * (anti-clobber / anti-vanish — N.7.2 belt-and-suspenders).
 *
 * Το snapshot ΔΕΝ αλλάζει στο save: το multi-floor 3Δ (ADR-399,
 * `useFloors3DAggregator`) διαβάζει το BIM **άλλων** floors από τα snapshots τους.
 * Αυτή η πολιτική αφορά ΜΟΝΟ το load του **active** floor.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-390-symmetric-bim-delete-undo.md (Phase 4)
 * @see hooks/scene/scene-write-origin.ts — «per-entity docs = SSoT, scene blob = cache»
 */

import type { SceneModel } from '../../types/scene';
import type { Entity } from '../../types/entities';
import { isBimEntity, isStairEntity } from '../../types/entities';

/**
 * True για κάθε BIM/parametric entity που έχει δικό του per-entity persistence
 * (SSoT). `isBimEntity` ΔΕΝ καλύπτει `'stair'` (ADR-358, χωριστό union) — ο stair
 * έχει επίσης per-entity persistence (`bim/hooks/use-stair-persistence`), οπότε
 * τον προσθέτουμε ρητά.
 */
export function isBimOrStairEntity(entity: Entity): boolean {
  return isBimEntity(entity) || isStairEntity(entity);
}

/**
 * Συνδυάζει ένα φρεσκο-φορτωμένο scene (snapshot) με την τρέχουσα in-memory σκηνή:
 * κρατά τα pure-DXF entities του snapshot + το ΗΔΗ-υπάρχον in-memory BIM (αν υπάρχει),
 * πετώντας το (πιθανώς stale) BIM του snapshot. Pure + idempotent.
 *
 * @param loaded   Το scene όπως φορτώθηκε από το `.scene.json` snapshot.
 * @param existing Η τρέχουσα in-memory σκηνή (ή null αν δεν υπάρχει ακόμη).
 */
export function reconcileLoadedSceneBim(
  loaded: SceneModel,
  existing: SceneModel | null,
): SceneModel {
  const dxfOnly = loaded.entities.filter((e) => !isBimOrStairEntity(e));
  const preservedBim = existing
    ? existing.entities.filter((e) => isBimOrStairEntity(e))
    : [];
  // Dedup-by-id ασφάλεια: αν για κάποιο λόγο ένα preserved BIM id υπάρχει και ως
  // DXF (δεν θα έπρεπε), το DXF προηγείται· το preserved BIM φιλτράρεται.
  const dxfIds = new Set(dxfOnly.map((e) => e.id));
  const preserved = preservedBim.filter((e) => !dxfIds.has(e.id));
  return { ...loaded, entities: [...dxfOnly, ...preserved] };
}
