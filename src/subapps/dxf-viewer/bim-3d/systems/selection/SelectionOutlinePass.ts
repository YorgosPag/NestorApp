/**
 * SelectionOutlinePass — Cinema 4D / Revit / Unreal-style silhouette outline for
 * the selected BIM entities, drawn with a fast, crisp **mask + dilate** technique
 * (the approach the big real-time engines use — NOT the heavier OutlinePass).
 *
 * Per frame, with a selection:
 *   1. Render ONLY the selected meshes (solid white, depth-less) into a mask RT —
 *      a handful of objects, NOT the whole scene, NO depth re-render, NO blur.
 *   2. One full-screen dilate pass draws a constant-width orange line just OUTSIDE
 *      the silhouette (premultiplied "over" blend). The colour is a uniform, so it
 *      never mixes with the scene behind it.
 *
 * Why not OutlinePass: it re-rendered the ENTIRE scene's depth + ran 2 blur passes
 * every frame → too slow at full-res on weaker GPUs, and noisy/unclear at half-res.
 * This mask+dilate path is both faster (only selected objects) and crisper
 * (full-res, exact pixel width). The body material is left UNTOUCHED.
 *
 * `renderOverlayToScreen()` is called AFTER the scene render on every interactive
 * path (raster / SSAO-idle / section-cut), so the outline is identical everywhere.
 *
 * ADR-536. Replaces the emissive mechanism of ADR-366 A.1 (BimSelectionHighlighter).
 */

import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { BIM_SELECTION_OUTLINE_COLOR_THREE, BIM_HOVER_OUTLINE_COLOR_THREE } from './selection-outline-tokens';

/** Selection outline width in device pixels (exact, resolution-independent). */
const OUTLINE_WIDTH_PX = 2.0;
/** Selection outline opacity (committed state = fully solid). */
const OUTLINE_ALPHA = 1.0;
// ADR-538 — HOVER outline reads as TRANSIENT vs the committed selection (Revit / Cinema 4D
// distinguish rollover from selection): a thinner + dimmer line, same yellow hue.
const HOVER_OUTLINE_WIDTH_PX = 1.4;
const HOVER_OUTLINE_ALPHA = 0.65;

// sRGB components of an outline colour, passed RAW to the shader. A raw ShaderMaterial
// does not apply the sRGB output transfer (unlike built-in materials), and THREE.Color
// would convert the hex to LINEAR — both would darken/desaturate the hue. Feeding the
// sRGB bytes directly displays the exact authored colour on the (sRGB) canvas.
function srgbVec(hex: number): THREE.Vector3 {
  return new THREE.Vector3(((hex >> 16) & 0xff) / 255, ((hex >> 8) & 0xff) / 255, (hex & 0xff) / 255);
}

const OUTLINE_COLOR_SRGB = srgbVec(BIM_SELECTION_OUTLINE_COLOR_THREE); // selection = gold
// ADR-538 — hover = yellow (mirrors the 2D entity hover glow #FFFF00).
const HOVER_COLOR_SRGB = srgbVec(BIM_HOVER_OUTLINE_COLOR_THREE);

const DILATE_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
`;

// Dilate: an outside pixel within uRadius of the white silhouette mask becomes a
// solid constant-colour line. The colour is the uColor uniform (never the scene),
// so the hue is identical regardless of what is behind it. Output is premultiplied
// for the matching One / 1-SrcAlpha "over" blend.
const DILATE_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D tMask;
  uniform vec2 uTexel;
  uniform vec3 uColor;
  uniform float uRadius;
  uniform float uAlpha;
  varying vec2 vUv;

  const int DIRS = 8;
  const int RINGS = 2;

  void main() {
    float center = texture2D( tMask, vUv ).r;
    float maxN = 0.0;
    for ( int r = 1; r <= RINGS; r++ ) {
      float rr = uRadius * float( r ) / float( RINGS );
      for ( int d = 0; d < DIRS; d++ ) {
        float ang = ( float( d ) + 0.5 * float( r ) ) / float( DIRS ) * 6.2831853;
        vec2 off = vec2( cos( ang ), sin( ang ) ) * rr * uTexel;
        maxN = max( maxN, texture2D( tMask, vUv + off ).r );
      }
    }
    float outside = 1.0 - smoothstep( 0.3, 0.7, center );
    float near = smoothstep( 0.3, 0.7, maxN );
    // uAlpha dims the whole line (premultiplied) — hover is dimmer than selection (ADR-538).
    float a = outside * near * uAlpha;
    gl_FragColor = vec4( uColor * a, a );
  }
`;

export class SelectionOutlinePass {
  private readonly _scene: THREE.Scene;
  private _camera: THREE.Camera;
  private _selected: THREE.Object3D[] = [];
  // ADR-538 — the hovered meshes, drawn in a SECOND silhouette pass (yellow) within the
  // same `renderOverlayToScreen`. Coexists with the selection silhouette (gold).
  private _hover: THREE.Object3D[] = [];

  private _maskRT: THREE.WebGLRenderTarget | null = null;
  private readonly _maskMaterial: THREE.MeshBasicMaterial;
  private _dilateQuad: FullScreenQuad | null = null;
  private _dilateMaterial: THREE.ShaderMaterial | null = null;

  private readonly _sizeVec = new THREE.Vector2();
  private readonly _prevClearColor = new THREE.Color();

  constructor(_resolution: THREE.Vector2, scene: THREE.Scene, camera: THREE.Camera) {
    this._scene = scene;
    this._camera = camera;
    // Solid-white, depth-less, double-sided → the union of selected meshes forms a
    // gap-free silhouette mask regardless of draw order or face winding.
    this._maskMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
  }

