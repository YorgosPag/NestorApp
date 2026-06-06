/**
 * ADR-396 Phase P10 — Per-wall-type U-value analytics (SSOT adapter).
 *
 * Pure analytics module: μετατρέπει WallDna σε ThermalLayer[] και υπολογίζει
 * U (W/m²K) ανά τύπο τοίχου. Reuses εξ ολοκλήρου:
 *   - `assembly-u-value.ts` — ISO 6946 math (SSOT)
 *   - `wall-material-catalog.ts` — λ ανά υλικό (SSOT)
 *   - `wall-dna-types.ts` — WallDna schema
 *
 * «Hybrid B+A» decision (§0 handoff 2026-06-06): DNA δεν αλλάζει για ETICS,
 * αλλά υπολογισμός U ΜΕ ETICS γίνεται virtual append (χωρίς mutation).
 *
 * ΔΕΝ περιέχει state / geometry / persistence. Καλείται από:
 *   - ThermalEnvelopeDialog (U display με επιλεγμένο wall type)
 *   - IFC wall serializer (Pset_WallCommon.ThermalTransmittance)
 *
 * @see ./assembly-u-value (computeAssemblyUValue — pure ISO 6946)
 * @see ../walls/wall-material-catalog (getThermalConductivityLambda — λ SSOT)
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §7 (P10)
 */

import type { WallDna } from '../types/wall-dna-types';
import type { ThermalLayer, SurfaceResistances } from './assembly-u-value';
import { computeAssemblyUValue } from './assembly-u-value';
import { getThermalConductivityLambda } from '../walls/wall-material-catalog';

// ─── Conversion ──────────────────────────────────────────────────────────────

/**
 * Μετατρέπει WallDna σε ThermalLayer[]. Στρώσεις με άγνωστο λ (custom/
 * unmapped preset) παραλείπονται — ο caller δέχεται μειωμένη ακρίβεια.
 * Θερμικά άσχετα υλικά (vapor barrier, cladding) απουσιάζουν από τον
 * κατάλογο λ οπότε παραλείπονται αυτόματα.
 */
export function wallDnaToThermalLayers(dna: WallDna): ThermalLayer[] {
  const out: ThermalLayer[] = [];
  for (const layer of dna.layers) {
    const lambda = getThermalConductivityLambda(layer.materialId);
    if (lambda === undefined) continue;
    out.push({ thickness_m: layer.thickness * 0.001, lambda });
  }
  return out;
}

// ─── U-value from DNA ─────────────────────────────────────────────────────────

/**
 * U (W/m²K) ενός τύπου τοίχου από τα υπάρχοντα WallDna layers. ISO 6946
 * steady-state 1D. Custom/άγνωστα υλικά παραλείπονται (μειωμένη ακρίβεια).
 */
export function computeWallTypeUValue(
  dna: WallDna,
  surface?: SurfaceResistances,
): number {
  return computeAssemblyUValue(wallDnaToThermalLayers(dna), surface);
}

// ─── Envelope spec for virtual ETICS append ──────────────────────────────────

/** Ένα virtual envelope layer για τον υπολογισμό U «με κέλυφος». */
export interface EnvelopeLayerInput {
  /** Πάχος ETICS σε ΜΕΤΡΑ. */
  readonly thickness_m: number;
  /** Material ID (preset slug) — αν άγνωστο, η στρώση παραλείπεται. */
  readonly materialId: string;
}

/**
 * U (W/m²K) τοίχου **με** virtual ETICS στρώση (εξωτερικά, append χωρίς
 * mutation DNA). Αντιστοιχεί στο «U τοίχου με κέλυφος» στο dialog.
 *
 * Αν το `envelopeLayer.materialId` δεν έχει γνωστό λ → χρησιμοποιεί μόνο
 * τα DNA layers (ίδιο αποτέλεσμα με `computeWallTypeUValue`).
 */
export function computeWallTypeUValueWithEnvelope(
  dna: WallDna,
  envelopeLayer: EnvelopeLayerInput,
  surface?: SurfaceResistances,
): number {
  const baseLayers = wallDnaToThermalLayers(dna);
  const lambda = getThermalConductivityLambda(envelopeLayer.materialId);
  if (lambda !== undefined) {
    baseLayers.push({ thickness_m: envelopeLayer.thickness_m, lambda });
  }
  return computeAssemblyUValue(baseLayers, surface);
}
