/**
 * ADR-587 Φ4 — Ribbon command dispatch tables (TIER-3 bridge routing, data-driven).
 *
 * Οι 4 παράλληλες `if (isXKey(key)) return xBridge.method(key)` αλυσίδες του
 * `useRibbonCommands` (~210 branches) → δηλωτικοί **ordered route tables** + generic
 * runners. Τα bridge **hook calls ΜΕΝΟΥΝ** upstream (`useDxfBimBridges` aggregator +
 * `useDxfViewerRibbon`) — Rules of Hooks, TIER-3· εδώ ζει ΜΟΝΟ το dispatch **δεδομένων**
 * (τα ήδη-resolved bridge objects περνούν ως deps).
 *
 * **Γιατί ενιαίος combobox route (matchWrite + matchRead σε ΕΝΑ entry):** οι αλυσίδες
 * `onComboboxChange` (write) και `getComboboxState` (read) ήταν σχεδόν πανομοιότυπες
 * (name-blind clone) και **απέκλιναν** — τα σχόλια ADR-449 στο `useRibbonCommands`
 * τεκμηριώνουν bugs όπου «ο composer ξεχνούσε key σε μία αλυσίδα αλλά όχι στην άλλη»
 * (finish keys → textEditor no-op). Ένα entry ανά bridge που ορίζει ΚΑΙ τα δύο match
 * καθιστά τη διαφορά **αδύνατη κατά κατασκευή**. Η μόνη νόμιμη ασυμμετρία — τα read-only
 * **readout** keys (hatch/column-structural/radiator/boiler) — κωδικοποιείται ρητά ως
 * `matchRead` ⊇ `matchWrite` (per-site default, ΟΧΙ σιωπηλή ομογενοποίηση).
 *
 * **Order-preserving:** τα route arrays κρατούν ΑΚΡΙΒΩΣ τη σειρά των αρχικών if-chains,
 * άρα ο «first-match» loop είναι behavior-preserving είτε τα guard domains είναι disjoint
 * είτε όχι (καρφωμένο σε coverage test).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-587-entity-type-descriptor-registry-ssot.md
 */

