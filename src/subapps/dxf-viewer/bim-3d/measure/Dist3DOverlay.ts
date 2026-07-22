'use client';

/**
 * ADR-680 (3D) — Dist3DOverlay: ο 3D resolver ζωγραφικής του εφήμερου «Μέτρημα Απόστασης».
 *
 * Ο 3D δίδυμος του 2D `DistMeasureOverlayLeaf` (SVG): αντί για SVG projection, ζωγραφίζει
 * ΠΡΑΓΜΑΤΙΚΗ 3D πολυγραμμή στη σκηνή (Revit/Cinema-4D measure), σχεδιασμένη **always-on-top**
 * (`depthTest:false` + high `renderOrder`) ώστε το μέτρημα να μη χάνεται πίσω από solids, με
 * screen-space labels σταθερού on-screen μεγέθους ανά τμήμα + τρέχον ΣΥΝΟΛΟ.
 *
 * SSoT: ΔΕΝ κρατά δικά του μήκη/κατάσταση — τα σημεία έρχονται από τον ΕΝΑΝ `dist-ephemeral-store`
 * (scene units) και τα μήκη/labels από τον ΕΝΑΝ `computeDistReadout`. Καθαρή Three.js, μηδέν React,
 * μηδέν store subscription (ο hook οδηγεί το `update()`), μηδέν εγγραφή entity/DB.
 *
 * Reuse: `createLabelTexture` (ένα text-rendering path σε όλα τα 3D overlays), `getPixelWorldSize`
 * (Revit annotation scaling), `dxfPlanToWorld` (ο SSoT plan-mm→world μετασχηματισμός).
 *
 * @module subapps/dxf-viewer/bim-3d/measure/Dist3DOverlay
 */

import * as THREE from 'three';
import { createLabelTexture } from '../dimensions/Dimension3DRenderer';
import { getPixelWorldSize, dxfPlanToWorld } from '../viewport/coordinate-transforms';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { computeDistReadout } from '../../systems/measure/dist-readout';
import type { DistPoint, DistSnapshot } from '../../systems/measure/dist-ephemeral-store';

/** Sky-blue = «βοηθητικό/εφήμερο» (parity με το 2D `CONSTRUCTION_LINE`). */
const INK = 0x38bdf8;
const LINE_RENDER_ORDER = 1998;
const POINT_RENDER_ORDER = 1999;
const LABEL_RENDER_ORDER = 2000;
/** On-screen ύψος (px) των labels, σταθερό στο zoom (Revit annotation). */
const SEG_TEXT_PX = 26;
const TOTAL_TEXT_PX = 34;
/** Label texture aspect (512×128 canvas → 4:1). */
const TEXT_ASPECT = 4;
const POINT_PX = 7;

/** Ένα label προς εμφάνιση: κείμενο + world θέση + on-screen ύψος. */
interface LabelSpec {
  readonly text: string;
  readonly world: THREE.Vector3;
  readonly px: number;
}

export class Dist3DOverlay {
  private readonly scene: THREE.Scene;
  private readonly group: THREE.Group;
  private readonly lineSegments: THREE.LineSegments;
  private readonly lineGeom: THREE.BufferGeometry;
  private readonly lineMat: THREE.LineBasicMaterial;
  private readonly points: THREE.Points;
  private readonly pointGeom: THREE.BufferGeometry;
  private readonly pointMat: THREE.PointsMaterial;
  private readonly sprites: THREE.Sprite[] = [];
  private readonly textureCache = new Map<string, THREE.CanvasTexture>();
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'dist-measure-3d';
    this.group.visible = false;

    this.lineGeom = new THREE.BufferGeometry();
    this.lineMat = new THREE.LineBasicMaterial({ color: INK, depthTest: false, depthWrite: false });
    this.lineSegments = new THREE.LineSegments(this.lineGeom, this.lineMat);
    this.lineSegments.renderOrder = LINE_RENDER_ORDER;
    this.lineSegments.frustumCulled = false;
    this.group.add(this.lineSegments);

    this.pointGeom = new THREE.BufferGeometry();
    this.pointMat = new THREE.PointsMaterial({
      color: INK, size: POINT_PX, sizeAttenuation: false, depthTest: false, depthWrite: false,
    });
    this.points = new THREE.Points(this.pointGeom, this.pointMat);
    this.points.renderOrder = POINT_RENDER_ORDER;
    this.points.frustumCulled = false;
    this.group.add(this.points);

