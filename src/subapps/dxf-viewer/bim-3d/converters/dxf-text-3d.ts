/**
 * dxf-text-3d.ts — build a flat, textured-plane 3D representation of a raw DXF text entity
 * (ADR-537 β). DXF text has no stroke geometry, so `DxfToThreeConverter` used to skip it and
 * the entity was invisible / unpickable in 3D. This lays the text on the floor plane (Y=0) as
 * a `CanvasTexture` on a `PlaneGeometry`, in NATIVE DXF units — the converter's group-level
 * `sceneUnitsToMeters` scale converts it to the metre world like the rest of the wireframe.
 *
 * Font / glyph rendering reuses the 2D single-line paint SSoT (`paintTextRun` /
 * `measureTextRunPx`, ADR-557 Φάση C): the texture is drawn with the SAME vector glyph outlines
 * (`resolveEntityFont` → `getGlyphRun`) the 2D renderer paints, honouring fontFamily / bold /
 * italic / widthFactor / tracking. Before Φάση C this converter used a hard-coded `ctx.fillText`
 * + `DEFAULT_FAMILY` string — a second, divergent text mechanism that dropped all of those and
 * rendered registry-only fonts (SHX / Τέκτονας) as the CSS fallback in 3D while 2D showed their
 * real outlines. Now there is ONE font engine across 2D & 3D (Revit / Cinema 4D / Figma model).
 *
 * Placement: the quad is laid flat AND spun by the DXF plan `rotation` (ADR-557 C-rotation,
 * `orientTextPlane`) so the 3D text leans EXACTLY like the 2D glyphs; the glyph STYLE (font /
 * weight / italic / X-scale / tracking / oblique) matches the plan too. The pick / hover-glow use
 * the em-box SSoT (`resolveTextEmBox`), so the click box stays consistent with this quad.
 */

import * as THREE from 'three';
import type { DxfText } from '../../canvas-v2/dxf-canvas/dxf-types';
// 🏢 Color-Conversion SSoT (ADR-573): int(0xRRGGBB)→hex via canonical `dxf-true-color`.
import { trueColorToHex } from '../../utils/dxf-true-color';
import {
  getTextHeightWithFallback,
  TEXT_FONTS,
  buildUIFont,
} from '../../config/text-rendering-config';
// ADR-557 Φάση C — the single-line glyph-run paint SSoT (same routine the 2D `TextRenderer`
// uses): vector glyph outlines when a CAD font resolves, else CSS `ctx.fillText` on `ctx.font`.
import { resolveEntityFont, paintTextRun, measureTextRunPx, type ResolvedFont } from '../../text-engine/fonts';
// ADR-557 Φ-attachment — the NOMINAL em box (`resolveTextEmBox`): the 3D canvas draws the
// glyph centred in an em cell (`textBaseline:'middle'`), so the plane must sit on the em-box
// centre, NOT the tight VISUAL cap box (`resolveTextBox`) the 2D grips/hover use — else the
// 3D text shifts vertically vs the plan (measured ~53 units for a 277-unit title).
import { resolveTextEmBox } from '../../bim/text/text-box';
// ADR-557 (multi-line) — the SAME split + line-spacing SSoT the 2D renderer + box use, so the
// stacked lines in this CanvasTexture match the plan glyphs and fill the (multi-line) em box.
import { splitTextLines, resolveLineSpacingRatio } from '../../bim/text/text-lines';
// ADR-557 — the oblique shear SSoT (world y-up); the 3D texture (screen-y-down) negates it.
import { obliqueShearFromAngle } from '../../bim/text/text-oblique';

/** Texture resolution: canvas pixels per drawing unit of text height (crisp at typical zoom). */
const TEXTURE_PX_PER_UNIT = 16;

/**
 * ADR-366 §B.5 — hard cap on the CanvasTexture's largest dimension. A tall DXF annotation
 * (e.g. a 300-unit title at 16 px/unit) produced an ~18760×6000 canvas → a ~340 MB RGBA GPU
 * upload that Three.js then clamps to maxTextureSize — a catastrophic per-texture stall on a
 * weak/integrated GPU (browser-verified: a single such upload spiked the click handler to
 * 616 ms and starved the cursor). The cap scales `pxPerUnit` down UNIFORMLY so the texture
 * fits; because the plane's world size is derived from `canvas / pxPerUnit`, the text keeps
 * the EXACT same physical footprint — only its texel resolution drops (a label never needs
 * thousands of px). 2048 is plenty crisp for an underlay annotation.
 */
