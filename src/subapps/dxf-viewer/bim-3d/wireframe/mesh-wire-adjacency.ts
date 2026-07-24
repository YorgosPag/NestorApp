/**
 * mesh-wire-adjacency — ποιες ακμές ενός πλέγματος είναι «πραγματικές» (ADR-689 Φ3).
 *
 * ## Το ερώτημα
 *
 * Ένα τριγωνοποιημένο πλέγμα δεν ξέρει ποιες γραμμές είναι σχεδιαστικά ουσιώδεις. Ένα επίπεδο
 * τετράγωνο έρχεται ως **δύο** τρίγωνα, άρα έχει μια εσωτερική **διαγώνιο** που κανένας αρχιτέκτονας
 * δεν θέλει να βλέπει. Το κριτήριο που κρατούν Revit / ArchiCAD / Cinema 4D είναι η **δίεδρη γωνία**:
 * μια ακμή δείχνεται όταν τα δύο τρίγωνα που τη μοιράζονται «σπάνε» πάνω της περισσότερο από ένα
 * κατώφλι (crease). Η διαγώνιος του επίπεδου τετραγώνου έχει δίεδρη γωνία 0 → κρύβεται· οι τέσσερις
 * περιμετρικές ακμές είναι σύνορα → φαίνονται.
 *
 * ## Γιατί ΕΔΩ και όχι με `EdgesGeometry`
 *
 * Το `THREE.EdgesGeometry(geo, 30)` απαντά το ΙΔΙΟ ερώτημα με το ΙΔΙΟ κατώφλι, αλλά παράγει ένα
 * **ξεχωριστό line buffer** — ακριβώς το βάρος που η Φ3 καταργεί. Εδώ χρειαζόμαστε την απάντηση ως
 * **μάσκα bits ανά τρίγωνο**, ώστε να ταξιδέψει μέσα στο ίδιο το vertex buffer του πλέγματος και να
 * αποφασιστεί στο fragment shader. Ίδιο κατώφλι ({@link MESH_WIRE_FEATURE_ANGLE_DEG}) → ένα πλέγμα
 * και ένα δομικό στερεό συμφωνούν στο τι είναι ακμή.
 *
 * ## Σύμβαση
 *
 * Το πλέγμα είναι **non-indexed** (9 floats ανά τρίγωνο). Η **ακμή i** ενός τριγώνου είναι η
 * (κορυφή i → κορυφή (i+1)%3), δηλαδή η **απέναντι** από την κορυφή (i+2)%3 — η ίδια σύμβαση που
 * χρησιμοποιεί η βαρυκεντρική μαθηματική στο `mesh-wire-encoding`.
 *
 * @see ./mesh-wire-encoding — η κωδικοποίηση της μάσκας στο vertex attribute
 * @see ../edges/bim-3d-edge-overlay-builder — το `EdgesGeometry` αντίστοιχο των δομικών
 */

/** Κορυφές (και ακμές) ανά τρίγωνο. */
export const TRIANGLE_CORNERS = 3;

/** Όλες οι ακμές ορατές (bits 0,1,2) — η τιμή του `full` mode. */
export const EDGE_MASK_ALL = 0b111;

/**
 * Ακρίβεια συγχώνευσης κορυφών (δεκαδικά ψηφία) όταν ψάχνουμε ποια τρίγωνα μοιράζονται μια ακμή.
 * **Ίδια τιμή με το `THREE.EdgesGeometry`** (`precisionPoints = 4`): οι εξαγωγείς γράφουν float32,
 * οπότε δύο «ίδιες» κορυφές δύο γειτονικών τριγώνων διαφέρουν στο τελευταίο bit. Χωρίς κβαντισμό
 * καμία ακμή δεν θα βρισκόταν μοιρασμένη → κάθε ακμή θα περνούσε ως σύνορο → πλήρης τριγωνοποίηση.
 */
const QUANTIZE = 1e4;

/** Κάτω από αυτό το μήκος το cross product θεωρείται εκφυλισμένο (μηδενικού εμβαδού τρίγωνο). */
const DEGENERATE_EPS = 1e-12;

/** Κλειδί κορυφής — κβαντισμένες συντεταγμένες, ώστε γειτονικά τρίγωνα να ταιριάζουν. */
function vertexKey(positions: ArrayLike<number>, vertexIndex: number): string {
  const o = vertexIndex * 3;
  const x = Math.round((positions[o] ?? 0) * QUANTIZE);
  const y = Math.round((positions[o + 1] ?? 0) * QUANTIZE);
  const z = Math.round((positions[o + 2] ?? 0) * QUANTIZE);
  return `${x},${y},${z}`;
}

/** Κλειδί ακμής, ανεξάρτητο φοράς (η ίδια ακμή από δύο τρίγωνα έχει αντίθετο winding). */
function edgeKey(keyA: string, keyB: string): string {
  return keyA < keyB ? `${keyA}|${keyB}` : `${keyB}|${keyA}`;
}

/**
 * Κανονικοποιημένη normal του τριγώνου `tri`, γραμμένη στη θέση `tri*3` του `out`. Εκφυλισμένο
 * τρίγωνο (μηδενικό εμβαδόν) αφήνει μηδενική normal — ο καλών το ερμηνεύει ως «άγνωστη».
 */
