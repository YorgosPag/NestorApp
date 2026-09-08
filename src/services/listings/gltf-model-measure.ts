/**
 * @fileoverview **Ο ΠΡΟΣΑΡΜΟΓΕΑΣ ΤΟΥ glTF** πάνω στον κοινό πυρήνα γεωμετρίας.
 * @related ADR-845 §6.2.1 (κλειστή λογιστική) · lib/geometry/mesh3d · ADR-749
 * @module services/listings/gltf-model-measure
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΑΔΕΛΦΟ ΤΟΥ `subapps/dxf-viewer/io/mesh3d-roundtrip/mesh-triangles`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η **ίδια** ερώτηση — *«δώσε μου τα τρίγωνα σε world space»* — από **άλλον ξενιστή**:
 * εκεί `THREE.Mesh`, εδώ `gltf-transform Document`. Ο **υπολογισμός** είναι κοινός και ζει
 * στο `@/lib/geometry/mesh3d/*`· εδώ ζει **μόνο η ανάγνωση**.
 *
 * 🔑 **Αυτό είναι ολόκληρο το φράγμα της Φ4.2, λυμένο**: ένα δεύτερο `measureMeshSolid` /
 * `computeGeometryFingerprint` γραμμένο για τον διακομιστή θα μεταγλωττιζόταν, θα περνούσε
 * τα tests, και θα **απέκλινε σιωπηλά** την πρώτη φορά που κάποιος πείραζε μια **ανοχή**
 * στη μία από τις δύο πλευρές — το σχήμα που τιμωρεί το **ADR-749**. Η λογιστική του
 * §6.2.1 απαιτεί οι δύο πλευρές να **συμφωνούν**· δύο μηχανές δεν μπορούν να το εγγυηθούν.
 *
 * ⚠️ **ΚΑΘΑΡΟ ΑΠΟ I/O**: δέχεται `Document`, δεν διαβάζει αρχεία και δεν αγγίζει κάδο.
 * Έτσι οι άγκυρες το εκτελούν χωρίς δίκτυο, και ο ψήστης το καλεί χωρίς να το εμπιστευτεί.
 */

import type { Document, Node as GltfNode, Primitive } from '@gltf-transform/core';

import { computeFingerprint } from '@/lib/geometry/mesh3d/geometry-fingerprint';
import type { TriangleSoup } from '@/lib/geometry/mesh3d/triangle-soup';
import type { ModelGeometryLedger } from '@/lib/listings/listing-model-declaration';

/** `TRIANGLES` του glTF. Ό,τι δεν είναι τρίγωνα δεν συνεισφέρει γεωμετρία — δες παρακάτω. */
const PRIMITIVE_MODE_TRIANGLES = 4;

/** Ένα κομμάτι γεωμετρίας, ήδη σε world space, πριν συγχωνευθεί με τα υπόλοιπα. */
interface SoupPiece {
  readonly positions: Float64Array;
  readonly index: Uint32Array | null;
}

/**
 * Κορυφές ενός primitive σε **world space**.
 *
 * ⚠️ **`getElement` και όχι `getArray`, και είναι απόφαση ορθότητας**: ένα εισερχόμενο GLB
 * επιτρέπεται να έχει **κβαντισμένες/κανονικοποιημένες** θέσεις *(`KHR_mesh_quantization`)*.
 * Το `getArray()` θα έδινε τους **ακέραιους του buffer**, δηλαδή γεωμετρία σε λάθος
 * κλίμακα — και η λογιστική θα κατήγγειλε **κάθε** τέτοιο αρχείο για λάθος λόγο. Το
 * `getElement` ρωτά τον **Accessor**, που είναι η αυθεντία για το πώς διαβάζεται ο buffer.
 *
 * ⚠️ Ο πίνακας `mat4` του glTF είναι **column-major**, ίδια διάταξη με το
 * `THREE.Matrix4.elements` — γι' αυτό ο πολλαπλασιασμός εδώ είναι **κατά γράμμα** ο ίδιος
 * με τον προσαρμογέα του three. Η matrix θεωρείται affine (TRS δέντρο, πάντα αληθές για glTF).
 */
function readWorldPositions(primitive: Primitive, world: number[]): Float64Array | null {
  const position = primitive.getAttribute('POSITION');
  if (position === null || position.getCount() === 0) return null;

  const count = position.getCount();
  const out = new Float64Array(count * 3);
  const element: number[] = [0, 0, 0];

  for (let i = 0; i < count; i += 1) {
    position.getElement(i, element);
    const [x, y, z] = element;
    const o = i * 3;
    out[o] = world[0] * x + world[4] * y + world[8] * z + world[12];
    out[o + 1] = world[1] * x + world[5] * y + world[9] * z + world[13];
    out[o + 2] = world[2] * x + world[6] * y + world[10] * z + world[14];
  }
  return out;
}

/** Οι δείκτες ενός primitive, ή `null` για non-indexed — ίδια διάκριση με τον three. */
function readIndex(primitive: Primitive): Uint32Array | null {
  const indices = primitive.getIndices();
  if (indices === null) return null;

  const count = indices.getCount();
  const out = new Uint32Array(count);
  const element: number[] = [0];

  for (let i = 0; i < count; i += 1) {
    indices.getElement(i, element);
    out[i] = element[0];
  }
  return out;
}

