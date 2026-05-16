/**
 * resolveEntityStyle — ADR-358 §G7 ByLayer/ByBlock pipeline.
 *
 * Pure cascade resolver that produces a fully-concrete `ResolvedStyle` for a
 * single entity, ready to feed the renderer. No side effects, no React state,
 * no async — safe to call from RAF + hit-testing + bitmap cache.
 *
 * Resolution cascade (color | linetype | lineweight | transparency):
 *
 *   entity (Concrete)
 *     → block (when entity is ByBlock and parentBlock provided)
 *       → layer (ByLayer — always available)
 *         → system default (lineweight cascade only — see default-lineweight-resolver)
 *
 * Color SSoT priority within a single resolution level:
 *   TrueColor (0xRRGGBB)  ▸ takes precedence
 *   ACI (1-255)           ▸ via getAciColor() palette
 *   legacy hex (`#rrggbb`) ▸ fallback
 *
 * Linetype SSoT: every name flows through `LinetypeRegistry.resolveLinetype()`.
 * Unknown names fall back to `DEFAULT_LINETYPE_NAME` ('Continuous').
 *
 * Lineweight SSoT: sentinels (-3 DEFAULT / -2 ByLayer / -1 ByBlock) are
 * resolved here exhaustively. Concrete output is always an ISO catalog value.
 */

import type { SceneLayer } from '../../types/entities';
import type { LineweightMm } from '../../types/entities';
import { resolveLinetype } from '../../stores/LinetypeRegistry';
import {
  DEFAULT_LINETYPE_NAME,
  type LinetypeDef,
} from '../../config/linetype-iso-catalog';
import {
  LINETYPE_ISO_CATALOG,
} from '../../config/linetype-iso-catalog';
import {
  LINEWEIGHT_SPECIAL,
  isConcreteLineweight,
  type ConcreteLineweightMm,
} from '../../config/lineweight-iso-catalog';
import { resolveDefaultLineweight } from '../../config/default-lineweight-resolver';
import { getAciColor } from '../../settings/standards/aci';
import type {
  BlockStyleInput,
  DefaultStyleInput,
  EntityStyleInput,
  ResolvedStyle,
  ResolvedStyleProvenance,
  StyleResolutionSource,
} from './resolved-style.types';

/** Fallback hex when every cascade level is empty — AutoCAD ACI 7 (white). */
const FALLBACK_COLOR_HEX = '#FFFFFF';

interface ColorResolution {
  readonly hex: string;
  readonly aci: number | null;
  readonly trueColor: number | null;
  readonly source: StyleResolutionSource;
}

interface ResolveOptions {
  /** Required — entity declaration extracted from the Entity object. */
  readonly entity: EntityStyleInput;
  /** Required — owning layer (SceneLayer). */
  readonly layer: SceneLayer;
  /** Optional — block context (when entity sits inside an INSERT). */
  readonly parentBlock?: BlockStyleInput;
  /** Optional — system default cascade input for `-3 DEFAULT` lineweight. */
  readonly defaults?: DefaultStyleInput;
}

// ─── Color cascade ───────────────────────────────────────────────────────────

function trueColorToHex(int: number): string {
  const clamped = Math.max(0, Math.min(0xffffff, Math.trunc(int)));
  return `#${clamped.toString(16).toUpperCase().padStart(6, '0')}`;
}

function resolveColorLevel(
  level: { colorTrueColor?: number | null; colorAci?: number; colorHex?: string },
  source: StyleResolutionSource,
): ColorResolution | null {
  if (level.colorTrueColor !== null && level.colorTrueColor !== undefined) {
    return {
      hex: trueColorToHex(level.colorTrueColor),
      aci: null,
      trueColor: level.colorTrueColor,
      source,
    };
  }
  if (typeof level.colorAci === 'number' && level.colorAci >= 1 && level.colorAci <= 255) {
    return {
      hex: getAciColor(level.colorAci),
      aci: level.colorAci,
      trueColor: null,
      source,
    };
  }
  if (typeof level.colorHex === 'string' && level.colorHex.length > 0) {
    return {
      hex: level.colorHex,
      aci: null,
      trueColor: null,
      source,
    };
  }
  return null;
}

function resolveColor(opts: ResolveOptions): ColorResolution {
  const { entity, parentBlock, layer } = opts;
  const mode = entity.colorMode ?? inferColorMode(entity);

  if (mode === 'Concrete') {
    const entityHit = resolveColorLevel(entity, 'entity');
    if (entityHit) return entityHit;
  }
  if (mode === 'ByBlock' && parentBlock) {
    const blockHit = resolveColorLevel(parentBlock, 'block');
    if (blockHit) return blockHit;
  }
  const layerHit = resolveColorLevel(
    { colorTrueColor: layer.colorTrueColor, colorAci: layer.colorAci, colorHex: layer.color },
    'layer',
  );
  if (layerHit) return layerHit;
  return { hex: FALLBACK_COLOR_HEX, aci: 7, trueColor: null, source: 'default' };
}

function inferColorMode(entity: EntityStyleInput): 'ByLayer' | 'ByBlock' | 'Concrete' {
  if (
    entity.colorTrueColor !== null && entity.colorTrueColor !== undefined
    || typeof entity.colorAci === 'number'
    || (typeof entity.colorHex === 'string' && entity.colorHex.length > 0)
  ) {
    return 'Concrete';
  }
  return 'ByLayer';
}

// ─── Linetype cascade ────────────────────────────────────────────────────────

