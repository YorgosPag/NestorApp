/**
 * @fileoverview **Η ΓΕΩΜΕΤΡΙΑ ΧΩΡΙΣ ΞΕΝΙΣΤΗ** — τρίγωνα σε world space, ως καθαροί αριθμοί.
 * @related ADR-845 §6.2.1 (κλειστή λογιστική) · ADR-683 §5 · ADR-749 (μία μηχανή)
 * @module lib/geometry/mesh3d/triangle-soup
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΕΦΥΓΕ ΑΠΟ ΤΟ `subapps/dxf-viewer` (ADR-845 Φ4.2)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η **κλειστή λογιστική** του §6.2.1 απαιτεί την ίδια ερώτηση — *«τι γεωμετρία είναι
 * αυτή;»* — να απαντηθεί σε **δύο θέσεις**: στον **πελάτη** *(που συναρμολογεί τη σκηνή
 * three.js)* και στον **διακομιστή** *(που παραλαμβάνει τα bytes του GLB)*. Ο πρωτότυπος
 * κώδικας ζούσε στο `subapps/dxf-viewer/io/mesh3d-roundtrip/`, που το root `tsconfig.json`
 * **ΕΞΑΙΡΕΙ** — άρα ο διακομιστής **δεν μπορούσε να τον εισαγάγει**.
 *
 * 🔑 **Η προφανής κίνηση ήταν η λάθος**: αντιγραφή του υπολογισμού στη μεριά του
 * διακομιστή θα μεταγλωττιζόταν, θα περνούσε τα tests, και θα **απέκλινε σιωπηλά** την
 * πρώτη φορά που κάποιος πείραζε μια **ανοχή** στη μία από τις δύο πλευρές. Είναι το
 * σχήμα που τιμωρεί το **ADR-749**, και το `public-listing-projection.ts` το γράφει ήδη
 * για τα mirrors του `functions/`: *«test πάνω στο αντίγραφο Α δεν μπορεί να δει αλλαγή
 * στο Β»*.
 *
 * 🏆 **ΚΑΙ Η ΕΞΑΓΩΓΗ ΗΤΑΝ ΔΥΝΑΤΗ ΕΠΕΙΔΗ Ο ΡΑΦΗΣ ΥΠΗΡΧΕ ΗΔΗ.** Το `mesh-triangles.ts`
 * γεννήθηκε στη Φ3.1 του ADR-683 ακριβώς για να είναι **ο ένας τόπος** που διαβάζει
 * γεωμετρία. Μετρημένο 2026-09-08: ολόκληρη η επαφή των μετρητών με το three ήταν
 * **δύο** συναρτήσεις *(κορυφές σε world space · διέλευση τριγώνων)*, και **και οι τρεις**
 * εισήγαγαν `import type * as THREE` — δηλαδή **μηδέν** εξάρτηση σε χρόνο εκτέλεσης.
 * Ό,τι ήταν από κάτω ήταν ήδη καθαροί αριθμοί.
 *
 * ⇒ Εδώ ζει το **ΤΙ**· ο ξενιστής απαντά μόνο **ΠΩΣ ΤΟ ΔΙΑΒΑΖΩ**:
 *   - πελάτης → `subapps/dxf-viewer/io/mesh3d-roundtrip/mesh-triangles` *(THREE.Mesh)*
 *   - διακομιστής → `services/listings/gltf-triangle-soup` *(gltf-transform Primitive)*
 *
 * ⚠️ **ΜΗΝ προσθέσεις εδώ τίποτα που ξέρει τι είναι `THREE`, `glTF` ή `Firestore`.** Η
 * αξία αυτού του module είναι ότι **δεν μπορεί** να διαφωνήσει με τον εαυτό του — και
 * αυτό ισχύει μόνο όσο δεν έχει ξενιστή.
 */

