'use client';

/**
 * ADR-417 Φ-per-edge — Pure SSoT για την κλίση/προεξοχή/«ορίζει κλίση;» ΑΝΑ ΑΚΜΗ
 * της στέγης στο ribbon (Revit «Defines Roof Slope», per footprint edge).
 *
 * Η στέγη διαφέρει από την πλάκα: ΟΧΙ ένα επίπεδο `SlabSlope`, αλλά
 * `RoofEdgeSlope[]` (μία ανά ακμή του footprint). Ο χρήστης διαλέγει ΜΙΑ ακμή
 * (dropdown «Ακμή» + live highlight, hybrid) και ορίζει `definesSlope` / `slope`
 * / `overhangMm` ΜΟΝΟ αυτής. Η μορφή (flat/mono/gable/hip) είναι **derived** από
 * το ποιες ακμές ορίζουν κλίση — δεν την αγγίζουμε εδώ (την υπολογίζει η μηχανή
 * `computeRoofGeometry` στο `UpdateRoofParamsCommand`).
 *
 * SSoT reuse (μηδέν διπλότυπα):
 *   - μετατροπή κλίσης deg↔ratio → `roof-slope-units.ts` (default seeding μόνο).
 *   - outward azimuth ακμής → `polygon-azimuth-utils` (`directionAzimuthDeg`) +
 *     `polygon-utils` (`segmentNormalX/Y`, `isPolygonCCW`) — ΟΧΙ νέα γεωμετρία.
 *
 * Pure module: zero React/DOM. Ο bridge (`useRibbonRoofBridge`) χτίζει τα option
 * labels (compass words μέσω `t()` — N.11) και κάνει το dispatch/store-set.
 *
 * @see ui/ribbon/hooks/bridge/slab-slope-param.ts — το πρότυπο
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md
 */

import {
  DEFAULT_ROOF_SLOPE_DEG,
  type RoofEdgeSlope,
  type RoofParams,
  type RoofSlopeUnit,
} from '../../../../bim/types/roof-types';
import type { Point3D } from '../../../../bim/types/bim-base';
import {
  roofSlopeFromRatio,
  roofSlopeToRatio,
} from '../../../../bim/geometry/roof-slope-units';
import { edgeOutwardAzimuthDeg } from '../../../../bim/geometry/shared/polygon-azimuth-utils';
import type { RibbonComboboxState } from '../../context/RibbonCommandContext';
import { ROOF_EDGE_KEYS } from './roof-command-keys';

// ─── Option-value sentinels (SSoT — reused από τον bridge + contextual tab) ────

export const ROOF_EDGE_DEFINES_ON = 'on';
export const ROOF_EDGE_DEFINES_OFF = 'off';

/** Compass key μιας ακμής (8-wind) — labels μέσω i18n στον bridge (N.11). */
export type RoofEdgeCompass = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

