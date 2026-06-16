/**
 * ADR-463 — Foundation structural/reinforcement ribbon+panel helper SSoT.
 *
 * Combobox options (Ø ράβδων/σχάρας, βήματα, πλήθος, επικάλυψη, on/off) + pure
 * kind-aware read/patch helpers πάνω στο `FootingReinforcement`. ΟΛΑ τα μεγέθη/
 * κατάλογοι προέρχονται από το `bim/structural/` — ΜΗΔΕΝ inline στατική λογική
 * (mirror του `structural-param.ts` της κολώνας).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-463-foundation-reinforcement-ux.md
 * @see ./foundation-structural-bridge.ts — ο consumer (read/write routing)
 */

import { REBAR_DIAMETERS_MM } from '../../../../bim/structural/rebar-catalog';
import {
  DEFAULT_BEAM_STIRRUP_LEGS,
} from '../../../../bim/structural/reinforcement/beam-reinforcement-types';
import type {
  BeamRebarLayer,
  BeamStirrups,
  FootingReinforcement,
  PadReinforcement,
  RebarMesh,
  StripReinforcement,
  TieBeamReinforcement,
} from '../../../../bim/structural/reinforcement/footing-reinforcement-types';
import { FOUNDATION_STRUCTURAL_KEYS } from './foundation-command-keys';

interface ComboboxOption {
  readonly value: string;
  readonly labelKey: string;
  readonly isLiteralLabel: boolean;
}

/** Helper — αριθμητικός κατάλογος → literal-label options. */
function numericOptions(values: readonly number[]): readonly ComboboxOption[] {
  return values.map((v) => ({ value: String(v), labelKey: String(v), isLiteralLabel: true }));
}

// ─── Combobox option lists (από τα structural SSoT) ───────────────────────────

/** Εμπορικές διάμετροι ράβδου/σχάρας (mm). */
export const FOUNDATION_DIAMETER_OPTIONS = numericOptions(REBAR_DIAMETERS_MM);

/** Βήμα σχάρας θεμελίωσης (mm). */
export const FOUNDATION_MESH_SPACING_OPTIONS = numericOptions([100, 125, 150, 200, 250, 300]);

/** Πλήθος διαμήκων ράβδων διανομής (strip/tie-beam). */
export const FOUNDATION_BAR_COUNT_OPTIONS = numericOptions([2, 3, 4, 5, 6, 8]);

/** Βήμα συνδετήρων μεσαίας ζώνης (mm). */
export const FOUNDATION_STIRRUP_SPACING_OPTIONS = numericOptions([100, 150, 200, 250, 300]);

/** Κρίσιμο βήμα συνδετήρων άκρων (mm). */
export const FOUNDATION_STIRRUP_CRITICAL_SPACING_OPTIONS = numericOptions([50, 75, 100, 125, 150]);

/** Επικάλυψη cnom (mm) — θεμελίωση: μεγαλύτερη (έδραση σε έδαφος, EC2 §4.4.1). */
export const FOUNDATION_COVER_OPTIONS = numericOptions([35, 40, 50, 60, 75]);

/** On/off toggle (προαιρετική άνω σχάρα / συνδετήρες) — i18n labels. */
export const FOUNDATION_TOGGLE_OPTIONS: readonly ComboboxOption[] = [
  { value: 'off', labelKey: 'ribbon.commands.foundationStructural.toggle.off', isLiteralLabel: false },
  { value: 'on', labelKey: 'ribbon.commands.foundationStructural.toggle.on', isLiteralLabel: false },
];

// ─── Defaults για ενεργοποίηση προαιρετικών μερών ─────────────────────────────

/** Default άνω σχάρα pad (καθρέφτης κάτω X) όταν ενεργοποιείται. */
function defaultTopMesh(r: PadReinforcement): RebarMesh {
  return { diameterMm: r.bottomMeshX.diameterMm, spacingMm: r.bottomMeshX.spacingMm };
}

/** Default συνδετήρες strip όταν ενεργοποιούνται. */
function defaultStripStirrups(): BeamStirrups {
  return { diameterMm: 8, spacingMm: 200, legs: DEFAULT_BEAM_STIRRUP_LEGS };
}

