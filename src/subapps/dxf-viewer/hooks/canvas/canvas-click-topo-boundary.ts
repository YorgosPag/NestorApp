/**
 * ADR-650 M6 (Γ) — «Όριο οικοπέδου»: ΕΝΑ κλικ σε κλειστή γραμμή του σχεδίου την ορίζει ως
 * όριο υπολογισμού όγκων· ξανά-κλικ στην ίδια → την αφαιρεί (toggle, ίδιο idiom με τις
 * breaklines του M2-Β).
 *
 * Ζει σε δικό του module — το `canvas-click-tool-handlers.ts` είναι στα 448/500 (N.7.1) και ο
 * κανόνας λέει EXTRACT, ποτέ trim. Το wiring παραμένει ΕΝΑ branch στο `useCanvasClickHandler`.
 *
 * Ο πυρήνας (ποια οντότητα κάνει για όριο, τι ρινγκ βγαίνει) ζει στο pure
 * `systems/topography/topo-boundary-pick` — εδώ μένουν μόνο pick + store + μήνυμα.
 */

import type { Point2D } from '../../rendering/types/Types';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { pickTopEntityAt } from '../../rendering/hitTesting/pick-top-entity-at';
import {
  buildBoundaryFromEntity,
  isBoundaryCandidate,
} from '../../systems/topography/topo-boundary-pick';
import { getTopoBoundary, setTopoBoundary } from '../../systems/topography/TopoPointStore';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import { i18n } from '@/i18n';
import { dlog } from '../../debug';
import type { UseCanvasClickHandlerParams } from './canvas-click-types';

const TOPO_BOUNDARY_NS = 'dxf-viewer-shell';

/** Status-prompt του εργαλείου (ίδιο pattern με το breakline hint). */
function setTopoBoundaryHint(key: string): void {
  toolHintOverrideStore.setOverride(i18n.t(`topoBoundary.status.${key}`, { ns: TOPO_BOUNDARY_NS }));
}

/**
 * Καταναλώνει ΠΑΝΤΑ το κλικ (ώστε να μην πέσει στο unified drawing/selection) και επιστρέφει
 * `true`. Αστοχία pick → μήνυμα, ποτέ σιωπή.
 */
export function handleTopoBoundaryClick(
  worldPoint: Point2D,
  p: UseCanvasClickHandlerParams,
): boolean {
  const levelId = p.levelManager.currentLevelId;
  const entities = levelId ? p.levelManager.getLevelScene(levelId)?.entities ?? [] : [];
  if (entities.length === 0) {
    setTopoBoundaryHint('awaitingEntity');
    return true;
  }

  // ADR-040 XXII.A: live SSoT scale read at click time (ίδια ανοχή με τα υπόλοιπα picks).
  const tolerance = TOLERANCE_CONFIG.SNAP_DEFAULT / getImmediateTransform().scale;
  // Opt-in enclosure pick (ADR-650 M6): κλικ ΠΑΝΩ στη γραμμή Ή ΜΕΣΑ στο κλειστό όριο το επιλέγει.
  // Η γενική επιλογή/hover μένει stroke-only (big-player· ισοϋψείς δεν καταπίνονται).
  const entityId = pickTopEntityAt(worldPoint, entities, isBoundaryCandidate, tolerance, { includeEnclosure: true });
  if (!entityId) {
    setTopoBoundaryHint('awaitingEntity');
    return true;
  }

  // Toggle: το ίδιο περίγραμμα ξανά → καθαρίζει (οι όγκοι ξαναμετρούν όλη την αποτύπωση).
  if (getTopoBoundary()?.sourceEntityId === entityId) {
    setTopoBoundary(null);
    p.universalSelection.replaceEntitySelection([]);
    setTopoBoundaryHint('removed');
    return true;
  }

  const entity = entities.find((e) => e.id === entityId);
  const boundary = entity ? buildBoundaryFromEntity(entity) : null;
  if (!boundary) {
    setTopoBoundaryHint('notClosed');
    return true;
  }

  setTopoBoundary(boundary);
  p.universalSelection.replaceEntitySelection([entityId]);
  setTopoBoundaryHint('added');
  dlog('handleTopoBoundaryClick', `boundary from ${entityId} (${boundary.vertices.length} verts)`);
  return true;
}
