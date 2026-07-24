/**
 * Material catalog definitions — pure SSoT (NO three.js).
 *
 * The colour + PBR-coefficient table (`MATERIAL_DEFS`) and the materialId → key
 * prefix resolver (`resolveMaterialKey`), extracted from `MaterialCatalog3D.ts`
 * so that 2D UI — material swatches in the layer editors / materials panel
 * (ADR-413 §2D appearance) — can resolve a material's appearance WITHOUT pulling
 * three.js into the UI bundle. `MaterialCatalog3D` imports these and wraps them in
 * `THREE.MeshStandardMaterial`; the swatch UI reads the same colour/key so the 2D
 * chip matches the 3D render exactly (one source of truth).
 *
 * Types/data file (size-exempt): no runtime logic beyond a pure lookup.
 *
 * @see ../../bim-3d/materials/MaterialCatalog3D.ts — 3D consumer (textured materials)
 * @see ./material-thumbnail-resolver.ts — 2D consumer (slug → albedo image)
 * @see docs/centralized-systems/reference/adrs/ADR-413-pbr-textures.md
 */

import type { BimMaterialCategory } from '../types/bim-material-types';
// 🏢 ADR-571: MEP water/plumbing cyan SSoT + hex→int SSoT (utils/dxf-true-color.ts)
import { MEP_WATER_COLOR } from '../../config/color-config';
import { hexToTrueColor, trueColorToHex } from '../../utils/dxf-true-color';
import { clamp, clamp01 } from '../../utils/scalar-math';

/** Flat PBR appearance definition for a resolved material key. */
export interface PbrMaterialDef {
  readonly color: number;
  readonly roughness: number;
  readonly metalness: number;
  readonly transparent?: boolean;
  readonly opacity?: number;
  /** ADR-687 Φ4 — self-illumination colour (true-colour int); default black = off. */
  readonly emissive?: number;
  /** ADR-687 Φ4 — self-illumination strength 0..1; default 0 = off. */
  readonly emissiveIntensity?: number;
  /** ADR-687 Φ5 — clearcoat layer strength 0..1; default 0 = off (needs MeshPhysicalMaterial). */
  readonly clearcoat?: number;
  /** ADR-687 Φ5 — clearcoat glossiness 0..1 (0 = mirror). */
  readonly clearcoatRoughness?: number;
  /** ADR-687 Φ5 — transmission 0..1 (glass/water refraction); default 0 = off (needs MeshPhysicalMaterial). */
  readonly transmission?: number;
  /** ADR-687 Φ5 — index of refraction 1.0..2.333; default 1.5 (glass). */
  readonly ior?: number;
  /** ADR-687 Φ5 — volume thickness for transmission tint; default 0. */
  readonly thickness?: number;
}

/**
 * ADR-366 §7.1 material definitions, keyed by materialId prefix (`mat-*` DNA
 * materials + `elem-*` element-type fallbacks). The key set drives
 * `resolveMaterialKey`'s prefix match; the `color` is the SSoT for both the 3D
 * flat material and the 2D fallback swatch chip.
 */
