/**
 * Entity Render Surfaces — derived view «ποιος renderable type αποδίδεται σε 2D
 * και/ή 3D» (ADR-550 Φ2).
 *
 * ⚠️ DERIVED, ΟΧΙ SSoT: από το Φ2 η αυθεντία είναι το `ENTITY_RENDER_CONTRACTS`
 * (`entity-render-contract.ts`). Αυτό το αρχείο μένει ως back-compat surface ώστε
 * οι υπάρχοντες consumers (coverage test) να μην αλλάξουν import path. Το
 * `ENTITY_RENDER_SURFACES` παράγεται από το contract — μία πηγή, μηδέν drift.
 *
 * @see entity-render-contract.ts — η αυθεντία (d2/d3/d3Builder)
 * @see __tests__/entity-render-coverage.test.ts — δένει δηλωτικό ↔ ζωντανά dispatchers
 */

import {
  ENTITY_RENDER_CONTRACTS,
  surfacesOf,
} from './entity-render-contract';
import {
  RENDERABLE_ENTITY_TYPES,
  type RenderableEntityType,
} from './renderable-entity-type';

export interface RenderSurfaces {
  /** Αποδίδεται στον 2D καμβά μέσω `EntityRendererComposite`. */
  readonly d2: boolean;
  /** Παράγει 3D mesh/object μέσω `BimSceneLayer` per-family sync. */
  readonly d3: boolean;
}

/**
 * BIM types που είναι ΣΚΟΠΙΜΑ 2D-only (έχουν 2D renderer αλλά κανένα standalone
 * 3D solid). Τεκμηριωμένη εξαίρεση ώστε ο symmetry έλεγχος να μην τα θεωρεί
 * «λείπει 3D». Αν κάποιο αποκτήσει 3D converter → άλλαξε το σε `point`/`bespoke`
 * στο `ENTITY_RENDER_CONTRACTS` και αφαίρεσέ το από εδώ.
 */
export const BIM_2D_ONLY_TYPES: readonly RenderableEntityType[] = [
  'wall-covering',   // ADR-511 — λεπτή επίστρωση στην παρειά· καμία ανεξάρτητη 3D mesh
  'thermal-space',   // ADR-422 — αναλυτικό IfcSpace· χωρίς 3D solid
  'space-separator', // ADR-437 — IfcVirtualElement· καθαρά 2D γραμμή
];

/** Παράγεται από το `ENTITY_RENDER_CONTRACTS` — μην το συντηρείς χειροκίνητα. */
export const ENTITY_RENDER_SURFACES: Readonly<Record<RenderableEntityType, RenderSurfaces>> =
  Object.fromEntries(
    RENDERABLE_ENTITY_TYPES.map((t) => [t, surfacesOf(t)]),
  ) as Record<RenderableEntityType, RenderSurfaces>;

// Compile-time αναφορά ώστε ο consumer να βλέπει ότι το source είναι το contract.
void ENTITY_RENDER_CONTRACTS;
