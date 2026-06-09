/**
 * Heating boiler 2D symbol SSoT (ADR-408 Εύρος Β #2).
 *
 * Single source of truth for the *vector* symbol of a boiler (λέβητας), consumed by
 * the 2D renderer. Pure + geometry-driven: it reads the already-computed (rotated)
 * footprint and emits the cabinet outline, a distinctive boiler glyph (horizontal
 * divider + upward-triangle flame/burner mark), and one stub PER embedded connector.
 *
 * Connector stubs are CONNECTOR-DRIVEN (FULL SSOT): instead of hardcoding supply/return,
 * the symbol loops over `buildBoilerConnectors(params)` — the SAME source of truth that
 * seeds the boiler's real connectors — and resolves each one's world position via
 * `connectorWorldPosition` (rotation-aware, the shared SSoT). So EVERY connector (the
 * hydronic supply/return pair, the combi DHW hot/cold/recirc ports, the gas/oil flue,
 * and any future port) is automatically drawn in plan at its true position — zero drift.
 * Each connector DOMAIN gets its own unmistakable read: pipes draw plain stubs, the
 * combustion flue (`domain:'duct'`) a vent glyph (stub + chevron + terminal cap), and the
 * fuel inlet (`domain:'fuel'`) a gas-cock isolation-valve glyph (stub + bow-tie + lever).
 *
 * Glyph design:
 *   - A horizontal divider line across the body ~40% from the bottom — visually
 *     separates the combustion chamber from the expansion vessel / flue section.
 *   - An upward-pointing triangle centred just below the divider (~25% body size)
 *     representing the burner flame. This distinguishes the boiler from the
 *     radiator (which uses parallel fin bars) at a glance.
 *
 * All coordinates are in world canvas units (same space as the footprint), so the
 * renderer just strokes them after applying its transform.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { Point3D } from '../types/bim-base';
import type {
  MepBoilerGeometry,
  MepBoilerParams,
} from '../types/mep-boiler-types';
import { DEFAULT_BOILER_SERVICE_CLEARANCE_MM } from '../types/mep-boiler-types';
import { connectorWorldPosition } from '../types/mep-connector-types';
import type {
  PlumbingSystemClassification,
  DuctSystemClassification,
} from '../types/mep-connector-types';
import { buildBoilerConnectors } from './mep-boiler-geometry';
import { buildFlueTerminalGlyph, DEFAULT_FLUE_TERMINATION } from './boiler-flue-terminal';
import { mmToSceneUnits } from '../../utils/scene-units';
import {
  buildClearanceOutline,
  buildDividerStroke,
  buildFlameStrokes,
  buildSafetyValveGlyph,
  buildExpansionVesselGlyph,
  buildPressureGaugeGlyph,
  buildFlueVentStroke,
  buildFuelCockStroke,
  buildCondensateTrapStroke,
  buildCondensateNeutraliserStroke,
} from './mep-boiler-symbol-glyphs';
import type { BoilerStroke } from './mep-boiler-symbol-glyphs';

export type { BoilerStroke } from './mep-boiler-symbol-glyphs';

/**
 * A connector stub polyline tagged with its System Classification (Revit color-coded MEP
 * plan). The symbol stays pure geometry + classification data — it carries NO colours; the
 * renderer resolves the colour from the classification via the `resolveSegmentClassificationColor`
 * SSoT (`mep-system-color.ts`). `classification` is `undefined` when the SSoT does not cover
 * the connector's domain (e.g. the `fuel` domain) — the renderer then falls back to its
 * default boiler stroke. Covers the plumbing classifications (supply/return, DHW hot/cold,
 * drainage) and the duct `exhaust` classification (the flue).
 */
export interface ClassifiedBoilerStroke {
  readonly line: BoilerStroke;
  readonly classification?: PlumbingSystemClassification | DuctSystemClassification;
}

