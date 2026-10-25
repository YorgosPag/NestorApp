/**
 * scene-fat-line-screen-dash — a fat-line dash measured in SCREEN pixels (ADR-920 Β4.8 Β2.1).
 *
 * `LineMaterial` dashes along `instanceDistanceStart/End` — distances in WORLD units (its `worldUnits`
 * flag governs the width only). That suits a dashed edge on a 3 m wall; it fails on a 100 m site, where a
 * dash that reads at 5 m from the camera is sub-pixel noise from an orbit and a solid smear up close. A
 * breakline's pattern is a LEGEND («where did this z come from?», `topo-breakline-style`), and a legend
 * must read the same at every zoom — exactly as it does on the plan, where the SVG dash is in px.
 *
 * AutoCAD/Civil 3D sidestep the question: a 3D polyline does not honour non-continuous linetypes at all
 * (`LINETYPE3DPLINEON` only half-fixes it). three.js has no screen-space dash. So this patches the stock
 * shader, in two small, anchored edits:
 *
 * 1. **Vertex** — replace the line distance with the on-screen distance from the segment's start, in
 *    drawing-buffer px (the `resolution` unit, like `linewidth`, see `scene-fat-line`). The dash restarts
 *    at every vertex, so each vertex — where a breakline's z is DEFINED — begins with ink.
 * 2. **Interpolation** — a varying is interpolated perspective-correctly, i.e. linearly in WORLD space,
 *    and a screen distance is linear in SCREEN space. GLSL ES 3.00 has no `noperspective`, so the
 *    distance travels pre-multiplied by `w` alongside `w` itself and the fragment divides: `∑bᵢdᵢ`, exact
 *    under perspective, identity under the orthographic camera.
 *
 * Every edit is located by an ANCHOR string of three 0.170's `ShaderLib.line`. An upgrade that moves one
 * would otherwise compile cleanly and silently draw a solid line — the legend lost with nothing red — so a
 * missing anchor is logged at runtime and pinned against the REAL shader in the test.
 *
 * @module bim-3d/lines/scene-fat-line-screen-dash
 * @enterprise ADR-920 — Topography breaklines · ADR-650 — Topography · ADR-584 — Anti-Duplication
 */

import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('SceneFatLineScreenDash');

/** Program cache key — mandatory with `onBeforeCompile`, or three may hand this material a stock program. */
const SCREEN_DASH_PROGRAM_CACHE_KEY = 'scene-fat-line-screen-dash';

/** The `w` that undoes perspective-correct interpolation (see module note, step 2). */
const W_VARYING = 'varying float vScreenDashW;';

const VERTEX_DISTANCE = /* glsl */ `
			#ifdef USE_DASH
				vec2 sdStart = ( ndcStart.xy * 0.5 + 0.5 ) * resolution;
				vec2 sdAxis = ( ndcEnd.xy * 0.5 + 0.5 ) * resolution - sdStart;
				vec2 sdHere = ( clip.xy / clip.w * 0.5 + 0.5 ) * resolution;
				float sdLength = length( sdAxis );
				float sd = sdLength > 0.0 ? dot( sdHere - sdStart, sdAxis ) / sdLength : 0.0;
				vLineDistance = sd * clip.w;
				vScreenDashW = clip.w;
			#endif
			gl_Position = clip;`;

/** One anchored edit: `find` must occur EXACTLY once in its stage. */
interface ShaderEdit {
  readonly stage: 'vertexShader' | 'fragmentShader';
  readonly find: string;
  readonly replace: string;
}

const EDITS: readonly ShaderEdit[] = [
  { stage: 'vertexShader', find: 'varying float vLineDistance;', replace: `varying float vLineDistance;\n\t\t\t${W_VARYING}` },
  { stage: 'vertexShader', find: 'gl_Position = clip;', replace: VERTEX_DISTANCE },
  { stage: 'fragmentShader', find: 'varying float vLineDistance;', replace: `varying float vLineDistance;\n\t\t${W_VARYING}` },
  { stage: 'fragmentShader', find: 'mod( vLineDistance + dashOffset,', replace: 'mod( vLineDistance / vScreenDashW + dashOffset,' },
];

export interface LineShaderSource {
  readonly vertexShader: string;
  readonly fragmentShader: string;
}

/**
 * Apply the screen-dash edits to a `LineMaterial` shader source. Pure. Returns `null` — never a half-
 * patched shader — when any anchor is missing or ambiguous, so the caller can keep the stock program.
 */
export function patchScreenDashShader(source: LineShaderSource): LineShaderSource | null {
  const out = { vertexShader: source.vertexShader, fragmentShader: source.fragmentShader };
  for (const edit of EDITS) {
    const code = out[edit.stage];
    const at = code.indexOf(edit.find);
    if (at < 0 || code.indexOf(edit.find, at + edit.find.length) >= 0) return null;
    out[edit.stage] = code.slice(0, at) + edit.replace + code.slice(at + edit.find.length);
  }
  return out;
}

/**
 * Turn a (dashed) `LineMaterial` into a screen-space-dashed one. `dashSize`/`gapSize` are then in
 * drawing-buffer px — the caller scales them by the pixel ratio, exactly as it does `linewidth`.
 */
export function applyScreenDash(material: LineMaterial): void {
  material.customProgramCacheKey = () => SCREEN_DASH_PROGRAM_CACHE_KEY;
  material.onBeforeCompile = (shader) => {
    const patched = patchScreenDashShader(shader);
    if (!patched) {
      logger.error('LineMaterial shader anchors not found — screen-space dash disabled (three upgrade?)');
      return;
    }
    shader.vertexShader = patched.vertexShader;
    shader.fragmentShader = patched.fragmentShader;
  };
}