/**
 * **Τρίγωνα σε world space, χωρίς ξενιστή.**
 *
 * ⚠️ **Οι κορυφές είναι ΗΔΗ σε world space** *(η matrix έχει εφαρμοστεί από τον
 * προσαρμογέα)*, σε **μέτρα** — ο three κόσμος είναι σε μέτρα *(ADR-462)* και το glTF
 * είναι spec-locked σε μέτρα. Ένας προσαρμογέας που θα έδινε τοπικές συντεταγμένες θα
 * παρήγαγε αποτίμηση που **μοιάζει** σωστή και είναι λάθος κατά την κλίμακα του κόμβου.
 */
export interface TriangleSoup {
  /** Κορυφές σε world space (m), **τρεις αριθμοί ανά κορυφή**. */
  readonly positions: Float64Array;
  /**
   * Δείκτες κορυφών, ή `null` για **non-indexed** γεωμετρία.
   *
   * 🔑 Η διάκριση indexed/non-indexed ζει **μόνο** στο {@link forEachTriangle}, ώστε
   * κανένας καταναλωτής να μην την ξαναγράψει — και, το κρισιμότερο, να μην την **ξεχάσει**.
   */
  readonly index: Uint32Array | null;
}

/** Πλήθος κορυφών — μία ερώτηση, μία απάντηση, ποτέ `length / 3` σκορπισμένο στους καλούντες. */
export function soupVertexCount(soup: TriangleSoup): number {
  return soup.positions.length / 3;
}

/**
 * Διέλευση όλων των τριγώνων. Καλύπτει indexed **και** non-indexed γεωμετρία.
 *
 * Επιστρέφει το πλήθος τριγώνων που επισκέφθηκε.
 *
 * ⚠️ **Δέχεται δείκτες + πλήθος κορυφών, ΟΧΙ ολόκληρο {@link TriangleSoup}**, και είναι
 * απόφαση: ο προσαρμογέας του three καλείται σε σημεία που κρατούν **μόνο** τους δείκτες
 * *(`imported-mesh-faces`)*. Με υπογραφή που ζητούσε `TriangleSoup`, εκείνα θα
 * υποχρεώνονταν να κατασκευάσουν πίνακα κορυφών **που δεν χρειάζονται** — ή, χειρότερα,
 * να ξαναγράψουν τον βρόχο, που είναι ακριβώς το structural clone του **N.18**.
 */
export function forEachTriangle(
  index: Uint32Array | null,
  vertexCount: number,
  visit: (ia: number, ib: number, ic: number) => void,
): number {
  const count = index !== null ? index.length : vertexCount;
  const triangleCount = Math.floor(count / 3);

  for (let t = 0; t < triangleCount; t += 1) {
    const base = t * 3;
    if (index !== null) {
      visit(index[base], index[base + 1], index[base + 2]);
    } else {
      visit(base, base + 1, base + 2);
    }
  }
  return triangleCount;
}

/** Ίδια διέλευση, από {@link TriangleSoup} — η μορφή που θέλουν οι μετρητές. */
export function forEachSoupTriangle(
  soup: TriangleSoup,
  visit: (ia: number, ib: number, ic: number) => void,
): number {
  return forEachTriangle(soup.index, soupVertexCount(soup), visit);
}

/** Εμβαδόν ενός τριγώνου από 3 δείκτες κορυφών (μισό μέτρο του εξωτερικού γινομένου). */
export function triangleArea(p: Float64Array, ia: number, ib: number, ic: number): number {
  const ax = p[ib * 3] - p[ia * 3];
  const ay = p[ib * 3 + 1] - p[ia * 3 + 1];
  const az = p[ib * 3 + 2] - p[ia * 3 + 2];
  const bx = p[ic * 3] - p[ia * 3];
  const by = p[ic * 3 + 1] - p[ia * 3 + 1];
  const bz = p[ic * 3 + 2] - p[ia * 3 + 2];
  const cx = ay * bz - az * by;
  const cy = az * bx - ax * bz;
  const cz = ax * by - ay * bx;
  return Math.sqrt(cx * cx + cy * cy + cz * cz) / 2;
}
