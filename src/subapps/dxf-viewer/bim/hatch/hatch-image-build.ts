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

type HatchImageFill = NonNullable<HatchEntity['imageFill']>;

type HatchGrout = NonNullable<HatchImageFill['grout']>;

/** Ένα πεδίο του image-fill προς αλλαγή (discriminated ώστε το value να είναι typed). */
export type ImageFieldPatch =
  | { readonly field: 'assetId'; readonly value: string }
  | { readonly field: 'tileWidth'; readonly value: number }
  | { readonly field: 'tileHeight'; readonly value: number }
  | { readonly field: 'angle'; readonly value: number }
  | { readonly field: 'groutEnabled'; readonly value: boolean }
  | { readonly field: 'groutColor'; readonly value: string }
  | { readonly field: 'groutWidth'; readonly value: number };

/** Grout object από τα draw-defaults (SSoT — μηδέν διπλότυπο default). */
function groutFromDefaults(d: HatchDrawDefaults): HatchGrout {
  return { color: d.groutColor, widthMm: d.groutWidthMm };
}

/** `HatchImageFill` από τα draw-defaults (νέα γραμμοσκίαση / switch σε fillType='image'). */
export function buildImageFillFromDefaults(d: HatchDrawDefaults): HatchImageFill {
  return {
    assetId: d.imageAssetId,
    tileWidth: d.imageTileWidth,
    tileHeight: d.imageTileHeight,
    angle: d.imageAngle,
    ...(d.groutEnabled ? { grout: groutFromDefaults(d) } : {}),
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
      const tile = getMaterialImageDefaultTileMm(patch.value);
      return { ...base, assetId: patch.value, tileWidth: tile.width, tileHeight: tile.height };
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
  }
}
