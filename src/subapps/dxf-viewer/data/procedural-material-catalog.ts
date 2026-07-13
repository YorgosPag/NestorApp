/**
 * ADR-653 Φ9 — Procedural Material Catalog SSoT (διαδικαστικά «ζωντανά» υλικά).
 *
 * Κάθε εγγραφή = μία γεννήτρια tile που ΖΩΓΡΑΦΙΖΕΤΑΙ από παραμέτρους (γεννήτρια + χρώματα
 * + αρμός), όχι από αρχείο εικόνας → μηδέν asset, πλήρως επεξεργάσιμα χρώματα, τέλεια
 * ευκρίνεια. Το `assetId` ενός procedural fill = `proc:<generator>` (σταθερό prefix,
 * ΠΟΤΕ σύγκρουση με builtin `matimg-*` ή upload `bmat_*`).
 *
 * Αυτός ο κατάλογος ορίζει τα **defaults** ανά γεννήτρια (χρώματα / πραγματικό μέγεθος
 * repeat-unit / αρμός) + i18n όνομα. Το «πώς ζωγραφίζεται» ζει στον renderer
 * (`procedural-tile-render.ts`) — εδώ ΜΟΝΟ δεδομένα (size-exempt).
 *
 * @see ../rendering/entities/shared/procedural-tile-render.ts — η ζωγραφική (params → canvas)
 * @see ../bim/hatch/hatch-image-build.ts — επιλογή procedural → default params (proc: prefix)
 * @see docs/centralized-systems/reference/adrs/ADR-653-editable-and-procedural-hatch-materials.md §4.1
 */

import type { ProceduralGeneratorId, HatchProceduralParams } from '../types/entities';

/** Σταθερό prefix του procedural assetId (διακριτό από `matimg-*` / `bmat_*`). */
export const PROCEDURAL_ASSET_PREFIX = 'proc:';

/** True όταν το assetId ανήκει σε procedural υλικό (`proc:<generator>`). */
export function isProceduralAssetId(assetId: string | undefined): boolean {
  return !!assetId && assetId.startsWith(PROCEDURAL_ASSET_PREFIX);
}

/** `proc:<generator>` για μια γεννήτρια. */
export function proceduralAssetId(generator: ProceduralGeneratorId): string {
  return `${PROCEDURAL_ASSET_PREFIX}${generator}`;
}

/** Ορισμός μιας διαδικαστικής γεννήτριας (default παράμετροι + πραγματικό μέγεθος + i18n). */
export interface ProceduralMaterialDef {
  readonly generator: ProceduralGeneratorId;
  /** Default χρώματα (1–2)· η γεννήτρια ερμηνεύει πόσα χρειάζεται. */
  readonly defaultColors: readonly string[];
  /** Default πάχος αρμού (mm)· 0 = χωρίς αρμό. */
  readonly defaultJointMm: number;
  /** Default χρώμα αρμού (hex). */
  readonly defaultJointColor: string;
  /** Πραγματικό μέγεθος repeat-unit (mm) — width/height του tile. Τετράγωνο εκτός stripes/brick. */
  readonly defaultTileWidthMm: number;
  readonly defaultTileHeightMm: number;
  /** i18n suffix κάτω από `proceduralMaterials.<suffix>`. */
  readonly labelKeySuffix: string;
}

// ─── Catalog ──────────────────────────────────────────────────────────────────

