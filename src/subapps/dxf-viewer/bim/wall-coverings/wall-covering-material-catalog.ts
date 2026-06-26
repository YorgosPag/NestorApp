/**
 * Wall Covering Material Catalog — SSoT (ADR-511).
 *
 * Built-in υλικά φινιρίσματος τοίχου: μπογιές (λευκό/κόκκινο/πράσινο/γαλάζιο), παραδοσιακός
 * σοβάς, knauf (γυψοσανίδα), κεραμικά πλακίδια, κόλλα. Κάθε υλικό φέρει: χρώμα 2D, hatch,
 * default πάχος, layer-function, θερμικό λ (bonus — δένει με θερμική μελέτη), PBR slug (3D),
 * i18n key suffix. Mirror του `floor-finish-material-catalog.ts`.
 *
 * @see bim/types/wall-covering-types.ts
 * @see bim/floor-finishes/floor-finish-material-catalog.ts — το πρότυπο
 */

import type { PbrTextureSlug } from '../materials/bim-texture-registry';
import type {
  WallCoveringHatchType,
  WallCoveringLayerFunction,
  WallCoveringMaterialId,
} from '../types/wall-covering-types';

/** Ορισμός ενός υλικού του catalog. */
export interface WallCoveringMaterialDef {
  readonly id: WallCoveringMaterialId;
  /** W/(m·K) θερμική αγωγιμότητα (bonus για θερμική συμβολή). */
  readonly lambda: number;
  /** CSS hex για το 2D plan fill. */
  readonly color: string;
  readonly hatch: WallCoveringHatchType;
  /** mm — τυπικό πάχος στρώσης (0 για μπογιά). */
  readonly defaultThicknessMm: number;
  /** Ρόλος στρώσης στο assembly. */
  readonly defaultFunction: WallCoveringLayerFunction;
  /** ADR-413 PBR registry key (3D). */
  readonly pbrSlug?: PbrTextureSlug;
  /** i18n key suffix (ribbon.commands.bim.wallCovering.material.<suffix>). */
  readonly labelKeySuffix: string;
}

const CATALOG: readonly WallCoveringMaterialDef[] = [
  { id: 'paint-white', lambda: 0.70, color: '#F5F5F0', hatch: 'solid', defaultThicknessMm: 0, defaultFunction: 'surface', pbrSlug: 'plaster', labelKeySuffix: 'paintWhite' },
  { id: 'paint-red', lambda: 0.70, color: '#C0392B', hatch: 'solid', defaultThicknessMm: 0, defaultFunction: 'surface', pbrSlug: 'plaster', labelKeySuffix: 'paintRed' },
  { id: 'paint-green', lambda: 0.70, color: '#27AE60', hatch: 'solid', defaultThicknessMm: 0, defaultFunction: 'surface', pbrSlug: 'plaster', labelKeySuffix: 'paintGreen' },
  { id: 'paint-blue', lambda: 0.70, color: '#5DADE2', hatch: 'solid', defaultThicknessMm: 0, defaultFunction: 'surface', pbrSlug: 'plaster', labelKeySuffix: 'paintBlue' },
  { id: 'paint-yellow', lambda: 0.70, color: '#F4D03F', hatch: 'solid', defaultThicknessMm: 0, defaultFunction: 'surface', pbrSlug: 'plaster', labelKeySuffix: 'paintYellow' },
  { id: 'plaster-traditional', lambda: 0.87, color: '#D7CCC0', hatch: 'plaster', defaultThicknessMm: 20, defaultFunction: 'body', pbrSlug: 'plaster', labelKeySuffix: 'plasterTraditional' },
  { id: 'plaster-spackle', lambda: 0.87, color: '#E8DFD0', hatch: 'plaster', defaultThicknessMm: 2, defaultFunction: 'surface', pbrSlug: 'plaster', labelKeySuffix: 'plasterSpackle' },
  { id: 'knauf-gypsum-board', lambda: 0.25, color: '#ECE9E2', hatch: 'board', defaultThicknessMm: 12.5, defaultFunction: 'body', pbrSlug: 'plaster', labelKeySuffix: 'knaufGypsumBoard' },
  { id: 'tile-ceramic', lambda: 1.30, color: '#AED6F1', hatch: 'tile', defaultThicknessMm: 8, defaultFunction: 'body', pbrSlug: 'tile', labelKeySuffix: 'tileCeramic' },
  { id: 'adhesive-mortar', lambda: 1.00, color: '#BDBDB0', hatch: 'solid', defaultThicknessMm: 4, defaultFunction: 'adhesive', pbrSlug: 'concrete', labelKeySuffix: 'adhesiveMortar' },
] as const;

const BY_ID: ReadonlyMap<WallCoveringMaterialId, WallCoveringMaterialDef> = new Map(
  CATALOG.map((m) => [m.id, m]),
);

/** Όλα τα υλικά (για ribbon combobox). */
export function listWallCoveringMaterials(): readonly WallCoveringMaterialDef[] {
  return CATALOG;
}

/** Ένα υλικό ή `undefined`. */
export function getWallCoveringMaterial(id: WallCoveringMaterialId): WallCoveringMaterialDef | undefined {
  return BY_ID.get(id);
}

/** CSS hex χρώμα του υλικού (2D plan). Fallback ουδέτερο γκρι. */
export function getWallCoveringColor(id: WallCoveringMaterialId): string {
  return BY_ID.get(id)?.color ?? '#9E9E9E';
}

/** Hatch οικογένεια του υλικού. */
export function getWallCoveringHatchType(id: WallCoveringMaterialId): WallCoveringHatchType {
  return BY_ID.get(id)?.hatch ?? 'solid';
}

/** Θερμικό λ (W/mK). */
export function getWallCoveringLambda(id: WallCoveringMaterialId): number {
  return BY_ID.get(id)?.lambda ?? 0.7;
}

/** Default πάχος στρώσης (mm). */
export function getWallCoveringDefaultThicknessMm(id: WallCoveringMaterialId): number {
  return BY_ID.get(id)?.defaultThicknessMm ?? 0;
}

/** Default layer function. */
export function getWallCoveringDefaultFunction(id: WallCoveringMaterialId): WallCoveringLayerFunction {
  return BY_ID.get(id)?.defaultFunction ?? 'surface';
}

/** PBR slug (3D). */
export function getWallCoveringPbrSlug(id: WallCoveringMaterialId): PbrTextureSlug | undefined {
  return BY_ID.get(id)?.pbrSlug;
}
