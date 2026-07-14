/**
 * ADR-587 Φ10 — Τύποι του `DxfEntityUnion → EntityModel` seam (hit-test / spatial index).
 *
 * Ζουν σε δικό τους module ώστε τα δύο handler packs (`hit-test-model-dxf` /
 * `hit-test-model-bim`) και το registry (`hit-test-entity-model`) να τους μοιράζονται
 * χωρίς κυκλική εξάρτηση.
 */

import type { EntityModel } from '../rendering/types/Types';
import type { DxfEntityUnion } from '../canvas-v2/dxf-canvas/dxf-types';
import type { BaseEntity } from '../types/entities';

/** Τα κοινά πεδία (id/layer/χρώμα/γραμμή) που έχουν ΗΔΗ αναλυθεί πριν το per-type dispatch. */
export type HitTestBaseModel = Omit<BaseEntity, 'type'> & { type: string };

/**
 * Ένας per-type converter. Παίρνει το raw scene entity + το έτοιμο base model και
 * επιστρέφει το `EntityModel` που θα μπει στο spatial index — ΜΕ τα γεωμετρικά πεδία
 * που χρειάζεται ο `BoundsCalculator`. Αν λείψουν, το entity βγαίνει σιωπηλά εκτός
 * index (ούτε hover ούτε κλικ) — η ρίζα του ADR-654 bug.
 */
export type HitTestModelHandler = (entity: DxfEntityUnion, base: HitTestBaseModel) => EntityModel;