export const MATERIAL_DEFS: Record<string, PbrMaterialDef> = {
  // Keyed by materialId prefix — matches wall-dna-types.ts materialId conventions.
  'mat-concrete': { color: 0xb0b0b0, roughness: 0.80, metalness: 0.00 },
  'mat-plaster':  { color: 0xe8e0d0, roughness: 0.90, metalness: 0.00 },
  'mat-brick':    { color: 0xb05030, roughness: 0.85, metalness: 0.00 },
  'mat-stone':    { color: 0x907060, roughness: 0.95, metalness: 0.00 },
  'mat-tile':     { color: 0xf0ece0, roughness: 0.30, metalness: 0.00 },
  'mat-wood':     { color: 0x8b5e3c, roughness: 0.70, metalness: 0.00 },
  'mat-glass':    { color: 0x88ccff, roughness: 0.10, metalness: 0.00, transparent: true, opacity: 0.35 },
  'mat-metal':    { color: 0x888888, roughness: 0.30, metalness: 0.90 },
  // ADR-416 — composite slab build-up layer materials (Revit Floor Type).
  // Cement screed: warm light grey, very matte cementitious surface.
  'mat-screed':     { color: 0xc9c4bb, roughness: 0.88, metalness: 0.00 },
  // Thermal/acoustic insulation (XPS/EPS/mineral wool): pale yellow board, matte.
  'mat-insulation': { color: 0xede4b0, roughness: 0.95, metalness: 0.00 },
  // Waterproof / vapour membrane (bitumen/PVC sheet): dark grey, smooth (low roughness).
  'mat-membrane':   { color: 0x3a3a3e, roughness: 0.45, metalness: 0.00 },
  // Gravel ballast / protection layer: grey-brown aggregate, fully rough.
  'mat-gravel':     { color: 0x9a948a, roughness: 1.00, metalness: 0.00 },
  // Generic floor finish (when not ceramic tile): neutral light, semi-matte.
  'mat-finish':     { color: 0xe8e4dc, roughness: 0.50, metalness: 0.00 },
  // ADR-417 — clay roof tile (κεραμίδι) covering layer: terracotta, matte. Maps to
  // the CC0 'roof-tiles' PBR set (Poly Haven), so a roof top layer set to this
  // material renders real κεραμίδια in 3D.
  'mat-roof-tile':  { color: 0x9e4a2c, roughness: 0.85, metalness: 0.00 },
  // Element-type fallbacks (when no DNA is present).
  // ADR-445 — per-category colour identity (muted 3D tones της 2D παλέτας ώστε να μην
  // φαίνονται cartoonish σε μεγάλη επιφάνεια): κολώνα steel-blue, δοκός amber, πλάκα
  // taupe, θεμελίωση sienna. Συνέπεια 2D κάτοψης ↔ 3D προβολής.
  'elem-column':  { color: 0x4a6f8c, roughness: 0.75, metalness: 0.05 },
  'elem-beam':    { color: 0xa8823a, roughness: 0.75, metalness: 0.05 },
  'elem-slab':    { color: 0xb2a290, roughness: 0.80, metalness: 0.00 },
  // ADR-436/445 v1.2 — θεμελίωση below-grade RC, ματ, μηδέν metalness. Per-kind
  // ΔΙΑΚΡΙΤΕΣ ΧΡΟΙΕΣ (ίδιες με την 2Δ παλέτα `FOUNDATION_KIND_STROKE` → συνέπεια
  // κάτοψης ↔ 3D): πέδιλο sienna, πεδιλοδοκός teal, συνδετήρια κεραμυδί.
  // `elem-foundation` = fallback (pad tone).
  'elem-foundation':          { color: 0x8a5a3c, roughness: 0.88, metalness: 0.00 },
  'elem-foundation-pad':      { color: 0x8a5a3c, roughness: 0.88, metalness: 0.00 },
  'elem-foundation-strip':    { color: 0x2f7d6a, roughness: 0.88, metalness: 0.00 },
  'elem-foundation-tie-beam': { color: 0xb5651d, roughness: 0.88, metalness: 0.00 },
  // ADR-417 — pitched roof «νερά»: terracotta clay-tile tone, matte non-metallic
  // (flat fallback before the CC0 roof-tile PBR set loads).
  'elem-roof':    { color: 0x9e4a2c, roughness: 0.85, metalness: 0.00 },
  // ADR-370 Phase 5 — stair element-type defaults (Revit-aligned: wood treads,
  // concrete risers/landings, metal stringers/handrails).
  'elem-stair-tread':    { color: 0x8b5e3c, roughness: 0.70, metalness: 0.00 },
  'elem-stair-riser':    { color: 0xbdbdbd, roughness: 0.85, metalness: 0.00 },
  'elem-stair-stringer': { color: 0x6b6b6b, roughness: 0.40, metalness: 0.80 },
  'elem-stair-landing':  { color: 0xbdbdbd, roughness: 0.80, metalness: 0.00 },
  'elem-stair-handrail': { color: 0x999999, roughness: 0.25, metalness: 0.90 },
  // ADR-650 M4 — topographic surface (TIN). Bare-earth tone: warm grey-brown soil, fully
  // matte, zero metalness — a natural surface must never catch a specular highlight, or the
  // relief reads as plastic instead of ground (Civil 3D / Revit toposolid default shading).
  'elem-terrain':        { color: 0x7d6a52, roughness: 0.97, metalness: 0.00 },
  // ADR-396 Phase P5 — envelope (ETICS) shell default. Insulation-board tint:
  // warm light grey (graphite EPS / XPS boards), matte non-metallic surface.
  'elem-envelope':       { color: 0xe6ddcf, roughness: 0.92, metalness: 0.00 },
  // ADR-406 — MEP light fixture default: bright diffuser white, low roughness
  // (frosted panel), slightly translucent so it reads as a luminaire.
  'elem-mep-fixture':    { color: 0xfff4d6, roughness: 0.35, metalness: 0.00, transparent: true, opacity: 0.85 },
  // ADR-408 Φ3 — electrical panel default: painted steel enclosure — grey-green
  // (RAL 7035-ish equipment grey), matte, low metalness (powder-coated box).
  'elem-electrical-panel': { color: 0x6b7280, roughness: 0.55, metalness: 0.30 },
  // ADR-407/445 — railing (guardrail) default: brushed steel — cool steel-grey
  // (ευθυγραμμισμένο με την κατηγορία), low roughness, high metalness.
  'elem-railing':        { color: 0x6b7785, roughness: 0.30, metalness: 0.85 },
  // ADR-408 Φ7 — home-run conduit/wire default. Always tinted by the circuit's
  // system colour (via getSystemTintedMaterial3D), so this base colour is only a
  // fallback; matte plastic-insulation look (low metalness, mid roughness).
  'elem-mep-wire':       { color: 0xb45309, roughness: 0.60, metalness: 0.00 },
  // ADR-410 — furniture fallback (used for the bbox placeholder + when a loaded
  // glTF carries no own materials). Warm wood-tan, matte. The real CC0 mesh keeps
  // its own glTF materials; this only paints the placeholder box.
  'elem-furniture':      { color: 0xb48250, roughness: 0.65, metalness: 0.05 },
  // ADR-408 Φ8 — MEP duct (rectangular/round HVAC duct): galvanised sheet-steel
  // grey (similar to RAL 9006 / zinc-coated surface). Low roughness (smooth
  // sheet metal), mid metalness.
  'elem-mep-duct':       { color: 0xb0b4b8, roughness: 0.35, metalness: 0.60 },
  // ADR-408 Φ8 — MEP pipe (plumbing / hydronic pipe): copper/brass tone.
  // Low roughness (polished pipe), high metalness.
  'elem-mep-pipe':       { color: 0xb87333, roughness: 0.30, metalness: 0.75 },
  // ADR-408 Φ11 — MEP fitting (auto pipe junction element): metallic grey
  // (cast/forged fitting body), mid roughness, high metalness.
  'elem-mep-fitting':    { color: 0x8a8f94, roughness: 0.40, metalness: 0.70 },
  // ADR-408 Φ12 — MEP plumbing manifold (συλλέκτης): cyan-teal (plumbing
  // equipment — distinguishable from copper pipe 0xb87333 and duct 0xb0b4b8).
  // Matte-ish plastic/composite housing, low metalness.
  'elem-mep-manifold':   { color: hexToTrueColor(MEP_WATER_COLOR), roughness: 0.50, metalness: 0.20 },
  // ADR-408 Εύρος Β — heating radiator: warm-red matte steel/aluminium panel.
  'elem-mep-radiator':   { color: 0xdc2626, roughness: 0.60, metalness: 0.10 },
  // ADR-408 Εύρος Β — heating boiler (λέβητας): hydronic-supply warm-red
  // (same hue as radiator — both are heating-circuit elements). Slightly higher
  // metalness to distinguish the boiler body from the flat panel radiator.
  'elem-mep-boiler':     { color: 0xdc2626, roughness: 0.55, metalness: 0.15 },
  // ADR-408 DHW — domestic hot water heater (θερμοσίφωνας): DHW-supply blue
  // (0x2563eb — Tailwind blue-600, domestic water palette, distinct from heating red).
  // Matte plastic/enamel cabinet, low metalness (same family as the plumbing manifold).
  'elem-mep-water-heater': { color: 0x2563eb, roughness: 0.55, metalness: 0.15 },
  // ADR-408 Εύρος Β #3 — underfloor radiant heating PIPE (the serpentine tubes swept
  // along `geometry.loopPath`): solid warm-red PEX/multilayer pipe (same heating-circuit
  // hue as radiator/boiler), slight sheen. MUST precede `elem-mep-underfloor` — the
  // `resolveMaterialKey` prefix match is first-wins, and `elem-mep-underfloor-pipe`
  // startsWith `elem-mep-underfloor`, so the more-specific pipe key has to come first.
  'elem-mep-underfloor-pipe': { color: 0xdc2626, roughness: 0.45, metalness: 0.10 },
  // ADR-408 Εύρος Β #3 — underfloor radiant heating loop: warm-red embedded screed
  // band (same heating-circuit hue), translucent so it reads as a thin layer in 3D.
  'elem-mep-underfloor': { color: 0xdc2626, roughness: 0.70, metalness: 0.05, transparent: true, opacity: 0.55 },
};

