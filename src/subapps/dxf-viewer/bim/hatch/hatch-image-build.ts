/**
 * Hatch image-fill build SSoT (ADR-643 Φ3) — mirror του `hatch-gradient-build.ts`.
 *
 * ΕΝΑ σημείο που χτίζει/ενημερώνει (immutable) το `HatchImageFill` nested object,
 * μοιρασμένο από:
 *   - `hatch-completion` (νέα γραμμοσκίαση από draw-defaults),
 *   - `useRibbonHatchBridge` (επεξεργασία επιλεγμένης — asset/διάσταση/γωνία).
 * Έτσι η «κατασκευή imageFill από defaults» + «patch ενός πεδίου» ορίζονται ΜΙΑ φορά
 * (N.12/N.18 — αλλιώς sibling clone σε completion + bridge).
 *
 * Big-player (Revit/ArchiCAD): επιλογή υλικού → υιοθετεί το ΠΡΑΓΜΑΤΙΚΟ μέγεθος tile
 * του υλικού (texture real-world size), το οποίο ο χρήστης μπορεί μετά να ρυθμίσει.
 *
 * @see ./hatch-gradient-build.ts — το ίδιο idiom για gradient
 * @see ../../data/material-image-catalog.ts — default tile size ανά υλικό
 * @see docs/centralized-systems/reference/adrs/ADR-643-hatch-image-fill.md §8 Φ3
 */

import type { HatchEntity } from '../../types/entities';
import type { HatchDrawDefaults } from './hatch-draw-defaults-store';
import { getMaterialImageDefaultTileMm } from '../../data/material-image-catalog';
import {
  isProceduralAssetId,
  defaultProceduralParams,
  proceduralDefaultTileMm,
  getProceduralMaterialByAssetId,
} from '../../data/procedural-material-catalog';

type HatchImageFill = NonNullable<HatchEntity['imageFill']>;

type HatchGrout = NonNullable<HatchImageFill['grout']>;

type HatchImageTint = NonNullable<HatchImageFill['tint']>;

type HatchProceduralParams = NonNullable<HatchImageFill['procedural']>;

/** Ένα πεδίο του image-fill προς αλλαγή (discriminated ώστε το value να είναι typed). */
export type ImageFieldPatch =
  | { readonly field: 'assetId'; readonly value: string }
  | { readonly field: 'tileWidth'; readonly value: number }
  | { readonly field: 'tileHeight'; readonly value: number }
  | { readonly field: 'angle'; readonly value: number }
  | { readonly field: 'groutEnabled'; readonly value: boolean }
  | { readonly field: 'groutColor'; readonly value: string }
  | { readonly field: 'groutWidth'; readonly value: number }
  // ADR-653 Φ8 — duotone επαναχρωματισμός (mirror grout: enable/χρώματα/ένταση).
  | { readonly field: 'tintEnabled'; readonly value: boolean }
  | { readonly field: 'tintColorA'; readonly value: string }
  | { readonly field: 'tintColorB'; readonly value: string }
  | { readonly field: 'tintStrength'; readonly value: number }
  // ADR-653 Φ9 — διαδικαστικό υλικό (χρώματα/αρμός· η γεννήτρια επιλέγεται μέσω assetId).
  | { readonly field: 'procColorA'; readonly value: string }
  | { readonly field: 'procColorB'; readonly value: string }
  | { readonly field: 'procJointMm'; readonly value: number }
  | { readonly field: 'procJointColor'; readonly value: string };

/** Grout object από τα draw-defaults (SSoT — μηδέν διπλότυπο default). */
function groutFromDefaults(d: HatchDrawDefaults): HatchGrout {
  return { color: d.groutColor, widthMm: d.groutWidthMm };
}

/** Tint object από τα draw-defaults (SSoT — μηδέν διπλότυπο default). */
function tintFromDefaults(d: HatchDrawDefaults): HatchImageTint {
  return { colorA: d.tintColorA, colorB: d.tintColorB, strength: d.tintStrength };
}

/**
 * Procedural params από τα draw-defaults — ΜΟΝΟ όταν το `imageAssetId` είναι `proc:*`
 * (η γεννήτρια προκύπτει από το assetId). `undefined` για raster υλικά.
 */
function proceduralFromDefaults(d: HatchDrawDefaults): HatchProceduralParams | undefined {
  const def = getProceduralMaterialByAssetId(d.imageAssetId);
  if (!def) return undefined;
  return {
    generator: def.generator,
    colors: [d.procColorA, d.procColorB],
    ...(d.procJointMm > 0 ? { jointMm: d.procJointMm, jointColor: d.procJointColor } : {}),
  };
}

/** Τρέχουσες procedural params (base ή defaults ή catalog checker) — για patch ενός πεδίου. */
function proceduralOf(base: HatchImageFill, d: HatchDrawDefaults): HatchProceduralParams {
  return base.procedural ?? proceduralFromDefaults(d) ?? defaultProceduralParams('checker');
}