const MAX_TEXTURE_DIM = 2048;

/** Degrees→radians (local constant, mirroring the sibling geometry modules' convention). */
const DEG_TO_RAD = Math.PI / 180;
/** World-space axes for the flat-lay + plan-spin quaternion composition (module-level = no per-mesh alloc). */
const PLANE_FLAT_AXIS = new THREE.Vector3(1, 0, 0);
const PLANE_UP_AXIS = new THREE.Vector3(0, 1, 0);

/**
 * ADR-557 (C-rotation) — orient the flat text quad so it leans EXACTLY like the 2D glyphs.
 *
 * Two composed world-space rotations, built as a QUATERNION (no Euler-order ambiguity, mirroring
 * `mep-fitting-to-mesh` / `railing-to-three`):
 *   • `flat` = rotateX(−90°): lays the plane on the floor, mapping plane-local (x, y) →
 *     world (x, 0, −y) — the DXF→Three convention (`DxfToThreeConverter`).
 *   • `spin` = rotateY(+rotation): the DXF plan rotation (CCW, degrees), applied AFTER `flat`
 *     (outer factor `spin ∘ flat`) so it spins about the WORLD vertical.
 *
 * Sign derivation (locked by `dxf-text-3d.rotation.test.ts`): for a plane-local corner (a, b),
 * `R_Y(θ)·R_X(−90°)·(a, b, 0) = (a·cosθ − b·sinθ, 0, −a·sinθ − b·cosθ)` — identical to the DXF box
 * corner `R(θ)·(a, b)` (the `text-box` SSoT, SAME `entity.rotation`) mapped (x, y) → (x, 0, −y).
 * So `+rotation` is correct here, NOT the `−rotationDeg` of `mesh-to-object3d` (whose UPRIGHT
 * objects lack the −90° flip that reverses the in-plane handedness).
 */
export function orientTextPlane(mesh: THREE.Object3D, entity: Pick<DxfText, 'rotation'>): void {
  const flat = new THREE.Quaternion().setFromAxisAngle(PLANE_FLAT_AXIS, -Math.PI / 2);
  const rotationRad = (entity.rotation ?? 0) * DEG_TO_RAD;
  if (rotationRad === 0) {
    mesh.quaternion.copy(flat);
    return;
  }
  const spin = new THREE.Quaternion().setFromAxisAngle(PLANE_UP_AXIS, rotationRad);
  mesh.quaternion.copy(spin.multiply(flat)); // spin ∘ flat: flat applied first, then world-Y spin
}

/** Disposable bundle for one text mesh (the converter disposes these on re-sync / unmount). */
export interface DxfTextMeshBundle {
  readonly mesh: THREE.Mesh;
  readonly geometry: THREE.PlaneGeometry;
  readonly material: THREE.MeshBasicMaterial;
  readonly texture: THREE.CanvasTexture;
}

/** Resolved glyph style for the texture, mirroring the 2D renderer's font resolution. */
interface TextFontResolution {
  /** A loaded opentype font, or null → CSS `ctx.fillText` fallback (`fallbackFont`). */
  readonly resolved: ResolvedFont | null;
  /** AutoCAD `\T` tracking factor (1 = normal). */
  readonly tracking: number;
  /** AutoCAD TEXT X-scale (horizontal stretch, 1 = none). */
  readonly widthFactor: number;
  /** CSS font string for the fallback path, at a given px size (family/bold/italic honoured). */
  readonly fallbackFont: (px: number) => string;
}

/**
 * Resolve the glyph font + style once, exactly like the 2D `TextRenderer`: a loaded CAD font
 * via `resolveEntityFont` (bold direct, italic → null → CSS), plus the tracking / widthFactor /
 * fallback-CSS-font the shared paint SSoT needs. So the 3D texture honours the SAME style.
 */
