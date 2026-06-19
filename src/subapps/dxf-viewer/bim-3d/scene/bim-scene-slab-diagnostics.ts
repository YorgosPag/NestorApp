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
  // (διαγνωστικά απενεργοποιημένα — δοκιμή πραγματικού fix depth-priority στο MaterialCatalog3D)
  void SLAB_TEST_MAT; void root;
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
  const nor = geo.getAttribute('normal') as THREE.BufferAttribute | undefined;
  const idx = geo.getIndex();
  const triCount = idx ? idx.count / 3 : pos.count / 3;
  const vidx = (t: number, k: number): number => (idx ? idx.getX(t * 3 + k) : t * 3 + k);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), fn = new THREE.Vector3();
  const mat0 = Array.isArray(body.material) ? body.material[0] : body.material;
  const lines: string[] = ['=== SLAB CURRENT GEOMETRY (local) ==='];
  lines.push(`triCount=${triCount} indexed=${idx ? 'Y' : 'N'} hasNormalAttr=${nor ? 'Y' : 'N'} groups=${geo.groups?.length ?? 0} matArray=${Array.isArray(body.material)} matType=${(mat0 as THREE.Material)?.type} flatShading=${(mat0 as THREE.MeshStandardMaterial)?.flatShading} hasNormalMap=${!!(mat0 as THREE.MeshStandardMaterial)?.normalMap}`);
  lines.push('--- TOP triangles: geometric faceN + STORED vertex normals ---');
  const sn = (i: number): string => nor ? `(${nor.getX(i).toFixed(3)},${nor.getY(i).toFixed(3)},${nor.getZ(i).toFixed(3)})` : '?';
  for (let t = 0; t < triCount; t++) {
    const i0 = vidx(t, 0), i1 = vidx(t, 1), i2 = vidx(t, 2);
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    ab.subVectors(b, a); ac.subVectors(c, a); fn.crossVectors(ab, ac).normalize();
    if (fn.y > 0.3) lines.push(`tri${t} faceN=(${fn.x.toFixed(3)},${fn.y.toFixed(3)},${fn.z.toFixed(3)}) storedN=[${sn(i0)}${sn(i1)}${sn(i2)}]`);
  }
  lines.push('--- CHILDREN of slab body ---');
  body.children.forEach((ch, i) => {
    const cm = ch as THREE.Mesh;
    const cmat = Array.isArray(cm.material) ? cm.material[0] : cm.material;
    lines.push(`child${i} type=${ch.type} bimType=${ch.userData['bimType']} isMesh=${!!cm.isMesh} matType=${(cmat as THREE.Material)?.type ?? '-'}`);
  });
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
    const mat = Array.isArray(m.material) ? m.material[0] : m.material;
    const off = (mat as THREE.Material)?.polygonOffset ? `off=${(mat as THREE.MeshStandardMaterial).polygonOffsetUnits}` : 'off=none';
    lines.push(
      `#${meshN} type=${m.userData['bimType']} matId=${m.userData['matId'] ?? '?'} finish=${m.userData['structuralFinish'] ?? false} ${inst} ${off}\n` +
      `   maxY=${box.max.y.toFixed(3)} center=(${ctr.x.toFixed(2)},${ctr.y.toFixed(2)},${ctr.z.toFixed(2)}) size=(${sz.x.toFixed(2)},${sz.y.toFixed(2)},${sz.z.toFixed(2)})`,
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
