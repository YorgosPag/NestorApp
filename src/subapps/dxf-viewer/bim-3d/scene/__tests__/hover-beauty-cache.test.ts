/**
 * ADR-549 Φ3/Φ5 — HoverBeautyCache (beauty snapshot for the instant hover-only fast path).
 *
 * Το παλιό suite (Φ3) περνούσε **πράσινο ενώ το feature ήταν 100% σπασμένο**: mock-άριζε το
 * `copyFramebufferToTexture` και μετρούσε ότι *κλήθηκε*, ποτέ ότι *πέτυχε*. Στον browser η κλήση
 * επέστρεφε `INVALID_OPERATION` (MSAA read framebuffer) και ο cache ζωγράφιζε **μαύρο** πάνω από τη
 * σκηνή. Ένα test που μετρά κλήσεις αντί για συνέπειες δεν είναι δίχτυ — είναι σχόλιο.
 *
 * Εδώ κλειδώνεται το ΣΥΜΒΟΛΑΙΟ:
 *   • fresh cache = MISS (ο καλών σχεδιάζει πλήρες καρέ),
 *   • capture() κάνει **MSAA resolve** (`blitFramebuffer`) με READ = ΟΘΟΝΗ, όχι `copyTexSubImage2D`,
 *   • 🔴 αν το GL αναφέρει σφάλμα, ο cache **ΔΕΝ** δηλώνει hit → πάντα σωστή εικόνα (Φ5 regression),
 *   • ο έλεγχος γίνεται ΜΙΑ φορά (το `getError()` είναι sync stall — απαγορευμένο per-frame),
 *   • ο RT μένει **γραμμικός** (SRGB internal format ⇒ ο resolve ξανασπάει — anchor της αιτίας),
 *   • invalidate() / resize διώχνουν το snapshot (καμία μπαγιάτικη εικόνα).
 */

import * as THREE from 'three';
import { HoverBeautyCache } from '../hover-beauty-cache';

const NO_ERROR = 0;
const INVALID_OPERATION = 1282;
const READ_FRAMEBUFFER = 0x8ca8;
const COLOR_BUFFER_BIT = 0x4000;
const NEAREST = 0x2600;

interface GlSpy {
  bindFramebuffer: jest.Mock;
  blitFramebuffer: jest.Mock;
  getError: jest.Mock;
  READ_FRAMEBUFFER: number;
  COLOR_BUFFER_BIT: number;
  NEAREST: number;
  NO_ERROR: number;
}

interface RendererSpy {
  gl: GlSpy;
  setRenderTarget: jest.Mock;
  render: jest.Mock;
  /** Σειρά κλήσεων GL/renderer — ο resolve είναι σωστός μόνο με τη ΣΩΣΤΗ σειρά. */
  calls: string[];
}

/**
 * @param resolveError το σφάλμα που «επιστρέφει» το GL μετά το blit (ο probe το διαβάζει)
 * @param webgl2 false ⇒ context χωρίς `blitFramebuffer` (WebGL1)
 * @param size drawing-buffer μέγεθος
 */
function makeRenderer(
  { resolveError = NO_ERROR, webgl2 = true, size = [800, 600] as const } = {},
): { renderer: THREE.WebGLRenderer; spy: RendererSpy } {
  const calls: string[] = [];
  // Το probe αδειάζει ΠΡΩΤΑ την ουρά (NO_ERROR), μετά διαβάζει το αποτέλεσμα του δικού μας blit.
  let drained = false;
  const gl: GlSpy = {
    bindFramebuffer: jest.fn((target: number) => {
      calls.push(target === READ_FRAMEBUFFER ? 'bindRead' : 'bindOther');
    }),
    blitFramebuffer: jest.fn(() => { calls.push('blit'); }),
    getError: jest.fn(() => {
      if (!drained) { drained = true; return NO_ERROR; }
      return resolveError;
    }),
    READ_FRAMEBUFFER, COLOR_BUFFER_BIT, NEAREST, NO_ERROR,
  };
  const context: Record<string, unknown> = webgl2
    ? { ...gl }
    : { bindFramebuffer: gl.bindFramebuffer, getError: gl.getError, NO_ERROR };
  const spy: RendererSpy = {
    gl,
    setRenderTarget: jest.fn((rt: THREE.WebGLRenderTarget | null) => {
      calls.push(rt ? 'targetRT' : 'targetScreen');
    }),
    render: jest.fn(() => { calls.push('quad'); }),
    calls,
  };
  const renderer = {
    getDrawingBufferSize: (v: THREE.Vector2) => v.set(size[0], size[1]),
    getContext: () => context,
    setRenderTarget: spy.setRenderTarget,
    render: spy.render,
  } as unknown as THREE.WebGLRenderer;
  return { renderer, spy };
}