export interface BoilerSymbolGeometry {
  /** Closed outline polygon (= the footprint). */
  readonly outline: readonly Point3D[];
  /**
   * Connector stub strokes — one straight stub per PIPE connector: the water/pipe ports
   * (`domain:'pipe'`) only (the hydronic supply/return pair + any combi DHW hot/cold/recirc
   * ports). The combustion flue (`domain:'duct'`) and the fuel inlet (`domain:'fuel'`) get
   * their own distinct glyphs in `ventStrokes` / `fuelStrokes`. Connector-driven from
   * `buildBoilerConnectors`; order follows it: supply outlet, return inlet, any combi DHW ports.
   * Each stub carries its plumbing System Classification so the renderer colours it per Revit
   * convention (supply red, return blue, DHW hot red / cold blue, drainage brown).
   */
  readonly strokes: readonly ClassifiedBoilerStroke[];
  /**
   * Vent/duct connector glyph strokes — per `domain:'duct'` connector (the gas/oil
   * combustion flue / καπναγωγός): a stub + chevron arrowhead, PLUS the vent-terminal
   * cap glyph at the chevron tip (καμινάδα, per `flueTermination`). Kept separate from
   * `strokes` so the renderer can give the exhaust duct a distinct read. Each glyph stroke
   * carries the duct classification (`exhaust`) so the renderer colours the flue grey.
   */
  readonly ventStrokes: readonly ClassifiedBoilerStroke[];
  /**
   * Fuel-supply connector glyph strokes — per `domain:'fuel'` connector (the gas/oil
   * combustion fuel inlet / τροφοδοσία καυσίμου): a stub capped with a gas-cock isolation
   * valve glyph (bow-tie «▷◁» plug valve + a short operating lever). Kept separate from
   * `strokes` so the piped fuel line reads distinctly from the water pipes and the exhaust
   * duct — every connector domain has its own unmistakable symbol in plan (Revit-grade).
   */
  readonly fuelStrokes: readonly BoilerStroke[];
  /**
   * Boiler glyph strokes — drawn with a thin line.
   *   [0] horizontal divider across the body
   *   [1..3] upward triangle (burner/flame mark, 3 sides as separate strokes)
   */
  readonly glyphStrokes: readonly BoilerStroke[];
  /**
   * Optional service-clearance envelope (Revit Mechanical Equipment «Clearances») — the
   * footprint rectangle offset uniformly outward by the clearance distance. Present only
   * when `params.showServiceClearance` is set; the renderer + placement ghost stroke it
   * DASHED (a «keep-clear» maintenance-access zone). Closed 4-vertex polygon in world
   * units, rotation-aware. Absent ⇒ no clearance drawn (back-compat).
   */
  readonly clearanceOutline?: readonly Point3D[];
}

/** Below this magnitude the outward direction is treated as degenerate (skip the stub). */
const MIN_OUTWARD_LEN = 1e-6;

/**
 * Build the boiler symbol geometry from params + computed geometry. Rectangular
 * cabinet → a divider + flame glyph plus ONE stub per embedded connector, all
 * rotation-aware because both the footprint and the connectors are resolved into world.
 *
 * Connector stubs are derived from `buildBoilerConnectors(params)` — the SSoT that seeds
 * the boiler's real connectors — so the plan symbol always matches the actual ports:
 *   - `domain:'pipe'` (supply outlet +X, return inlet −X, and any combi DHW hot/cold/recirc
 *     corners) → a straight stub from the connector's world position pointing outward (the
 *     normalised connector offset). Supply/return reproduce EXACTLY their prior geometry
 *     (supply at +X edge midpoint, return at −X edge midpoint) — regression-free.
 *   - `domain:'duct'` (the gas/oil combustion flue) → a distinct vent glyph (stub + chevron).
 *
 * NOTE: supply is at the +X end (flow:'out' → sources hydronic supply) and return at the
 * −X end (flow:'in') — REVERSED vs the radiator (which has supply at −X end).
 */