import type { RibbonComboboxState } from '../context/RibbonCommandContext';
// ADR-451/449 — «Ύψος Ορόφου» writes floor.height του ενεργού ορόφου (module fns, όχι bridge).
import { getStoreyComboboxState, applyStoreyComboboxChange } from './bridge/storey-height-bridge';
import { isStoreyRibbonKey } from './bridge/storey-command-keys';
// Combobox guard sets (per-entity key predicates — Φ3b-1 `makeKeySetGuard` outputs).
import { isStairRibbonKey, isStairRibbonStringKey } from './bridge/stair-command-keys';
import { isWallRibbonKey, isWallRibbonStringKey, isWallRibbonToggleKey, isWallTiltKey } from './bridge/wall-command-keys';
import { isOpeningRibbonKey, isOpeningRibbonStringKey, isOpeningTagStyleComboboxKey } from './bridge/opening-command-keys';
import { isSlabRibbonKey, isSlabRibbonStringKey, isSlabSlopeKey } from './bridge/slab-command-keys';
import { isRoofRibbonKey, isRoofRibbonStringKey, isRoofEdgeKey } from './bridge/roof-command-keys';
import { isFloorFinishRibbonNumberKey, isFloorFinishRibbonStringKey } from './bridge/floor-finish-command-keys';
import { isWallCoveringRibbonNumberKey, isWallCoveringRibbonStringKey } from './bridge/wall-covering-command-keys';
import { isHatchRibbonNumberKey, isHatchRibbonStringKey, isHatchRibbonReadoutKey, isHatchRibbonVisibilityKey } from './bridge/hatch-command-keys';
import { isThermalSpaceRibbonNumberKey, isThermalSpaceRibbonStringKey } from './bridge/thermal-space-command-keys';
import { isColumnRibbonKey, isColumnRibbonStringKey, isColumnFinishKey, isColumnStructuralKey, isColumnStructuralReadoutKey } from './bridge/column-command-keys';
import { isBeamRibbonKey, isBeamRibbonStringKey, isBeamFinishKey } from './bridge/beam-command-keys';
import { isFoundationRibbonKey, isFoundationRibbonStringKey, isFoundationBadgeKey } from './bridge/foundation-command-keys';
import { isSlabOpeningRibbonStringKey } from './bridge/slab-opening-command-keys';
import { isMepFixtureRibbonKey, isMepFixtureRibbonStringKey } from './bridge/mep-fixture-command-keys';
import { isMepManifoldRibbonKey, isMepManifoldClassificationKey } from './bridge/mep-manifold-command-keys';
import { isElectricalPanelRibbonKey } from './bridge/electrical-panel-command-keys';
import { isMepRadiatorRibbonKey, isMepRadiatorRibbonStringKey, isMepRadiatorRibbonReadoutKey } from './bridge/mep-radiator-command-keys';
import { isMepBoilerRibbonKey, isMepBoilerRibbonStringKey, isMepBoilerReadoutKey } from './bridge/mep-boiler-command-keys';
import { isMepWaterHeaterRibbonKey } from './bridge/mep-water-heater-command-keys';
import { isMepUnderfloorRibbonKey } from './bridge/mep-underfloor-command-keys';
import { isMepSegmentRibbonKey, isMepSegmentRibbonStringKey } from './bridge/mep-segment-command-keys';
import { isFurnitureRibbonKey, isFurnitureRibbonStringKey } from './bridge/furniture-command-keys';
import { isFloorplanSymbolRibbonKey, isFloorplanSymbolRibbonStringKey } from './bridge/floorplan-symbol-command-keys';
import { isAnnotationSymbolRibbonKey, isAnnotationSymbolRibbonStringKey } from './bridge/annotation-symbol-command-keys';
import { isMepFixtureLibraryKey, isMepFixtureLibraryStringKey } from './bridge/mep-fixture-library-command-keys';
import { isMepRiserKey, isMepRiserStringKey } from './bridge/mep-riser-command-keys';
import { isArrayRibbonKey, isArrayRibbonStringKey } from './bridge/array-command-keys';
import { isLineToolRibbonKey, isLineToolPanelVisibilityKey } from './bridge/line-tool-command-keys';
import { isDimRibbonKey } from './bridge/dim-command-keys';
import { isXlineRibbonKey } from './bridge/xline-command-keys';
// Badge / panel-visibility guards (own key-sets, live in bridge hook files).
import { isStairBadgeKey, isStairPanelVisibilityKey } from '../../../bim/hooks/use-ribbon-stair-bridge';
import { isWallBadgeKey } from './useRibbonWallBridge';
import { isOpeningBadgeKey } from './useRibbonOpeningBridge';
import { isSlabBadgeKey, isSlabPanelVisibilityKey } from './useRibbonSlabBridge';
import { isRoofBadgeKey } from './useRibbonRoofBridge';
import { isColumnBadgeKey, isColumnPanelVisibilityKey } from './useRibbonColumnBridge';
import { isBeamBadgeKey, isBeamPanelVisibilityKey } from './useRibbonBeamBridge';
import { isSlabOpeningBadgeKey } from './useRibbonSlabOpeningBridge';
import { isMepFixturePanelVisibilityKey } from './useRibbonMepFixtureBridge';
import { isMepManifoldPanelVisibilityKey } from './useRibbonMepManifoldBridge';
import { isElectricalPanelPanelVisibilityKey } from './useRibbonElectricalPanelBridge';
import { isMepBoilerPanelVisibilityKey } from './useRibbonMepBoilerBridge';
import { isMepWaterHeaterPanelVisibilityKey } from './useRibbonMepWaterHeaterBridge';
import { isMepUnderfloorPanelVisibilityKey } from './useRibbonMepUnderfloorBridge';
import { isMepSegmentPanelVisibilityKey } from './useRibbonMepSegmentBridge';
import { isFurniturePanelVisibilityKey } from './useRibbonFurnitureBridge';
import { isFloorplanSymbolPanelVisibilityKey } from './useRibbonFloorplanSymbolBridge';

