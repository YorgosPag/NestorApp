/**
 * @fileoverview **Ο ΓΡΑΦΟΣ ΤΗΣ ΠΕΡΙΗΓΗΣΗΣ** — αναλλοίωτα κόμβων/ορόφων + η μία πράξη αφαίρεσης κόμβου.
 * @related ADR-884 §8.1 Φ0.2 (αναλλοίωτα #4, #5, όριο κόμβων) · Ε6
 * @module lib/spatial-tour/spatial-tour-graph
 *
 * Οι κόμβοι ζουν ως **πίνακας** στο ίδιο έγγραφο (Ε6) ακριβώς ώστε ο γράφος να αλλάζει **ατομικά**.
 * Αυτό έχει νόημα μόνο αν κάθε εγγραφή **περνά από εδώ**: ο διακομιστής καλεί `checkTourGraph` πριν
 * γράψει, και αφαιρεί κόμβο **μόνο** με `removeTourNode` — ποτέ ορφανός σύνδεσμος σε ενδιάμεση κατάσταση.
 *
 * Ονομασμένες παραβάσεις, ποτέ boolean: κάθε μία λέει **τι** να διορθωθεί.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις.
 */

import { MAX_TOUR_NODES } from '@/constants/spatial-tour-vocabulary';
import type { SpatialTour, TourLevelKey, TourNode } from '@/types/spatial-tour';

export type TourGraphViolation =
  | { readonly kind: 'too-many-nodes'; readonly count: number }
  | { readonly kind: 'duplicate-node-id'; readonly nodeId: string }
  | { readonly kind: 'dangling-link'; readonly fromNodeId: string; readonly toNodeId: string }
  | { readonly kind: 'self-link'; readonly nodeId: string }
  | { readonly kind: 'node-on-unknown-level'; readonly nodeId: string }
  | { readonly kind: 'duplicate-level'; readonly levelKey: string }
  | { readonly kind: 'active-floor-plan-count'; readonly levelKey: string; readonly activeCount: number }
  | { readonly kind: 'floor-plan-file-mismatch'; readonly levelKey: string };

/** Ταυτότητα ορόφου ως κείμενο — για σύγκριση και για το μήνυμα της παράβασης. */
export function levelKeyId(key: TourLevelKey): string {
  return key.kind === 'floor' ? `floor:${key.floorId}` : `local:${key.ordinal}`;
}

/** #4 — ακριβώς ένα `active` ανά όροφο· `fileId === null` ⇔ πηγή `none`. */
function levelViolations(levels: SpatialTour['levels']): TourGraphViolation[] {
  const out: TourGraphViolation[] = [];
  const seen = new Set<string>();
  for (const level of levels) {
    const levelKey = levelKeyId(level.key);
    if (seen.has(levelKey)) out.push({ kind: 'duplicate-level', levelKey });
    seen.add(levelKey);
    const activeCount = level.floorPlans.filter((plan) => plan.state === 'active').length;
    if (activeCount !== 1) out.push({ kind: 'active-floor-plan-count', levelKey, activeCount });
    if (level.floorPlans.some((plan) => (plan.fileId === null) !== (plan.source === 'none'))) {
      out.push({ kind: 'floor-plan-file-mismatch', levelKey });
    }
  }
  return out;
}

/** #5 — κάθε σύνδεσμος δείχνει σε κόμβο του **ίδιου** πίνακα· κάθε κόμβος σε δηλωμένο όροφο. */
function nodeViolations(tour: Pick<SpatialTour, 'nodes' | 'levels'>): TourGraphViolation[] {
  const out: TourGraphViolation[] = [];
  const levelKeys = new Set(tour.levels.map((level) => levelKeyId(level.key)));
  const nodeIds = new Set<string>();
  for (const node of tour.nodes) {
    if (nodeIds.has(node.id)) out.push({ kind: 'duplicate-node-id', nodeId: node.id });
    nodeIds.add(node.id);
    if (!levelKeys.has(levelKeyId(node.levelKey))) out.push({ kind: 'node-on-unknown-level', nodeId: node.id });
  }
  for (const node of tour.nodes) {
    for (const link of node.links) {
      if (link.toNodeId === node.id) out.push({ kind: 'self-link', nodeId: node.id });
      else if (!nodeIds.has(link.toNodeId)) {
        out.push({ kind: 'dangling-link', fromNodeId: node.id, toNodeId: link.toNodeId });
      }
    }
  }
  return out;
}

/** **Ο έλεγχος πριν από κάθε εγγραφή του γράφου.** Κενός πίνακας ⇒ έγκυρος. */
export function checkTourGraph(tour: Pick<SpatialTour, 'nodes' | 'levels'>): TourGraphViolation[] {
  const out: TourGraphViolation[] = [];
  if (tour.nodes.length > MAX_TOUR_NODES) out.push({ kind: 'too-many-nodes', count: tour.nodes.length });
  return [...out, ...levelViolations(tour.levels), ...nodeViolations(tour)];
}

/**
 * **Η μόνη πράξη αφαίρεσης κόμβου** (#5): φεύγει ο κόμβος **και** κάθε εισερχόμενος σύνδεσμος, στον ίδιο
 * νέο πίνακα. Ιδεμποτική: ανύπαρκτος κόμβος ⇒ ίδιος γράφος.
 */
export function removeTourNode(nodes: readonly TourNode[], nodeId: string): TourNode[] {
  return nodes
    .filter((node) => node.id !== nodeId)
    .map((node) =>
      node.links.some((link) => link.toNodeId === nodeId)
        ? { ...node, links: node.links.filter((link) => link.toNodeId !== nodeId) }
        : node,
    );
}