// ─── Pure read (FootingReinforcement → string value) ──────────────────────────

const KEYS = FOUNDATION_STRUCTURAL_KEYS;

function readPad(r: PadReinforcement, key: string): string | null {
  switch (key) {
    case KEYS.cover: return String(Math.round(r.coverMm));
    case KEYS.padBottomXDiameter: return String(r.bottomMeshX.diameterMm);
    case KEYS.padBottomXSpacing: return String(r.bottomMeshX.spacingMm);
    case KEYS.padBottomYDiameter: return String(r.bottomMeshY.diameterMm);
    case KEYS.padBottomYSpacing: return String(r.bottomMeshY.spacingMm);
    case KEYS.padTopEnabled: return r.topMesh ? 'on' : 'off';
    case KEYS.padTopDiameter: return String((r.topMesh ?? r.bottomMeshX).diameterMm);
    case KEYS.padTopSpacing: return String((r.topMesh ?? r.bottomMeshX).spacingMm);
    default: return null;
  }
}

function readStrip(r: StripReinforcement, key: string): string | null {
  switch (key) {
    case KEYS.cover: return String(Math.round(r.coverMm));
    case KEYS.stripTransverseDiameter: return String(r.transverse.diameterMm);
    case KEYS.stripTransverseSpacing: return String(r.transverse.spacingMm);
    case KEYS.stripLongitudinalDiameter: return String(r.longitudinal.diameterMm);
    case KEYS.stripLongitudinalCount: return String(r.longitudinal.count);
    case KEYS.stripStirrupEnabled: return r.stirrups ? 'on' : 'off';
    case KEYS.stripStirrupDiameter: return String((r.stirrups ?? defaultStripStirrups()).diameterMm);
    case KEYS.stripStirrupSpacing: return String((r.stirrups ?? defaultStripStirrups()).spacingMm);
    default: return null;
  }
}

function readTieBeam(r: TieBeamReinforcement, key: string): string | null {
  switch (key) {
    case KEYS.cover: return String(Math.round(r.coverMm));
    case KEYS.tieBottomDiameter: return String(r.bottom.diameterMm);
    case KEYS.tieBottomCount: return String(r.bottom.count);
    case KEYS.tieTopDiameter: return String(r.top.diameterMm);
    case KEYS.tieTopCount: return String(r.top.count);
    case KEYS.tieStirrupDiameter: return String(r.stirrups.diameterMm);
    case KEYS.tieStirrupSpacing: return String(r.stirrups.spacingMm);
    case KEYS.tieStirrupCriticalSpacing:
      return String(r.stirrups.spacingCriticalMm ?? r.stirrups.spacingMm);
    default: return null;
  }
}

/** Τρέχουσα τιμή ενός structural πεδίου για το combobox (string), ή `null`. */
export function readFoundationStructuralField(
  r: FootingReinforcement,
  commandKey: string,
): string | null {
  switch (r.kind) {
    case 'pad': return readPad(r, commandKey);
    case 'strip': return readStrip(r, commandKey);
    case 'tie-beam': return readTieBeam(r, commandKey);
  }
}

// ─── Pure patch (FootingReinforcement + value → νέο FootingReinforcement) ───────

function patchMesh(mesh: RebarMesh, field: 'diameterMm' | 'spacingMm', v: number): RebarMesh {
  return { ...mesh, [field]: v };
}

function patchLayer(layer: BeamRebarLayer, field: 'diameterMm' | 'count', v: number): BeamRebarLayer {
  return { ...layer, [field]: v };
}

function patchStirrups(
  s: BeamStirrups,
  field: 'diameterMm' | 'spacingMm' | 'spacingCriticalMm',
  v: number,
): BeamStirrups {
  return { ...s, [field]: v };
}

