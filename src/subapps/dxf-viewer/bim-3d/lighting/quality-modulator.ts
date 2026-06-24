import type * as THREE from 'three';
import { DXF_TIMING } from '../../config/dxf-timing';

const SHADOW_SOFT = { radius: 4, mapSize: 2048 } as const;
const SHADOW_MOVING = { radius: 0.5, mapSize: 1024 } as const;
const TRANSITION_MS = DXF_TIMING.animation.DEFAULT; // ADR-516

const IS_LOW_PERF = typeof navigator !== 'undefined' && navigator.hardwareConcurrency < 4;

export class QualityModulator {
  private readonly light: THREE.DirectionalLight;
  private animFrame: number | null = null;

  constructor(light: THREE.DirectionalLight) {
    this.light = light;
  }

  onCameraActive(): void {
    if (IS_LOW_PERF) return;
    this.cancelAnim();
    this.light.shadow.radius = SHADOW_MOVING.radius;
    this.light.shadow.mapSize.set(SHADOW_MOVING.mapSize, SHADOW_MOVING.mapSize);
    this.rebuildShadowMap();
  }

  onCameraIdle(): void {
    if (IS_LOW_PERF) return;
    if (this.animFrame !== null) return;
    const start = performance.now();
    const startRadius = this.light.shadow.radius;

    const animate = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(elapsed / TRANSITION_MS, 1);
      // cubic ease-out
      const eased = 1 - Math.pow(1 - t, 3);
      this.light.shadow.radius = startRadius + (SHADOW_SOFT.radius - startRadius) * eased;

      if (t < 1) {
        this.animFrame = requestAnimationFrame(animate);
      } else {
        this.animFrame = null;
        this.light.shadow.mapSize.set(SHADOW_SOFT.mapSize, SHADOW_SOFT.mapSize);
        this.rebuildShadowMap();
      }
    };

    this.animFrame = requestAnimationFrame(animate);
  }

  dispose(): void {
    this.cancelAnim();
  }

  private cancelAnim(): void {
    if (this.animFrame !== null) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
  }

  private rebuildShadowMap(): void {
    if (this.light.shadow.map) {
      this.light.shadow.map.dispose();
      // Force Three.js to rebuild the shadow map on next render
      (this.light.shadow as { map: THREE.WebGLRenderTarget | null }).map = null;
    }
  }
}
