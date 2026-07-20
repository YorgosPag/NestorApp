/**
 * mesh-solid-measure — ADR-683 **Φ3.1** (§10.2). Απαντά τη μία ερώτηση που δεν μπορούσε να απαντηθεί
 * μέχρι τώρα για ένα εισαγόμενο πλέγμα: **«έχει αξιόπιστο όγκο;»**
 *
 * ## Γιατί υπάρχει
 *
 * Η προμέτρηση χρειάζεται ποσότητα ανά μονάδα. Μήκος και εμβαδόν βγαίνουν ήδη από το
 * `GeometrySignature` (`./geometry-hash` — `sizeM`, `areaM2`). Ο **όγκος** όμως δεν βγαίνει από το
 * κουτί οριοθέτησης: ένα κάγκελο 10×1×0,05 m δίνει 0,5 m³ ως κουτί ενώ πραγματικά είναι ~0,02 m³
 * (**σφάλμα ×25**). Ένας διακοσμητικός τοίχος στις ίδιες διαστάσεις είναι όντως ~0,5 m³.
 * **Από τις διαστάσεις δεν ξεχωρίζουν** — η διαφορά ζει στα τρίγωνα.
 *
 * ## Η αρχή (πρακτική Revit / ArchiCAD / IFC)
 *
 * Το Revit δίνει Volume σε εισαγόμενο DirectShape **μόνο** όταν είναι έγκυρο στερεό· για ανοιχτό
 * πλέγμα αφήνει την παράμετρο **κενή**. Το IFC απαιτεί οι `IfcElementQuantity` να **δηλώνονται**,
 * ποτέ να συνάγονται. Ίδια γραμμή εδώ: **όγκος μόνο για κλειστό πλέγμα· αλλιώς `null`.**
 * Το `null` είναι απάντηση — σημαίνει «δεν μπορώ να το ξέρω», και ο dialog της ανάθεσης δεν
 * προσφέρει καν τις μονάδες m³/kg. Ποτέ αριθμός που ο χρήστης θα εμπιστευόταν λανθασμένα.
 *
 * ## Τι σημαίνει «κλειστό» (και γιατί δεν αρκεί «κάθε ακμή δύο φορές»)
 *
 * Ελέγχεται **προσανατολισμένη πολλαπλότητα**: κάθε κατευθυνόμενη ακμή `u→v` πρέπει να εμφανίζεται
 * **ακριβώς μία** φορά, και η αντίστροφη `v→u` επίσης ακριβώς μία. Αυτό πιάνει μαζί και τα τρία:
 *   - **ανοιχτό** (ακμή χωρίς ζεύγος) → κάγκελο, επίπεδο, μη κλειστό κέλυφος·
 *   - **μη πολλαπλό** (τρία τρίγωνα σε μία ακμή) → γεωμετρία που δεν οριοθετεί χώρο·
 *   - **ασυνεπής φορά** (δύο ίδιας κατεύθυνσης) → ο όγκος θα ήταν αριθμητικά ανοησία.
 *
 * Οι κορυφές **συγκολλούνται κατά θέση** πριν τον έλεγχο: ο `GLTFLoader` διπλασιάζει κορυφές στις
 * σκληρές ακμές (διαφορετικό normal/UV, **ίδια** θέση), οπότε έλεγχος με τους δείκτες του buffer θα
 * έβγαζε **κάθε** στερεό ως ανοιχτό.
 *
 * @see ./mesh-triangles — η κοινή ανάγνωση γεωμετρίας (SSoT, μοιράζεται με το fingerprint)
 * @see ./geometry-hash — από εκεί έρχονται εμβαδόν & διαστάσεις (δεν ξαναϋπολογίζονται εδώ)
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §10.2
 */

import type * as THREE from 'three';

import { forEachTriangle, readWorldPositions } from './mesh-triangles';

/**
 * Κάδος συγκόλλησης κορυφών (0.01 mm). **Ξεχωριστός** από το `GEOMETRY_QUANTUM_M` του fingerprint
 * (0.1 mm) και σκόπιμα δεκαπλάσια λεπτός: εκεί το ζητούμενο είναι «ίδιο σχήμα παρά τον θόρυβο»,
 * εδώ «ίδιο **σημείο**». Πολύ χοντρός κάδος θα κολλούσε γειτονικές αλλά διακριτές κορυφές και θα
 * έβγαζε ψευδώς κλειστό ένα ανοιχτό πλέγμα — δηλαδή θα παρήγαγε ακριβώς τον αριθμό που το module
 * υπάρχει για να αποτρέψει.
 */
export const WELD_QUANTUM_M = 1e-5;

/**
 * Κάτω όριο όγκου (1 mm³). Ένα «κλειστό» πλέγμα με πρακτικά μηδενικό όγκο είναι εκφυλισμένο
 * (συμπτυγμένο/επίπεδο κέλυφος) — επιστρέφεται `null`, όχι μηδέν: το μηδέν θα διάβαζόταν ως
 * μετρημένη ποσότητα και θα κοστολογούσε 0 €.
 */
export const MIN_SOLID_VOLUME_M3 = 1e-9;

