/**
 * Wall masonry line-loads — pure SSoT (ADR-478, T1).
 *
 * Revit-grade «zero-input» γραμμικό μόνιμο φορτίο τοιχοποιίας: ο μηχανικός **δεν
 * πληκτρολογεί kN/m**. Από το πάχος/ύψος του τοίχου + την πυκνότητα των υλικών
 * (DNA layers) παράγεται αυτόματα το χαρακτηριστικό φορτίο που μεταφέρει ο τοίχος
 * στη φέρουσα δοκό:
 *
 *   · Φορτίο όψης  g_face [kN/m²] = Σ(layer.t[m] · γ_layer[kN/m³])  (πλήρες ίδιο βάρος).
 *   · Γραμμικό     g_wall [kN/m]  = g_face · ύψος[m]  → στη δοκό που πατάει.
 *
 * Πιο ακριβές από τον πίνακα μπατική 3.6 / δρομική 2.1 kN/m² του τεύχους — η τιμή
 * παράγεται per-wall από τη μοντελοποιημένη γεωμετρία+υλικό (Revit way: DNA layers).
 *
 * **Φέρον τοίχωμα Ο.Σ. (shear wall) ≠ τοιχοποιία πληρώσεως:** χυτό σκυρόδεμα στον
 * πυρήνα = κατακόρυφο δομικό μέλος (πατάει σε θεμελίωση, T6) — ΔΕΝ μοντελοποιείται
 * ως γραμμικό φορτίο δοκού ({@link isMasonryLineLoadCandidate}).
 *
 * **Override (Revit-grade):** αν δοθεί ρητή τιμή kN/m, αυτή **κερδίζει**· αλλιώς
 * αυτόματο default από γεωμετρία+υλικό. Μηδέν input μηχανικού στο default path.
 *
 * Pure — zero React/DOM/Firestore. Μονάδες: φορτία kN/m & kN/m², μήκη mm (input).
 *
 * @see ./wall-beam-support.ts — ο καταναλωτής (wall → δοκός spatial aggregation)
 * @see ../../walls/wall-material-catalog.ts — `WALL_MATERIAL_DENSITY` / `getDensity`
 * @see docs/centralized-systems/reference/adrs/ADR-478-wall-line-loads.md
 */

import type { WallParams } from '../../types/wall-types';
import { getDensity } from '../../walls/wall-material-catalog';
import { GRAVITY_MS2 } from './member-load-geometry';

/**
 * kg/m³ — fallback πυκνότητα τοιχοποιίας όταν το υλικό ενός layer είναι άγνωστο
 * (κόκκινο διάτρητο τούβλο, EN1991-1-1 / ΤΟΤΕΕ). Ποτέ silent-drop βάρους.
 */
export const DEFAULT_MASONRY_DENSITY_KG_M3 = 1800;

/** kN/m³ ειδικό βάρος από πυκνότητα (kg/m³): γ = ρ·g/1000. */
function unitWeightKnM3(densityKgM3: number): number {
  return (densityKgM3 * GRAVITY_MS2) / 1000;
}

/** True όταν το υλικό είναι **χυτό** δομικό σκυρόδεμα Ο.Σ. (mat-concrete-cNN) — όχι μπλοκ. */
function isStructuralConcrete(materialId: string | undefined): boolean {
  return !!materialId && /^mat-concrete-c\d/.test(materialId);
}

/** Μόνο πάχος+υλικό που χρειάζονται για το φορτίο όψης (per-layer ή single). */
type WallLoadParams = Pick<WallParams, 'dna' | 'thickness' | 'material' | 'height'>;

/** kN/m² ενός layer = t[m] · γ[kN/m³]· άγνωστη πυκνότητα → fallback τοιχοποιίας. */
function layerFaceLoadKpa(thicknessMm: number, materialId: string | undefined): number {
  const t = thicknessMm > 0 ? thicknessMm : 0;
  const density = getDensity(materialId) ?? DEFAULT_MASONRY_DENSITY_KG_M3;
  return (t / 1000) * unitWeightKnM3(density);
}

