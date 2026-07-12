/**
 * 🏢 ENTERPRISE: DXF per-entity STYLE extraction (lineweight / linetype / ltscale).
 *
 * DXF group codes 370 (lineweight), 6 (linetype name) + 48 (CELTSCALE per-object
 * linetype scale). Extracted from `dxf-converter-helpers.ts` (file-size SRP split,
 * N.7.1 / ADR-635 Φ C) and re-exported there so the converters' import path stays
 * unchanged. Each mirrors `extractEntityColor`: the inheritance sentinels collapse to
 * `undefined` so the render style cascade (`resolveEntityStyle`) resolves them from the
 * owning layer (implicit ByLayer) exactly like AutoCAD.
 *
 * @see dxf-converter-helpers.ts - extractEntityColor (the color sibling these mirror)
 * @see config/lineweight-iso-catalog.ts - parseDxfCode370 SSoT
 * @see AutoCAD DXF Reference for entity codes
 */

import type { LineweightMm } from '../types/entities';
// 🏢 SSoT: DXF group 370 lineweight (mm) — reuse the ISO catalog decoder (ADR-635 Φ C.3).
import { parseDxfCode370, isConcreteLineweight } from '../config/lineweight-iso-catalog';
// 🏢 SSoT: DXF group 440 transparency codec (inverse του export `encodeDxf440`, ADR-507).
import { decodeDxf440 } from '../export/core/dxf-transparency-440';

/**
 * 🏢 ENTERPRISE: Extract a per-entity lineweight (mm) from DXF group code 370.
 *
 * DXF group 370 encodes the entity's own lineweight in hundredths of a millimetre
 * (25 → 0.25mm), plus the three inheritance sentinels -1 ByBlock / -2 ByLayer /
 * -3 Default. We bake ONLY a **concrete** mm value onto the imported entity
 * (`entity.lineweightMm`), mirroring `extractEntityColor`: the sentinels collapse to
 * `undefined` so the render style cascade (`resolveEntityStyle`) resolves them from
 * the owning layer (implicit ByLayer) exactly like AutoCAD. An out-of-catalog raw
 * value snaps to the nearest ISO weight via `parseDxfCode370`, else → undefined.
 *
 * Reuses the `lineweight-iso-catalog` SSoT (`parseDxfCode370`) — no second decoder.
 * The screen-px conversion + the global LWDISPLAY gate live downstream in
 * `dxf-renderer-style-resolve.ts` (ADR-510 Φ2G); this only populates the import value.
 * BYBLOCK lineweight inheritance on INSERT is a follow-up (mirror of the C.2 color rule).
 *
 * @see extractEntityColor - the color sibling this mirrors
 * @see config/lineweight-iso-catalog.ts - parseDxfCode370 SSoT
 * @param data - Raw DXF group codes
 * @returns Concrete lineweight in mm, or undefined (absent / ByLayer / ByBlock / Default)
 */
export function extractEntityLineweight(data: Record<string, string>): LineweightMm | undefined {
  const raw = data['370'];
  if (raw === undefined) return undefined;
  const int = parseInt(raw, 10);
  if (Number.isNaN(int)) return undefined;
  const lw = parseDxfCode370(int);
  // Concrete-only: -1/-2/-3 sentinels stay absent → the layer cascade resolves them.
  return isConcreteLineweight(lw) ? lw : undefined;
}

