/**
 * ADR-402 — Bim3DEditLivePreview: live "entity follows the cursor" preview.
 *
 * Pure THREE, no mocks. Covers the rigid move/rotate transform (the common
 * move/vertical/rotate path) and the resize swap (hide originals + parent the
 * rebuilt object), plus the commit (drop refs, leave the scene for the re-sync)
 * vs reset (restore everything) lifecycle branches.
 */

import * as THREE from 'three';
import { Bim3DEditLivePreview } from '../bim3d-edit-live-preview';

function taggedMesh(bimId: string, pos: [number, number, number]): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  m.userData['bimId'] = bimId;
  m.position.set(...pos);
  return m;
}

function group(...children: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  for (const c of children) g.add(c);
  return g;
}

describe('Bim3DEditLivePreview — rigid move/rotate', () => {
  it('captureTransform picks only the edited direct children (by bimId)', () => {
    const a = taggedMesh('a', [0, 0, 0]);
    const b = taggedMesh('b', [0, 0, 0]);
    const p = new Bim3DEditLivePreview();
    expect(p.isActive).toBe(false);
    p.captureTransform(group(a, b), new Set(['a']));
    expect(p.isActive).toBe(true);
  });

  it('applyMove offsets the captured mesh from its ORIGINAL pose (not cumulative)', () => {
    const a = taggedMesh('a', [1, 2, 3]);
    const p = new Bim3DEditLivePreview();
    p.captureTransform(group(a), new Set(['a']));
    p.applyMove(new THREE.Vector3(10, 0, 0));
    expect(a.position.toArray()).toEqual([11, 2, 3]);
    // A second frame re-bases from the original — not 21.
    p.applyMove(new THREE.Vector3(5, 0, 0));
    expect(a.position.toArray()).toEqual([6, 2, 3]);
  });

  it('only the edited mesh moves; siblings stay put', () => {
    const a = taggedMesh('a', [0, 0, 0]);
    const b = taggedMesh('b', [4, 0, 0]);
    const p = new Bim3DEditLivePreview();
    p.captureTransform(group(a, b), new Set(['a']));
    p.applyMove(new THREE.Vector3(10, 0, 0));
    expect(a.position.x).toBe(10);
    expect(b.position.x).toBe(4);
  });

  it('applyRotate orbits the mesh about world +Y through the pivot and rotates it', () => {
    const a = taggedMesh('a', [4, 0, 0]); // +2 from pivot (2,0,0) along X
    const p = new Bim3DEditLivePreview();
    p.captureTransform(group(a), new Set(['a']));
    p.applyRotate(new THREE.Vector3(2, 0, 0), Math.PI / 2); // +90° about +Y
    // (2,0,0) local offset rotated +90° about +Y → (0,0,-2): world (2,0,-2).
    expect(a.position.x).toBeCloseTo(2, 6);
    expect(a.position.y).toBeCloseTo(0, 6);
    expect(a.position.z).toBeCloseTo(-2, 6);
    // Orientation followed: +X local axis now points to -Z.
    const dir = new THREE.Vector3(1, 0, 0).applyQuaternion(a.quaternion);
    expect(dir.x).toBeCloseTo(0, 6);
    expect(dir.z).toBeCloseTo(-1, 6);
  });

  it('reset() restores the captured pose; commit() leaves it in place', () => {
    const a = taggedMesh('a', [1, 2, 3]);
    const p = new Bim3DEditLivePreview();

    p.captureTransform(group(a), new Set(['a']));
    p.applyMove(new THREE.Vector3(10, 0, 0));
    p.reset();
    expect(a.position.toArray()).toEqual([1, 2, 3]); // snapped back
    expect(p.isActive).toBe(false);

    p.captureTransform(group(a), new Set(['a']));
    p.applyMove(new THREE.Vector3(10, 0, 0));
    p.commit();
    expect(a.position.toArray()).toEqual([11, 2, 3]); // left at the final pose
    expect(p.isActive).toBe(false);
  });
});