/**
 * ADR-478 — φορτίο όψης τοίχου g_face (kN/m²) = άθροισμα ιδίου βάρους ΟΛΩΝ των
 * layers (σοβάς + τούβλο + μόνωση). DNA present → per-layer· αλλιώς ενιαίο
 * `thickness` + `material` (generic wall).
 */
export function resolveWallFaceLoadKpa(params: WallLoadParams): number {
  const layers = params.dna?.layers;
  if (layers && layers.length > 0) {
    return layers.reduce((sum, l) => sum + layerFaceLoadKpa(l.thickness, l.materialId), 0);
  }
  return layerFaceLoadKpa(params.thickness, params.material);
}

/**
 * ADR-478 — γραμμικό μόνιμο φορτίο g_wall (kN/m) που μεταφέρει ο τοίχος στη δοκό
 * που πατάει = g_face · ύψος[m]. Μη-θετικό ύψος ⇒ 0.
 */
export function resolveWallLineLoadKnm(params: WallLoadParams): number {
  const heightM = (params.height > 0 ? params.height : 0) / 1000;
  return resolveWallFaceLoadKpa(params) * heightM;
}

/**
 * ADR-478 — true όταν ο τοίχος είναι τοιχοποιία πληρώσεως (μεταφέρει γραμμικό
 * φορτίο στη φέρουσα δοκό), ΟΧΙ φέρον τοίχωμα Ο.Σ. (shear wall = κατακόρυφο μέλος,
 * T6). Κριτήριο: το υλικό του CORE layer δεν είναι χυτό σκυρόδεμα. Χωρίς DNA →
 * `params.material` (drawn walls default = τούβλο → candidate).
 */
export function isMasonryLineLoadCandidate(params: Pick<WallParams, 'dna' | 'material'>): boolean {
  const layers = params.dna?.layers;
  const coreMaterial =
    layers && layers.length > 0
      ? (layers.find((l) => l.side === 'core') ?? layers[0]).materialId
      : params.material;
  return !isStructuralConcrete(coreMaterial);
}

// ─── Effective resolver (explicit-wins, αλλιώς auto) — future-proof ───────────

/** True όταν μια τιμή είναι έγκυρη πεπερασμένη θετική (explicit override). */
function isPositiveKnm(v: number | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

/** Είσοδος επίλυσης ενεργού γραμμικού φορτίου τοίχου — explicit override + params. */
export interface EffectiveWallLineLoadInput {
  /** Ρητό γραμμικό μόνιμο φορτίο (kN/m) — override· absent ⇒ auto από γεωμετρία+υλικό. */
  readonly explicitDeadLineLoadKnm?: number;
  /** Παράμετροι τοίχου για το auto default. */
  readonly params: WallLoadParams;
}

/** Ενεργό γραμμικό φορτίο τοίχου (kN/m), έτοιμο για aggregation στη δοκό. */
export interface EffectiveWallLineLoad {
  readonly deadLineLoadKnm: number;
}

/**
 * ADR-478 — **ΕΝΑ SSoT** επίλυσης ενεργού γραμμικού φορτίου τοιχοποιίας. Revit-grade
 * override: ρητή kN/m **κερδίζει**· αλλιώς αυτόματο default από γεωμετρία+υλικό.
 * Η τοιχοποιία είναι αμιγώς μόνιμη δράση (G) — μηδέν live συνιστώσα.
 */
export function resolveEffectiveWallLineLoad(
  input: EffectiveWallLineLoadInput,
): EffectiveWallLineLoad {
  return {
    deadLineLoadKnm: isPositiveKnm(input.explicitDeadLineLoadKnm)
      ? input.explicitDeadLineLoadKnm
      : resolveWallLineLoadKnm(input.params),
  };
}