/** 8-wind keys σε σειρά azimuth bucket (0°=Β/+Y, CW→Α/+X). */
const COMPASS_ORDER: readonly RoofEdgeCompass[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

// ─── Index helpers ────────────────────────────────────────────────────────────

/** Clamp σε έγκυρο index ακμής (0..n-1)· -1/άκυρο → 0. */
export function clampEdgeIndex(index: number, edgeCount: number): number {
  if (edgeCount <= 0) return 0;
  if (!Number.isFinite(index) || index < 0) return 0;
  return Math.min(Math.floor(index), edgeCount - 1);
}

// ─── Outward azimuth → compass (FULL reuse SSoT) ──────────────────────────────

/**
 * Compass key (8-wind) της ακμής `edgeIndex` (κορυφή i → i+1)· `null` σε
 * degenerate. Η outward azimuth υπολογίζεται από το ΕΝΑ SSoT
 * `edgeOutwardAzimuthDeg` (`polygon-azimuth-utils`) — μηδέν τοπικός normal/winding
 * υπολογισμός (κοινός με `nearestEdgeOutwardAzimuthDeg` του thermal resolver).
 */
export function roofEdgeCompass(
  outline: readonly Point3D[],
  edgeIndex: number,
): RoofEdgeCompass | null {
  const az = edgeOutwardAzimuthDeg(outline, edgeIndex);
  if (az === null) return null;
  // 8-wind buckets των 45°, centered στο 0=Β (337.5..22.5 → N κ.ο.κ.).
  const bucket = Math.round(az / 45) % 8;
  return COMPASS_ORDER[bucket];
}

// ─── Pure core: read combobox value από επιλεγμένη ακμή ────────────────────────

function readEdgeField(
  commandKey: string,
  edge: RoofEdgeSlope,
  selectedIndex: number,
): string | null {
  if (commandKey === ROOF_EDGE_KEYS.select) return String(selectedIndex);
  if (commandKey === ROOF_EDGE_KEYS.defines) {
    return edge.definesSlope ? ROOF_EDGE_DEFINES_ON : ROOF_EDGE_DEFINES_OFF;
  }
  if (commandKey === ROOF_EDGE_KEYS.slope) return String(Math.round(edge.slope));
  if (commandKey === ROOF_EDGE_KEYS.overhang) return String(Math.round(edge.overhangMm));
  return null;
}

/**
 * Resolve το combobox state ενός edge key για την επιλεγμένη ακμή της στέγης. Τα
 * options του `select` (compass list) τα χτίζει ο bridge (χρειάζεται `t()`).
 * `null` αν δεν είναι edge key.
 */
export function resolveRoofEdgeComboboxState(
  commandKey: string,
  params: RoofParams,
  selectedIndex: number,
): RibbonComboboxState | null {
  const edges = params.edges;
  const idx = clampEdgeIndex(selectedIndex, edges.length);
  const edge = edges[idx];
  if (!edge) return null;
  const v = readEdgeField(commandKey, edge, idx);
  return v === null ? null : { value: v, options: [] };
}

// ─── Pure core: παράγει το επόμενο state από μία αλλαγή combobox ───────────────

/** Default κλίση όταν ενεργοποιείται `definesSlope` από επίπεδη ακμή (στη μονάδα). */
function defaultSlopeForUnit(unit: RoofSlopeUnit): number {
  return Math.round(roofSlopeFromRatio(roofSlopeToRatio(DEFAULT_ROOF_SLOPE_DEG, 'deg'), unit));
}

function patchEdge(
  params: RoofParams,
  index: number,
  patch: Partial<RoofEdgeSlope>,
): RoofParams {
  return {
    ...params,
    edges: params.edges.map((e, i) => (i === index ? { ...e, ...patch } : e)),
  };
}

/** Αποτέλεσμα μιας edge αλλαγής: είτε νέα επιλογή ακμής, είτε patched params. */
export type RoofEdgeApply =
  | { readonly kind: 'select'; readonly edgeIndex: number }
  | { readonly kind: 'params'; readonly next: RoofParams };

/**
 * Παράγει το αποτέλεσμα μιας edge-combobox αλλαγής. `select` → νέα ακμή (ο bridge
 * γράφει το `roofEdgeSelectionStore`)· `defines/slope/overhang` → patched
 * `RoofParams` (ο bridge κάνει `dispatchParams` → `UpdateRoofParamsCommand`).
 * `null` σε άκυρη/μη-edge key (δεν αγγίζει τη στέγη).
 */
export function applyRoofEdgeChange(
  commandKey: string,
  value: string,
  params: RoofParams,
  selectedIndex: number,
): RoofEdgeApply | null {
  const edges = params.edges;
  const idx = clampEdgeIndex(selectedIndex, edges.length);
  const edge = edges[idx];
  if (!edge) return null;

  if (commandKey === ROOF_EDGE_KEYS.select) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return null;
    return { kind: 'select', edgeIndex: clampEdgeIndex(parsed, edges.length) };
  }

  if (commandKey === ROOF_EDGE_KEYS.defines) {
    if (value !== ROOF_EDGE_DEFINES_ON && value !== ROOF_EDGE_DEFINES_OFF) return null;
    const definesSlope = value === ROOF_EDGE_DEFINES_ON;
    // Ενεργοποίηση πάνω σε επίπεδη ακμή → seed default κλίση ώστε να μη μένει 0
    // (degenerate slope-defining edge). reuse roof-slope-units.
    const slope = definesSlope && edge.slope <= 0 ? defaultSlopeForUnit(params.slopeUnit) : edge.slope;
    return { kind: 'params', next: patchEdge(params, idx, { definesSlope, slope }) };
  }

  if (commandKey === ROOF_EDGE_KEYS.slope) {
    const slope = Number.parseFloat(value);
    if (!Number.isFinite(slope) || slope < 0) return null;
    return { kind: 'params', next: patchEdge(params, idx, { slope }) };
  }

  if (commandKey === ROOF_EDGE_KEYS.overhang) {
    const overhangMm = Number.parseFloat(value);
    if (!Number.isFinite(overhangMm) || overhangMm < 0) return null;
    return { kind: 'params', next: patchEdge(params, idx, { overhangMm }) };
  }

  return null;
}
