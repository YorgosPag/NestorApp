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

import { MAX_TOUR_NODES, MAX_TOUR_SEPARATIONS_PER_LEVEL, MAX_TOUR_SPACES_PER_LEVEL } from '@/constants/spatial-tour-vocabulary';
import type { SpatialTour, TourLevel, TourLevelKey, TourNode } from '@/types/spatial-tour';

export type TourGraphViolation =
  | { readonly kind: 'too-many-nodes'; readonly count: number }
  | { readonly kind: 'duplicate-node-id'; readonly nodeId: string }
  | { readonly kind: 'dangling-link'; readonly fromNodeId: string; readonly toNodeId: string }
  | { readonly kind: 'self-link'; readonly nodeId: string }
  | { readonly kind: 'node-on-unknown-level'; readonly nodeId: string }
  | { readonly kind: 'duplicate-level'; readonly levelKey: string }
  | { readonly kind: 'active-floor-plan-count'; readonly levelKey: string; readonly activeCount: number }
  | { readonly kind: 'floor-plan-file-mismatch'; readonly levelKey: string }
  // ── Γ3β: σχήματα χώρων ανά όροφο ──
  | { readonly kind: 'too-many-shapes'; readonly levelKey: string }
  | { readonly kind: 'duplicate-shape-id'; readonly shapeId: string };

/** Ταυτότητα ορόφου ως κείμενο — για σύγκριση και για το μήνυμα της παράβασης. */
export function levelKeyId(key: TourLevelKey): string {
  return key.kind === 'floor' ? `floor:${key.floorId}` : `local:${key.ordinal}`;
}

/**
 * **Η σειρά ενός ορόφου** (κάτω → πάνω): τοπικός ⇒ ο αριθμός του· BIM ⇒ η θέση δήλωσης (το υψόμετρο ζει στο BIM — Φ3).
 * Ο **ένας** κανόνας για θεατή, εισερχόμενα και την εφαρμογή λήψης (ADR-904 Κ8) — αλλιώς «Όροφος 2» σε δύο οθόνες = δύο όροφοι.
 */
export function tourLevelOrdinal(key: TourLevelKey, index: number): number {
  return key.kind === 'local' ? key.ordinal : index;
}

/** Ένας όροφος όπως τον χρειάζεται όποιος **διαλέγει** όροφο — κλειδί, σειρά, ετικέτα (`null` ⇒ «Όροφος {n}»). */
export interface TourLevelChoice {
  readonly key: TourLevelKey;
  readonly ordinal: number;
  /** Το όνομα ορόφου BIM θα έρθει με τη σύνδεση στο μοντέλο — δεν επινοείται εδώ. */
  readonly label: string | null;
}

/** **Οι όροφοι της περιήγησης ως επιλογές** — η ΜΙΑ προβολή (θεατής · εισερχόμενα · λίστα λήψης Κ7). */
export function tourLevelChoices(levels: readonly Pick<TourLevel, 'key'>[]): TourLevelChoice[] {
  return levels.map((level, index) => ({ key: level.key, ordinal: tourLevelOrdinal(level.key, index), label: null }));
}

/** **Ο όροφος με αυτό το κλειδί** — η μία αναζήτηση (ήταν αντίγραφο σε εντολές κάτοψης και αντίστροφες). */
export function findTourLevel<L extends Pick<TourLevel, 'key'>>(levels: readonly L[] | undefined, key: TourLevelKey): L | undefined {
  const id = levelKeyId(key);
  return levels?.find((level) => levelKeyId(level.key) === id);
}

/** Γ3β — όρια ανά όροφο και μοναδικά id χώρων/γραμμών σε **όλη** την περιήγηση. */
function shapeViolations(levels: SpatialTour['levels']): TourGraphViolation[] {
  const out: TourGraphViolation[] = [];
  const ids = new Set<string>();
  for (const level of levels) {
    const spaces = level.spaces ?? [];
    const separations = level.separations ?? [];
    if (spaces.length > MAX_TOUR_SPACES_PER_LEVEL || separations.length > MAX_TOUR_SEPARATIONS_PER_LEVEL) {
      out.push({ kind: 'too-many-shapes', levelKey: levelKeyId(level.key) });
    }
    for (const { id } of [...spaces, ...separations]) {
      if (ids.has(id)) out.push({ kind: 'duplicate-shape-id', shapeId: id });
      ids.add(id);
    }
  }
  return out;
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
  return [...out, ...levelViolations(tour.levels), ...shapeViolations(tour.levels), ...nodeViolations(tour)];
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