function resolveTextFont(entity: DxfText): TextFontResolution {
  const style = entity.textStyle;
  const family = style?.fontFamily || TEXT_FONTS.DEFAULT_FAMILY;
  const weight: 'normal' | 'bold' = style?.bold ? 'bold' : 'normal';
  const italic = style?.italic;
  return {
    resolved: resolveEntityFont(style?.fontFamily, { bold: style?.bold, italic: style?.italic }),
    tracking: typeof style?.tracking === 'number' && style.tracking > 0 ? style.tracking : 1,
    widthFactor: typeof entity.widthFactor === 'number' && entity.widthFactor > 0 ? entity.widthFactor : 1,
    fallbackFont: (px: number) => buildUIFont(px, family, weight, italic),
  };
}

/** Canvas px footprint for one measure pass (width = widest line, block = stacked lines). */
interface CanvasMeasure {
  readonly fontPx: number;
  readonly padPx: number;
  readonly advancePx: number;
  readonly blockPx: number;
  readonly obliqueMarginPx: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Draw the stacked text lines onto the (sized) texture canvas via the shared glyph-run SSoT.
 * Each line is centred (`textBaseline:'middle'`) at its stacked Y; the oblique shear + widthFactor
 * form a per-line frame around the line centre (shear BEFORE the X-scale, mirroring `TextRenderer`).
 */
function drawTextLinesToCanvas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  lines: string[],
  m: CanvasMeasure,
  font: TextFontResolution,
  obliqueShear: number,
  colorHex: string,
): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = colorHex;
  ctx.textAlign = 'center';   // CSS-fallback alignment (glyph-run path passes 'center' explicitly)
  ctx.textBaseline = 'middle';
  ctx.font = font.fallbackFont(m.fontPx);
  // First line centre sits so the block is vertically centred (matches the em-box anchor below).
  const firstCenterY = (canvas.height - m.blockPx) / 2 + m.fontPx / 2;
  for (let i = 0; i < lines.length; i++) {
    const cy = firstCenterY + i * m.advancePx;
    ctx.save();
    ctx.translate(canvas.width / 2, cy);
    // ADR-557 — shear BEFORE the widthFactor scale so the lean is `tan θ` per unit height
    // INDEPENDENT of widthFactor (same order as `TextRenderer.renderTextContent`).
    if (obliqueShear !== 0) ctx.transform(1, 0, obliqueShear, 1, 0, 0);
    if (font.widthFactor !== 1) ctx.scale(font.widthFactor, 1);
    paintTextRun(ctx, lines[i], {
      originX: 0, originY: 0, targetHeight: m.fontPx,
      align: 'center', baseline: 'middle', resolved: font.resolved, tracking: font.tracking,
    });
    ctx.restore();
  }
}

/**
 * Build a flat textured-plane mesh for a DXF text entity laid on the floor plane (Y=0) in
 * native DXF units, coloured `colorInt`. Returns null for empty text or when a 2D canvas is
 * unavailable. The plane spans the text's width × height anchored at the em-box centre.
 */
