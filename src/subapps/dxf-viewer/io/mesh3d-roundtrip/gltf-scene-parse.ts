/**
 * gltf-scene-parse — ADR-683 Φ2, **κενό Κ1**: ο Νέστωρ **εξάγει** glTF/GLB (ADR-668) αλλά δεν το
 * **ξαναδιάβαζε** ποτέ. Ο υπάρχων importer (ADR-678) είναι text-only OBJ parser — δεν αγγίζει
 * glTF, ούτε γεωμετρία.
 *
 * Αυτό το module γεφυρώνει το κενό παράγοντας **ακριβώς το ίδιο σχήμα δεδομένων** που ήδη
 * καταναλώνει ο pipeline του ADR-678 (`ObjectMaterialAssignment` = «όνομα object → όνομα υλικού»),
 * ώστε τα `matchObjectsToEntities` / `resolveImportAppearance` / `applyFaceAppearanceToFaces` να
 * δουλέψουν **αυτούσια** — μηδέν διπλότυπο μονοπάτι ανά format. Το μόνο επιπλέον είναι το
 * `fingerprint` (ADR-683 §5), που το OBJ μονοπάτι δεν μπορεί να δώσει (δεν φορτώνει γεωμετρία).
 *
 * **Γιατί εδώ φορτώνουμε πραγματικά τη γεωμετρία, ενώ στο OBJ όχι:** το OBJ χρειαζόταν μόνο
 * «ποιο object → ποιο υλικό» (βάψιμο). Το glTF μονοπάτι πρέπει επιπλέον να απαντήσει «άλλαξε το
 * σχήμα;» (καταστάσεις A vs C) — και αυτό απαιτεί κορυφές. Ο `GLTFLoader` είναι ήδη production
 * dependency (`bim-mesh-library/bim-mesh-cache.ts`), οπότε δεν προστίθεται τίποτα καινούριο.
 *
 * **Ονόματα:** ο `GLTFExporter` γράφει το `mesh.name` ως node name και ο `GLTFLoader` το
 * επιστρέφει· άρα το κανάλι ταυτότητας του ADR-678 §2 (`[HIDDEN_]<Όροφος>_<Κατηγορία>_<bimId>`)
 * επιβιώνει ακέραιο — και σε **unicode**, γιατί το glTF επιβάλλει UTF-8 (χωρίς το latin
 * transliteration που χρειάζεται το OBJ για το C4D R15). Γι' αυτό ο caller περνά
 * `charset: 'unicode'` στο matching.
 *
 * @see ../mesh3d-material-import/obj-mtl-parse — το αντίστοιχο για OBJ (ίδιο συμβόλαιο εξόδου)
 * @see ../mesh3d-material-import/match-objects-to-entities — ο κοινός καταναλωτής (name → bimId)
 * @see ./geometry-hash — το fingerprint (ίδιο SSoT με το export)
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §2.1 Κ1
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { finiteBox3FromObject } from '../../bim-3d/scene/finite-bounds';
import {
  collectAddressableGltfNodes,
  readGltfFaceKeys,
} from '../../bim-3d/scene/gltf-addressable-nodes';
import type {
  ObjectMaterialAssignment,
  ImportedMaterial,
} from '../mesh3d-material-import/obj-mtl-parse';
import { computeGeometryFingerprint, type GeometryFingerprint } from './geometry-hash';
import type { GltfNodeWorldBox } from './gltf-node-placement';
import { measureMeshSolid, type MeshSolidMeasure } from './mesh-solid-measure';

/**
 * Ένα mesh του επιστρεφόμενου glTF. Επεκτείνει το OBJ συμβόλαιο (`objectName` + `materialName`)
 * με το σχήμα, ώστε ο ίδιος reconciler να τρέχει και για τα δύο formats.
 */
