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

/**
 * ADR-459 Phase 7 — Foreign-floor BIM guard (η write-side συμπληρωματική του
 * `reconcileLoadedSceneBim`). Ένα floor snapshot πρέπει να περιέχει ΜΟΝΟ τα δικά
 * του entities. Cross-level BIM (π.χ. πέδιλο του ορόφου Θεμελίωσης που διέρρευσε
 * προσωρινά στην ενεργή σκηνή) ΔΕΝ πρέπει να «ψηθεί» στο snapshot **άλλου** ορόφου —
 * αλλιώς το multi-floor 3Δ (`useFloors3DAggregator`, που διαβάζει το BIM κάθε ορόφου
 * από το snapshot του) το δείχνει ως «φάντασμα» στον λάθος όροφο, και ο per-entity
 * SSoT (`floorplan_*`) δεν μπορεί να το διαγράψει από εκεί.
 *
 * Αφαιρεί BIM/stair entities με **ορισμένο** `floorId` που **διαφέρει** από τον
 * αποθηκευόμενο όροφο. Κρατά: pure-DXF, own-floor BIM (`floorId === ownFloorId` ή
 * χωρίς `floorId`). **No-op** όταν ο όροφος είναι άγνωστος (`ownFloorId` κενό) ή
 * δεν υπάρχει foreign entity → επιστρέφει το ίδιο reference. Pure + idempotent.
 *
 * @param scene      Το scene προς persist (snapshot).
 * @param ownFloorId Το `Floor.id` του ορόφου που αποθηκεύεται (από το save context).
 */
export function stripForeignFloorBim(
  scene: SceneModel,
  ownFloorId: string | null | undefined,
): SceneModel {
  if (!ownFloorId) return scene;
  const entities = scene.entities.filter((e) => {
    const floorId = (e as { floorId?: string }).floorId;
    return !(isBimOrStairEntity(e) && typeof floorId === 'string' && floorId !== ownFloorId);
  });
  return entities.length === scene.entities.length ? scene : { ...scene, entities };
}

/** True για foundation entities (πέδιλα) — minimal type-tag check. */
function isFoundationLike(entity: Entity): boolean {
  return (entity as { type?: string }).type === 'foundation';
}

/**
 * ADR-484 Slice 5 — Revit-canonical foundation isolation. Τα πέδιλα ζουν **ΜΟΝΟ**
 * στον όροφο Θεμελίωσης. Αφαιρεί ΟΛΑ τα foundation entities από ένα scene — το
 * καλούν οι all-floors aggregators για κάθε **μη-foundation** όροφο, ώστε legacy
 * foundation entities baked σε λάθος blob (π.χ. πεδιλοδοκοί στο Ισόγειο) να μην
 * εμφανίζονται ποτέ. Pure + idempotent· same-reference no-op όταν δεν υπάρχει πέδιλο.
 */
export function stripAllFoundations(scene: SceneModel): SceneModel {
  const entities = scene.entities.filter((e) => !isFoundationLike(e));
  return entities.length === scene.entities.length ? scene : { ...scene, entities };
}

/**
 * ADR-459 Φ7 — αντικαθιστά τα foundation entities (πέδιλα) ενός scene με τα
 * authoritative `modelFootings` που αντλούνται από το model SSoT
 * (`floorplan_foundations`, keyed-by-`floorId`). Τα cross-level auto πέδιλα ΔΕΝ
 * είναι ποτέ στο scene snapshot του ορόφου Θεμελίωσης — άρα οι all-floors aggregators
 * πρέπει να τα ενώσουν από το model ώστε να εμφανιστούν στο «Όλοι οι όροφοι».
 *
 * Πετά ΟΛΑ τα υπάρχοντα foundation entities του scene (stale / drifted-then-stripped)
 * και προσθέτει τα `modelFootings` (dedup-by-id έναντι των non-foundation entities,
 * για να μη διπλασιαστεί ποτέ ένα id). Pure + idempotent· same-reference no-op όταν
 * δεν υπάρχουν footings να αλλάξουν.
 *
 * @param scene         Το scene του ορόφου Θεμελίωσης (μετά από `stripForeignFloorBim`).
 * @param modelFootings Τα πέδιλα από το `floorplan_foundations` (ως scene entities).
 */
export function replaceFootingsFromModel(
  scene: SceneModel,
  modelFootings: readonly Entity[],
): SceneModel {
  const nonFoundations = scene.entities.filter((e) => !isFoundationLike(e));
  // No-op fast-path: κανένα πέδιλο στο scene και κανένα στο model.
  if (nonFoundations.length === scene.entities.length && modelFootings.length === 0) {
    return scene;
  }
  const takenIds = new Set(nonFoundations.map((e) => e.id));
  const footings = modelFootings.filter((f) => !takenIds.has(f.id));
  return { ...scene, entities: [...nonFoundations, ...footings] };
}