/** Fallback key when a materialId matches no known prefix. */
export const DEFAULT_MATERIAL_KEY = 'mat-concrete';

/**
 * The resolved MaterialCatalog key behind a DNA materialId (e.g. 'mat-concrete-c25'
 * → 'mat-concrete'). Prefix match against `MATERIAL_DEFS` keys; default to concrete.
 */
export function resolveMaterialKey(materialId: string): string {
  for (const prefix of Object.keys(MATERIAL_DEFS)) {
    if (materialId.startsWith(prefix)) return prefix;
  }
  return DEFAULT_MATERIAL_KEY;
}

/**
 * ADR-687 Φ7 — the flat `PbrMaterialDef` behind a catalog materialId (`mat-*`/`elem-*`),
 * via the same prefix resolver the 3D catalog uses. Pure (no three.js). Used by the
 * offscreen material-thumbnail sphere to render a catalog material's real appearance.
 */
export function catalogDefForMaterialId(materialId: string): PbrMaterialDef {
  return MATERIAL_DEFS[resolveMaterialKey(materialId)] ?? MATERIAL_DEFS[DEFAULT_MATERIAL_KEY]!;
}

/**
 * ADR-687 Φ7 — a flat `PbrMaterialDef` from a `#rrggbb` colour, for the legacy flat
 * wall-covering paints (which carry only a colour). Matte-ish default so the paint reads
 * as a painted surface, not plastic. Pure (no three.js).
 */