/**
 * Κάθε κόμβος με πλέγμα, σε world space.
 *
 * 🔑 **Η διέλευση είναι ΤΩΝ ΚΟΜΒΩΝ, όχι των πλεγμάτων** — και η διάκριση μετράει: το glTF
 * επιτρέπει το **ίδιο** mesh να τοποθετηθεί σε **πολλούς** κόμβους *(instancing)*. Μια
 * διέλευση του `root.listMeshes()` θα μετρούσε τη γεωμετρία **μία** φορά ενώ ο άνθρωπος
 * βλέπει **δέκα** — και η λογιστική θα κατήγγειλε τη δική της τυφλότητα ως αλλοίωση.
 */
function collectPieces(document: Document): SoupPiece[] {
  const scene = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0];
  if (scene === undefined) return [];

  const pieces: SoupPiece[] = [];

  scene.traverse((node: GltfNode) => {
    const mesh = node.getMesh();
    if (mesh === null) return;

    const world = node.getWorldMatrix();
    for (const primitive of mesh.listPrimitives()) {
      // ⚠️ Ό,τι δεν είναι τρίγωνα (γραμμές, σημεία) **δεν** συνεισφέρει: ο πυρήνας μετρά
      //    εμβαδά και όγκους τριγώνων. Δεν αγνοείται σιωπηλά — απλώς δεν είναι γεωμετρία
      //    επιφάνειας, και το πλήθος τριγώνων του παραμένει ειλικρινώς μηδέν.
      if (primitive.getMode() !== PRIMITIVE_MODE_TRIANGLES) continue;

      const positions = readWorldPositions(primitive, [...world]);
      if (positions === null) continue;

      pieces.push({ positions, index: readIndex(primitive) });
    }
  });

  return pieces;
}

/**
 * 🏆 **ΕΝΑΣ ΠΟΛΤΟΣ ΓΙΑ ΟΛΟ ΤΟ ΜΟΝΤΕΛΟ** — τα κομμάτια συγχωνεύονται με **μετατόπιση δεικτών**.
 *
 * 🔑 **Γιατί ΕΝΑ αποτύπωμα και όχι Ν**: η δήλωση του πελάτη είναι για **το μοντέλο**, όχι
 * για κάθε πλέγμα χωριστά. Ένας πίνακας αποτυπωμάτων θα απαιτούσε **αντιστοίχιση** πλεγμάτων
 * ανάμεσα στις δύο πλευρές — δηλαδή δεύτερη ερώτηση *(«ποιο είναι ποιο;»)* που κανείς δεν
 * ζήτησε, και της οποίας η λάθος απάντηση θα φαινόταν ως αλλοίωση.
 *
 * ⚠️ Το αποτύπωμα **ταξινομεί** τις κορυφές πριν το hash, άρα η **σειρά** συγχώνευσης
 * **δεν** επηρεάζει το αποτέλεσμα. Χωρίς αυτή την ιδιότητα, μια αναδιάταξη κόμβων από τον
 * exporter θα διαβαζόταν ως αλλαγή σχήματος.
 */
function mergeSoup(pieces: readonly SoupPiece[]): TriangleSoup | null {
  if (pieces.length === 0) return null;

  const vertexTotal = pieces.reduce((sum, piece) => sum + piece.positions.length / 3, 0);
  const indexTotal = pieces.reduce(
    (sum, piece) => sum + (piece.index?.length ?? piece.positions.length / 3),
    0,
  );

  const positions = new Float64Array(vertexTotal * 3);
  const index = new Uint32Array(indexTotal);
  let vertexOffset = 0;
  let indexOffset = 0;

  for (const piece of pieces) {
    const pieceVertices = piece.positions.length / 3;
    positions.set(piece.positions, vertexOffset * 3);

    // Non-indexed κομμάτι ⇒ γεννιούνται δείκτες, ώστε ο συγχωνευμένος πολτός να έχει **μία**
    // μορφή. Αλλιώς η μετατόπιση θα ήταν σωστή για άλλα κομμάτια και λάθος για αυτό.
    const count = piece.index?.length ?? pieceVertices;
    for (let i = 0; i < count; i += 1) {
      index[indexOffset + i] = (piece.index?.[i] ?? i) + vertexOffset;
    }

    vertexOffset += pieceVertices;
    indexOffset += count;
  }

  return { positions, index };
}

/**
 * **Τα μεγέθη του παραληφθέντος αρχείου** — η μία πλευρά της κλειστής λογιστικής.
 *
 * ⚠️ Τα πλήθη υλικών/υφών έρχονται από τη **ρίζα του εγγράφου**, όχι από διέλευση: το glTF
 * τα κρατά ήδη **αποδιπλασιασμένα**, και μια δική μας μέτρηση θα ήταν δεύτερη απάντηση στο
 * *«πόσα διακριτά;»* — ελεύθερη να διαφωνήσει με το ίδιο το αρχείο.
 */
export function measureModelLedger(document: Document): ModelGeometryLedger {
  const root = document.getRoot();
  const soup = mergeSoup(collectPieces(document));
  const fingerprint = computeFingerprint(soup);

  return {
    meshCount: root.listMeshes().length,
    triangleCount: fingerprint?.signature.triangleCount ?? 0,
    materialCount: root.listMaterials().length,
    textureCount: root.listTextures().length,
    fingerprint,
  };
}
