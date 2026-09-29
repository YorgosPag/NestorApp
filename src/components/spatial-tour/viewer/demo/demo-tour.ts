/**
 * @fileoverview **ΕΙΚΟΝΙΚΗ ΠΕΡΙΗΓΗΣΗ** — η έξοδος της Φ1 «θεατής με εικονικά δεδομένα» (ADR-884 §8 · §4.8). Τη χρησιμοποιούν
 * το `/test-harness/tour-viewer` και οι άγκυρες RTL — **μία** πηγή, ώστε ό,τι βλέπει ο άνθρωπος να είναι ό,τι ελέγχει το test.
 * @module components/spatial-tour/viewer/demo/demo-tour
 *
 * Σχήμα: ισόγειο **με** κάτοψη (τετράγωνο 4×3 m, τέσσερις κόμβοι, **διαφορετικές** κατευθύνσεις λήψης ώστε να φαίνεται ότι
 * η ευθυγράμμιση δουλεύει) + όροφος **χωρίς** κάτοψη (δύο κόμβοι, `position: null` — ADR-884 Δ5 `none`), με σκάλα g2 ↔ u1.
 * Ένας κόμβος (`ghost`) δεν έχει στάση: ο θεατής **δεν** πρέπει να τον προσφέρει.
 * ⚠️ Ετικέτες ορόφων `null` επίτηδες (N.11 — καμία ελληνική λέξη σε `.ts`): ο θεατής δείχνει «Όροφος {n}».
 */

import { degToRad } from '@/lib/geometry/angle';
import type { TourViewerLevel } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import type { TourManifest } from '@/server/spatial-tour/tour-view-session';
import type { TourLevelKey, TourNode } from '@/types/spatial-tour';

const GROUND: TourLevelKey = { kind: 'floor', floorId: 'demo_ground' };
const UPPER: TourLevelKey = { kind: 'floor', floorId: 'demo_upper' };

function demoNode(id: string, levelKey: TourLevelKey, position: TourNode['position'], links: readonly string[]): TourNode {
  return { id, levelKey, position, links: links.map((toNodeId) => ({ toNodeId, via: 'manual' as const, bearingRad: null })) };
}

const HEADINGS_DEG: Readonly<Record<string, number>> = { g1: 0, g2: 90, g3: 200, g4: 315, u1: 45, u2: 0 };

export const DEMO_TOUR_LEVELS: readonly TourViewerLevel[] = [
  { key: UPPER, label: null, ordinal: 1 },
  { key: GROUND, label: null, ordinal: 0 },
];

export const DEMO_TOUR_MANIFEST: TourManifest = {
  tourId: 'stour_demo',
  label: null,
  levels: DEMO_TOUR_LEVELS,
  nodes: [
    demoNode('g1', GROUND, { x: 0, y: 0, z: 1.6 }, ['g2', 'g4']),
    demoNode('g2', GROUND, { x: 4, y: 0, z: 1.6 }, ['g3', 'u1']),
    demoNode('g3', GROUND, { x: 4, y: 3, z: 1.6 }, ['g4', 'ghost']),
    demoNode('g4', GROUND, { x: 0, y: 3, z: 1.6 }, []),
    demoNode('ghost', GROUND, { x: 2, y: 5, z: 1.6 }, []),
    demoNode('u1', UPPER, null, ['u2']),
    demoNode('u2', UPPER, null, []),
  ],
  stops: Object.entries(HEADINGS_DEG).map(([nodeId, heading]) => ({
    captureId: `tcap_demo_${nodeId}`,
    nodeId,
    capturedAt: '2026-09-27T09:00:00.000Z',
    headingRad: degToRad(heading),
    tilesetHash: `demo_${nodeId}`,
    faceSize: 1024,
  })),
  ready: true,
  spaceAreaDisplay: 'shown',
};
