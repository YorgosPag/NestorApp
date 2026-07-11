/**
 * ADR-635 Φ C.8 / ADR-531 Φ5b.6 — Imported-scene per-entity first-save emitter (SSoT).
 *
 * ΓΙΑΤΙ: Τα per-entity-persisted entities (BIM/stair/hatch — `isPerEntityPersistedEntity`)
 * ζωγραφίζονται στο scene blob, αλλά η **SSoT** τους είναι το per-entity Firestore doc
 * (`floorplan_*`). Στο load, το `reconcileLoadedSceneBim` (scene-bim-load-policy) πετά το
 * blob-copy ως παράγωγο cache και τα ξαναγεμίζει ΜΟΝΟ από τα per-entity docs. Άρα, μετά
 * από **import**, κάθε τέτοιο entity ΠΡΕΠΕΙ να first-save-άρει το doc του — αλλιώς
 * εξαφανίζεται στο πρώτο reload (incident: imported AutoCAD hatches «χάνονται μετά την
 * εισαγωγή» — 6 dumb-DXF μένουν, 9 hatches φεύγουν).
 *
 * Το first-save σκανδαλίζεται από `drawing:entity-created {tool}` — ο default createTrigger
 * του `createBimEntityPersistenceHook` (ADR-594) είναι `{ tool: entityType }` όπου
 * `entityType === entity.type` ΠΑΝΤΑ (ο hook επιπλέον φιλτράρει `entity.type === entityType`),
 * και ο hatch έχει explicit extraCreateTrigger `{ tool: 'hatch' }` (ADR-507). Επομένως
 * `tool: entity.type` είναι καθολικά σωστό. Αυτός ο emitter είναι ο **ΕΝΑΣ** κοινός δρόμος
 * και για .tek ΚΑΙ για DXF import (N.18 — μία υλοποίηση, όχι δύο δίδυμα loops).
 *
 * Iteration order = scene order → διατηρεί το host-first ordering που απαιτούν τα refs
 * (π.χ. τοίχος ΠΡΙΝ το κούφωμα, `opening.wallId`). Pure side-effect (EventBus emit)·
 * idempotent στο DB (setDoc + σταθερό entity id).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-635-autocad-dxf-import-entity-coverage.md
 * @see docs/centralized-systems/reference/adrs/ADR-390-symmetric-bim-delete-undo.md (Phase 4)
 * @see systems/levels/scene-bim-load-policy.ts — `reconcileLoadedSceneBim` / `isPerEntityPersistedEntity`
 */

import type { AnySceneEntity } from '../../types/entities';
import { EventBus } from '../events';
import { isPerEntityPersistedEntity } from './scene-bim-load-policy';

/**
 * Για κάθε imported entity με per-entity Firestore persistence (SSoT) εκπέμπει
 * `drawing:entity-created` ώστε ο αντίστοιχος persistence hook να first-save-άρει το
 * doc του. Pure-DXF primitives (line/arc/circle/text/dimension) αγνοούνται — ζουν ΜΟΝΟ
 * στο scene blob και δεν έχουν per-entity host.
 *
 * @param entities Τα entities της εισαγόμενης σκηνής (scene order — ΜΗΝ ανακατεύεις).
 */
export function emitImportedEntityCreateEvents(entities: readonly AnySceneEntity[]): void {
  for (const entity of entities) {
    if (isPerEntityPersistedEntity(entity)) {
      EventBus.emit('drawing:entity-created', { entity, tool: entity.type });
    }
  }
}