export interface MeshSolidMeasure {
  /** Κλειστό, πολλαπλό και συνεπώς προσανατολισμένο κέλυφος. */
  readonly isWatertight: boolean;
  /**
   * m³. **Μόνο** για στεγανό πλέγμα· `null` αλλιώς (ανοιχτό / μη πολλαπλό / εκφυλισμένο / κενό).
   * Πάντα θετικός: κέλυφος γυρισμένο «μέσα-έξω» είναι νόμιμη εξαγωγή DCC, όχι αρνητικός όγκος.
   */
  readonly volumeM3: number | null;
}

const NOT_SOLID: MeshSolidMeasure = { isWatertight: false, volumeM3: null };

/** Δείκτης συγκολλημένης κορυφής ανά κβαντισμένη θέση — ο `GLTFLoader` διπλασιάζει στις σκληρές ακμές. */
function buildWeldMap(points: Float64Array): Int32Array {
  const welded = new Int32Array(points.length / 3);
  const byPosition = new Map<string, number>();

  for (let v = 0; v < welded.length; v += 1) {
    const o = v * 3;
    const key = `${Math.round(points[o] / WELD_QUANTUM_M)},${Math.round(points[o + 1] / WELD_QUANTUM_M)},${Math.round(points[o + 2] / WELD_QUANTUM_M)}`;
    const existing = byPosition.get(key);
    if (existing === undefined) {
      byPosition.set(key, v);
      welded[v] = v;
    } else {
      welded[v] = existing;
    }
  }
  return welded;
}

/**
 * Προσανατολισμένη πολλαπλότητα: κάθε κατευθυνόμενη ακμή ακριβώς μία φορά, με την αντίστροφή της
 * επίσης ακριβώς μία. Εκφυλισμένα τρίγωνα (δύο ίδιες κορυφές μετά τη συγκόλληση) **αγνοούνται** —
 * είναι συνηθισμένο σκουπίδι εξαγωγής και δεν συνεισφέρουν ούτε σε ακμές ούτε σε όγκο.
 */
function isOrientedManifold(mesh: THREE.Mesh, welded: Int32Array): boolean {
  const directed = new Map<number, number>();
  const n = welded.length;
  let usable = 0;

  const addEdge = (u: number, v: number): void => {
    const key = u * n + v;
    directed.set(key, (directed.get(key) ?? 0) + 1);
  };

  forEachTriangle(mesh, n, (ia, ib, ic) => {
    const a = welded[ia];
    const b = welded[ib];
    const c = welded[ic];
    if (a === b || b === c || a === c) return;
    usable += 1;
    addEdge(a, b);
    addEdge(b, c);
    addEdge(c, a);
  });

  if (usable === 0) return false;

  for (const [key, count] of directed) {
    if (count !== 1) return false;
    const u = Math.floor(key / n);
    const v = key % n;
    if (directed.get(v * n + u) !== 1) return false;
  }
  return true;
}

/**
 * Προσημασμένος όγκος = (1/6)·Σ a·(b×c) πάνω σε κλειστό κέλυφος (θεώρημα απόκλισης).
 *
 * Οι κορυφές μετατοπίζονται στο κεντροειδές του bbox πριν τον υπολογισμό: τα γινόμενα τριών
 * συντεταγμένων μεγαλώνουν με τον **κύβο** της απόστασης από την αρχή, οπότε γεωμετρία σε
 * γεωαναφερμένες συντεταγμένες (εκατοντάδες χιλιάδες μέτρα) θα έχανε κάθε σημαντικό ψηφίο σε
 * αφαιρέσεις σχεδόν ίσων τεράστιων αριθμών. Η μετατόπιση δεν αλλάζει τον όγκο κλειστού κελύφους.
 */
function signedVolume(mesh: THREE.Mesh, points: Float64Array): number {
  const n = points.length / 3;
  const origin = [0, 0, 0];
  for (let i = 0; i < points.length; i += 1) origin[i % 3] += points[i];
  for (let axis = 0; axis < 3; axis += 1) origin[axis] /= n;

  let sum = 0;
  forEachTriangle(mesh, n, (ia, ib, ic) => {
    const ax = points[ia * 3] - origin[0];
    const ay = points[ia * 3 + 1] - origin[1];
    const az = points[ia * 3 + 2] - origin[2];
    const bx = points[ib * 3] - origin[0];
    const by = points[ib * 3 + 1] - origin[1];
    const bz = points[ib * 3 + 2] - origin[2];
    const cx = points[ic * 3] - origin[0];
    const cy = points[ic * 3 + 1] - origin[1];
    const cz = points[ic * 3 + 2] - origin[2];
    sum += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  });
  return sum / 6;
}

/**
 * Ο όγκος ενός εισαγόμενου κόμβου, ή `null` όταν η γεωμετρία δεν στηρίζει την ερώτηση.
 * Καλείται **μία φορά ανά κόμβο κατά την εισαγωγή** — τα τρίγωνα είναι ήδη στη μνήμη.
 */
export function measureMeshSolid(mesh: THREE.Mesh): MeshSolidMeasure {
  const points = readWorldPositions(mesh);
  if (points === null) return NOT_SOLID;

  if (!isOrientedManifold(mesh, buildWeldMap(points))) return NOT_SOLID;

  const volumeM3 = Math.abs(signedVolume(mesh, points));
  if (!Number.isFinite(volumeM3) || volumeM3 < MIN_SOLID_VOLUME_M3) return NOT_SOLID;

  return { isWatertight: true, volumeM3 };
}
