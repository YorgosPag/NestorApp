import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import type { LightPreset } from './lighting-presets';
import type { BackgroundMode } from '../../config/bim-visual-style';
import { resolveDxfCanvasBackgroundHex } from '../../config/color-config';
import { buildStudioBackgroundTexture } from './studio-background-texture';

const ENV_WIDTH = 512;
const ENV_HEIGHT = 256;
const BLEND_ZONE = 0.2;

export class EnvmapGenerator {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly pmremGenerator: THREE.PMREMGenerator;
  private currentEnvmap: THREE.Texture | null = null;
  private currentBackground: THREE.Texture | null = null;
  private hdriActive = false;
  /** ADR-446 §2 — visible-background mode. `scene.background` is resolved from this. */
  private backgroundMode: BackgroundMode = 'environment';
  /** ADR-446 §2.1 — cached studio gradient backdrop + the 2D base hex it was built for. */
  private studioBackground: THREE.DataTexture | null = null;
  private studioBackgroundBaseHex = '';

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.pmremGenerator = new THREE.PMREMGenerator(renderer);
    this.pmremGenerator.compileCubemapShader();
  }

  updateForPreset(preset: LightPreset): void {
    this.applyGradientFallback(preset);
  }

  /**
   * ADR-446 §2 — switch the VISIBLE background between the lighting environment and
   * a flat dark colour, WITHOUT touching `scene.environment` (so PBR faces keep
   * their IBL lighting/reflections in either mode). Sole writer of `scene.background`
   * alongside the section-stencil save/restore.
   */
  setBackgroundMode(mode: BackgroundMode): void {
    this.backgroundMode = mode;
    this.applyBackground();
  }

  /** Resolve `scene.background` from the current mode + last env-derived source. */
  private applyBackground(): void {
    if (this.backgroundMode === 'dark') {
      // FULL SSoT — the SAME `--canvas-background-dxf` token the 2D canvas uses (solid «σαν 2Δ»).
      this.scene.background = new THREE.Color(resolveDxfCanvasBackgroundHex());
      return;
    }
    // environment: the loaded HDRI backdrop if any, else the Cinema 4D-style studio gradient
    // built AROUND the SAME 2D-canvas base colour (ADR-446 §2.1) — screen-fixed, IBL untouched.
    this.scene.background = this.hdriActive && this.currentBackground
      ? this.currentBackground
      : this.ensureStudioBackground();
  }

  /** Lazy + theme-aware studio gradient backdrop (rebuilt when the 2D base colour changes). */
  private ensureStudioBackground(): THREE.Texture {
    const baseHex = resolveDxfCanvasBackgroundHex();
    if (!this.studioBackground || this.studioBackgroundBaseHex !== baseHex) {
      this.studioBackground?.dispose();
      this.studioBackground = buildStudioBackgroundTexture(baseHex);
      this.studioBackgroundBaseHex = baseHex;
    }
    return this.studioBackground;
  }

  applyGradientFallback(preset: LightPreset): void {
    if (this.hdriActive) return;
    const envMap = this.buildGradientEnvmap(preset);
    const prev = this.currentEnvmap;
    this.currentEnvmap = envMap;
    this.scene.environment = this.currentEnvmap;
    this.applyBackground();
    prev?.dispose();
  }

  async loadHdri(url: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const loader = new RGBELoader();
      loader.load(
        url,
        (hdrTexture) => {
          hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
          const pmremResult = this.pmremGenerator.fromEquirectangular(hdrTexture);

          const prevEnv = this.currentEnvmap;
          const prevBg = this.currentBackground;

          this.currentEnvmap = pmremResult.texture;
          this.currentBackground = hdrTexture;
          this.hdriActive = true;

          this.scene.environment = this.currentEnvmap;
          this.applyBackground();

          prevEnv?.dispose();
          prevBg?.dispose();
          resolve();
        },
        undefined,
        (error) => reject(error),
      );
    });
  }

  private buildGradientEnvmap(preset: LightPreset): THREE.Texture {
    const skyColor = new THREE.Color(preset.skyColor);
    const groundColor = new THREE.Color(preset.groundColor);
    const data = new Uint8Array(ENV_WIDTH * ENV_HEIGHT * 4);
    const blendPx = Math.floor(BLEND_ZONE * ENV_HEIGHT);
    const horizonRow = Math.floor(ENV_HEIGHT / 2);

    for (let row = 0; row < ENV_HEIGHT; row++) {
      const distToHorizon = Math.abs(row - horizonRow);
      const blendT = Math.max(0, Math.min(1, (distToHorizon - blendPx * 0.5) / (blendPx * 0.5)));
      // `DataTexture` έχει `flipY=false` + `EquirectangularReflectionMapping`: η κατεύθυνση
      // +Y (ζενίθ) αντιστοιχεί στο v≈1 → στις ΤΕΛΕΥΤΑΙΕΣ γραμμές (row→ENV_HEIGHT). Άρα το
      // πάνω ημισφαίριο = `row >= horizonRow`. (Πριν ήταν `row < horizonRow` → ανεστραμμένο:
      // ο ουρανός έμπαινε κάτω και το μπεζ έδαφος πάνω → ΟΛΕΣ οι οριζόντιες top επιφάνειες
      // φωτίζονταν μπεζ από το IBL όταν τις έβλεπες από πάνω. Giorgio fix 2026-06-19.)
      const isSky = row >= horizonRow;
      const base = isSky ? skyColor : groundColor;
      const other = isSky ? groundColor : skyColor;
      const r = base.r + (other.r - base.r) * (1 - blendT);
      const g = base.g + (other.g - base.g) * (1 - blendT);
      const b = base.b + (other.b - base.b) * (1 - blendT);

      for (let col = 0; col < ENV_WIDTH; col++) {
        const i = (row * ENV_WIDTH + col) * 4;
        data[i]     = Math.round(r * 255);
        data[i + 1] = Math.round(g * 255);
        data[i + 2] = Math.round(b * 255);
        data[i + 3] = 255;
      }
    }

    const dataTexture = new THREE.DataTexture(data, ENV_WIDTH, ENV_HEIGHT, THREE.RGBAFormat);
    dataTexture.mapping = THREE.EquirectangularReflectionMapping;
    dataTexture.needsUpdate = true;

    const pmremTexture = this.pmremGenerator.fromEquirectangular(dataTexture);
    dataTexture.dispose();
    return pmremTexture.texture;
  }

  dispose(): void {
    this.currentEnvmap?.dispose();
    this.currentEnvmap = null;
    this.currentBackground?.dispose();
    this.currentBackground = null;
    this.studioBackground?.dispose();
    this.studioBackground = null;
    this.pmremGenerator.dispose();
  }
}