/**
 * 🏢 ENTERPRISE: Extract a per-entity linetype **name** from DXF group code 6.
 *
 * DXF group 6 names the entity's own linetype. It carries three meanings we split
 * exactly like `extractEntityColor` splits code 62:
 *   - **absent** → implicit ByLayer → `undefined` (the render cascade resolves the
 *     owning layer's linetype).
 *   - **`BYLAYER`** (any case) → explicit ByLayer → `undefined` (same cascade).
 *   - **`BYBLOCK`** (any case) → `undefined` for now → falls to the layer cascade;
 *     true INSERT-linetype inheritance is a follow-up (mirror of the C.2 color BYBLOCK rule).
 *   - **any concrete name** (incl. `Continuous`, `Dashed`, custom `.lin` names) → the
 *     name is baked onto `entity.linetypeName`. `Continuous` is a REAL linetype, NOT a
 *     sentinel: an entity explicitly set to Continuous must override a dashed layer, so
 *     it is baked (not dropped) — the render resolves it to `[]` (solid).
 *
 * Case-insensitive on the sentinels only (AutoCAD writes `BYLAYER`/`CONTINUOUS`
 * uppercase). Concrete names are forwarded verbatim — the render SSoT
 * (`resolveLinetypePatternMm` → `resolveAnyLinetype`) already matches DXF names
 * case-insensitively and unions the ISO catalog with the runtime registry (custom
 * DXF linetypes registered by the LTYPE pre-pass in `DxfSceneBuilder`). No second
 * resolver is introduced here.
 *
 * @see extractEntityColor - the color sibling this mirrors
 * @see rendering/linetype-dash-resolver.ts - resolveLinetypePatternMm (name→pattern SSoT)
 * @param data - Raw DXF group codes
 * @returns Concrete linetype name, or undefined (absent / ByLayer / ByBlock)
 */
export function extractEntityLinetype(data: Record<string, string>): string | undefined {
  const raw = data['6'];
  if (raw === undefined) return undefined;
  const name = raw.trim();
  if (name.length === 0) return undefined;
  const upper = name.toUpperCase();
  // Sentinels collapse to undefined → the layer cascade resolves the linetype.
  if (upper === 'BYLAYER' || upper === 'BYBLOCK') return undefined;
  return name;
}

/**
 * 🏢 ENTERPRISE: Extract a per-object linetype scale (AutoCAD CELTSCALE) from DXF group 48.
 *
 * Code 48 is a **unitless relative multiplier** on the entity's dash pattern (default 1),
 * stacked with the global LTSCALE + live zoom at stroke time
 * (`dashMmToScreenPx(…, celtscale)`). Unlike `$LTSCALE` (a source-unit-space drawing knob
 * we deliberately do NOT apply — see ADR-635 Φ C.4), CELTSCALE is a pure per-object ratio,
 * so it maps cleanly onto `entity.ltscale`.
 *
 * Returns a finite **positive** value only (AutoCAD rejects `celtscale <= 0`). Absent /
 * invalid / the trivial `1` collapse to `undefined` so the render forward + EntityModel
 * builder omit it → zero regression on native/Tekton/bare paths.
 *
 * @see rendering/linetype-dash-resolver.ts - dashMmToScreenPx (celtscale slot)
 * @param data - Raw DXF group codes
 * @returns Positive per-object linetype scale, or undefined (absent / invalid / default 1)
 */
export function extractEntityLtscale(data: Record<string, string>): number | undefined {
  const raw = data['48'];
  if (raw === undefined) return undefined;
  const value = parseFloat(raw);
  if (!Number.isFinite(value) || value <= 0 || value === 1) return undefined;
  return value;
}

/**
 * 🏢 ENTERPRISE: Extract a per-entity transparency % (0..90) from DXF group code 440.
 *
 * Group 440 encodes AutoCAD object transparency as a 32-bit int (BYALPHA flag + alpha
 * byte). We decode via the `decodeDxf440` SSoT (inverse of the `encodeDxf440` writer),
 * baking ONLY a concrete value onto `entity.transparency`. Opaque (0) / ByLayer / ByBlock
 * collapse to `undefined` — exactly like `extractEntityColor`/`extractEntityLineweight` —
 * so the render style cascade (`resolveEntityStyle`) resolves the inherited transparency.
 *
 * @see export/core/dxf-transparency-440 - decodeDxf440 SSoT
 * @param data - Raw DXF group codes
 * @returns Concrete transparency % (1..90), or undefined (absent / opaque / ByLayer / ByBlock)
 */
export function extractEntityTransparency(data: Record<string, string>): number | undefined {
  const raw = data['440'];
  if (raw === undefined) return undefined;
  const int = parseInt(raw, 10);
  if (Number.isNaN(int)) return undefined;
  return decodeDxf440(int);
}
