/**
 * mesh3d-collada-geometry — ADR-668/678 Φ3.1. Ένα `<geometry>` + το `<node>` του ανά mesh για
 * τον COLLADA 1.4.1 writer.
 *
 * **Per-face = πολλά `<triangles material="sym_i">`** (ένα ανά `geometry.group`, στη σειρά των
 * groups = σειρά όψεων του `buildFacedIndex`: bottom, top, side:i, hole:h:k), με το binding
 * `symbol → material` να ζει στο `<bind_material>` του instance. Αυτό διαβάζει το Cinema 4D R15
 * με **χρώμα ανά όψη** — ό,τι ο OBJ writer κάνει με `usemtl`, εδώ σε δομή XML.
 *
 * **TEXCOORD + `<bind_vertex_input>` (ground-truth native C4D .dae):** ο αυστηρός importer του R15
 * (FBX-SDK based) τιμά την ανάθεση υλικού↔όψης ΜΟΝΟ όταν το `<instance_material>` κουβαλά
 * `<bind_vertex_input>` που δείχνει σε υπαρκτό UV set — αλλιώς φορτώνει τα υλικά στο ντουλάπι με
 * σωστά χρώματα αλλά αφήνει τη γεωμετρία **γκρι** (αποδεδειγμένο: ακόμα και single-material κύβος).
 * Το native `red-green-cube.dae` του C4D R15.037 γράφει: `<source>` UV (S/T) + `<input
 * semantic="TEXCOORD" set="0">` σε κάθε `<triangles>` + `<bind_vertex_input semantic="UVSET0"
 * input_semantic="TEXCOORD" input_set="0"/>`. Το αντιγράφουμε ακριβώς. Επειδή τα υλικά μας είναι
 * flat χρώμα (χωρίς texture), η **τιμή** του UV είναι αδιάφορη → ένα μοναδικό `(0,0)` που το
 * δείχνουν όλες οι κορυφές (μηδέν κόστος, μηδέν παραμόρφωση γεωμετρίας).
 *
 * **World-space κορυφές/normals** (όπως ο OBJ writer): ο caller έχει ψήσει τα world matrices
 * (`applyExportUnit → updateMatrixWorld(true)`), οπότε τα nodes μένουν **χωρίς** transform
 * (identity) — καμία διπλή κλίμακα.
 *
 * @see ./mesh3d-collada-writer — ο orchestrator που συναρμολογεί το έγγραφο
 * @see ./mesh3d-obj-writer — το ίδιο group model σε επίπεδο Wavefront format
 * @see docs/centralized-systems/reference/adrs/ADR-668-mesh3d-export-obj-gltf.md
 */

import * as THREE from 'three';
import { escapeXml } from '@/lib/xml/escape-xml';

/** Το `geometry` και το αντίστοιχο `node` (με bind_material) ενός mesh. */
export interface ColladaMeshBlocks {
  readonly geometry: string;
  readonly node: string;
}

/** Ένα εύρος τριγώνων που μοιράζονται υλικό — single-material ⇒ ένα group για όλο το mesh. */
interface TriangleGroup {
  readonly materialIndex: number;
  readonly triStart: number;
  readonly triEnd: number;
}

/** Πλήθος τριγώνων: index length / 3 (indexed) ή position count / 3 (non-indexed). */
function triangleCount(geometry: THREE.BufferGeometry): number {
  const index = geometry.getIndex();
  if (index !== null) return Math.floor(index.count / 3);
  const positions = geometry.getAttribute('position');
  return positions !== undefined ? Math.floor(positions.count / 3) : 0;
}

/** World-space θέσεις ως επίπεδο `[x,y,z, …]` (matrixWorld ψημένο, όπως ο OBJ writer). */
function worldPositions(geometry: THREE.BufferGeometry, matrixWorld: THREE.Matrix4): number[] {
  const positions = geometry.getAttribute('position');
  if (positions === undefined) return [];
  const out: number[] = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < positions.count; i += 1) {
    v.fromBufferAttribute(positions, i).applyMatrix4(matrixWorld);
    out.push(v.x, v.y, v.z);
  }
  return out;
}

/** World-space normals (normal matrix), ή null όταν η γεωμετρία δεν έχει normals. */
function worldNormals(geometry: THREE.BufferGeometry, matrixWorld: THREE.Matrix4): number[] | null {
  const normals = geometry.getAttribute('normal');
  if (normals === undefined) return null;
  const out: number[] = [];
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrixWorld);
  const n = new THREE.Vector3();
  for (let i = 0; i < normals.count; i += 1) {
    n.fromBufferAttribute(normals, i).applyMatrix3(normalMatrix).normalize();
    out.push(n.x, n.y, n.z);
  }
  return out;
}

