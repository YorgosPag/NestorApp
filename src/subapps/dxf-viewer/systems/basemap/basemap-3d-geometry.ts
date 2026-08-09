/**
 * Το πλέγμα παραμόρφωσης ενός πλακιδίου, ως γεωμετρία three.js.
 *
 * ## Γιατί ΔΕΝ είναι `PlaneGeometry`
 * Ένα επίπεδο τετράγωνο θα ήταν λάθος με τον ίδιο ακριβώς τρόπο που είναι λάθος στο 2Δ: το
 * πλακίδιο είναι τετράγωνο στο Web Mercator, όχι στο ΕΓΣΑ'87. Οι κορυφές έρχονται από το
 * **ίδιο** {@link ./basemap-warp}, οπότε οι δύο προβολές δεν μπορούν να αποκλίνουν — αν
 * διορθωθεί η μία, διορθώνεται και η άλλη. Δύο ανεξάρτητα πλέγματα θα ήταν το σχήμα «η μία
 * κατεύθυνση διορθώθηκε και η άλλη όχι» που έχει ήδη πληρώσει αυτό το αποθετήριο.
 *
 * ## Οι άξονες δεν ξαναγράφονται
 * Η αντιστοίχιση «κάτοψη mm → κόσμος 3Δ (μέτρα, Y-πάνω)» ζει στο
 * `bim-3d/viewport/plan-to-world-math` και καταναλώνεται μέσω `writeDxfPlanToWorld` — το ίδιο
 * μονοπάτι που χρησιμοποιεί το ανάγλυφο TIN. Η τεκμηρίωση εκείνου του αρχείου το λέει ρητά: μια
 * δεύτερη ενσωμάτωση του `(x, elev, −y) × 0,001` είναι ακριβώς ο τρόπος με τον οποίο το 3Δ
 * καθρεφτίζεται σιωπηλά ως προς το 2Δ.
 */

import * as THREE from 'three';
import { writeDxfPlanToWorld } from '../../bim-3d/viewport/coordinate-transforms';
import { meshVertex, type TileWarpMesh } from './basemap-warp';

/**
 * Γεωμετρία για ένα πλακίδιο.
 *
 * @param elevationMm Υψόμετρο τοποθέτησης σε mm κάτοψης. Ο χάρτης κάθεται **κάτω** από το
 *   επίπεδο εργασίας, όχι πάνω του: μηδενικό υψόμετρο θα τον έκανε συνεπίπεδο με τα δάπεδα και
 *   ο οδηγός βάθους θα αποφάσιζε ανά καρέ ποιος φαίνεται — το γνωστό «z-fighting», που δεν
 *   μοιάζει με σφάλμα τοποθέτησης αλλά με τρεμόπαιγμα υλικού.
 */
export function buildTileGeometry(mesh: TileWarpMesh, elevationMm: number): THREE.BufferGeometry {
  const side = mesh.divisions + 1;
  const positions = new Float32Array(side * side * 3);
  const uvs = new Float32Array(side * side * 2);

  for (let row = 0; row < side; row += 1) {
    for (let col = 0; col < side; col += 1) {
      const index = row * side + col;
      const vertex = meshVertex(mesh, row, col);
      writeDxfPlanToWorld(positions, index * 3, vertex.display.x, vertex.display.y, elevationMm);
      uvs[index * 2] = vertex.u;
      // Η προεπιλογή `flipY` του three αναστρέφει την εικόνα κατά το ανέβασμα, οπότε το `v = 0`
      // της υφής είναι το ΚΑΤΩ της. Το `v` του πλακιδίου μετριέται από τον ΒΟΡΡΑ. Χωρίς αυτή τη
      // μία αφαίρεση ο χάρτης βγαίνει ανάποδα — βλάβη που μοιάζει με λάθος γεωαναφορά.
      uvs[index * 2 + 1] = 1 - vertex.v;
    }
  }

  const indices = new Uint32Array(mesh.divisions * mesh.divisions * 6);
  let cursor = 0;
  for (let row = 0; row < mesh.divisions; row += 1) {
    for (let col = 0; col < mesh.divisions; col += 1) {
      const topLeft = row * side + col;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + side;
      const bottomRight = bottomLeft + 1;
      // Ίδια διαγώνιος με τον ζωγράφο του 2Δ — δες `basemap-painter.meshTriangles`.
      indices[cursor] = topLeft;
      indices[cursor + 1] = bottomLeft;
      indices[cursor + 2] = bottomRight;
      indices[cursor + 3] = topLeft;
      indices[cursor + 4] = bottomRight;
      indices[cursor + 5] = topRight;
      cursor += 6;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Υλικό πλακιδίου: αφώτιστο, χωρίς εγγραφή βάθους.
 *
 * `MeshBasicMaterial` επίτηδες — μια αεροφωτογραφία **έχει ήδη μέσα της** τον φωτισμό της ώρας
 * που τραβήχτηκε. Φωτίζοντάς τη ξανά με τους ήλιους της σκηνής, το υπόβαθρο θα σκοτείνιαζε ή θα
 * καιγόταν ανάλογα με τη γωνία του ήλιου του **έργου**, δηλαδή μια ρύθμιση σκίασης θα άλλαζε
 * κάτι που δεν είναι γεωμετρία της σκηνής.
 */
export function createTileMaterial(image: TexImageSource, opacity: number): THREE.MeshBasicMaterial {
  const texture = new THREE.Texture(image);
  texture.needsUpdate = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  // Τα πλακίδια αγγίζουν ακριβώς στις ακμές τους· η επανάληψη θα έφερνε μια γραμμή από την
  // απέναντι πλευρά της εικόνας πάνω στη ραφή.
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  return new THREE.MeshBasicMaterial({
    map: texture,
    transparent: opacity < 1,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
