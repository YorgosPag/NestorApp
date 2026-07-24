/**
 * material-thumbnail-sphere — ADR-687 Φ6. ONE lazily-created offscreen sphere
 * renderer that turns a `PbrMaterialDef` into a small PNG data URL, so the material
 * swatches (library list + «Υλικά όψης» bar) show the REAL rendered appearance
 * (green glass, lacquer, metal…) instead of a flat colour chip — the C4D / Revit
 * Material Manager thumbnail.
 *
 * WHY a singleton: browsers cap concurrent WebGL contexts (~16). One shared offscreen
 * renderer draws EVERY material's thumbnail sequentially (render-on-demand); the PMREM
 * studio env is built ONCE in its constructor. The caller (the reactive store) caches
 * the resulting data URL per appearance signature, so each unique appearance renders once.
 *
 * SSoT: reuses `MaterialPreviewSphereRenderer` (the exact editor sphere + studio HDR env
 * + stripe backdrop) with `preserveDrawingBuffer:true` for readback — no second renderer,
 * no second lighting rig (N.18).
 *
 * @see ./material-preview-sphere-renderer.ts — the reused renderer (toDataURL)
 * @see ./material-appearance-thumbnail-store.ts — the reactive cache + hook
 * @see docs/centralized-systems/reference/adrs/ADR-687-material-editor-visual-appearance.md
 */

import type { PbrMaterialDef } from '../../bim/materials/material-catalog-defs';
import type { LoadedTextureSet } from '../materials/bim-texture-cache';
import { MaterialPreviewSphereRenderer } from './material-preview-sphere-renderer';

/** Square render size (px). Downscaled by the swatch (`object-cover`) → crisp at 20–40px. */
const THUMB_SIZE = 64;

let renderer: MaterialPreviewSphereRenderer | null = null;
let unavailable = false; // set once if the GL context can't be created (SSR / no-WebGL / tests)

/** Lazily build (once) the offscreen renderer bound to a detached container. */
function ensureRenderer(): MaterialPreviewSphereRenderer | null {
  if (renderer) return renderer;
  if (unavailable) return null;
  if (typeof document === 'undefined') { unavailable = true; return null; }
  try {
    const container = document.createElement('div');
    // Detached from the DOM — never displayed; sized via `toDataURL`'s resize.
    renderer = new MaterialPreviewSphereRenderer(container, { preserveDrawingBuffer: true });
    return renderer;
  } catch {
    // No WebGL (headless / jsdom / context-limit) → give up permanently; swatch falls back to flat.
    unavailable = true;
    return null;
  }
}

/**
 * ADR-693 Γ1 — είναι αυτό ΠΡΑΓΜΑΤΙΚΗ εικόνα ή εκφυλισμένο data URL;
 *
 * `HTMLCanvasElement.toDataURL()` πάνω σε **χαμένο** WebGL context δεν πετά — επιστρέφει τη
 * συμβολοσειρά `'data:,'`. Αυτή είναι **truthy**, οπότε περνούσε για επιτυχία, αποθηκευόταν
 * ΜΟΝΙΜΑ στο cache του `material-appearance-thumbnail-store`, και κατέληγε ως
 * `<img src="data:,">` = **σπασμένη εικόνα** — ακριβώς τα δύο swatches που ανέφερε ο Giorgio
 * (ADR-693 §2.3 υπόθεση Α). Οι browsers κόβουν το ~16ο ταυτόχρονο WebGL context, γι' αυτό
 * αστοχούσαν ΜΕΡΙΚΑ swatches και όχι όλα.
 */
function isRenderedImage(dataUrl: string): boolean {
  return dataUrl.startsWith('data:image/') && dataUrl.length > MIN_DATA_URL_LENGTH;
}

/** Κάτω από αυτό το μήκος ένα data URL δεν κουβαλά καρέ (το `'data:,'` έχει 6 χαρακτήρες). */
const MIN_DATA_URL_LENGTH = 64;

/**
 * Render `def` (optionally WITH a loaded PBR texture set — ADR-687 Φ7) to a PNG data URL,
 * or `null` when offscreen rendering is unavailable (SSR / no-WebGL) or the draw fails.
 * Synchronous (render-on-demand); the caller passes an ALREADY-loaded texture set.
 *
 * ADR-693 Γ1 — δύο δίχτυα πάνω από την παλιά συμπεριφορά: το αποτέλεσμα **επικυρώνεται** ως
 * πραγματική εικόνα, και ένα χαμένο context **ανακτάται** (dispose + rebuild του singleton) αντί
 * να θεωρείται μόνιμη αποτυχία. Ο caller ξαναζητά το thumbnail στο επόμενο render και πετυχαίνει.
 */
export function renderAppearanceThumbnail(def: PbrMaterialDef, set: LoadedTextureSet | null = null): string | null {
  // Η ανάκτηση πρέπει να είναι ΣΥΓΧΡΟΝΗ και ΦΡΑΓΜΕΝΗ: ο καλών (`material-appearance-thumbnail-
  // store`) βάζει κάθε `null` σε ένα μόνιμο `failed` set και δεν ξαναρωτά ποτέ. Άρα μία —
  // ακριβώς μία — επανάληψη με φρέσκο GL context, εδώ, πριν επιστρέψουμε αποτυχία. Αν λείπει
  // πραγματικά το WebGL, το `ensureRenderer` έχει ήδη σημαδέψει `unavailable` και η δεύτερη
  // προσπάθεια βγαίνει αμέσως — μηδέν κόστος, μηδέν βρόχος.
  return attemptRender(def, set) ?? attemptRender(def, set);
}

/** Μία προσπάθεια readback· σε αποτυχία πετά τον renderer ώστε η επόμενη να πάρει νέο context. */
function attemptRender(def: PbrMaterialDef, set: LoadedTextureSet | null): string | null {
  const r = ensureRenderer();
  if (!r) return null;
  try {
    const url = r.toDataURL(def, set, THUMB_SIZE);
    if (isRenderedImage(url)) return url;
  } catch {
    // πέφτουμε στην ανάκτηση παρακάτω
  }
  recoverFromLostContext();
  return null;
}

/**
 * Πετά τον τρέχοντα offscreen renderer ώστε ο επόμενος να χτιστεί με ΦΡΕΣΚΟ GL context.
 * Το `unavailable` μένει `false` σκόπιμα: το χαμένο context είναι **παροδική** κατάσταση (ο
 * browser ανακύκλωσε contexts), σε αντίθεση με το «δεν υπάρχει WebGL» που το `ensureRenderer`
 * σημαδεύει μόνιμα. Χωρίς αυτό, μια στιγμιαία απώλεια πάγωνε τα swatches για όλη τη συνεδρία.
 */
function recoverFromLostContext(): void {
  if (!renderer) return;
  try {
    renderer.dispose();
  } catch {
    // ο renderer είναι ήδη νεκρός — το μόνο που έχει σημασία είναι να ξεχαστεί
  }
  renderer = null;
}

/** Test-only — dispose + reset the singleton between specs. */
export function __resetMaterialThumbnailSphereForTests(): void {
  renderer?.dispose();
  renderer = null;
  unavailable = false;
}
