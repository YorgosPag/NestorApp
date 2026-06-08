/**
 * Sanitary fixture connector set — SSoT (ADR-408 plumbing-fixture connect).
 *
 * A Revit "Plumbing Fixture" (WC / washbasin / shower / bathtub / bidet) declares
 * its connectors in its family definition: one sanitary-drainage outlet (always) +
 * the domestic water-supply inlets the kind needs (cold always; hot for everything
 * but a WC). This module is the single source of truth for that set, used by BOTH:
 *   - the placement completion (`mep-fixture-completion.ts`) — new fixtures, and
 *   - the legacy load seed (`mep-connector-seed.ts`) — re-materialise on every load,
 * so the two paths never drift (mirror `buildMepManifoldConnectors` / `buildRadiatorConnectors`).
 *
 * Positions are host-local SCENE units (pre-rotation, the host's `position` space):
 *   - drain → the fixture insertion point (origin, z=0 floor level) — unchanged from Φ14.
 *   - cold / hot supply → the BACK edge, offset left/right so cold/hot/drain never
 *     coincide (snap disambiguation). z=0 (floor-level stubs); a real supply-stub
 *     elevation is a follow-up.
 *
 * @see ../types/mep-connector-types.ts — the connector builders (SSoT shape)
 * @see ../sanitary/sanitary-symbol-spec.ts — SANITARY_SPEC (dims + drain Ø + supply)
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { MepConnector } from '../types/mep-connector-types';
import {
  buildSanitaryDrainConnector,
  buildSanitaryColdWaterConnector,
  buildSanitaryHotWaterConnector,
} from '../types/mep-connector-types';
import { SANITARY_SPEC, type SanitaryKind } from '../sanitary/sanitary-symbol-spec';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';

/** Back-edge offset of the supply stubs as a fraction of the footprint depth. */
const SUPPLY_BACK_DEPTH_FRACTION = 0.4;
/** Left/right split of cold vs hot as a fraction of the footprint width. */
const SUPPLY_SIDE_WIDTH_FRACTION = 0.25;

/**
 * Build the full connector set of a sanitary fixture from its kind + the active
 * scene units. Always emits the sanitary-drainage outlet; adds a cold-water inlet
 * (and a hot-water inlet for kinds that take hot water) per {@link SANITARY_SPEC}.
 * Pure.
 */
export function buildSanitaryFixtureConnectors(
  kind: SanitaryKind,
  sceneUnits: SceneUnits,
): MepConnector[] {
  const spec = SANITARY_SPEC[kind];
  const s = mmToSceneUnits(sceneUnits);
  const backY = spec.depthMm * SUPPLY_BACK_DEPTH_FRACTION * s;
  const sideX = spec.widthMm * SUPPLY_SIDE_WIDTH_FRACTION * s;
  const dia = spec.supply.diameterMm;

  const connectors: MepConnector[] = [
    buildSanitaryDrainConnector({ x: 0, y: 0, z: 0 }, spec.drainDiameterMm),
  ];
  if (spec.supply.cold && spec.supply.hot) {
    // Cold left, hot right — distinct points so a snapped pipe targets the right port.
    connectors.push(buildSanitaryColdWaterConnector({ x: -sideX, y: backY, z: 0 }, dia));
    connectors.push(buildSanitaryHotWaterConnector({ x: sideX, y: backY, z: 0 }, dia));
  } else if (spec.supply.cold) {
    // Cold-only (WC): a single back-centre stub.
    connectors.push(buildSanitaryColdWaterConnector({ x: 0, y: backY, z: 0 }, dia));
  }
  return connectors;
}