function patchPad(r: PadReinforcement, key: string, value: string): PadReinforcement | null {
  const n = Number.parseFloat(value);
  switch (key) {
    case KEYS.cover: return Number.isNaN(n) ? r : { ...r, coverMm: n };
    case KEYS.padBottomXDiameter: return { ...r, bottomMeshX: patchMesh(r.bottomMeshX, 'diameterMm', n) };
    case KEYS.padBottomXSpacing: return { ...r, bottomMeshX: patchMesh(r.bottomMeshX, 'spacingMm', n) };
    case KEYS.padBottomYDiameter: return { ...r, bottomMeshY: patchMesh(r.bottomMeshY, 'diameterMm', n) };
    case KEYS.padBottomYSpacing: return { ...r, bottomMeshY: patchMesh(r.bottomMeshY, 'spacingMm', n) };
    case KEYS.padTopEnabled:
      return value === 'on'
        ? { ...r, topMesh: r.topMesh ?? defaultTopMesh(r) }
        : { ...r, topMesh: undefined };
    case KEYS.padTopDiameter:
      return { ...r, topMesh: patchMesh(r.topMesh ?? defaultTopMesh(r), 'diameterMm', n) };
    case KEYS.padTopSpacing:
      return { ...r, topMesh: patchMesh(r.topMesh ?? defaultTopMesh(r), 'spacingMm', n) };
    default: return null;
  }
}

function patchStrip(r: StripReinforcement, key: string, value: string): StripReinforcement | null {
  const n = Number.parseFloat(value);
  switch (key) {
    case KEYS.cover: return Number.isNaN(n) ? r : { ...r, coverMm: n };
    case KEYS.stripTransverseDiameter: return { ...r, transverse: patchMesh(r.transverse, 'diameterMm', n) };
    case KEYS.stripTransverseSpacing: return { ...r, transverse: patchMesh(r.transverse, 'spacingMm', n) };
    case KEYS.stripLongitudinalDiameter: return { ...r, longitudinal: patchLayer(r.longitudinal, 'diameterMm', n) };
    case KEYS.stripLongitudinalCount: return { ...r, longitudinal: patchLayer(r.longitudinal, 'count', n) };
    case KEYS.stripStirrupEnabled:
      return value === 'on'
        ? { ...r, stirrups: r.stirrups ?? defaultStripStirrups() }
        : { ...r, stirrups: undefined };
    case KEYS.stripStirrupDiameter:
      return { ...r, stirrups: patchStirrups(r.stirrups ?? defaultStripStirrups(), 'diameterMm', n) };
    case KEYS.stripStirrupSpacing:
      return { ...r, stirrups: patchStirrups(r.stirrups ?? defaultStripStirrups(), 'spacingMm', n) };
    default: return null;
  }
}

function patchTieBeam(r: TieBeamReinforcement, key: string, value: string): TieBeamReinforcement | null {
  const n = Number.parseFloat(value);
  switch (key) {
    case KEYS.cover: return Number.isNaN(n) ? r : { ...r, coverMm: n };
    case KEYS.tieBottomDiameter: return { ...r, bottom: patchLayer(r.bottom, 'diameterMm', n) };
    case KEYS.tieBottomCount: return { ...r, bottom: patchLayer(r.bottom, 'count', n) };
    case KEYS.tieTopDiameter: return { ...r, top: patchLayer(r.top, 'diameterMm', n) };
    case KEYS.tieTopCount: return { ...r, top: patchLayer(r.top, 'count', n) };
    case KEYS.tieStirrupDiameter: return { ...r, stirrups: patchStirrups(r.stirrups, 'diameterMm', n) };
    case KEYS.tieStirrupSpacing: return { ...r, stirrups: patchStirrups(r.stirrups, 'spacingMm', n) };
    case KEYS.tieStirrupCriticalSpacing: return { ...r, stirrups: patchStirrups(r.stirrups, 'spacingCriticalMm', n) };
    default: return null;
  }
}

/** Νέο `FootingReinforcement` με ενημερωμένο ένα πεδίο (immutable), ή `null`. */
export function patchFoundationStructuralField(
  r: FootingReinforcement,
  commandKey: string,
  value: string,
): FootingReinforcement | null {
  switch (r.kind) {
    case 'pad': return patchPad(r, commandKey, value);
    case 'strip': return patchStrip(r, commandKey, value);
    case 'tie-beam': return patchTieBeam(r, commandKey, value);
  }
}