export function buildMepBoilerSymbol(
  params: MepBoilerParams,
  geometry: MepBoilerGeometry,
): BoilerSymbolGeometry {
  const outline = geometry.footprint.vertices;
  if (outline.length !== 4) {
    return { outline, strokes: [], ventStrokes: [], fuelStrokes: [], glyphStrokes: [] };
  }

  // v0=(-hw,-hl) v1=(hw,-hl) v2=(hw,hl) v3=(-hw,hl) — rotated to world.
  const [v0, v1, v2, v3] = outline;
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const stubLen = Math.max(params.length * s * 0.8, 60 * s);

  // Connector-driven stubs (FULL SSOT): one stub per real connector, at its true world
  // position. `connectorWorldPosition` = hostPosition + R·localPosition, so the outward
  // direction is `normalize(worldPos − hostPosition)` = R·(normalised local offset).
  const strokes: ClassifiedBoilerStroke[] = [];
  const ventStrokes: ClassifiedBoilerStroke[] = [];
  const fuelStrokes: BoilerStroke[] = [];
  for (const connector of buildBoilerConnectors(params)) {
    const root = connectorWorldPosition(connector, params.position, params.rotation);
    const len = Math.hypot(root.x - params.position.x, root.y - params.position.y);
    if (len < MIN_OUTWARD_LEN) continue; // connector at the origin — no meaningful stub direction
    const outward = { x: (root.x - params.position.x) / len, y: (root.y - params.position.y) / len };
    if (connector.domain === 'duct') {
      // Flue (καπναγωγός) — tag every chevron/terminal stroke with the duct classification
      // (`exhaust`) so the renderer colours the whole vent glyph grey via the colour SSoT.
      const ductClass = connector.duct?.systemClassification;
      ventStrokes.push(
        ...buildFlueVentStroke(root, outward, stubLen).map((line) => ({ line, classification: ductClass })),
      );
      // VENT TERMINAL (καμινάδα) — cap the chevron tip with the termination-type glyph.
      const tip: Point3D = { x: root.x + outward.x * stubLen, y: root.y + outward.y * stubLen, z: 0 };
      ventStrokes.push(
        ...buildFlueTerminalGlyph(tip, outward, stubLen, params.flueTermination ?? DEFAULT_FLUE_TERMINATION).map(
          (line) => ({ line, classification: ductClass }),
        ),
      );
    } else if (connector.domain === 'fuel') {
      // FUEL INLET (τροφοδοσία καυσίμου) — a distinct gas-cock isolation-valve glyph so the
      // piped fuel line reads differently from the water stubs and the exhaust duct. The fuel
      // domain is NOT covered by the colour SSoT, so the gas-cock keeps the default boiler
      // stroke (it is already shape-distinct) — left untagged in `fuelStrokes`.
      fuelStrokes.push(...buildFuelCockStroke(root, outward, stubLen));
    } else {
      // Pipe stub — tag with the connector's plumbing classification (supply/return, DHW
      // hot/cold, drainage) so the renderer colours it per Revit convention.
      const pipeClass = connector.pipe?.systemClassification;
      if (pipeClass === 'sanitary-drainage') {
        // CONDENSATE DRAIN (αποχέτευση συμπυκνωμάτων) — a distinct P-trap/σιφώνι «∪» glyph so
        // the condensing boiler's drain reads as a trap, not a plain pipe. Both the stub and
        // the U-bend stay tagged `sanitary-drainage` → the renderer colours them brown via the
        // colour SSoT (zero renderer/ghost change).
        strokes.push(
          ...buildCondensateTrapStroke(root, outward, stubLen).map((line) => ({
            line,
            classification: pipeClass,
          })),
        );
        // CONDENSATE NEUTRALISER (εξουδετερωτής) — an in-line cartridge box on the drain run
        // (boiler → trap → neutraliser → sewer). Same sanitary-drainage tag → brown for free.
        if (params.condensateNeutraliser) {
          strokes.push(
            ...buildCondensateNeutraliserStroke(root, outward, stubLen).map((line) => ({
              line,
              classification: pipeClass,
            })),
          );
        }
      } else {
        // Supply/return/DHW hot-cold — single plain stub (regression-free).
        strokes.push({
          line: [root, { x: root.x + outward.x * stubLen, y: root.y + outward.y * stubLen, z: 0 }],
          classification: pipeClass,
        });
      }
    }
  }

  const glyphStrokes: BoilerStroke[] = [
    buildDividerStroke(v0, v1, v2, v3),
    ...buildFlameStrokes(v0, v1, v2, v3),
  ];

  // SAFETY RELIEF VALVE (Revit «Safety Relief Valve») — a body glyph (not a perimeter connector:
  // the footprint is full). Appended to glyphStrokes → the renderer/ghost draw it warm-red THIN
  // with the existing loop (zero drawing-file change). Drawn only when the toggle is set.
  if (params.safetyReliefValve) {
    glyphStrokes.push(...buildSafetyValveGlyph(v0, v1, v2, v3));
  }

  // EXPANSION VESSEL (Revit accessory, IFC IfcTank EXPANSION) — the second sealed-system pressure
  // component (partner of the relief valve). A diaphragm-vessel body glyph appended to glyphStrokes
  // → drawn warm-red THIN by the existing loop (zero drawing-file change). Drawn only when toggled.
  if (params.expansionVessel) {
    glyphStrokes.push(...buildExpansionVesselGlyph(v0, v1, v2, v3));
  }

  // PRESSURE GAUGE (Revit accessory, IFC IfcSensor PRESSURE) — the third sealed-system instrument
  // (relief valve + expansion vessel + gauge). A dial-gauge body glyph appended to glyphStrokes →
  // drawn warm-red THIN by the existing loop (zero drawing-file change). Drawn only when toggled.
  if (params.pressureGauge) {
    glyphStrokes.push(...buildPressureGaugeGlyph(v0, v1, v2, v3));
  }

  // Service-clearance envelope (Revit «Clearances») — dashed keep-clear zone offset
  // uniformly outward from the footprint. Drawn only when the toggle is set.
  const clearanceOutline = params.showServiceClearance
    ? buildClearanceOutline(
        v0,
        v1,
        v2,
        v3,
        (params.serviceClearanceMm ?? DEFAULT_BOILER_SERVICE_CLEARANCE_MM) * s,
      )
    : undefined;

  return { outline, strokes, ventStrokes, fuelStrokes, glyphStrokes, clearanceOutline };
}
