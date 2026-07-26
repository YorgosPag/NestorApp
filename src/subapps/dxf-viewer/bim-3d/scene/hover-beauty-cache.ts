/**
 * hover-beauty-cache.ts — Frozen "beauty" snapshot for INSTANT 3D hover outline (ADR-549 Φ3 · Φ5).
 *
 * PROBLEM (measured 2026-07-22, weak GPU): with the LIVE hover silhouette, every hover-id change
 * fires a FULL scene render — avg 37-44ms, max 187ms (full raster + shadow-toggle material churn) —
 * to repaint a 2px outline. The BVH raycast pick itself is ~0.5ms; the cost is 100% the beauty
 * re-render (dirty-reason histogram: ρητό αίτημα redraw — σήμερα `requestedRedraw`, SSAO off).
 *
 * SOLUTION (mirror of ADR-516 `DxfBackdropCache` + the 2D bitmap cache of ADR-040): when ONLY the
 * hover changed (camera + geometry + lights + selection all static), the beauty is identical to the
 * previous frame. Snapshot the framebuffer AFTER the beauty render but BEFORE the outline overlay,
 * then on a hover-only frame BLIT that snapshot and redraw just the (cheap) outline. 40ms → ~1-2ms.
 *
 * The snapshot is captured ONLY on a cacheable frame (static raster/SSAO — NOT backdrop-drag, section
 * cut, path-trace, camera interaction or animation); any non-cacheable frame {@link invalidate}s it,
 * so a hover-only blit can never show a stale beauty.
 *
 * ## 🐛 Φ5 — ΓΙΑΤΙ ΤΟ SNAPSHOT ΕΙΝΑΙ **MSAA RESOLVE** ΚΑΙ ΟΧΙ `copyFramebufferToTexture`
 *
 * INCIDENT 2026-07-26 (browser-proven): μόλις το Φ4 άνοιξε επιτέλους το gate, ΚΑΘΕ hover πάνω σε BIM
 * στοιχείο **μαύριζε ολόκληρη τη σκηνή** — έμεναν μόνο τα κίτρινα περιγράμματα «φαντάσματα» και ο
 * ViewCube. Ο κώδικας του Φ3 δεν είχε εκτελεστεί ΠΟΤΕ, άρα το δικό του σφάλμα ήταν αόρατο επί ~1 μήνα.
 *
 * ΑΙΤΙΑ: ο main renderer δημιουργείται με **`antialias: true`** (`scene-setup.ts`), άρα το default
 * framebuffer είναι **multisampled** (μετρημένο: `SAMPLES = 4`). Το `renderer.copyFramebufferToTexture`
 * κάτω από την επιφάνεια είναι `glCopyTexSubImage2D`, και η OpenGL ES 3.0 §3.8.5 ορίζει ρητά
 * **INVALID_OPERATION όταν το `SAMPLE_BUFFERS` του read framebuffer είναι > 0**. Μετρημένο ζωντανά:
 * `glErrorAfterCopy = 1282 (INVALID_OPERATION)` σε **κάθε** κλήση. Το texture έμενε μηδενισμένο, το
 * `capture()` δήλωνε ΠΑΡ' ΟΛΑ ΑΥΤΑ επιτυχία (`captured = true` χωρίς κανέναν έλεγχο), και το `blit()`
 * ζωγράφιζε **μαύρο** πάνω από τη σωστή εικόνα. Κλασικό «η βελτιστοποίηση απέτυχε σιωπηλά και πήρε
 * μαζί της την ορθότητα».
 *
 * ΔΙΟΡΘΩΣΗ (ο τρόπος που το ορίζει η ίδια η spec): ένα multisampled framebuffer **δεν αντιγράφεται —
 * αναλύεται (resolve)**. Το `blitFramebuffer(READ = οθόνη, DRAW = single-sample RT)` είναι ακριβώς ο
 * MSAA resolve και είναι ο ΜΟΝΟΣ νόμιμος δρόμος από MSAA πηγή. Μετρημένο ζωντανά στον ίδιο υπολογιστή:
 * `blitErr = 0` με πραγματικό περιεχόμενο (avg 128 / max 190 vs 0 πριν).
 *
 * ⚠️ Ο RT **ΠΡΕΠΕΙ** να μείνει **γραμμικός (RGBA8)**, ΟΧΙ `SRGBColorSpace`. Ο multisample resolve
 * απαιτεί **ταυτόσημα** internal formats πηγής/προορισμού· το default framebuffer είναι `RGBA8`, ενώ
 * το `SRGBColorSpace` κάνει το three να επιλέξει `SRGB8_ALPHA8`. Μετρημένο ζωντανά: με
 * `SRGB8_ALPHA8` προορισμό το blit επιστρέφει **1282 και μαύρο** — δηλαδή ακριβώς το ίδιο bug από
 * άλλη πόρτα. Γι' αυτό ΚΑΙ το blit-back γίνεται με **pass-through `ShaderMaterial`**: τα bytes είναι
 * ήδη screen-encoded, οπότε γράφονται αυτούσια (καμία διπλή sRGB μετατροπή).
 *
 * ⚠️ Η **αντίστροφη** διαδρομή (blit RT → οθόνη) ΔΕΝ επιτρέπεται: η ES 3.0 §4.3.2 απαγορεύει
 * `blitFramebuffer` προς multisampled DRAW framebuffer. Μετρημένο: `1282`. Γι' αυτό η επαναφορά
 * γίνεται με fullscreen quad και όχι με δεύτερο blit.
 *
 * ## Belt-and-suspenders (N.7.2 §4) — η βελτιστοποίηση ΔΕΝ κρατά όμηρο την ορθότητα
 *
 * Το `capture()` **επαληθεύει** το resolve μία φορά (`getError()` μετά το πρώτο blit) και κρατά το
 * αποτέλεσμα. Αν ο resolve δεν υποστηρίζεται (WebGL1 / driver), ο cache **αυτο-απενεργοποιείται**
 * μόνιμα: `hasCapture()` μένει `false` → το `renderTickFrame` πέφτει σε πλήρες render. Χειρότερη
 * περίπτωση = πιο αργό hover· **ποτέ ξανά λάθος εικόνα**. Η επαλήθευση είναι ΜΙΑ φορά επίτηδες:
 * το `getError()` προκαλεί sync stall στον driver και δεν έχει θέση σε per-frame διαδρομή.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-549-3d-cursor-swim-render-loop.md §Φ5
 * @see ./dxf-backdrop-cache.ts — αδελφός cache (ADR-516)· ΔΕΝ έπασχε γιατί **σχεδιάζει** μέσα στον RT
 * @see ./sized-render-target.ts — SSoT για size-managed render targets (ADR-516 Phase 2)
 */

