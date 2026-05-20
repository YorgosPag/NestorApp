declare module 'three-gpu-pathtracer' {
  import type { WebGLRenderer, Scene, PerspectiveCamera } from 'three';

  export class WebGLPathTracer {
    samples: number;
    renderScale: number;
    minSamples: number;
    renderDelay: number;
    fadeDuration: number;
    enablePathTracing: boolean;
    pausePathTracing: boolean;
    rasterizeScene: boolean;
    renderToCanvas: boolean;

    constructor(renderer: WebGLRenderer);
    setScene(scene: Scene, camera: PerspectiveCamera): void;
    setCamera(camera: PerspectiveCamera): void;
    renderSample(): void;
    reset(): void;
    dispose(): void;
  }
}