/** Επίπεδα UV `[u,v, …]` από το `uv` attribute (ADR-679 Φ1), ή null όταν λείπει. Χωρίς transform. */
function uvArray(geometry: THREE.BufferGeometry): number[] | null {
  const uv = geometry.getAttribute('uv');
  if (uv === undefined) return null;
  const out: number[] = [];
  for (let i = 0; i < uv.count; i += 1) out.push(uv.getX(i), uv.getY(i));
  return out;
}

/** Multi-material (per-face) ⇒ ένα group ανά `geometry.group`· αλλιώς ένα group για όλο το mesh. */
function triangleGroups(mesh: THREE.Mesh): TriangleGroup[] {
  const geometry = mesh.geometry;
  if (Array.isArray(mesh.material) && geometry.groups.length > 0) {
    return geometry.groups.map((g) => ({
      materialIndex: g.materialIndex,
      triStart: g.start / 3,
      triEnd: (g.start + g.count) / 3,
    }));
  }
  return [{ materialIndex: 0, triStart: 0, triEnd: triangleCount(geometry) }];
}

/** Το όνομα υλικού μιας όψης (array = per-face· αλλιώς το ένα υλικό), ή undefined αν ανώνυμο. */
function groupMaterialName(mesh: THREE.Mesh, materialIndex: number): string | undefined {
  const material = mesh.material;
  const face = Array.isArray(material) ? material[materialIndex] : material;
  const name = face?.name;
  return typeof name === 'string' && name.length > 0 ? name : undefined;
}

/** `source` για float attribute (θέσεις/normals): `float_array` + accessor με τα params. */
function floatSource(sourceId: string, data: readonly number[], params: readonly string[]): string {
  const arrId = `${sourceId}_arr`;
  const stride = params.length;
  const paramXml = params.map((p) => `<param name="${p}" type="float"/>`).join('');
  return (
    `<source id="${sourceId}"><float_array id="${arrId}" count="${data.length}">${data.join(' ')}</float_array>` +
    `<technique_common><accessor source="#${arrId}" count="${data.length / stride}" stride="${stride}">` +
    `${paramXml}</accessor></technique_common></source>`
  );
}

/**
 * Οι δείκτες ενός `<p>`: ανά κορυφή τριγώνου ο ordinal VERTEX (offset 0), μετά NORMAL (offset 1,
 * αν υπάρχει normals — μοιράζεται buffer θέση), μετά TEXCOORD (τελευταίο offset) που δείχνει πάντα
 * στο μοναδικό UV `(0,0)` ⇒ ordinal `0`. Το TEXCOORD ζευγάρι απαιτείται από το `<bind_vertex_input>`
 * που ο R15 χρειάζεται για να τιμήσει την ανάθεση υλικού (βλ. header).
 */
function pIndices(
  geometry: THREE.BufferGeometry,
  triStart: number,
  triEnd: number,
  hasNormal: boolean,
  hasUv: boolean,
): string {
  const index = geometry.getIndex();
  const out: string[] = [];
  for (let t = triStart; t < triEnd; t += 1) {
    for (let m = 0; m < 3; m += 1) {
      const local = index !== null ? index.getX(t * 3 + m) : t * 3 + m;
      // TEXCOORD ordinal = ο ίδιος index (uv attribute παράλληλο με position) όταν έχουμε
      // πραγματικά UVs· αλλιώς `0` → το μοναδικό placeholder `(0,0)`.
      const uvOrd = hasUv ? `${local}` : '0';
      out.push(hasNormal ? `${local} ${local} ${uvOrd}` : `${local} ${uvOrd}`);
    }
  }
  return out.join(' ');
}

/** Ένα `triangles` για ένα group: inputs (VERTEX [+NORMAL] +TEXCOORD) + `p` δείκτες. */
function trianglesElement(
  geometry: THREE.BufferGeometry,
  ids: { verticesId: string; normalSourceId: string; uvSourceId: string },
  group: TriangleGroup,
  symbol: string,
  flags: { hasNormal: boolean; hasUv: boolean },
): string {
  const { hasNormal, hasUv } = flags;
  const texcoordOffset = hasNormal ? 2 : 1;
  const inputs =
    `<input semantic="VERTEX" source="#${ids.verticesId}" offset="0"/>` +
    (hasNormal ? `<input semantic="NORMAL" source="#${ids.normalSourceId}" offset="1"/>` : '') +
    `<input semantic="TEXCOORD" source="#${ids.uvSourceId}" offset="${texcoordOffset}" set="0"/>`;
  return (
    `<triangles material="${symbol}" count="${group.triEnd - group.triStart}">${inputs}` +
    `<p>${pIndices(geometry, group.triStart, group.triEnd, hasNormal, hasUv)}</p></triangles>`
  );
}