function resolveLinetypeName(opts: ResolveOptions): { def: LinetypeDef; source: StyleResolutionSource } {
  const { entity, parentBlock, layer } = opts;
  const entName = entity.linetypeName;

  if (entName === 'ByBlock' && parentBlock?.linetypeName) {
    const def = resolveLinetype(parentBlock.linetypeName);
    if (def) return { def, source: 'block' };
  }
  if (entName && entName !== 'ByLayer' && entName !== 'ByBlock') {
    const def = resolveLinetype(entName);
    if (def) return { def, source: 'entity' };
  }
  if (layer.linetype) {
    const def = resolveLinetype(layer.linetype);
    if (def) return { def, source: 'layer' };
  }
  return { def: LINETYPE_ISO_CATALOG[DEFAULT_LINETYPE_NAME], source: 'default' };
}

// ─── Lineweight cascade ──────────────────────────────────────────────────────

function resolveLineweight(opts: ResolveOptions): { mm: ConcreteLineweightMm; source: StyleResolutionSource } {
  const { entity, parentBlock, layer, defaults } = opts;
  const lw = entity.lineweightMm;

  // Concrete entity value
  if (isConcreteLineweight(lw)) return { mm: lw, source: 'entity' };

  // ByBlock sentinel — resolve via parent block
  if (lw === LINEWEIGHT_SPECIAL.BYBLOCK && parentBlock) {
    if (isConcreteLineweight(parentBlock.lineweightMm)) {
      return { mm: parentBlock.lineweightMm, source: 'block' };
    }
    // ByBlock without concrete block value → fall through to layer.
  }

  // ByLayer sentinel OR missing → resolve from layer
  // DEFAULT sentinel on entity also falls through to system cascade.
  if (lw === undefined || lw === LINEWEIGHT_SPECIAL.BYLAYER || lw === LINEWEIGHT_SPECIAL.BYBLOCK) {
    if (isConcreteLineweight(layer.lineweight)) {
      return { mm: layer.lineweight, source: 'layer' };
    }
    // Layer is also DEFAULT / ByLayer / ByBlock / missing → system cascade.
  }

  const systemMm = resolveDefaultLineweight({
    projectSetting: defaults?.projectLineweight ?? null,
    userPreference: defaults?.userLineweight ?? null,
  });
  // resolveDefaultLineweight always returns a concrete value.
  return { mm: systemMm as ConcreteLineweightMm, source: 'default' };
}

// ─── Transparency cascade ────────────────────────────────────────────────────

function resolveTransparency(opts: ResolveOptions): { value: number; source: StyleResolutionSource } {
  const { entity, parentBlock, layer } = opts;
  if (typeof entity.transparency === 'number') return { value: clampTransparency(entity.transparency), source: 'entity' };
  if (parentBlock && typeof parentBlock.transparency === 'number') {
    return { value: clampTransparency(parentBlock.transparency), source: 'block' };
  }
  if (typeof layer.transparency === 'number') return { value: clampTransparency(layer.transparency), source: 'layer' };
  return { value: 0, source: 'default' };
}

function clampTransparency(v: number): number {
  if (v < 0) return 0;
  if (v > 90) return 90;
  return v;
}

// ─── Public entry point ──────────────────────────────────────────────────────

/**
 * Resolve a concrete `ResolvedStyle` for a single entity.
 *
 * Always returns a fully-populated value. Sentinels never leak out — callers
 * (renderer, hit-testing, property panel) can rely on every field being concrete.
 */
export function resolveEntityStyle(
  entity: EntityStyleInput,
  layer: SceneLayer,
  parentBlock?: BlockStyleInput,
  defaults?: DefaultStyleInput,
): ResolvedStyle {
  const opts: ResolveOptions = { entity, layer, parentBlock, defaults };
  const color = resolveColor(opts);
  const linetype = resolveLinetypeName(opts);
  const lineweight = resolveLineweight(opts);
  const transparency = resolveTransparency(opts);

  const provenance: ResolvedStyleProvenance = {
    color: color.source,
    linetype: linetype.source,
    lineweight: lineweight.source,
    transparency: transparency.source,
  };

  return {
    color: color.hex,
    colorAci: color.aci,
    colorTrueColor: color.trueColor,
    linetype: linetype.def,
    lineweight: lineweight.mm,
    transparency: transparency.value,
    provenance,
  };
}

/**
 * Convenience adapter — extract `EntityStyleInput` from an Entity-shaped object.
 * Renderer call sites use this to bridge legacy entity shape (color string +
 * lineWidth number) to the explicit StyleInput contract without forcing every
 * caller to re-encode.
 *
 * Conventions:
 *   - `color` absent  → ByLayer
 *   - `color` present → Concrete (treated as hex)
 *   - `lineWidth` is in px, NOT mm — Phase 4 keeps it untouched (passed via
 *     `lineweightMm` only when caller has already converted).
 */
export function entityToStyleInput(entity: {
  color?: string;
  colorAci?: number;
  colorTrueColor?: number | null;
  linetypeName?: string;
  lineweightMm?: LineweightMm;
  colorMode?: 'ByLayer' | 'ByBlock' | 'Concrete';
  transparency?: number;
}): EntityStyleInput {
  return {
    colorMode: entity.colorMode,
    colorHex: entity.color,
    colorAci: entity.colorAci,
    colorTrueColor: entity.colorTrueColor,
    linetypeName: entity.linetypeName,
    lineweightMm: entity.lineweightMm,
    transparency: entity.transparency,
  };
}