function writeFaceNormal(positions: ArrayLike<number>, tri: number, out: Float32Array): void {
  const o = tri * 9;
  const ax = positions[o + 3]! - positions[o]!;
  const ay = positions[o + 4]! - positions[o + 1]!;
  const az = positions[o + 5]! - positions[o + 2]!;
  const bx = positions[o + 6]! - positions[o]!;
  const by = positions[o + 7]! - positions[o + 1]!;
  const bz = positions[o + 8]! - positions[o + 2]!;
  const nx = ay * bz - az * by;
  const ny = az * bx - ax * bz;
  const nz = ax * by - ay * bx;
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (len < DEGENERATE_EPS) return; // μένει (0,0,0)
  const n = tri * 3;
  out[n] = nx / len;
  out[n + 1] = ny / len;
  out[n + 2] = nz / len;
}

/** Οι κανονικοποιημένες normals όλων των τριγώνων (3 floats ανά τρίγωνο). */
function computeFaceNormals(positions: ArrayLike<number>, triangleCount: number): Float32Array {
  const normals = new Float32Array(triangleCount * 3);
  for (let tri = 0; tri < triangleCount; tri++) writeFaceNormal(positions, tri, normals);
  return normals;
}

/**
 * Χάρτης «κλειδί ακμής → οι θέσεις ακμής που το μοιράζονται». Μια **θέση ακμής** κωδικοποιείται ως
 * `tri * 3 + edge`, ώστε ο δεύτερος περασμα να ξέρει και ποιο τρίγωνο και ποια από τις 3 ακμές του.
 */
function buildEdgeAdjacency(
  positions: ArrayLike<number>,
  triangleCount: number,
): Map<string, number[]> {
  const adjacency = new Map<string, number[]>();
  for (let tri = 0; tri < triangleCount; tri++) {
    const base = tri * TRIANGLE_CORNERS;
    const keys = [vertexKey(positions, base), vertexKey(positions, base + 1), vertexKey(positions, base + 2)];
    for (let edge = 0; edge < TRIANGLE_CORNERS; edge++) {
      const key = edgeKey(keys[edge]!, keys[(edge + 1) % TRIANGLE_CORNERS]!);
      const slots = adjacency.get(key);
      if (slots) slots.push(tri * TRIANGLE_CORNERS + edge);
      else adjacency.set(key, [tri * TRIANGLE_CORNERS + edge]);
    }
  }
  return adjacency;
}

/** Σπάνε τα δύο τρίγωνα πάνω στην κοινή τους ακμή περισσότερο από το κατώφλι; */
function isCrease(normals: Float32Array, triA: number, triB: number, cosThreshold: number): boolean {
  const a = triA * 3;
  const b = triB * 3;
  const dot = normals[a]! * normals[b]! + normals[a + 1]! * normals[b + 1]! + normals[a + 2]! * normals[b + 2]!;
  // Εκφυλισμένο τρίγωνο → normal (0,0,0) → dot 0 → κρίνεται ως crease (συντηρητικό: δείξ' την).
  return dot < cosThreshold;
}

/**
 * Η μάσκα ορατών ακμών κάθε τριγώνου (bit `i` = η ακμή `i` δείχνεται).
 *
 * Μια ακμή δείχνεται όταν:
 *   - **είναι σύνορο** — τη μοιράζεται ένα μόνο τρίγωνο (ανοιχτή επιφάνεια, κομμένο πλέγμα)· ή
 *   - **είναι non-manifold** — τη μοιράζονται 3+ τρίγωνα (πάντα σχεδιαστικά σημαντική)· ή
 *   - **είναι crease** — η δίεδρη γωνία με το γειτονικό τρίγωνο ξεπερνά το `thresholdDeg`.
 *
 * Ό,τι απομένει (δύο σχεδόν επίπεδα τρίγωνα) είναι εσωτερική διαγώνιος τριγωνοποίησης → κρύβεται.
 *
 * @param positions non-indexed θέσεις (9 floats ανά τρίγωνο)
 * @param thresholdDeg κατώφλι δίεδρης γωνίας σε μοίρες
 */
export function computeTriangleEdgeMasks(
  positions: ArrayLike<number>,
  thresholdDeg: number,
): Uint8Array {
  const triangleCount = Math.floor(positions.length / 9);
  const masks = new Uint8Array(triangleCount);
  if (triangleCount === 0) return masks;

  const normals = computeFaceNormals(positions, triangleCount);
  const adjacency = buildEdgeAdjacency(positions, triangleCount);
  const cosThreshold = Math.cos((thresholdDeg * Math.PI) / 180);

  for (const slots of adjacency.values()) {
    const visible =
      slots.length !== 2 ||
      isCrease(normals, Math.floor(slots[0]! / TRIANGLE_CORNERS), Math.floor(slots[1]! / TRIANGLE_CORNERS), cosThreshold);
    if (!visible) continue;
    for (const slot of slots) {
      masks[Math.floor(slot / TRIANGLE_CORNERS)]! |= 1 << (slot % TRIANGLE_CORNERS);
    }
  }
  return masks;
}