import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { ensureSizedRenderTarget } from './sized-render-target';

const BLIT_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
`;

// Pass-through. Ένα raw ShaderMaterial ΔΕΝ εφαρμόζει τον sRGB output transfer (σε αντίθεση με τα
// built-in materials) — τα cached bytes είναι ήδη screen-encoded, άρα γράφονται αυτούσια και το blit
// είναι pixel-identical με το ζωντανό καρέ. Ίδιο idiom με το `SelectionOutlinePass` (ADR-536).
const BLIT_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D tBeauty;
  varying vec2 vUv;
  void main() {
    gl_FragColor = texture2D( tBeauty, vUv );
  }
`;

/** Μέγιστες επαναλήψεις στο άδειασμα της ουράς σφαλμάτων — φράχτης για χαμένο context. */
const MAX_ERROR_DRAIN = 32;

/**
 * Υποστηρίζει αυτό το context τον MSAA resolve; Ελέγχεται **μία φορά** (βλ. belt-and-suspenders):
 * το `getError()` είναι synchronous stall και δεν επιτρέπεται σε per-frame διαδρομή.
 */
type ResolveSupport = 'unknown' | 'ok' | 'unsupported';

/** Το WebGL2 context όταν υπάρχει· `null` σε WebGL1 (ο resolve είναι WebGL2-only). */
function webgl2Or(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
): WebGL2RenderingContext | null {
  return 'blitFramebuffer' in gl ? gl : null;
}

export class HoverBeautyCache {
  private rt: THREE.WebGLRenderTarget | null = null;
  private quad: FullScreenQuad | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private captured = false;
  private support: ResolveSupport = 'unknown';
  private readonly size = new THREE.Vector2();

  /** Drop the snapshot — the next full frame must re-capture before a hover-only blit is allowed. */
  invalidate(): void {
    this.captured = false;
  }

  /** True when a valid beauty snapshot exists to blit. */
  hasCapture(): boolean {
    return this.captured && this.rt !== null;
  }