export function flatColorDef(hex: string): PbrMaterialDef {
  return { color: hexToTrueColor(hex), roughness: 0.7, metalness: 0 };
}

/**
 * The flat appearance colour of a materialId as a `#rrggbb` CSS hex — SSoT for the
 * 2D fallback swatch chip (matches the 3D flat material colour for the same key).
 */
export function getMaterialFlatColorHex(materialId: string): string {
  const def = MATERIAL_DEFS[resolveMaterialKey(materialId)] ?? MATERIAL_DEFS[DEFAULT_MATERIAL_KEY]!;
  // Canonical BIM material colour = lowercase `#rrggbb` (docstring contract + THREE.Color
  // convention). Το DXF-domain `trueColorToHex` uppercase-άρει (ACI/DXF), οπότε κανονικοποιούμε εδώ.
  return trueColorToHex(def.color).toLowerCase();
}

/**
 * ADR-686 — flat χρώμα ΜΟΝΟ για γνωστό construction-catalog id (`mat-*`/`elem-*` που ταιριάζει σε
 * `MATERIAL_DEFS` prefix)· αλλιώς `null`. Provider-shaped, σε αντίθεση με το {@link getMaterialFlatColorHex}
 * που δίνει ΠΑΝΤΑ fallback χρώμα: έτσι δηλώνεται ΑΣΦΑΛΩΣ ως `MaterialColorProvider` στο
 * `material-color-registry` — δεν «αρπάζει» ξένα ids (wall-covering/floor-finish/`bmat_*` μένουν στους
 * δικούς τους providers). Χωρίς αυτό, μια όψη βαμμένη με catalog υλικό (τούβλο/ξύλο/μέταλλο) σε
 * realistic OFF έβγαινε άβαφη: `getFaceMaterial3D`→null (realistic OFF) και κανένας color provider δεν
 * γνώριζε το `mat-*` id → base look.
 */