export function buildDxfTextMesh(entity: DxfText, colorInt: number): DxfTextMeshBundle | null {
  const text = entity.text ?? '';
  if (!text.trim()) return null;

  const heightUnits = getTextHeightWithFallback(undefined, entity.height);
  // ADR-557 (multi-line) — split on `\n`; width = max line, height = stacked block.
  const lines = splitTextLines(text);
  const lineSpacingRatio = resolveLineSpacingRatio(entity);
  // ADR-557 Φάση C — reuse the 2D font resolution (fontFamily/bold/italic/tracking/widthFactor).
  const font = resolveTextFont(entity);
  // ADR-557 — AutoCAD oblique angle: horizontal shear of the texture glyphs (2D≡3D). Reads the
  // SAME shear SSoT (`obliqueShearFromAngle`, world y-up) the 2D renderer + box use; the texture
  // canvas is screen-y-DOWN so it NEGATES it (like `TextRenderer`) → `-tan(θ)` leans forward.
  // 🔴 3D slant direction browser-verify: the CanvasTexture `flipY` + plane `rotateX(-90°)` may
  // invert it; flip the sign if the 3D lean is opposite the 2D plan.
  const obliqueShear = -obliqueShearFromAngle(entity.textStyle?.obliqueAngle);

  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return null;

  // `measureCanvas` returns the canvas px footprint for a given px/unit resolution via the SAME
  // measure SSoT the draw uses (`measureTextRunPx` — glyph advance when a font resolves, else CSS
  // measureText). Width = the WIDEST line × widthFactor; block height = fontPx + (L−1)·advance.
  const measureCanvas = (pxPerUnit: number): CanvasMeasure => {
    const fontPx = Math.max(1, Math.round(heightUnits * pxPerUnit));
    const padPx = Math.ceil(fontPx * 0.25);
    ctx.font = font.fallbackFont(fontPx); // CSS-fallback measure reads `ctx.font`
    let textPx = 0;
    for (const line of lines) {
      const w = measureTextRunPx(ctx, line, { targetHeight: fontPx, resolved: font.resolved, tracking: font.tracking }) * font.widthFactor;
      if (w > textPx) textPx = Math.ceil(w);
    }
    const advancePx = fontPx * lineSpacingRatio;
    const blockPx = fontPx + (lines.length - 1) * advancePx;
    // ADR-557 — extra horizontal margin so a sheared (oblique) / stretched glyph never touches the
    // canvas edge: each line shears ±|shear|·fontPx/2 around its centre, then scales by widthFactor.
    const obliqueMarginPx = obliqueShear !== 0 ? Math.ceil(Math.abs(obliqueShear) * fontPx * font.widthFactor) : 0;
    return {
      fontPx, padPx, advancePx, blockPx, obliqueMarginPx,
      width: Math.max(8, textPx + padPx * 2 + obliqueMarginPx * 2),
      height: Math.max(8, Math.ceil(blockPx) + padPx * 2),
    };
  };

  // ADR-366 §B.5 — measure at full resolution, then if the canvas would exceed MAX_TEXTURE_DIM
  // scale px/unit down uniformly so the GPU upload stays bounded. The plane world size below is
  // derived from `canvas / pxPerUnit`, so it is INVARIANT under this scale — only texel density drops.
  let pxPerUnit = TEXTURE_PX_PER_UNIT;
  let m = measureCanvas(pxPerUnit);
  const maxDim = Math.max(m.width, m.height);
  if (maxDim > MAX_TEXTURE_DIM) {
    pxPerUnit *= MAX_TEXTURE_DIM / maxDim;
    m = measureCanvas(pxPerUnit);
  }

  canvas.width = m.width;
  canvas.height = m.height;
  // Resizing the canvas resets the 2D context → the draw helper re-applies all draw state.
  drawTextLinesToCanvas(ctx, canvas, lines, m, font, obliqueShear, trueColorToHex(colorInt));

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter; // non power-of-two canvas → no mipmaps
  texture.magFilter = THREE.LinearFilter;

  // Plane spans the canvas in world units (same px→unit factor) so the texture never distorts
  // and never clips. Centred on the attachment-aware box centre (below) — the padded plane
  // extends symmetrically around it (transparent margin), matching the 2D glyph block.
  const widthUnits = canvas.width / pxPerUnit;
  const heightUnitsPadded = canvas.height / pxPerUnit;
  const geometry = new THREE.PlaneGeometry(widthUnits, heightUnitsPadded);
  // ADR-537 underlay-depth — text is part of the DXF underlay and is drawn by the dedicated
  // overlay pass (`post-fx-overlay-pass.ts`) AFTER the lit scene + SSAO, so it needs NO `depthTest:false`
  // band-aid: depth-TESTED (walls in front occlude it, unified with the wireframe) but
  // `depthWrite:false` so the translucent quad never self-z-fights the linework it labels.
  const material = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  // ADR-557 (C-rotation) — flat-lay (rotateX(−90°), the DXF→Three mapping) + plan-spin about the
  // world vertical by `entity.rotation`, so the text lies flat AND leans exactly like the 2D glyphs.
  orientTextPlane(mesh, entity);
  // ADR-557 Φ-attachment — anchor the plane CENTRE at the NOMINAL em-box centre
  // (`resolveTextEmBox`): the 3D canvas draws the glyph centred in an em cell, so the plane
  // follows the em box, NOT the tight VISUAL cap box the 2D grips/hover use (which would
  // shift the 3D text vs the plan). Attachment-aware → 2D ≡ 3D placement.
  const boxCenter = resolveTextEmBox(entity).center;
  mesh.position.set(boxCenter.x, 0, -boxCenter.y);

  return { mesh, geometry, material, texture };
}