const CATALOG: readonly ProceduralMaterialDef[] = [
  {
    // Σκακιέρα — 2 χρώματα εναλλάξ (repeat-unit = 2×2 κελιά· κάθε κελί = tile/2).
    generator: 'checker',
    defaultColors: ['#1a1a1a', '#f5f5f5'],
    defaultJointMm: 0,
    defaultJointColor: '#808080',
    defaultTileWidthMm: 600, // → 300 mm κελί
    defaultTileHeightMm: 600,
    labelKeySuffix: 'checker',
  },
  {
    // Πλακίδιο με αρμό — ενιαίο χρώμα + πλέγμα αρμών στα όρια.
    generator: 'grid-tile',
    defaultColors: ['#d8d4cc'],
    defaultJointMm: 8,
    defaultJointColor: '#9a9488',
    defaultTileWidthMm: 300,
    defaultTileHeightMm: 300,
    labelKeySuffix: 'gridTile',
  },
  {
    // Τούβλο (ιμάντας μισής μετατόπισης) — τούβλο + κονίαμα (αρμός).
    generator: 'running-bond',
    defaultColors: ['#9c4a2f'],
    defaultJointMm: 12,
    defaultJointColor: '#d9cbb2',
    defaultTileWidthMm: 200, // μήκος τούβλου (repeat-unit πλάτος)
    defaultTileHeightMm: 130, // 2 σειρές × 65 mm
    labelKeySuffix: 'runningBond',
  },
  {
    // Ρίγες — 2 εναλλασσόμενες μπάντες (μόνωση/μεμβράνες/διακόσμηση).
    generator: 'stripes',
    defaultColors: ['#3d5a80', '#e0e0e0'],
    defaultJointMm: 0,
    defaultJointColor: '#808080',
    defaultTileWidthMm: 200,
    defaultTileHeightMm: 200, // → 2 μπάντες × 100 mm
    labelKeySuffix: 'stripes',
  },
  {
    // Ψαροκόκαλο (herringbone parquet) — 2 τόνοι ξύλου εναλλάξ ανά προσανατολισμό + αρμός.
    // repeat-unit = 4W × 4W (W = πλάτος σανίδας)· σανίδα 150 × 75 mm (λόγος 2:1).
    generator: 'herringbone',
    defaultColors: ['#a9743f', '#8a5a2e'],
    defaultJointMm: 4,
    defaultJointColor: '#5e4426',
    defaultTileWidthMm: 300, // 4 × 75 mm
    defaultTileHeightMm: 300,
    labelKeySuffix: 'herringbone',
  },
  {
    // Πλέξη (basketweave) — τετράδες σανίδων εναλλάξ οριζόντια/κάθετα (ψάθα/παρκέ) + αρμός.
    // repeat-unit = 4W × 4W· μπλοκ 150 mm (2 σανίδες 150 × 75 mm).
    generator: 'basketweave',
    defaultColors: ['#c19a6b', '#a97f52'],
    defaultJointMm: 4,
    defaultJointColor: '#6f5636',
    defaultTileWidthMm: 300,
    defaultTileHeightMm: 300,
    labelKeySuffix: 'basketweave',
  },
  {
    // Εξάγωνο πλακάκι (hex mosaic) — 1 χρώμα πλακιδίου + αρμός (grout).
    // Κανονικό pointy-top hex, R = 100 mm → rectangular repeat-unit √3R × 3R = 173 × 300 mm.
    generator: 'hexagon',
    defaultColors: ['#d8d4cc'],
    defaultJointMm: 8,
    defaultJointColor: '#9a9488',
    defaultTileWidthMm: 173, // √3 × 100 mm
    defaultTileHeightMm: 300, // 3 × 100 mm
    labelKeySuffix: 'hexagon',
  },
];

const CATALOG_MAP: ReadonlyMap<ProceduralGeneratorId, ProceduralMaterialDef> = new Map(
  CATALOG.map((def) => [def.generator, def]),
);

// ─── Public accessors ─────────────────────────────────────────────────────────

/** Όλες οι διαθέσιμες γεννήτριες (για τον picker). */
export function listProceduralMaterials(): readonly ProceduralMaterialDef[] {
  return CATALOG;
}

/** Ορισμός γεννήτριας από generator id, ή `undefined` για άγνωστη. */
export function getProceduralMaterial(
  generator: ProceduralGeneratorId,
): ProceduralMaterialDef | undefined {
  return CATALOG_MAP.get(generator);
}

/** Ορισμός γεννήτριας από `proc:<generator>` assetId, ή `undefined` αν δεν είναι procedural/άγνωστο. */
export function getProceduralMaterialByAssetId(
  assetId: string | undefined,
): ProceduralMaterialDef | undefined {
  if (!isProceduralAssetId(assetId)) return undefined;
  const gen = assetId!.slice(PROCEDURAL_ASSET_PREFIX.length) as ProceduralGeneratorId;
  return getProceduralMaterial(gen);
}

/** Default `HatchProceduralParams` για μια γεννήτρια (νέα επιλογή procedural υλικού). */
export function defaultProceduralParams(generator: ProceduralGeneratorId): HatchProceduralParams {
  const def = getProceduralMaterial(generator);
  if (!def) return { generator, colors: ['#808080'] };
  return {
    generator,
    colors: [...def.defaultColors],
    ...(def.defaultJointMm > 0 ? { jointMm: def.defaultJointMm, jointColor: def.defaultJointColor } : {}),
  };
}

/** Default πραγματικό μέγεθος tile (mm) μιας γεννήτριας. Άγνωστη → 300×300 ασφαλές. */
export function proceduralDefaultTileMm(
  generator: ProceduralGeneratorId,
): { readonly width: number; readonly height: number } {
  const def = getProceduralMaterial(generator);
  return def
    ? { width: def.defaultTileWidthMm, height: def.defaultTileHeightMm }
    : { width: 300, height: 300 };
}

/** Πλήρες i18n key για το όνομα γεννήτριας. */
export function proceduralMaterialLabelKey(def: ProceduralMaterialDef): string {
  return `proceduralMaterials.${def.labelKeySuffix}`;
}