export interface GltfObjectRecord extends ObjectMaterialAssignment {
  /** `null` όταν το mesh δεν έχει αξιοποιήσιμες κορυφές — ποτέ «ίδιο» εξ ορισμού. */
  readonly fingerprint: GeometryFingerprint | null;
  /**
   * ADR-683 Φ3β — **απόλυτη** θέση του κόμβου στον κόσμο (m). Ξεχωριστό πεδίο, **ποτέ** μέσα στο
   * `fingerprint`: το signature οφείλει να μένει ανεξάρτητο μετατόπισης (ένα μετακινημένο αλλά
   * αναλλοίωτο αντικείμενο είναι κατάσταση **A**, όχι **C**). `null` για κενή γεωμετρία.
   */
  readonly worldBoxM: GltfNodeWorldBox | null;
  /**
   * ADR-683 Φ3.1 (§10.2) — μπορεί αυτός ο κόμβος να κοστολογηθεί σε m³/kg; Το εμβαδόν και οι
   * διαστάσεις βγαίνουν ήδη από το `fingerprint.signature`· ο **όγκος** χρειάζεται τα τρίγωνα και
   * ισχύει μόνο για κλειστό κέλυφος (βλ. `./mesh-solid-measure`). Μετριέται εδώ γιατί εδώ είναι
   * φορτωμένη η γεωμετρία — μετά την εισαγωγή δεν ξαναδιαβάζεται ποτέ.
   */
  readonly solid: MeshSolidMeasure;
}

/**
 * Το όνομα υλικού ενός mesh. Πολλαπλά υλικά (material groups) → **το πρώτο ονομασμένο**: το
 * ADR-678 Φ1 είναι ρητά **ανά-στοιχείο** (`BASE_FACE_KEY '*'`), όπως και το OBJ μονοπάτι που
 * κρατά το dominant υλικό. Το per-face είναι ADR-678 Φ3.
 */
function resolveMaterialName(mesh: THREE.Mesh): string | null {
  const material = mesh.material;
  const list = Array.isArray(material) ? material : [material];
  for (const m of list) {
    const name = m?.name;
    if (typeof name === 'string' && name.length > 0) return name;
  }
  return null;
}

/**
 * Το παγκόσμιο κουτί ενός mesh (m). Επιστρέφει `null` για κενή/μη-πεπερασμένη γεωμετρία, ώστε ο
 * καλών να μην πάρει ποτέ `Infinity` ως «θέση» — ένα `Box3` χωρίς σημεία είναι εξ ορισμού άπειρο.
 */
function readWorldBox(node: THREE.Object3D): GltfNodeWorldBox | null {
  const box = finiteBox3FromObject(node);
  if (!box) return null;

  const centre = box.getCenter(new THREE.Vector3());
  return { centre: { x: centre.x, y: centre.y, z: centre.z }, minY: box.min.y };
}

/** `MeshSolidMeasure` fallback όταν δεν χτίζεται representative (ίδιο σχήμα με το module NOT_SOLID). */
const UNKNOWN_SOLID: MeshSolidMeasure = { isWatertight: false, volumeM3: null };

/**
 * Τα per-primitive child meshes ενός faced solid. Ο GLTFLoader τυλίγει πολλαπλά primitives σε
 * THREE.Group· ένα μοναδικό primitive (π.χ. roof «νερό») επιστρέφει σκέτο Mesh χωρίς children →
 * το ίδιο το node ΕΙΝΑΙ ο (μοναδικός) faced child.
 */
function facedChildMeshes(node: THREE.Object3D): THREE.Mesh[] {
  const asMesh = node as THREE.Mesh;
  if (asMesh.isMesh === true && node.children.length === 0) return [asMesh];
  return node.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh === true);
}

/** Το όνομα υλικού ενός child (single-material μετά το round-trip)· null αν ανώνυμο. */
function meshMaterialName(mesh: THREE.Mesh): string | null {
  const material = mesh.material;
  const single = Array.isArray(material) ? material[0] : material;
  const name = single?.name;
  return typeof name === 'string' && name.length > 0 ? name : null;
}

/** `FaceKey → όνομα υλικού` ζιπάροντας κατά ΘΕΣΗ (materialIndex `i` → `children[i]`, μετρημένο 1:1). */
function collectFaceMaterials(
  faceKeys: readonly string[],
  children: readonly THREE.Mesh[],
): Map<string, string | null> {
  const map = new Map<string, string | null>();
  const n = Math.min(faceKeys.length, children.length);
  for (let i = 0; i < n; i += 1) map.set(faceKeys[i], meshMaterialName(children[i]));
  return map;
}

/** Το πρώτο ονομασμένο υλικό των children (dominant fallback για back-compat single-material APIs). */
function dominantMaterialName(children: readonly THREE.Mesh[]): string | null {
  for (const child of children) {
    const name = meshMaterialName(child);
    if (name !== null) return name;
  }
  return null;
}