/** A ribbon key → boolean predicate (Φ3b-1 guard). */
type KeyGuard = (key: string) => boolean;

/** Structural capability slices — decouple the tables from the ~40 concrete bridge types. */
interface ComboboxCapable {
  onComboboxChange(key: string, value: string): void;
  getComboboxState(key: string): RibbonComboboxState | null;
}
interface BadgeCapable { getBadgeState(key: string): boolean; }
interface VisibilityCapable { getPanelVisibility(key: string): boolean; }

/**
 * One combobox route: the bridge/handler owning a key-set, with SEPARATE write/read
 * matchers. `matchRead` ⊇ `matchWrite` (read-only readout keys). Both derive from ONE
 * entry ⇒ write and read cannot silently drift.
 */
export interface ComboboxRoute {
  readonly matchWrite: KeyGuard;
  readonly matchRead: KeyGuard;
  readonly onChange: (key: string, value: string) => void;
  readonly getState: (key: string) => RibbonComboboxState | null;
}

/** A single-capability route (badge / panel-visibility): one guard → one reader. */
export interface SimpleRoute {
  readonly match: KeyGuard;
  readonly handle: (key: string) => boolean;
}

/** Bridges consumed by the combobox routes (order = original if-chain order). */
export interface ComboboxRouteDeps {
  readonly stairBridge: ComboboxCapable;
  readonly wallBridge: ComboboxCapable;
  readonly openingBridge: ComboboxCapable;
  readonly slabBridge: ComboboxCapable;
  readonly roofBridge: ComboboxCapable;
  readonly floorFinishBridge: ComboboxCapable;
  readonly wallCoveringBridge: ComboboxCapable;
  readonly hatchBridge: ComboboxCapable;
  readonly thermalSpaceBridge: ComboboxCapable;
  readonly columnBridge: ComboboxCapable;
  readonly beamBridge: ComboboxCapable;
  readonly foundationBridge: ComboboxCapable;
  readonly slabOpeningBridge: ComboboxCapable;
  readonly mepFixtureBridge: ComboboxCapable;
  readonly mepManifoldBridge: ComboboxCapable;
  readonly electricalPanelBridge: ComboboxCapable;
  readonly mepRadiatorBridge: ComboboxCapable;
  readonly mepBoilerBridge: ComboboxCapable;
  readonly mepWaterHeaterBridge: ComboboxCapable;
  readonly mepUnderfloorBridge: ComboboxCapable;
  readonly mepSegmentBridge: ComboboxCapable;
  readonly furnitureBridge: ComboboxCapable;
  readonly floorplanSymbolBridge: ComboboxCapable;
  readonly annotationSymbolBridge: ComboboxCapable;
  readonly mepFixtureLibraryBridge: ComboboxCapable;
  readonly mepRiserBridge: ComboboxCapable;
  readonly arrayBridge: ComboboxCapable;
  readonly lineToolBridge: ComboboxCapable;
  readonly dimBridge: ComboboxCapable;
  readonly xlineModeBridge: ComboboxCapable;
}

/** Bridges consumed by the badge routes. */
export interface BadgeRouteDeps {
  readonly stairBridge: BadgeCapable;
  readonly wallBridge: BadgeCapable;
  readonly openingBridge: BadgeCapable;
  readonly slabBridge: BadgeCapable;
  readonly roofBridge: BadgeCapable;
  readonly columnBridge: BadgeCapable;
  readonly beamBridge: BadgeCapable;
  readonly foundationBridge: BadgeCapable;
  readonly slabOpeningBridge: BadgeCapable;
}

/** Bridges consumed by the panel-visibility routes. */
export interface VisibilityRouteDeps {
  readonly stairBridge: VisibilityCapable;
  readonly columnBridge: VisibilityCapable;
  readonly beamBridge: VisibilityCapable;
  readonly slabBridge: VisibilityCapable;
  readonly mepFixtureBridge: VisibilityCapable;
  readonly mepManifoldBridge: VisibilityCapable;
  readonly electricalPanelBridge: VisibilityCapable;
  readonly mepBoilerBridge: VisibilityCapable;
  readonly mepWaterHeaterBridge: VisibilityCapable;
  readonly mepUnderfloorBridge: VisibilityCapable;
  readonly mepSegmentBridge: VisibilityCapable;
  readonly furnitureBridge: VisibilityCapable;
  readonly floorplanSymbolBridge: VisibilityCapable;
  readonly hatchBridge: VisibilityCapable;
  readonly lineToolBridge: VisibilityCapable;
}

