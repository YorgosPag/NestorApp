import * as THREE from 'three';
import type { LightPreset } from './lighting-presets';

const ENV_WIDTH = 512;
const ENV_HEIGHT = 256;
const BLEND_ZONE = 0.2; // fraction of height for horizon blend

export class EnvmapGenerator {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly pmremGenerator: THREE.PMREMGenerator;
  private currentEnvmap: THREE.Texture | null = null;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.pmremGenerator = new THREE.PMREMGenerator(renderer);
    this.pmremGenerator.compileCubemapShader();
  }

  updateForPreset(preset: LightPreset): void {
    const skyColor = new THREE.Color(preset.skyColor);
    const groundColor = new THREE.Color(preset.groundColor);
    const data = new Uint8Array(ENV_WIDTH * ENV_HEIGHT * 4);
    const blendPx = Math.floor(BLEND_ZONE * ENV_HEIGHT);
    const horizonRow = Math.floor(ENV_HEIGHT / 2);

    for (let row = 0; row < ENV_HEIGHT; row++) {
      const distToHorizon = Math.abs(row - horizonRow);
      const blendT = Math.max(0, Math.min(1, (distToHorizon - blendPx * 0.5) / (blendPx * 0.5)));
      const isSky = row < horizonRow;
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

    const prev = this.currentEnvmap;
    this.currentEnvmap = pmremTexture.texture;
    this.scene.environment = this.currentEnvmap;
    this.scene.background = new THREE.Color(preset.skyColor);

    prev?.dispose();
  }

  dispose(): void {
    this.currentEnvmap?.dispose();
    this.currentEnvmap = null;
    this.pmremGenerator.dispose();
  }
}
