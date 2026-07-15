/**
 * finite-bounds — NaN-safe `Box3` SSoT (ADR-537).
 *
 * `THREE.Box3.setFromObject` + `.isEmpty()` is the pattern every 3D bounds site used inline
 * (DXF overlay, section union, scene framing, selection). It is NaN-BLIND: `Box3.isEmpty()` is
 * `max < min`, which is `false` when either side is NaN, so a SINGLE corrupt vertex (a DXF entity
 * with a non-finite coordinate, a BIM mesh built from a NaN param) yields a box that reports
 * "not empty" yet carries NaN bounds. Fed into the SHARED camera frame (`viewport.frameBounds`)
 * or the section box, that NaN blanks the ENTIRE viewport — both the DXF underlay AND the lit BIM.
 *
 * Routing every bounds-from-object computation through {@link finiteBox3FromObject} guarantees a
 * NaN box can never propagate: callers get `null` (their existing "no usable bounds → no-op"
 * branch) instead of a poisoned box. This is the defense layer; the source guards
 * (`DxfToThreeConverter` segment/text filters) still keep the geometry itself NaN-free.
 */

import * as THREE from 'three';

/** localStorage flag (mirrors `dxf-no-shadows`) that arms the dev NaN-geometry locator. */
const NAN_LOCATE_FLAG = 'dxf-nan-locate';

/**
 * True when every component of the given min & max corner is finite (no NaN / Infinity).
 * SSoT for the ADR-537 "never tween the camera toward a non-finite target" guard — shared by
 * `isFiniteBox3` and every `frameBounds`/`frameHome`-style camera framing entry point so the
 * check can never drift between call sites.
 */
export function areFiniteBounds(min: THREE.Vector3, max: THREE.Vector3): boolean {
  return Number.isFinite(min.x) && Number.isFinite(min.y) && Number.isFinite(min.z)
    && Number.isFinite(max.x) && Number.isFinite(max.y) && Number.isFinite(max.z);
}

/** True when every component of the box's min & max is finite (no NaN / Infinity). */
export function isFiniteBox3(box: THREE.Box3): boolean {
  return areFiniteBounds(box.min, box.max);
}

/**
 * `new Box3().setFromObject(obj)`, but NaN-SAFE: returns `null` when the object has no geometry
 * (empty box) OR any computed bound is non-finite. Every 3D bounds-from-object site uses this so a
 * NaN-poisoned box can never reach the shared camera / section subsystem. When a non-finite box is
 * detected AND the `dxf-nan-locate` dev flag is armed, {@link locateNonFiniteGeometry} pinpoints the
 * offending entity (the real data bug behind the THREE `computeBoundingBox NaN` console warning).
 */
export function finiteBox3FromObject(obj: THREE.Object3D): THREE.Box3 | null {
  const box = new THREE.Box3().setFromObject(obj);
  if (box.isEmpty()) return null;
  if (!isFiniteBox3(box)) {
    locateNonFiniteGeometry(obj);
    return null;
  }
  return box;
}

/** Nearest ancestor identity (bimId / bimType) — the NaN vertex often lives on a child sub-mesh. */
function resolveBimIdentity(o: THREE.Object3D): { bimId?: unknown; bimType?: unknown } {
  let cur: THREE.Object3D | null = o;
  while (cur) {
    const ud = cur.userData;
    if (ud && (ud['bimId'] !== undefined || ud['bimType'] !== undefined)) {
      return { bimId: ud['bimId'], bimType: ud['bimType'] };
    }
    cur = cur.parent;
  }
  return {};
}

/**
 * ADR-537 dev diagnostic — pinpoint WHICH descendant geometry carries a NaN vertex (the real data
 * bug behind the `THREE.BufferGeometry.computeBoundingBox(): … NaN` console warning). Gated behind
 * `localStorage['dxf-nan-locate'] === '1'` (mirrors the `dxf-no-shadows` diag flag) so it never runs
 * in normal use. Enable it in the browser console:
 *
 *   localStorage.setItem('dxf-nan-locate', '1')   // then toggle 2D↔3D to re-sync
 *
 * Logs the offending mesh's `bimId` / `bimType` + the first non-finite vertex, so the fix can go to
 * the exact converter at source. No-op on the server and when the flag is off.
 */
export function locateNonFiniteGeometry(obj: THREE.Object3D): void {
  if (typeof window === 'undefined' || window.localStorage.getItem(NAN_LOCATE_FLAG) !== '1') return;
  const v = new THREE.Vector3();
  obj.traverse((child) => {
    const geo = (child as Partial<THREE.Mesh>).geometry as THREE.BufferGeometry | undefined;
    const pos = geo?.getAttribute?.('position') as THREE.BufferAttribute | undefined;
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)) continue;
      const { bimId, bimType } = resolveBimIdentity(child);
      // eslint-disable-next-line no-console
      console.warn(
        `[dxf-nan-locate] non-finite vertex #${i} — bimType=${String(bimType)} bimId=${String(bimId)} mesh="${child.name || '(unnamed)'}"`,
        { vertex: { x: v.x, y: v.y, z: v.z }, object: child },
      );
      return; // one report per mesh is enough — move on to the next child
    }
  });
}