/** Bind a combobox-capable bridge's methods (arrow-wrapped → no `this` reliance). */
function boundCombobox(b: ComboboxCapable): Pick<ComboboxRoute, 'onChange' | 'getState'> {
  return {
    onChange: (k, v) => b.onComboboxChange(k, v),
    getState: (k) => b.getComboboxState(k),
  };
}

/** OR two guards (for `matchRead` = write ∪ readout). */
const anyOf = (...gs: readonly KeyGuard[]): KeyGuard => (k) => gs.some((g) => g(k));

/**
 * Build the ordered combobox dispatch table. Order === the original `onComboboxChange`
 * /`getComboboxState` if-chains (which were identical). `matchRead` adds the read-only
 * readout guards for the 4 entries that had them.
 */
export function buildComboboxRoutes(d: ComboboxRouteDeps): readonly ComboboxRoute[] {
  const stairG = anyOf(isStairRibbonKey, isStairRibbonStringKey);
  const wallG = anyOf(isWallRibbonKey, isWallRibbonStringKey, isWallRibbonToggleKey, isWallTiltKey);
  const openingG = anyOf(isOpeningRibbonKey, isOpeningRibbonStringKey, isOpeningTagStyleComboboxKey);
  const slabG = anyOf(isSlabRibbonKey, isSlabRibbonStringKey, isSlabSlopeKey);
  const roofG = anyOf(isRoofRibbonKey, isRoofRibbonStringKey, isRoofEdgeKey);
  const floorFinishG = anyOf(isFloorFinishRibbonNumberKey, isFloorFinishRibbonStringKey);
  const wallCoveringG = anyOf(isWallCoveringRibbonNumberKey, isWallCoveringRibbonStringKey);
  const hatchWriteG = anyOf(isHatchRibbonNumberKey, isHatchRibbonStringKey);
  const thermalG = anyOf(isThermalSpaceRibbonNumberKey, isThermalSpaceRibbonStringKey);
  const columnWriteG = anyOf(isColumnRibbonKey, isColumnRibbonStringKey, isColumnFinishKey, isColumnStructuralKey);
  const beamG = anyOf(isBeamRibbonKey, isBeamRibbonStringKey, isBeamFinishKey);
  const foundationG = anyOf(isFoundationRibbonKey, isFoundationRibbonStringKey);
  const mepFixtureG = anyOf(isMepFixtureRibbonKey, isMepFixtureRibbonStringKey);
  const mepManifoldG = anyOf(isMepManifoldRibbonKey, isMepManifoldClassificationKey);
  const mepRadiatorWriteG = anyOf(isMepRadiatorRibbonKey, isMepRadiatorRibbonStringKey);
  const mepBoilerWriteG = anyOf(isMepBoilerRibbonKey, isMepBoilerRibbonStringKey);
  const mepSegmentG = anyOf(isMepSegmentRibbonKey, isMepSegmentRibbonStringKey);
  const furnitureG = anyOf(isFurnitureRibbonKey, isFurnitureRibbonStringKey);
  const floorplanSymbolG = anyOf(isFloorplanSymbolRibbonKey, isFloorplanSymbolRibbonStringKey);
  const annotationSymbolG = anyOf(isAnnotationSymbolRibbonKey, isAnnotationSymbolRibbonStringKey);
  const mepFixtureLibraryG = anyOf(isMepFixtureLibraryKey, isMepFixtureLibraryStringKey);
  const mepRiserG = anyOf(isMepRiserKey, isMepRiserStringKey);
  const arrayG = anyOf(isArrayRibbonKey, isArrayRibbonStringKey);

  const both = (g: KeyGuard): Pick<ComboboxRoute, 'matchWrite' | 'matchRead'> => ({ matchWrite: g, matchRead: g });

  return [
    { ...both(stairG), ...boundCombobox(d.stairBridge) },
    { ...both(wallG), ...boundCombobox(d.wallBridge) },
    { ...both(openingG), ...boundCombobox(d.openingBridge) },
    { ...both(slabG), ...boundCombobox(d.slabBridge) },
    { ...both(roofG), ...boundCombobox(d.roofBridge) },
    { ...both(floorFinishG), ...boundCombobox(d.floorFinishBridge) },
    { ...both(wallCoveringG), ...boundCombobox(d.wallCoveringBridge) },
    // Readout asymmetry (read-only): hatch readout keys resolve on READ only.
    { matchWrite: hatchWriteG, matchRead: anyOf(hatchWriteG, isHatchRibbonReadoutKey), ...boundCombobox(d.hatchBridge) },
    { ...both(thermalG), ...boundCombobox(d.thermalSpaceBridge) },
    // Storey «Ύψος Ορόφου» — module handlers (not a bridge object); read guard === write guard.
    {
      matchWrite: isStoreyRibbonKey,
      matchRead: isStoreyRibbonKey,
      onChange: (k, v) => applyStoreyComboboxChange(k, v),
      getState: (k) => getStoreyComboboxState(k),
    },
    { matchWrite: columnWriteG, matchRead: anyOf(columnWriteG, isColumnStructuralReadoutKey), ...boundCombobox(d.columnBridge) },
    { ...both(beamG), ...boundCombobox(d.beamBridge) },
    { ...both(foundationG), ...boundCombobox(d.foundationBridge) },
    { ...both(isSlabOpeningRibbonStringKey), ...boundCombobox(d.slabOpeningBridge) },
    { ...both(mepFixtureG), ...boundCombobox(d.mepFixtureBridge) },
    { ...both(mepManifoldG), ...boundCombobox(d.mepManifoldBridge) },
    { ...both(isElectricalPanelRibbonKey), ...boundCombobox(d.electricalPanelBridge) },
    { matchWrite: mepRadiatorWriteG, matchRead: anyOf(mepRadiatorWriteG, isMepRadiatorRibbonReadoutKey), ...boundCombobox(d.mepRadiatorBridge) },
    { matchWrite: mepBoilerWriteG, matchRead: anyOf(mepBoilerWriteG, isMepBoilerReadoutKey), ...boundCombobox(d.mepBoilerBridge) },
    { ...both(isMepWaterHeaterRibbonKey), ...boundCombobox(d.mepWaterHeaterBridge) },
    { ...both(isMepUnderfloorRibbonKey), ...boundCombobox(d.mepUnderfloorBridge) },
    { ...both(mepSegmentG), ...boundCombobox(d.mepSegmentBridge) },
    { ...both(furnitureG), ...boundCombobox(d.furnitureBridge) },
    { ...both(floorplanSymbolG), ...boundCombobox(d.floorplanSymbolBridge) },
    { ...both(annotationSymbolG), ...boundCombobox(d.annotationSymbolBridge) },
    { ...both(mepFixtureLibraryG), ...boundCombobox(d.mepFixtureLibraryBridge) },
    { ...both(mepRiserG), ...boundCombobox(d.mepRiserBridge) },
    { ...both(arrayG), ...boundCombobox(d.arrayBridge) },
    { ...both(isLineToolRibbonKey), ...boundCombobox(d.lineToolBridge) },
    { ...both(isDimRibbonKey), ...boundCombobox(d.dimBridge) },
    { ...both(isXlineRibbonKey), ...boundCombobox(d.xlineModeBridge) },
  ];
}