    scene.add(this.group);
  }

  /**
   * Ξαναχτίζει το μέτρημα από το snapshot του store (scene units) + τον ζωντανό cursor (scene units,
   * το κινούμενο τελευταίο vertex). `camera`/`canvas` για το σταθερό on-screen μέγεθος των labels.
   */
  update(
    snapshot: DistSnapshot,
    liveCursor: DistPoint | null,
    units: SceneUnits,
    camera: THREE.Camera,
    canvas: HTMLElement,
  ): void {
    if (this.disposed) return;
    const paths = this.collectPaths(snapshot, liveCursor);
    if (paths.length === 0) {
      this.group.visible = false;
      return;
    }
    const factor = mmToSceneUnits(units) || 1;
    const segVerts: number[] = [];
    const nodeVerts: number[] = [];
    const labels: LabelSpec[] = [];
    for (const path of paths) {
      this.accumulatePath(path, factor, units, segVerts, nodeVerts, labels);
    }
    this.applyGeometry(segVerts, nodeVerts);
    this.applyLabels(labels, camera, canvas);
    this.group.visible = true;
  }

  hide(): void {
    if (!this.disposed) this.group.visible = false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.remove(this.group);
    this.lineGeom.dispose();
    this.lineMat.dispose();
    this.pointGeom.dispose();
    this.pointMat.dispose();
    for (const sprite of this.sprites) {
      sprite.material.map = null;
      sprite.material.dispose();
    }
    for (const tex of this.textureCache.values()) tex.dispose();
    this.textureCache.clear();
  }

  /** committed διαδρομές + η ενεργή (με τον live cursor ως κινούμενο τελευταίο vertex). */
  private collectPaths(snapshot: DistSnapshot, liveCursor: DistPoint | null): DistPoint[][] {
    const paths: DistPoint[][] = snapshot.committed.map((p) => [...p]);
    const active = liveCursor && snapshot.active.length > 0
      ? [...snapshot.active, liveCursor]
      : [...snapshot.active];
    if (active.length >= 2) paths.push(active);
    return paths;
  }

  /** Μετατροπή scene-unit σημείου → world (m). Αντίστροφο του `worldToDxfPlan`/store write. */
  private sceneToWorld(p: DistPoint, factor: number): THREE.Vector3 {
    return dxfPlanToWorld(p.x / factor, p.y / factor, (p.z ?? 0) / factor);
  }

  /** Γεμίζει segment/node vertices + labels (ανά-τμήμα μήκη + ΣΥΝΟΛΟ) για μία διαδρομή. */
  private accumulatePath(
    path: DistPoint[], factor: number, units: SceneUnits,
    segVerts: number[], nodeVerts: number[], labels: LabelSpec[],
  ): void {
    const worlds = path.map((p) => this.sceneToWorld(p, factor));
    for (const w of worlds) nodeVerts.push(w.x, w.y, w.z);
    for (let i = 1; i < worlds.length; i++) {
      const a = worlds[i - 1];
      const b = worlds[i];
      segVerts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    const readout = computeDistReadout(path, units);
    readout.segments.forEach((seg, i) => {
      const mid = worlds[i].clone().lerp(worlds[i + 1], 0.5);
      labels.push({ text: seg.label, world: mid, px: SEG_TEXT_PX });
    });
    if (readout.segments.length >= 2) {
      labels.push({ text: readout.totalLabel, world: worlds[worlds.length - 1].clone(), px: TOTAL_TEXT_PX });
    }
  }

  private applyGeometry(segVerts: number[], nodeVerts: number[]): void {
    this.lineGeom.setAttribute('position', new THREE.Float32BufferAttribute(segVerts, 3));
    this.lineGeom.computeBoundingSphere();
    this.pointGeom.setAttribute('position', new THREE.Float32BufferAttribute(nodeVerts, 3));
    this.pointGeom.computeBoundingSphere();
  }

  private applyLabels(labels: LabelSpec[], camera: THREE.Camera, canvas: HTMLElement): void {
    labels.forEach((spec, i) => {
      const sprite = this.acquireSprite(i);
      sprite.visible = true;
      sprite.position.copy(spec.world);
      sprite.material.map = this.getTexture(spec.text);
      sprite.material.needsUpdate = true;
      const dist = camera.position.distanceTo(spec.world);
      const worldH = getPixelWorldSize(dist, camera, canvas) * spec.px;
      if (worldH > 0) sprite.scale.set(worldH * TEXT_ASPECT, worldH, 1);
    });
    for (let i = labels.length; i < this.sprites.length; i++) this.sprites[i].visible = false;
  }

  private acquireSprite(i: number): THREE.Sprite {
    let sprite = this.sprites[i];
    if (!sprite) {
      const material = new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false });
      sprite = new THREE.Sprite(material);
      sprite.renderOrder = LABEL_RENDER_ORDER;
      this.group.add(sprite);
      this.sprites[i] = sprite;
    }
    return sprite;
  }

  /** Cache label textures ανά κείμενο — ΠΟΤΕ recreate texture per frame (ADR-680 perf). */
  private getTexture(text: string): THREE.CanvasTexture {
    let tex = this.textureCache.get(text);
    if (!tex) {
      tex = createLabelTexture(text);
      this.textureCache.set(text, tex);
    }
    return tex;
  }
}