  /**
   * Resolve the CURRENT screen framebuffer (the clean beauty, before the outline overlay) into the
   * cache target. Call once per cacheable full frame; allocates lazily on the first call / a resize.
   *
   * Δεν πετάει ποτέ: σε αποτυχία απλώς **δεν** δηλώνει `captured`, οπότε το επόμενο hover καρέ κάνει
   * cache miss και ο καλών σχεδιάζει κανονικά (σωστή εικόνα, απλώς χωρίς την επιτάχυνση).
   */
  capture(renderer: THREE.WebGLRenderer): void {
    if (this.support === 'unsupported') return;
    const gl = webgl2Or(renderer.getContext());
    if (!gl) {
      this.support = 'unsupported';
      return;
    }
    const rt = this.ensure(renderer);
    const { width, height } = rt;
    const probing = this.support === 'unknown';
    if (probing) drainGlErrors(gl);

    // DRAW = ο cache RT (τον δένει το three, άρα το framebuffer του στήνεται/ανα-στήνεται μόνο του).
    renderer.setRenderTarget(rt);
    // READ = η ΟΘΟΝΗ. ⚠️ ΟΧΙ μέσω `renderer.state.bindFramebuffer`: το `setRenderTarget` παραπάνω
    // έδεσε `gl.FRAMEBUFFER` (= read ΚΑΙ draw) στον RT, αλλά η cache του three ενημερώνει μόνο τα
    // FRAMEBUFFER/DRAW κλειδιά. Ο cached wrapper θα νόμιζε ότι το READ είναι ήδη `null` και θα
    // ΠΑΡΕΛΕΙΠΕ το bind → το blit θα διάβαζε τον ΙΔΙΟ τον RT. Το raw bind είναι εδώ το σωστό.
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    // Επαναφέρει `gl.FRAMEBUFFER = null` (read + draw) ΚΑΙ συγχρονίζει ξανά την cache του three.
    renderer.setRenderTarget(null);

    if (probing) {
      this.support = gl.getError() === gl.NO_ERROR ? 'ok' : 'unsupported';
      if (this.support === 'unsupported') return; // αυτο-απενεργοποίηση → πάντα πλήρες render
    }
    this.captured = true;
  }

  /** Hover-only frame: paint the cached beauty fullscreen over the screen. Returns false on a miss. */
  blit(renderer: THREE.WebGLRenderer): boolean {
    if (!this.captured || !this.quad) return false;
    renderer.setRenderTarget(null);
    this.quad.render(renderer);
    return true;
  }

  /**
   * (Re)allocate the cache target + blit quad to the current drawing-buffer size (SSoT
   * `ensureSizedRenderTarget`). A resize goes through `setSize`, which reallocates the storage — άρα
   * το προηγούμενο snapshot παύει να ισχύει και σβήνεται εδώ ρητά.
   */
  private ensure(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
    const size = renderer.getDrawingBufferSize(this.size);
    const before = this.rt;
    const prevW = before?.width ?? -1;
    const prevH = before?.height ?? -1;
    // Γραμμικός RGBA8 + κανένα depth/stencil: ο multisample resolve απαιτεί ΤΑΥΤΟΣΗΜΟ internal
    // format με το default framebuffer (βλ. docblock — SRGB8_ALPHA8 → INVALID_OPERATION + μαύρο).
    const rt = ensureSizedRenderTarget(before, size.x, size.y, (w, h) =>
      new THREE.WebGLRenderTarget(w, h, { depthBuffer: false, stencilBuffer: false }));
    this.rt = rt;
    if (rt.width !== prevW || rt.height !== prevH) this.captured = false;
    if (!this.material) {
      this.material = new THREE.ShaderMaterial({
        uniforms: { tBeauty: { value: rt.texture } },
        vertexShader: BLIT_VERTEX_SHADER,
        fragmentShader: BLIT_FRAGMENT_SHADER,
        depthTest: false,
        depthWrite: false,
        blending: THREE.NoBlending, // καθαρή αντικατάσταση της οθόνης, όχι σύνθεση
      });
      this.quad = new FullScreenQuad(this.material);
    }
    this.material.uniforms.tBeauty.value = rt.texture;
    return rt;
  }

  dispose(): void {
    this.rt?.dispose();
    this.quad?.dispose();
    this.material?.dispose();
    this.rt = null;
    this.quad = null;
    this.material = null;
    this.captured = false;
  }
}

/** Αδειάζει την ουρά σφαλμάτων ώστε το `getError()` του probe να μετρά ΜΟΝΟ το δικό μας blit. */
function drainGlErrors(gl: WebGL2RenderingContext): void {
  for (let i = 0; i < MAX_ERROR_DRAIN && gl.getError() !== gl.NO_ERROR; i += 1) { /* drain */ }
}