/** Τα `triangles` + τα `instance_material` bindings ενός mesh (ένα ζεύγος ανά group). */
function buildGroupsXml(
  mesh: THREE.Mesh,
  ids: { verticesId: string; normalSourceId: string; uvSourceId: string },
  flags: { hasNormal: boolean; hasUv: boolean },
  materialIdByName: ReadonlyMap<string, string>,
): { triangles: string[]; bindings: string[] } {
  const triangles: string[] = [];
  const bindings: string[] = [];
  triangleGroups(mesh).forEach((group, gi) => {
    const symbol = `sym_${gi}`;
    triangles.push(trianglesElement(mesh.geometry, ids, group, symbol, flags));
    const matName = groupMaterialName(mesh, group.materialIndex);
    const matId = matName !== undefined ? materialIdByName.get(matName) : undefined;
    // `bind_vertex_input` → UVSET0/TEXCOORD/set 0: το native C4D R15 το γράφει σε ΚΑΘΕ
    // instance_material· χωρίς αυτό ο importer αφήνει την όψη γκρι (ground-truth).
    if (matId !== undefined) {
      bindings.push(
        `<instance_material symbol="${symbol}" target="#${matId}">` +
          `<bind_vertex_input semantic="UVSET0" input_semantic="TEXCOORD" input_set="0"/>` +
          `</instance_material>`,
      );
    }
  });
  return { triangles, bindings };
}

/**
 * Ένα mesh → `<geometry>` + `<node>`. Επιστρέφει null για mesh χωρίς θέσεις (τίποτα να γραφτεί).
 * Τα ids είναι index-based (`geom_k`/`node_k`) — μηδέν κίνδυνος άκυρου xs:ID από ονόματα· το
 * αναγνώσιμο όνομα μπαίνει (escaped) στο `name=`.
 */
export function buildColladaMeshBlocks(
  mesh: THREE.Mesh,
  index: number,
  materialIdByName: ReadonlyMap<string, string>,
): ColladaMeshBlocks | null {
  const geometry = mesh.geometry;
  const positions = worldPositions(geometry, mesh.matrixWorld);
  if (positions.length === 0) return null;
  const normals = worldNormals(geometry, mesh.matrixWorld);
  const hasNormal = normals !== null;
  const uvs = uvArray(geometry);
  const hasUv = uvs !== null;

  const geomId = `geom_${index}`;
  const ids = {
    verticesId: `${geomId}_verts`,
    normalSourceId: `${geomId}_nrm`,
    uvSourceId: `${geomId}_uv`,
  };

  const sources = [floatSource(`${geomId}_pos`, positions, ['X', 'Y', 'Z'])];
  if (normals !== null) sources.push(floatSource(ids.normalSourceId, normals, ['X', 'Y', 'Z']));
  // TEXCOORD source: πραγματικά UVs (ADR-679 Φ1, για textures) όταν υπάρχουν· αλλιώς μοναδικό
  // placeholder `(0,0)` — σε κάθε περίπτωση υπαρκτό set ώστε το `<bind_vertex_input>` (που ο R15
  // απαιτεί για την ανάθεση υλικού) να έχει στόχο.
  sources.push(floatSource(ids.uvSourceId, uvs ?? [0, 0], ['S', 'T']));

  const { triangles, bindings } = buildGroupsXml(mesh, ids, { hasNormal, hasUv }, materialIdByName);
  const safeName = escapeXml(mesh.name);

  const geometryXml =
    `<geometry id="${geomId}" name="${safeName}"><mesh>${sources.join('')}` +
    `<vertices id="${ids.verticesId}"><input semantic="POSITION" source="#${geomId}_pos"/></vertices>` +
    `${triangles.join('')}</mesh></geometry>`;
  const node =
    `<node id="node_${index}" name="${safeName}" type="NODE"><instance_geometry url="#${geomId}">` +
    `<bind_material><technique_common>${bindings.join('')}</technique_common></bind_material></instance_geometry></node>`;

  return { geometry: geometryXml, node };
}