export function catalogFlatColorOrNull(materialId: string): string | null {
  const known = Object.keys(MATERIAL_DEFS).some((prefix) => materialId.startsWith(prefix));
  return known ? getMaterialFlatColorHex(materialId) : null;
}

/**
 * ADR-413 §2D Phase 3 — library material category → `MATERIAL_DEFS` key. For
 * `bim_materials` library docs (`bmat_*` ids that carry no DNA prefix) the flat 3D
 * appearance is derived from the doc's `category`. Mirrors `CATEGORY_SLUG` in
 * `material-thumbnail-resolver.ts` (2D swatch) so the flat colour the 3D viewport
 * paints matches the 2D fallback chip. Every value is an existing key, so the
 * lookup never misses (defensive default to concrete anyway).
 */
const CATEGORY_FLAT_KEY: Record<BimMaterialCategory, string> = {
  plaster: 'mat-plaster',
  masonry: 'mat-brick',
  concrete: 'mat-concrete',
  insulation: 'mat-insulation',
  flooring: 'mat-tile',
  'window-frame': 'mat-metal',
  'door-frame': 'mat-wood',
  paint: 'mat-plaster',
  roofing: 'elem-roof',
  waterproofing: 'mat-membrane',
  other: 'mat-concrete',
};

/**
 * The flat PBR appearance def for a library material category — the 3D fallback
 * for a `bmat_*` material that has no (or not-yet-loaded) PBR textures.
 */
export function getCategoryMaterialDef(category: BimMaterialCategory): PbrMaterialDef {
  return MATERIAL_DEFS[CATEGORY_FLAT_KEY[category]] ?? MATERIAL_DEFS[DEFAULT_MATERIAL_KEY]!;
}

/**
 * ADR-687 Φ1 — per-material user appearance → flat `PbrMaterialDef` (SSoT mapping,
 * NO three.js). Χαρτογραφεί το `{baseColorHex, metalness, roughness}` του χρήστη σε
 * `{color, roughness, metalness}` του καταλόγου — ώστε ΟΛΟΙ οι καταναλωτές (3D
 * `buildMat`, ο 2D color provider, το swatch chip) να διαβάζουν ΤΟ ΙΔΙΟ override
 * αντί της κατηγορίας. Το `clamp01` προστατεύει από εκτός-ορίων persisted τιμές.
 * `metalness`/`roughness` = flat PBR. ADR-687 Φ4: `emissiveHex`/`emissiveIntensity` →
 * `emissive`/`emissiveIntensity` (self-illumination), `opacity` → `opacity` + `transparent`
 * (when < 1). Όλα τα Φ4 πεδία optional (back-compat με τα Φ1 appearance objects → defaults).
 * ADR-687 Φ5: `clearcoat`/`clearcoatRoughness`/`transmission` (clamp01), `ior` (clamp
 * [1, 2.333]), `thickness` (≥0) → physical props· undefined → σβηστά (buildMat μένει
 * MeshStandardMaterial).
 */
export function appearanceToDef(
  appearance: {
    baseColorHex: string;
    metalness: number;
    roughness: number;
    emissiveHex?: string;
    emissiveIntensity?: number;
    opacity?: number;
    clearcoat?: number;
    clearcoatRoughness?: number;
    transmission?: number;
    ior?: number;
    thickness?: number;
  },
): PbrMaterialDef {
  const opacity = clamp01(appearance.opacity ?? 1);
  return {
    color: hexToTrueColor(appearance.baseColorHex),
    roughness: clamp01(appearance.roughness),
    metalness: clamp01(appearance.metalness),
    transparent: opacity < 1,
    opacity,
    emissive: hexToTrueColor(appearance.emissiveHex ?? '#000000'),
    emissiveIntensity: clamp01(appearance.emissiveIntensity ?? 0),
    clearcoat: clamp01(appearance.clearcoat ?? 0),
    clearcoatRoughness: clamp01(appearance.clearcoatRoughness ?? 0),
    transmission: clamp01(appearance.transmission ?? 0),
    // IOR physical range (three.js MeshPhysicalMaterial.ior): air→diamond.
    ior: clamp(appearance.ior ?? 1.5, 1, 2.333),
    thickness: Math.max(0, appearance.thickness ?? 0),
  };
}
