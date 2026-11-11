/**
 * **Εξωτερικοί τοίχοι** = όσοι ανήκουν σε αλυσίδα κελύφους (spec-free perimeter, `computeEnvelopePerimeter`).
 *
 * Εξήχθη από το `hooks/data/useHeatLoadInputs.ts` (ADR-937 Φάση Β) — το ίδιο ερώτημα «ποιος τοίχος βλέπει έξω;» το
 * κάνουν πλέον δύο καταναλωτές: τα θερμικά φορτία (ADR-422) και η πρόταση προσανατολισμού ακινήτου. Μία απάντηση.
 *
 * `resolveExteriorEnvelope` δίνει **και** τις αλυσίδες (το `exteriorFaceLoop` τους είναι το όριο του ακινήτου σε κάτοψη
 * ακινήτου, ADR-937 §2.2) **και** τα id των τοίχων τους, από **έναν** υπολογισμό κελύφους.
 */

import { computeEnvelopePerimeter, type EnvelopeChain, type WallForEnvelope } from './envelope-perimeter';
import type { SceneUnits } from '../../utils/scene-units';

export interface ExteriorEnvelope {
  readonly chains: readonly EnvelopeChain[];
  readonly wallIds: ReadonlySet<string>;
}

export function resolveExteriorEnvelope(
  walls: readonly WallForEnvelope[],
  sceneUnits: SceneUnits,
): ExteriorEnvelope {
  const { chains } = computeEnvelopePerimeter(walls, 0, sceneUnits);
  const wallIds = new Set<string>();
  for (const chain of chains) for (const id of chain.wallIds) wallIds.add(id);
  return { chains, wallIds };
}

export function resolveExteriorWallIds(
  walls: readonly WallForEnvelope[],
  sceneUnits: SceneUnits,
): Set<string> {
  return new Set(resolveExteriorEnvelope(walls, sceneUnits).wallIds);
}
