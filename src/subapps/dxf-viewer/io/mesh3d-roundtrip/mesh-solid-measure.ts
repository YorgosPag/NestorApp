/**
 * mesh-solid-measure — **ΤΟ ΠΕΡΙΤΥΛΙΓΜΑ ΤΟΥ THREE** πάνω στον κοινό μετρητή στερεού.
 *
 * ⚠️ **Ο ΥΠΟΛΟΓΙΣΜΟΣ ΕΦΥΓΕ ΣΤΟ `@/lib/geometry/mesh3d/mesh-solid-measure`** *(ADR-845 Φ4.2)*, ώστε
 * να τον βλέπει **και ο διακομιστής** — το πλήρες σκεπτικό *(γιατί, και γιατί όχι αντιγραφή)* ζει
 * εκεί και στο `@/lib/geometry/mesh3d/triangle-soup`. Εδώ έμεινε **μία γραμμή μετάφρασης**.
 *
 * 🔑 **Το αρχείο ΔΕΝ διαγράφηκε, και είναι απόφαση**: τέσσερις καταναλωτές του subapp το εισάγουν
 * ονομαστικά *(`./gltf-scene-parse`, `../../bim/entities/imported-mesh/build-imported-mesh-entity`,
 * και οι δύο σουίτες τους)*. Μια «καθαρή» διαγραφή θα τους έσπρωχνε να μάθουν τη διαδρομή του
 * πυρήνα — δηλαδή θα διέσπειρε τη γνώση *«πού ζει ο υπολογισμός»* σε τέσσερα σημεία, για να
 * γλιτώσει **ένα** αρχείο δεκατεσσάρων γραμμών.
 *
 * Η **σημασιολογία** παραμένει αυτούσια: όγκος **μόνο** για κλειστό, πολλαπλό, συνεπώς
 * προσανατολισμένο κέλυφος· αλλιώς `null` — ποτέ μηδέν που ο χρήστης θα κοστολογούσε.
 *
 * @see @/lib/geometry/mesh3d/mesh-solid-measure — η μηχανή, οι ανοχές, και το «γιατί κλειστό»
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §10.2
 */

import type * as THREE from 'three';

import { measureSolid, type MeshSolidMeasure } from '@/lib/geometry/mesh3d/mesh-solid-measure';

import { toTriangleSoup } from './mesh-triangles';

export {
  WELD_QUANTUM_M,
  MIN_SOLID_VOLUME_M3,
  type MeshSolidMeasure,
} from '@/lib/geometry/mesh3d/mesh-solid-measure';

/**
 * Ο όγκος ενός εισαγόμενου κόμβου, ή `null` όταν η γεωμετρία δεν στηρίζει την ερώτηση.
 * Καλείται **μία φορά ανά κόμβο κατά την εισαγωγή** — τα τρίγωνα είναι ήδη στη μνήμη.
 */
export function measureMeshSolid(mesh: THREE.Mesh): MeshSolidMeasure {
  return measureSolid(toTriangleSoup(mesh));
}
