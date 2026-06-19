/**
 * 🚨 TEMP DIAGNOSTIC (slab two-tone) — ΑΦΑΙΡΕΣΕ ΟΛΟ ΤΟ ΑΡΧΕΙΟ μετά.
 *
 * Extracted from BimSceneLayer.ts (N.7.1 file-size split) — δύο διαγνωστικές
 * συναρτήσεις που δεν ανήκουν στη μόνιμη κλάση scene-layer:
 *  - `overrideSlabBodyMaterialTEMP` — override υλικού σώματος πλάκας + dump γεωμετρίας.
 *  - `dumpCoplanarAtSlabTopOnce` — full mesh inventory για coplanar/z-fight διάγνωση.
 *
 * Όταν λυθεί το two-tone artefact → διάγραψε αυτό το αρχείο + τις 2 κλήσεις στο BimSceneLayer.
 */
import * as THREE from 'three';

// Flat MeshStandard ΧΩΡΙΣ texture, roughness=1, metalness=0, envMapIntensity=0.
// Uniform ⇒ αιτία = texture/normalMap (realistic). Παραμένει ⇒ shading.
let __slabParamsDumped = false;
const SLAB_TEST_MAT = new THREE.MeshPhysicalMaterial({
  color: 0xb2a290, roughness: 1, metalness: 0, envMapIntensity: 0, specularIntensity: 0, side: THREE.DoubleSide,
});

export function overrideSlabBodyMaterialTEMP(root: THREE.Object3D, sp: unknown): void {
  // 🚨 Decisive z-fight test: όλα τα meshes της ομάδας πλάκας → ΕΝΑ κοινό lit υλικό.
  // Uniform ⇒ ήταν z-fight 2 διαφορετικών υλικών. Two-tone ⇒ intrinsic shading.
  root.traverse((o) => {
    const m = o as THREE.Mesh & { isLineSegments2?: boolean };
    if (m.isMesh && !m.isLineSegments2 && m.userData['bimType'] === 'slab') {
      m.material = SLAB_TEST_MAT;
      m.receiveShadow = false; // 🚨 test σκιάς (surviving file, αξιόπιστο)
      m.castShadow = false;
    }
  });
  if (__slabParamsDumped || typeof document === 'undefined') return;
  let body: THREE.Mesh | undefined;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!body && m.isMesh && !(m as THREE.InstancedMesh).isInstancedMesh
        && m.userData['bimType'] === 'slab' && m.geometry?.getAttribute) body = m;
  });
  if (!body?.geometry) return;
  __slabParamsDumped = true;
  const geo = body.geometry;
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const idx = geo.getIndex();
  const triCount = idx ? idx.count / 3 : pos.count / 3;
  const vidx = (t: number, k: number): number => (idx ? idx.getX(t * 3 + k) : t * 3 + k);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), fn = new THREE.Vector3();
  const lines: string[] = ['=== SLAB CURRENT GEOMETRY (local) ==='];
  lines.push(`bbox-from-geo: see inventory. triCount=${triCount} indexed=${idx ? 'Y' : 'N'}`);
  lines.push('--- TOP-facing triangles (faceN.y>0.3) ---');
  for (let t = 0; t < triCount; t++) {
    a.fromBufferAttribute(pos, vidx(t, 0)); b.fromBufferAttribute(pos, vidx(t, 1)); c.fromBufferAttribute(pos, vidx(t, 2));
    ab.subVectors(b, a); ac.subVectors(c, a); fn.crossVectors(ab, ac).normalize();
    if (fn.y > 0.3) {
      lines.push(`tri${t} faceN=(${fn.x.toFixed(3)},${fn.y.toFixed(3)},${fn.z.toFixed(3)}) cY=${((a.y + b.y + c.y) / 3).toFixed(3)} verts=[(${a.x.toFixed(2)},${a.y.toFixed(2)},${a.z.toFixed(2)})(${b.x.toFixed(2)},${b.y.toFixed(2)},${b.z.toFixed(2)})(${c.x.toFixed(2)},${c.y.toFixed(2)},${c.z.toFixed(2)})]`);
    }
  }
  lines.push(`slabParams: ${JSON.stringify(sp)}`);
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const el = document.createElement('a'); el.href = url; el.download = 'slab-current-geo.txt';
  document.body.appendChild(el); el.click(); el.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 🚨 TEMP DIAGNOSTIC (slab two-tone) — ολόκληρη η συνάρτηση ΑΦΑΙΡΕΣΕ μετά.
// Σκανάρει ΟΛΑ τα meshes· βρίσκει επιφάνειες/τρίγωνα με world-Y≈3.0 (slab top) πάνω από το footprint.
let __coplanarDumped = false;
export function dumpCoplanarAtSlabTopOnce(group: THREE.Object3D): void {
  if (__coplanarDumped || typeof document === 'undefined') return;
  __coplanarDumped = true;
  group.updateMatrixWorld(true);
  const lines: string[] = ['=== FULL MESH INVENTORY ==='];
  const box = new THREE.Box3(); const ctr = new THREE.Vector3(); const sz = new THREE.Vector3();
  let meshN = 0;
  group.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (!(m instanceof THREE.Mesh) || !m.geometry?.getAttribute) return;
    meshN++;
    box.setFromObject(m);
    box.getCenter(ctr); box.getSize(sz);
    const inst = (m as THREE.InstancedMesh).isInstancedMesh ? `INSTANCED(${(m as THREE.InstancedMesh).count})` : '';
    lines.push(
      `#${meshN} type=${m.userData['bimType']} id=${String(m.userData['bimId'] ?? '?').slice(0, 20)} matId=${m.userData['matId'] ?? '?'} ${inst}\n` +
      `   center=(${ctr.x.toFixed(2)},${ctr.y.toFixed(2)},${ctr.z.toFixed(2)}) size=(${sz.x.toFixed(2)},${sz.y.toFixed(2)},${sz.z.toFixed(2)}) visible=${m.visible} parentType=${m.parent?.userData?.['bimType'] ?? m.parent?.type}`,
    );
  });
  lines.push(`(σύνολο ${meshN} meshes)`);
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const el = document.createElement('a');
  el.href = url; el.download = 'coplanar-scan.txt';
  document.body.appendChild(el); el.click(); el.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