describe('Bim3DEditLivePreview — resize swap', () => {
  it('applyResize hides the originals and parents the rebuilt object', () => {
    const orig = taggedMesh('w1', [0, 0, 0]);
    const g = group(orig);
    const rebuilt = taggedMesh('w1', [0, 0, 0]);
    const p = new Bim3DEditLivePreview();

    p.captureResize(g, 'w1');
    p.applyResize(rebuilt);
    expect(orig.visible).toBe(false);
    expect(g.children).toContain(rebuilt);
  });

  it('a null rebuild frame (no-op resize) leaves the originals untouched', () => {
    const orig = taggedMesh('w1', [0, 0, 0]);
    const g = group(orig);
    const p = new Bim3DEditLivePreview();
    p.captureResize(g, 'w1');
    p.applyResize(null);
    expect(orig.visible).toBe(true);
    expect(g.children).toEqual([orig]);
  });

  it('reset() un-hides the originals and removes the preview object', () => {
    const orig = taggedMesh('w1', [0, 0, 0]);
    const g = group(orig);
    const rebuilt = taggedMesh('w1', [0, 0, 0]);
    const p = new Bim3DEditLivePreview();

    p.captureResize(g, 'w1');
    p.applyResize(rebuilt);
    p.reset();
    expect(orig.visible).toBe(true);
    expect(g.children).toEqual([orig]); // preview removed
    expect(p.isActive).toBe(false);
  });

  it('commit() keeps the swapped object (the re-sync will replace the group)', () => {
    const orig = taggedMesh('w1', [0, 0, 0]);
    const g = group(orig);
    const rebuilt = taggedMesh('w1', [0, 0, 0]);
    const p = new Bim3DEditLivePreview();

    p.captureResize(g, 'w1');
    p.applyResize(rebuilt);
    p.commit();
    expect(g.children).toContain(rebuilt);
    expect(orig.visible).toBe(false); // group is about to be rebuilt by the command re-sync
    expect(p.isActive).toBe(false);
  });
});

describe('Bim3DEditLivePreview — ADR-401 attached-dependent re-clip on host move', () => {
  it('captures the dragged host (rigid) AND its dependent walls (hidden + ids) together', () => {
    const host = taggedMesh('beam1', [0, 0, 0]); // dragged host (rigid move)
    const wall = taggedMesh('wall1', [5, 0, 0]); // attached dependent (re-clipped)
    const g = group(host, wall);
    const p = new Bim3DEditLivePreview();

    p.captureTransform(g, new Set(['beam1']));
    p.captureDependents(g, ['wall1'], new Set(['beam1']));

    expect(p.isActive).toBe(true);
    expect(p.dependentWallIds).toEqual(['wall1']);
    expect(p.movedHostIds.has('beam1')).toBe(true);

    // The host still moves rigidly; the dependent is left to per-frame rebuild.
    p.applyMove(new THREE.Vector3(10, 0, 0));
    expect(host.position.x).toBe(10);
    expect(wall.position.x).toBe(5);
  });

  it('applyDependents hides the originals and parents the rebuilt meshes', () => {
    const wall = taggedMesh('wall1', [0, 0, 0]);
    const g = group(wall);
    const rebuilt = taggedMesh('wall1', [0, 0, 0]);
    const p = new Bim3DEditLivePreview();

    p.captureDependents(g, ['wall1'], new Set(['beam1']));
    p.applyDependents([rebuilt]);
    expect(wall.visible).toBe(false);
    expect(g.children).toContain(rebuilt);
  });

  it('a new frame removes the previous frame dependents and skips null rebuilds', () => {
    const wall = taggedMesh('wall1', [0, 0, 0]);
    const g = group(wall);
    const frame1 = taggedMesh('wall1', [0, 0, 0]);
    const frame2 = taggedMesh('wall1', [0, 0, 0]);
    const p = new Bim3DEditLivePreview();

    p.captureDependents(g, ['wall1'], new Set(['beam1']));
    p.applyDependents([frame1]);
    p.applyDependents([frame2, null]); // null entry is skipped, frame1 replaced
    expect(g.children).toContain(frame2);
    expect(g.children).not.toContain(frame1);
  });

  it('reset() un-hides the dependents and removes the swapped meshes', () => {
    const host = taggedMesh('beam1', [1, 0, 0]);
    const wall = taggedMesh('wall1', [0, 0, 0]);
    const g = group(host, wall);
    const rebuilt = taggedMesh('wall1', [0, 0, 0]);
    const p = new Bim3DEditLivePreview();

    p.captureTransform(g, new Set(['beam1']));
    p.captureDependents(g, ['wall1'], new Set(['beam1']));
    p.applyMove(new THREE.Vector3(10, 0, 0));
    p.applyDependents([rebuilt]);
    p.reset();

    expect(host.position.x).toBe(1); // host snapped back
    expect(wall.visible).toBe(true); // dependent original restored
    expect(g.children).not.toContain(rebuilt); // preview removed
    expect(p.isActive).toBe(false);
  });

  it('commit() keeps the dependent preview (the command re-sync replaces it)', () => {
    const wall = taggedMesh('wall1', [0, 0, 0]);
    const g = group(wall);
    const rebuilt = taggedMesh('wall1', [0, 0, 0]);
    const p = new Bim3DEditLivePreview();

    p.captureDependents(g, ['wall1'], new Set(['beam1']));
    p.applyDependents([rebuilt]);
    p.commit();
    expect(g.children).toContain(rebuilt);
    expect(wall.visible).toBe(false);
    expect(p.isActive).toBe(false);
  });
});