describe('HoverBeautyCache', () => {
  it('is a MISS until a capture exists', () => {
    const cache = new HoverBeautyCache();
    const { renderer, spy } = makeRenderer();
    expect(cache.hasCapture()).toBe(false);
    expect(cache.blit(renderer)).toBe(false); // nothing to paint → caller falls back to a full render
    expect(spy.gl.blitFramebuffer).not.toHaveBeenCalled();
    cache.dispose();
  });

  it('capture() MSAA-resolves the SCREEN into the cache → blit() paints it', () => {
    const cache = new HoverBeautyCache();
    const { renderer, spy } = makeRenderer();

    cache.capture(renderer);
    expect(cache.hasCapture()).toBe(true);
    expect(spy.gl.blitFramebuffer).toHaveBeenCalledTimes(1);
    // Η σειρά ΕΙΝΑΙ ο μηχανισμός: DRAW = RT, μετά READ = οθόνη, μετά resolve, μετά πίσω στην οθόνη.
    expect(spy.calls).toEqual(['targetRT', 'bindRead', 'blit', 'targetScreen']);

    expect(cache.blit(renderer)).toBe(true); // hit → painted
    expect(spy.render).toHaveBeenCalledTimes(1); // the fullscreen quad drew the cached beauty
    cache.dispose();
  });

  it('resolves with a 1:1 rectangle and NEAREST filter (multisample resolve requirement)', () => {
    const cache = new HoverBeautyCache();
    const { renderer, spy } = makeRenderer({ size: [1555, 697] });
    cache.capture(renderer);
    expect(spy.gl.blitFramebuffer).toHaveBeenCalledWith(
      0, 0, 1555, 697, 0, 0, 1555, 697, COLOR_BUFFER_BIT, NEAREST,
    );
    // READ πρέπει να δεθεί ΡΗΤΑ στο default framebuffer (null) — αλλιώς διαβάζουμε τον ίδιο τον RT.
    expect(spy.gl.bindFramebuffer).toHaveBeenCalledWith(READ_FRAMEBUFFER, null);
    cache.dispose();
  });

  // 🔴 Το test που θα είχε πιάσει το incident της 2026-07-26 (μαύρη 3D σκηνή στο hover).
  it('NEVER reports a hit when the GL resolve fails → caller keeps rendering the real frame', () => {
    const cache = new HoverBeautyCache();
    const { renderer, spy } = makeRenderer({ resolveError: INVALID_OPERATION });

    cache.capture(renderer);

    expect(spy.gl.blitFramebuffer).toHaveBeenCalledTimes(1); // προσπάθησε…
    expect(cache.hasCapture()).toBe(false); // …αλλά ΔΕΝ ψεύδεται για το αποτέλεσμα
    expect(cache.blit(renderer)).toBe(false); // → πλήρες render, ποτέ μαύρη οθόνη
    expect(spy.render).not.toHaveBeenCalled();
    cache.dispose();
  });

  it('self-disables after a failed resolve — no per-frame getError() stall, no retry storm', () => {
    const cache = new HoverBeautyCache();
    const { renderer, spy } = makeRenderer({ resolveError: INVALID_OPERATION });

    cache.capture(renderer);
    const afterFirst = spy.gl.getError.mock.calls.length;
    cache.capture(renderer);
    cache.capture(renderer);

    expect(spy.gl.blitFramebuffer).toHaveBeenCalledTimes(1); // δεν ξαναδοκιμάζει
    expect(spy.gl.getError.mock.calls.length).toBe(afterFirst);
    expect(cache.hasCapture()).toBe(false);
    cache.dispose();
  });

  it('probes ONCE — later captures resolve without touching getError()', () => {
    const cache = new HoverBeautyCache();
    const { renderer, spy } = makeRenderer();

    cache.capture(renderer);
    const afterProbe = spy.gl.getError.mock.calls.length;
    cache.capture(renderer);
    cache.capture(renderer);

    expect(spy.gl.blitFramebuffer).toHaveBeenCalledTimes(3); // ο resolve συνεχίζει κανονικά
    expect(spy.gl.getError.mock.calls.length).toBe(afterProbe); // …χωρίς νέο sync stall
    expect(cache.hasCapture()).toBe(true);
    cache.dispose();
  });

  it('a WebGL1 context (no blitFramebuffer) is a permanent MISS, never a false hit', () => {
    const cache = new HoverBeautyCache();
    const { renderer, spy } = makeRenderer({ webgl2: false });

    cache.capture(renderer);

    expect(cache.hasCapture()).toBe(false);
    expect(cache.blit(renderer)).toBe(false);
    expect(spy.setRenderTarget).not.toHaveBeenCalled(); // ούτε καν αγγίζει τον renderer
    cache.dispose();
  });

  // ⚓ ANCHOR ΤΗΣ ΑΙΤΙΑΣ: `SRGBColorSpace` ⇒ internal format SRGB8_ALPHA8 ⇒ ο multisample resolve
  // επιστρέφει INVALID_OPERATION (browser-measured) ⇒ μαύρη οθόνη. Αν κάποιος το «διορθώσει» για
  // χρωματική ακρίβεια, αυτό το test κοκκινίζει ΠΡΙΝ φτάσει στον browser.
  it('keeps the cache target LINEAR + depth/stencil-free (multisample-resolve compatible)', () => {
    const cache = new HoverBeautyCache();
    const { renderer } = makeRenderer();
    cache.capture(renderer);

    const rt = (cache as unknown as { rt: THREE.WebGLRenderTarget }).rt;
    expect(rt.texture.colorSpace).not.toBe(THREE.SRGBColorSpace);
    expect(rt.depthBuffer).toBe(false);
    expect(rt.stencilBuffer).toBe(false);
    cache.dispose();
  });

  it('invalidate() drops the snapshot → the next blit is a miss again', () => {
    const cache = new HoverBeautyCache();
    const { renderer } = makeRenderer();
    cache.capture(renderer);
    expect(cache.blit(renderer)).toBe(true);

    cache.invalidate();
    expect(cache.hasCapture()).toBe(false);
    expect(cache.blit(renderer)).toBe(false); // stale beauty is never blitted
    cache.dispose();
  });

  it('follows the drawing-buffer size, so the blit is never a stretched old frame', () => {
    const cache = new HoverBeautyCache();
    const first = makeRenderer({ size: [800, 600] });
    cache.capture(first.renderer);
    const rtBefore = (cache as unknown as { rt: THREE.WebGLRenderTarget }).rt;
    expect([rtBefore.width, rtBefore.height]).toEqual([800, 600]);

    const resized = makeRenderer({ size: [1024, 768] });
    cache.capture(resized.renderer);
    const rtAfter = (cache as unknown as { rt: THREE.WebGLRenderTarget }).rt;
    expect([rtAfter.width, rtAfter.height]).toEqual([1024, 768]);
    // Ο resolve ζητά ΤΟ ΝΕΟ ορθογώνιο — αλλιώς αντιγράφει μέρος της οθόνης και το quad το τεντώνει.
    expect(resized.spy.gl.blitFramebuffer).toHaveBeenCalledWith(
      0, 0, 1024, 768, 0, 0, 1024, 768, COLOR_BUFFER_BIT, NEAREST,
    );
    cache.dispose();
  });

  it('dispose() releases everything and leaves a cold cache', () => {
    const cache = new HoverBeautyCache();
    const { renderer } = makeRenderer();
    cache.capture(renderer);
    cache.dispose();
    expect(cache.hasCapture()).toBe(false);
    expect(cache.blit(renderer)).toBe(false);
  });
});
