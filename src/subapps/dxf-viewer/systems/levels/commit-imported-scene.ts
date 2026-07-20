/**
 * ADR-635 Φ C.17 — Η ΜΙΑ πόρτα με την οποία μια εισαγόμενη σκηνή μπαίνει σε όροφο (SSoT).
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ: τα δύο import branches (.tek + DXF) στο `useSceneState.handleFileImport`
 * είχαν την ΙΔΙΑ πεντάδα βημάτων copy-pasted (N.18). Κάθε νέο βήμα έπρεπε να γραφτεί δύο
 * φορές — και το layer-identity reconcile θα ήταν το τρίτο τέτοιο δίδυμο. Ζει εδώ μία φορά.
 *
 * ΕΙΝΑΙ ΠΟΛΙΤΙΚΗ ΕΙΣΑΓΩΓΗΣ, όχι state management — γι' αυτό δεν είναι hook: οι εξαρτήσεις
 * περνούν ρητά, ώστε η σειρά των βημάτων να ελέγχεται από test χωρίς React mocking.
 *
 * 🔴 Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ, όχι στυλ:
 *   1. reconcile — ξαναδένει τα layer ids με ό,τι ΗΔΗ κατέχει ο όροφος-ΣΤΟΧΟΣ.
 *   2. setLevelScene — γράφει τη RECONCILED σκηνή.
 *   3. emit — τα per-entity docs first-save-άρουν με τα RECONCILED ids. Αν έπαιρναν τα
 *      ωμά, τα docs θα κρατούσαν νέα ids ενώ το scene τα παλιά: το ίδιο ορφάνιασμα από
 *      την ανάποδη. Κλειδωμένο με test (`commit-imported-scene.test.ts`).
 *   4. capture blocks → 5. link FileRecord → 6. fit-to-extents.
 *
 * @see ./reconcile-scene-layer-identity.ts — το «γιατί» του βήματος 1
 * @see hooks/scene/useSceneState.ts — ο μοναδικός caller
 */

import type { SceneModel } from '../../types/entities';
import type { EntityCreateTargetScope } from '../../bim/persistence/bim-floor-scope';
import { emitImportedEntityCreateEvents } from './emit-imported-entity-create-events';
import { reconcileSceneLayerIdentity } from './reconcile-scene-layer-identity';
import { captureSessionBlocksFromScene } from '../../bim/block-library/capture-session-blocks';
import { markFreshImportFit } from '../zoom/viewport-fit-intent';

export interface CommitImportedSceneDeps {
  /** Ο όροφος-ΣΤΟΧΟΣ (ADR-420 + Φ C.16) — ΟΧΙ ο ενεργός. */
  readonly targetLevelId: string;
  /** Ο ρητός scope των per-entity first-saves (Φ C.16). */
  readonly scope: EntityCreateTargetScope;
  readonly getLevelScene: (levelId: string) => SceneModel | null;
  readonly setLevelScene: (levelId: string, scene: SceneModel) => void;
  /** ADR-526 Φ5a — δένει τον όροφο με το canonical FileRecord (idempotent). */
  readonly linkSceneFileToLevel: () => void;
}

/**
 * Γράφει την εισαγόμενη σκηνή στον όροφο-στόχο, αφού πρώτα ξαναδέσει τα layer ids της
 * με αυτά που ο όροφος ήδη κατέχει, και σκανδαλίζει τα first-saves / block capture /
 * file link / auto-fit — με αυτή τη σειρά.
 */
export function commitImportedScene(imported: SceneModel, deps: CommitImportedSceneDeps): void {
  const { targetLevelId, scope, getLevelScene, setLevelScene, linkSceneFileToLevel } = deps;

  const existing = getLevelScene(targetLevelId);
  const { scene } = reconcileSceneLayerIdentity(imported, existing?.layersById);

  setLevelScene(targetLevelId, scene);
  // ADR-531 Φ5b.2 — χωρίς first-save, το `reconcileLoadedSceneBim` αφαιρεί τα per-entity
  // entities στο πρώτο reload («ο τοίχος/η γραμμοσκίαση εμφανίζεται & εξαφανίζεται»).
  // 2Δ primitives (line/arc/circle/text/dimension) δεν έχουν host → σώζονται με το blob.
  emitImportedEntityCreateEvents(scene.entities, scope);
  // Block Library M1 — «κράτα» τα named blocks στο in-session registry («Τα Blocks μου»).
  captureSessionBlocksFromScene(scene.entities);
  // 🛡️ ROOT-CAUSE FIX (incident 2026-06-08 «hard refresh → χάνεται το σχέδιο») — δέσε τον
  // όροφο με το canonical FileRecord ΤΩΡΑ, όχι μέσω του 2s debounced auto-save (που θα
  // μπορούσε να κόψει PHANTOM id χωρίς `files` doc → κενός καμβάς στο reload).
  linkSceneFileToLevel();
  // Giorgio 2026-07-11 — fresh import → fit-to-extents μέσω του ΕΝΟΣ `useViewportAutoFit`
  // controller (ADR-399), χωρίς imperative double-emit race.
  markFreshImportFit();
}