/**
 * Προσωρινό representative Mesh με ΟΛΟ το κέλυφος του faced solid. Τα child primitives είναι ανοιχτά
 * ξεχωριστά (NOT_SOLID καθένα)· μόνο ενωμένα οριοθετούν όγκο και δίνουν σταθερό fingerprint. Ψήνει
 * τα world transforms στις θέσεις ώστε τα SSoT helpers (`computeGeometryFingerprint`/
 * `measureMeshSolid`) να τρέξουν ΑΝΑΛΛΟΙΩΤΑ. Reuse του κεντρικού `mergeGeometries` (mesh3d-instancing).
 */
function facedRepresentative(children: readonly THREE.Mesh[]): THREE.Mesh | null {
  const geoms: THREE.BufferGeometry[] = [];
  for (const child of children) {
    const geo = child.geometry;
    if (!(geo instanceof THREE.BufferGeometry) || !geo.getAttribute('position')) continue;
    child.updateWorldMatrix(true, false);
    const baked = new THREE.BufferGeometry();
    baked.setAttribute('position', geo.getAttribute('position').clone());
    const index = geo.getIndex();
    if (index) baked.setIndex(index.clone());
    baked.applyMatrix4(child.matrixWorld);
    geoms.push(baked);
  }
  if (geoms.length === 0) return null;
  const merged = geoms.length === 1 ? geoms[0] : mergeGeometries(geoms, false);
  if (geoms.length > 1) geoms.forEach((g) => g.dispose());
  return merged ? new THREE.Mesh(merged) : null;
}

/** Ένα faced-solid record: per-face υλικά + shape/solid από το ΕΝΩΜΕΝΟ κέλυφος + bounds του node. */
function buildFacedRecord(node: THREE.Object3D, faceKeys: readonly string[]): GltfObjectRecord {
  const children = facedChildMeshes(node);
  const representative = facedRepresentative(children);
  return {
    objectName: node.name,
    materialName: dominantMaterialName(children),
    faceMaterials: collectFaceMaterials(faceKeys, children),
    fingerprint: representative ? computeGeometryFingerprint(representative) : null,
    worldBoxM: readWorldBox(node),
    solid: representative ? measureMeshSolid(representative) : UNKNOWN_SOLID,
  };
}

/** Ένα legacy single-material record από ένα σκέτο Mesh (μη-faced). */
function buildMeshRecord(mesh: THREE.Mesh): GltfObjectRecord {
  return {
    objectName: mesh.name,
    materialName: resolveMaterialName(mesh),
    fingerprint: computeGeometryFingerprint(mesh),
    worldBoxM: readWorldBox(mesh),
    solid: measureMeshSolid(mesh),
  };
}

/**
 * **Pure** — από ένα φορτωμένο δέντρο three σε εγγραφές. Χωρισμένο από τη φόρτωση ώστε να είναι
 * testable χωρίς GLTFLoader/αρχείο (ίδιο μοτίβο με τα pure parsers του ADR-678).
 *
 * ADR-678 Φ3 — ένα per-face-βαμμένο solid επιστρέφεται ως faced node (Group με ένα single-material
 * child ανά όψη· η αρίθμηση όψεων ζει στο node `userData.faceKeyByMaterialIndex`). Αναγνωρίζεται ως
 * ΕΝΑ record με per-face υλικά· τα child primitives του **δεν** μετρώνται ως ξεχωριστά objects.
 *
 * Ανώνυμα legacy meshes **δεν** πετιούνται: επιστρέφονται με κενό `objectName` → πέφτουν στα «χωρίς
 * αντιστοίχιση» (κατάσταση D) αντί να εξαφανιστούν σιωπηλά από την αναφορά.
 *
 * **Ποιοι κόμβοι** μετρούν = `collectAddressableGltfNodes` (SSoT, ADR-683 §mesh-load-nesting): ο ίδιος
 * walker καθορίζει και τι ευρετηριάζει ο `bim-mesh-cache`, ώστε το `nodeName` της οντότητας να μη
 * μπορεί ποτέ να δείξει σε κόμβο που ο cache δεν έχει template.
 */
export function collectGltfObjects(root: THREE.Object3D): GltfObjectRecord[] {
  return collectAddressableGltfNodes(root).map((node) => {
    const faceKeys = readGltfFaceKeys(node);
    return faceKeys ? buildFacedRecord(node, faceKeys) : buildMeshRecord(node as THREE.Mesh);
  });
}