/** Build the ordered badge dispatch table (order === original `getBadgeState` chain). */
export function buildBadgeRoutes(d: BadgeRouteDeps): readonly SimpleRoute[] {
  return [
    { match: isStairBadgeKey, handle: (k) => d.stairBridge.getBadgeState(k) },
    { match: isWallBadgeKey, handle: (k) => d.wallBridge.getBadgeState(k) },
    { match: isOpeningBadgeKey, handle: (k) => d.openingBridge.getBadgeState(k) },
    { match: isSlabBadgeKey, handle: (k) => d.slabBridge.getBadgeState(k) },
    { match: isRoofBadgeKey, handle: (k) => d.roofBridge.getBadgeState(k) },
    { match: isColumnBadgeKey, handle: (k) => d.columnBridge.getBadgeState(k) },
    { match: isBeamBadgeKey, handle: (k) => d.beamBridge.getBadgeState(k) },
    { match: isFoundationBadgeKey, handle: (k) => d.foundationBridge.getBadgeState(k) },
    { match: isSlabOpeningBadgeKey, handle: (k) => d.slabOpeningBridge.getBadgeState(k) },
  ];
}

/** Build the ordered panel-visibility dispatch table (order === original chain). */
export function buildVisibilityRoutes(d: VisibilityRouteDeps): readonly SimpleRoute[] {
  return [
    { match: isStairPanelVisibilityKey, handle: (k) => d.stairBridge.getPanelVisibility(k) },
    { match: isColumnPanelVisibilityKey, handle: (k) => d.columnBridge.getPanelVisibility(k) },
    { match: isBeamPanelVisibilityKey, handle: (k) => d.beamBridge.getPanelVisibility(k) },
    { match: isSlabPanelVisibilityKey, handle: (k) => d.slabBridge.getPanelVisibility(k) },
    { match: isMepFixturePanelVisibilityKey, handle: (k) => d.mepFixtureBridge.getPanelVisibility(k) },
    { match: isMepManifoldPanelVisibilityKey, handle: (k) => d.mepManifoldBridge.getPanelVisibility(k) },
    { match: isElectricalPanelPanelVisibilityKey, handle: (k) => d.electricalPanelBridge.getPanelVisibility(k) },
    { match: isMepBoilerPanelVisibilityKey, handle: (k) => d.mepBoilerBridge.getPanelVisibility(k) },
    { match: isMepWaterHeaterPanelVisibilityKey, handle: (k) => d.mepWaterHeaterBridge.getPanelVisibility(k) },
    { match: isMepUnderfloorPanelVisibilityKey, handle: (k) => d.mepUnderfloorBridge.getPanelVisibility(k) },
    { match: isMepSegmentPanelVisibilityKey, handle: (k) => d.mepSegmentBridge.getPanelVisibility(k) },
    { match: isFurniturePanelVisibilityKey, handle: (k) => d.furnitureBridge.getPanelVisibility(k) },
    { match: isFloorplanSymbolPanelVisibilityKey, handle: (k) => d.floorplanSymbolBridge.getPanelVisibility(k) },
    { match: isHatchRibbonVisibilityKey, handle: (k) => d.hatchBridge.getPanelVisibility(k) },
    // ADR-510 Φ4 — Geometry panel is line-only (bridge inspects the selection).
    { match: isLineToolPanelVisibilityKey, handle: (k) => d.lineToolBridge.getPanelVisibility(k) },
  ];
}

/** First matching route WRITES; none → `fallback` (textEditor). */
export function dispatchComboboxWrite(
  routes: readonly ComboboxRoute[],
  key: string,
  value: string,
  fallback: (key: string, value: string) => void,
): void {
  for (const r of routes) {
    if (r.matchWrite(key)) {
      r.onChange(key, value);
      return;
    }
  }
  fallback(key, value);
}

/** First matching route READS; none → `fallback` (textEditor). */
export function dispatchComboboxRead(
  routes: readonly ComboboxRoute[],
  key: string,
  fallback: (key: string) => RibbonComboboxState | null,
): RibbonComboboxState | null {
  for (const r of routes) {
    if (r.matchRead(key)) return r.getState(key);
  }
  return fallback(key);
}

/** First matching single-capability route wins; none → `fallbackValue` (badge=false, visibility=true). */
export function dispatchSimple(
  routes: readonly SimpleRoute[],
  key: string,
  fallbackValue: boolean,
): boolean {
  for (const r of routes) {
    if (r.match(key)) return r.handle(key);
  }
  return fallbackValue;
}
