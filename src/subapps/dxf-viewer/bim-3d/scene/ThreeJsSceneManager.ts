/**
 * ThreeJsSceneManager — Three.js lifecycle management for BIM 3D viewport.
 *
 * Phase 0: placeholder scene (wireframe cube + axes + ambient light).
 * Phase 2+: BIM entity rendering replaces placeholder.
 *
 * Pure class — no React imports. Owned exclusively by BimViewport3D.
 * Caller is responsible for dispose() on component unmount.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ── Scene Manager ─────────────────────────────────────────────────────────────

export class ThreeJsSceneManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;

  private rafHandle: number | null = null;
  private disposed = false;

  constructor(canvas: HTMLElement) {
    this.renderer = this.initRenderer(canvas);
    this.camera = this.initCamera(canvas);
    this.scene = this.initScene();
    this.controls = this.initControls(canvas);
    this.startLoop();
  }

  // ── Init helpers (each ≤40 LOC) ───────────────────────────────────────────

  private initRenderer(canvas: HTMLElement): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth || 800, canvas.clientHeight || 600);
    renderer.setClearColor(0x1a1a1a, 1);
    canvas.appendChild(renderer.domElement);
    return renderer;
  }

  private initCamera(canvas: HTMLElement): THREE.PerspectiveCamera {
    const aspect = (canvas.clientWidth || 800) / (canvas.clientHeight || 600);
    const cam = new THREE.PerspectiveCamera(45, aspect, 0.01, 1000);
    cam.position.set(5, 5, 5);
    cam.lookAt(0, 0, 0);
    return cam;
  }

  private initScene(): THREE.Scene {
    const scene = new THREE.Scene();

    // Placeholder: wireframe cube (1m × 1m × 1m)
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      wireframe: true,
    });
    scene.add(new THREE.Mesh(geo, mat));

    // Axes helper (2m)
    scene.add(new THREE.AxesHelper(2));

    // Ambient + directional lights (for Phase 2+ solid geometry)
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 10, 5);
    scene.add(dir);

    return scene;
  }

  private initControls(canvas: HTMLElement): OrbitControls {
    const controls = new OrbitControls(this.camera, this.renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0, 0);
    controls.update();
    return controls;
  }

  private startLoop(): void {
    const animate = () => {
      if (this.disposed) return;
      this.rafHandle = requestAnimationFrame(animate);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    this.rafHandle = requestAnimationFrame(animate);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  resize(width: number, height: number): void {
    if (this.disposed || width === 0 || height === 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }

    this.controls.dispose();
    this.renderer.dispose();

    // Remove canvas from DOM
    const domElement = this.renderer.domElement;
    if (domElement.parentNode) {
      domElement.parentNode.removeChild(domElement);
    }
  }
}