/**
 * Υλικό three με προαιρετικό `color` (η βάση `THREE.Material` δεν το δηλώνει· το έχουν τα
 * `MeshStandardMaterial`/`MeshPhysicalMaterial` που παράγει ο `GLTFLoader`). Ρητός τύπος αντί για
 * `any`/cast — το πεδίο ελέγχεται πριν χρησιμοποιηθεί.
 */
type MaybeColoredMaterial = THREE.Material & { readonly color?: THREE.Color };

/**
 * **Το glTF ανάλογο του `.mtl`.** Ο OBJ δρόμος διαβάζει τα χρώματα από ξεχωριστό sidecar αρχείο
 * (`parseMtl` → `Map<name, ImportedMaterial>`)· στο glTF τα χρώματα ζουν **μέσα** στο ίδιο αρχείο,
 * πάνω στο υλικό του κάθε mesh. Χωρίς αυτή τη συλλογή ο `resolveImportAppearance` δεν θα έβρισκε
 * ποτέ `Kd` και **θα έχανε σιωπηλά κάθε χρώμα** που έβαλε ο συνεργάτης — θα έπεφτε στο τελευταίο
 * fallback (hex μέσα στο όνομα), που ισχύει μόνο για το C4D R15 χωρίς `.mtl`.
 *
 * Παράγει **ακριβώς** το `ImportedMaterial` του ADR-678 ⇒ ο ίδιος `resolveImportAppearance`
 * τρέχει αυτούσιος και για τα δύο formats (μηδέν δεύτερο μονοπάτι ανάλυσης εμφάνισης).
 *
 * `getHexString()` μετατρέπει από τον working (linear) χώρο του three σε **sRGB** — δηλαδή στο
 * χρώμα που βλέπει ο χρήστης στον viewer του, όχι στην εσωτερική αριθμητική αναπαράσταση.
 *
 * Ανώνυμα υλικά αγνοούνται: το κλειδί αντιστοίχισης είναι το όνομα (ADR-678 §2) — υλικό χωρίς
 * όνομα δεν μπορεί να αναζητηθεί.
 */
export function collectGltfMaterials(root: THREE.Object3D): Map<string, ImportedMaterial> {
  const materials = new Map<string, ImportedMaterial>();

  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh !== true) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const raw of list) {
      const material = raw as MaybeColoredMaterial | undefined;
      const name = material?.name;
      if (typeof name !== 'string' || name.length === 0) continue;
      if (materials.has(name) || material?.color === undefined) continue;
      materials.set(name, {
        name,
        colorHex: `#${material.color.getHexString()}`,
        opacity: typeof material.opacity === 'number' ? material.opacity : 1,
      });
    }
  });

  return materials;
}

/**
 * Ό,τι χρειάζεται ο pipeline του ADR-678 από ένα επιστρεφόμενο glTF: τα objects (ταυτότητα +
 * υλικό + σχήμα) και ο πίνακας υλικών. Ένα σχήμα, μία διέλευση του δέντρου.
 */
export interface GltfSceneImport {
  readonly objects: readonly GltfObjectRecord[];
  /** Ισοδύναμο του `parseMtl` — όνομα υλικού → χρώμα/διαφάνεια. */
  readonly materials: ReadonlyMap<string, ImportedMaterial>;
}

/**
 * Φορτώνει `.glb` (ArrayBuffer) ή `.gltf` (JSON κείμενο) και επιστρέφει objects + υλικά.
 *
 * `path` = `''`: τα GLB κουβαλούν τους πόρους τους ενσωματωμένους (ο exporter μας γράφει
 * `embedImages: true`), άρα δεν υπάρχει σχετικό directory να λυθεί. Ένα `.gltf` με **εξωτερικά**
 * `.bin`/textures θα αποτύχει εδώ — σωστά και ρητά: δεν έχουμε τα συνοδά αρχεία. Το κανονικό
 * μονοπάτι παράδοσης είναι το GLB (ένα αρχείο).
 */
export async function parseGltfScene(data: ArrayBuffer | string): Promise<GltfSceneImport> {
  const loader = new GLTFLoader();
  return new Promise<GltfSceneImport>((resolve, reject) => {
    loader.parse(
      data,
      '',
      (gltf) =>
        resolve({
          objects: collectGltfObjects(gltf.scene),
          materials: collectGltfMaterials(gltf.scene),
        }),
      () => reject(new Error('MESH3D_GLTF_PARSE_FAILED')),
    );
  });
}