  /** Set the silhouetted objects (the meshes whose bimId is selected). */
  setSelected(objects: readonly THREE.Object3D[]): void {
    this._selected = objects.slice();
  }

  /** ADR-538 — set the HOVER silhouette objects (drawn yellow, alongside the selection). */
  setHovered(objects: readonly THREE.Object3D[]): void {
    this._hover = objects.slice();
  }

  /** True when there is an active silhouette to draw. */
  hasSelection(): boolean {
    return this._selected.length > 0;
  }

  /** The current silhouetted objects (read-only; used by tests + diagnostics). */
  get selectedObjects(): readonly THREE.Object3D[] {
    return this._selected;
  }

  /** Keep the outline camera in sync with the live viewport camera. */
  setCamera(camera: THREE.Camera): void {
    this._camera = camera;
  }

  /**
   * ADR-536 — composite the selection silhouette onto the CURRENT framebuffer
   * (screen), ON TOP of whatever the scene path rendered. No-op without a selection.
   */
  renderOverlayToScreen(renderer: THREE.WebGLRenderer): void {
    if (this._selected.length === 0 && this._hover.length === 0) return;
    const size = renderer.getDrawingBufferSize(this._sizeVec);
    const maskRT = this._ensureMaskTarget(size.x, size.y);
    const prevTarget = renderer.getRenderTarget();
    const prevAutoClear = renderer.autoClear;
    renderer.getClearColor(this._prevClearColor);
    const prevAlpha = renderer.getClearAlpha();

    // ADR-536 selection (gold, solid 2px) + ADR-538 hover (yellow, thinner 1.4px + dimmer):
    // two independent silhouettes, each its own mask+dilate, sharing one RT. Selection drawn
    // first so a hovered-AND-selected mesh (filtered out of the hover set upstream) keeps gold.
    this._renderSilhouette(renderer, this._selected, OUTLINE_COLOR_SRGB, OUTLINE_WIDTH_PX, OUTLINE_ALPHA, maskRT, prevTarget, size);
    this._renderSilhouette(renderer, this._hover, HOVER_COLOR_SRGB, HOVER_OUTLINE_WIDTH_PX, HOVER_OUTLINE_ALPHA, maskRT, prevTarget, size);

    renderer.autoClear = prevAutoClear;
    renderer.setClearColor(this._prevClearColor, prevAlpha);
  }

  /**
   * One silhouette: render `objects` as a solid-white mask, then dilate it into a
   * constant-width `colorVec` line over the current frame. No-op for an empty set.
   * Shared by the selection (gold) and hover (yellow) passes — ADR-536 / ADR-538.
   */
  private _renderSilhouette(
    renderer: THREE.WebGLRenderer,
    objects: readonly THREE.Object3D[],
    colorVec: THREE.Vector3,
    widthPx: number,
    alpha: number,
    maskRT: THREE.WebGLRenderTarget,
    prevTarget: THREE.WebGLRenderTarget | null,
    size: THREE.Vector2,
  ): void {
    if (objects.length === 0) return;
    // 1. Render only these meshes as a solid-white silhouette mask.
    renderer.setRenderTarget(maskRT);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.autoClear = false;
    for (const obj of objects) {
      if (!(obj instanceof THREE.Mesh)) continue;
      const saved = obj.material;
      obj.material = this._maskMaterial;
      try {
        renderer.render(obj, this._camera);
      } finally {
        obj.material = saved; // guarantee restore — a leaked white material is very visible
      }
    }
    // 2. Dilate the mask into a constant-width coloured line over the existing frame.
    renderer.setRenderTarget(prevTarget);
    this._ensureDilateQuad(maskRT.texture, size.x, size.y, colorVec, widthPx, alpha).render(renderer);
  }

  private _ensureMaskTarget(w: number, h: number): THREE.WebGLRenderTarget {
    if (!this._maskRT) {
      this._maskRT = new THREE.WebGLRenderTarget(w, h);
    } else if (this._maskRT.width !== w || this._maskRT.height !== h) {
      this._maskRT.setSize(w, h);
    }
    return this._maskRT;
  }

  private _ensureDilateQuad(
    texture: THREE.Texture, w: number, h: number, colorVec: THREE.Vector3, widthPx: number, alpha: number,
  ): FullScreenQuad {
    if (!this._dilateMaterial) {
      this._dilateMaterial = new THREE.ShaderMaterial({
        uniforms: {
          tMask: { value: texture },
          uTexel: { value: new THREE.Vector2(1 / w, 1 / h) },
          uColor: { value: colorVec.clone() },
          uRadius: { value: widthPx },
          uAlpha: { value: alpha },
        },
        vertexShader: DILATE_VERTEX_SHADER,
        fragmentShader: DILATE_FRAGMENT_SHADER,
        transparent: true,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        depthTest: false,
        depthWrite: false,
      });
    }
    this._dilateMaterial.uniforms['tMask'].value = texture;
    this._dilateMaterial.uniforms['uTexel'].value.set(1 / w, 1 / h);
    // ADR-538 — colour/width/alpha set per silhouette (selection: gold 2px solid · hover:
    // yellow 1.4px dim); one material reused across both draws.
    this._dilateMaterial.uniforms['uColor'].value.copy(colorVec);
    this._dilateMaterial.uniforms['uRadius'].value = widthPx;
    this._dilateMaterial.uniforms['uAlpha'].value = alpha;
    if (!this._dilateQuad) this._dilateQuad = new FullScreenQuad(this._dilateMaterial);
    return this._dilateQuad;
  }

  dispose(): void {
    this._maskMaterial.dispose();
    this._maskRT?.dispose();
    this._dilateMaterial?.dispose();
    this._dilateQuad?.dispose();
  }
}
