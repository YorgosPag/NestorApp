/**
 * **Εξωτερικοί τοίχοι** = όσοι ανήκουν σε αλυσίδα κελύφους (spec-free perimeter, `computeEnvelopePerimeter`).
 *
 * Εξήχθη από το `hooks/data/useHeatLoadInputs.ts` (ADR-937 Φάση Β) — το ίδιο ερώτημα «ποιος τοίχος βλέπει έξω;» το
 * κάνουν πλέον δύο καταναλωτές: τα θερμικά φορτία (ADR-422) και η πρόταση προσανατολισμού ακινήτου. Μία απάντηση.
 */

import { computeEnvelopePerimeter, type WallForEnvelope } from './envelope-perimeter';
import type { SceneUnits } from '../../utils/scene-units';

export function resolveExteriorWallIds(
  walls: readonly WallForEnvelope[],
  sceneUnits: SceneUnits,
): Set<string> {
  const { chains } = computeEnvelopePerimeter(walls, 0, sceneUnits);
  const set = new Set<string>();
  for (const chain of chains) for (const id of chain.wallIds) set.add(id);
  return set;
}