/** Immutable set ενός χρώματος στη θέση `i` (γεμίζει κενά με ουδέτερο γκρι). */
function setProcColor(p: HatchProceduralParams, i: number, value: string): HatchProceduralParams {
  const colors = [...p.colors];
  while (colors.length <= i) colors.push('#808080');
  colors[i] = value;
  return { ...p, colors };
}

/** `HatchImageFill` από τα draw-defaults (νέα γραμμοσκίαση / switch σε fillType='image'). */
export function buildImageFillFromDefaults(d: HatchDrawDefaults): HatchImageFill {
  const procedural = proceduralFromDefaults(d);
  return {
    assetId: d.imageAssetId,
    tileWidth: d.imageTileWidth,
    tileHeight: d.imageTileHeight,
    angle: d.imageAngle,
    ...(d.groutEnabled ? { grout: groutFromDefaults(d) } : {}),
    // Procedural ⇒ τα χρώματα ζουν εκεί (tint αγνοείται)· αλλιώς προαιρετικό tint.
    ...(procedural ? { procedural } : (d.tintEnabled ? { tint: tintFromDefaults(d) } : {})),
  };
}

/**
 * Νέο (immutable) `HatchImageFill` = (τρέχον ή defaults) + patch ενός πεδίου. Στην
 * αλλαγή υλικού (`assetId`) υιοθετεί το πραγματικό default μέγεθος tile του υλικού
 * (Revit/ArchiCAD «texture real-world size»). Η επεξεργασία χρώματος/πάχους αρμού
 * ενεργοποιεί τους αρμούς (δημιουργεί το grout object αν λείπει).
 */
export function withImageFillPatch(
  current: HatchImageFill | undefined,
  d: HatchDrawDefaults,
  patch: ImageFieldPatch,
): HatchImageFill {
  const base = current ?? buildImageFillFromDefaults(d);
  switch (patch.field) {
    case 'assetId': {
      // ADR-653 Φ9 — επιλογή procedural υλικού: default params + tile size της γεννήτριας,
      // καθάρισε το tint (αγνοείται). Επιλογή raster: καθάρισε τυχόν procedural params.
      if (isProceduralAssetId(patch.value)) {
        const gen = getProceduralMaterialByAssetId(patch.value)?.generator ?? 'checker';
        const tile = proceduralDefaultTileMm(gen);
        const { tint: _dropTint, ...rest } = base;
        return {
          ...rest, assetId: patch.value, procedural: defaultProceduralParams(gen),
          tileWidth: tile.width, tileHeight: tile.height,
        };
      }
      const tile = getMaterialImageDefaultTileMm(patch.value);
      const { procedural: _dropProc, ...rest } = base;
      return { ...rest, assetId: patch.value, tileWidth: tile.width, tileHeight: tile.height };
    }
    case 'tileWidth':
      return { ...base, tileWidth: patch.value };
    case 'tileHeight':
      return { ...base, tileHeight: patch.value };
    case 'angle':
      return { ...base, angle: patch.value };
    case 'groutEnabled': {
      if (!patch.value) {
        const { grout: _drop, ...rest } = base;
        return rest;
      }
      return { ...base, grout: base.grout ?? groutFromDefaults(d) };
    }
    case 'groutColor':
      return { ...base, grout: { color: patch.value, widthMm: base.grout?.widthMm ?? d.groutWidthMm } };
    case 'groutWidth':
      return { ...base, grout: { color: base.grout?.color ?? d.groutColor, widthMm: patch.value } };
    // ADR-653 Φ8 — duotone tint (mirror grout: disable αφαιρεί το object· χρώμα/ένταση το δημιουργεί).
    case 'tintEnabled': {
      if (!patch.value) {
        const { tint: _drop, ...rest } = base;
        return rest;
      }
      return { ...base, tint: base.tint ?? tintFromDefaults(d) };
    }
    case 'tintColorA':
      return { ...base, tint: { ...(base.tint ?? tintFromDefaults(d)), colorA: patch.value } };
    case 'tintColorB':
      return { ...base, tint: { ...(base.tint ?? tintFromDefaults(d)), colorB: patch.value } };
    case 'tintStrength':
      return { ...base, tint: { ...(base.tint ?? tintFromDefaults(d)), strength: patch.value } };
    // ADR-653 Φ9 — procedural χρώματα/αρμός (μεταλλάσσουν το nested procedural object).
    case 'procColorA':
      return { ...base, procedural: setProcColor(proceduralOf(base, d), 0, patch.value) };
    case 'procColorB':
      return { ...base, procedural: setProcColor(proceduralOf(base, d), 1, patch.value) };
    case 'procJointMm':
      return { ...base, procedural: { ...proceduralOf(base, d), jointMm: patch.value } };
    case 'procJointColor':
      return { ...base, procedural: { ...proceduralOf(base, d), jointColor: patch.value } };
  }
}
