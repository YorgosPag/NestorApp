/**
 * loading-placeholder-material — το «φορτώνει» ghost των mesh-based οντοτήτων (ADR-693 Άξονας Β).
 *
 * ## Το πρόβλημα που λύνει (μετρημένο, ADR-693 §2.1)
 *
 * Όσο κατεβαίνει το `.glb` ενός εισαγόμενου μοντέλου, το `meshToObject3D` δείχνει bbox placeholder
 * ζωγραφισμένο με `getMaterial3D(matId)`. Για το `elem-imported-mesh` **κανένα** prefix του
 * `MATERIAL_DEFS` δεν ταίριαζε → `DEFAULT_MATERIAL_KEY` → `mat-concrete` → slug `concrete` → τα
 * κουτιά φόρτωσης ζωγραφίζονταν με τη **ΦΩΤΟΓΡΑΦΙΑ ΣΚΥΡΟΔΕΜΑΤΟΣ**, με σκιές. Ο χρήστης δεν μπορεί
 * να ξεχωρίσει «φορτώνει» από «αυτό ΕΙΝΑΙ σκυρόδεμα» — και ακριβώς αυτό συνέβη (Giorgio, 2026-07-24).
 *
 * ## Ο κανόνας των μεγάλων (ADR-693 §3)
 *
 * Revit (linked model) → wireframe bbox ή τίποτα. ArchiCAD (Hotlink) → placeholder περίγραμμα.
 * Cinema 4D (proxy/Alembic) → bounding box, οπτικά ουδέτερο. Autodesk APS Viewer / Speckle → ό,τι
 * δεν φόρτωσε δεν ζωγραφίζεται. Figma → skeleton. **Καμία** δεν δείχνει αληθοφανές υλικό: μια
 * κατάσταση φόρτωσης πρέπει να ΦΑΙΝΕΤΑΙ σαν κατάσταση φόρτωσης.
 *
 * ## Γιατί ΔΕΝ είναι `MATERIAL_DEFS` καταχώριση
 *
 * Ένα ghost **δεν είναι υλικό — είναι κατάσταση UI**. Στο `MATERIAL_DEFS` θα γινόταν επιλέξιμο από
 * τον `resolveMaterialKey` prefix match, βαφόμενο, και θα εμφανιζόταν σε προμετρήσεις/τομές. Ζει
 * εδώ, με ρητό κύκλο ζωής, και το ξέρει **ένας** caller: το `meshToObject3D::buildPlaceholder`.
 *
 * ## Πού ξεπερνάμε τους μεγάλους (ADR-693 §3.1)
 *
 * Το Revit δείχνει bbox **χωρίς σωστές διαστάσεις** μέχρι να διαβάσει το linked αρχείο. Εμείς
 * έχουμε ήδη τα per-node `measuredWidth/Depth/HeightMm` στην οντότητα (ADR-683), οπότε το ghost
 * έχει **σωστό μέγεθος και θέση από το πρώτο καρέ**, χωρίς καμία αναμονή δικτύου.
 *
 * @see ../converters/mesh-to-object3d — ο ΜΟΝΑΔΙΚΟΣ caller (ένα call site → καμία οντότητα εκτός)
 * @see ./pbr-material-builder — ο SOLE PBR factory (N.18: κανένας δεύτερος builder εδώ)
 * @see ../edges/bim-edge-colors — το SSoT χρώμα ακμής ανά background
 * @see docs/centralized-systems/reference/adrs/ADR-693-loading-ghost-and-unknown-material-fallback.md
 */

import * as THREE from 'three';
import type { BackgroundMode } from '../../config/bim-visual-style';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
import { resolveEdgeColorForBackground } from '../edges/bim-edge-colors';
import { buildMat } from './pbr-material-builder';

/**
 * Σημαία στο `userData` ενός ghost. Το `tagObject` (mesh-to-object3d) τη διαβάζει ώστε να ΜΗΝ
 * ξαναγράψει `castShadow/receiveShadow = true` πάνω της: ένα ημιδιάφανο «φορτώνει» κουτί που ρίχνει
 * συμπαγή σκιά διαβάζεται ως πραγματικός όγκος — ακριβώς η σύγχυση που κλείνει το ADR-693.
 */
export const BIM_LOADING_GHOST_FLAG = 'bimLoadingGhost';

/** Διαφάνεια του ghost: αρκετή για να διαβάζεται ο όγκος, όχι τόση ώστε να περνά για υλικό. */
const GHOST_OPACITY = 0.28;

/**
 * Ουδέτερο χρώμα σώματος ανά ορατό background. Σε ανοιχτό (environment) background ένα ψυχρό
 * μεσαίο γκρι, σε σκούρο («σαν 2Δ») ένα ανοιχτό γκρι — ίδια λογική αντιστροφής με τις ακμές
 * (`bim-edge-colors`), ώστε το ghost να διαβάζεται και στα δύο χωρίς να μοιάζει με υλικό.
 */
const GHOST_BODY_COLOR: Record<BackgroundMode, number> = {
  environment: 0x8a9199,
  dark: 0xc4cad1,
};

/** Ένα cached σώμα + ένα cached περίγραμμα ανά background mode (μηδέν per-instance allocation). */
const bodyMaterials = new Map<BackgroundMode, THREE.MeshStandardMaterial>();
const outlineMaterials = new Map<BackgroundMode, THREE.LineBasicMaterial>();

/**
 * Το ουδέτερο ημιδιάφανο υλικό σώματος για το τρέχον background. Χτίζεται από τον SOLE PBR factory
 * (`buildMat`, N.18) και μετά παίρνει τις δύο ghost-specific υπερβάσεις:
 *   - `DoubleSide` — ένα ημιδιάφανο κουτί πρέπει να δείχνει και τα πίσω τοιχώματά του, αλλιώς
 *     διαβάζεται ως επίπεδη κηλίδα αντί για όγκο·
 *   - `depthWrite: false` — δεν κρύβει ό,τι φορτώνει πίσω του, και δεν παλεύει με τα αδελφά ghosts
 *     για το z-buffer (24 ταυτόχρονα κουτιά στην εισαγωγή του Giorgio).
 */
function bodyMaterial(mode: BackgroundMode): THREE.MeshStandardMaterial {
  let mat = bodyMaterials.get(mode);
  if (!mat) {
    mat = buildMat({
      color: GHOST_BODY_COLOR[mode],
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: GHOST_OPACITY,
    });
    mat.side = THREE.DoubleSide;
    mat.depthWrite = false;
    bodyMaterials.set(mode, mat);
  }
  return mat;
}

/** Το περίγραμμα του ghost — η «placeholder περίγραμμα» γλώσσα του ArchiCAD Hotlink / C4D proxy. */
function outlineMaterial(mode: BackgroundMode): THREE.LineBasicMaterial {
  let mat = outlineMaterials.get(mode);
  if (!mat) {
    mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(resolveEdgeColorForBackground(mode)),
      transparent: true,
      opacity: 0.7,
    });
    outlineMaterials.set(mode, mat);
  }
  return mat;
}

/**
 * Το «φορτώνει» ghost κουτί, σε ΜΕΤΡΑ (ο caller έχει ήδη εφαρμόσει κλίμακα/μονάδες).
 *
 * Επιστρέφει ένα `THREE.Mesh` με το περίγραμμα ως παιδί. Καμία σκιά (ένα ghost δεν ρίχνει και δεν
 * δέχεται σκιά) και το `userData` κουβαλά το {@link BIM_LOADING_GHOST_FLAG} ώστε το downstream
 * tagging να μην το «διορθώσει» πίσω σε σκιαζόμενο.
 */
export function buildLoadingGhostBox(widthM: number, heightM: number, depthM: number): THREE.Mesh {
  const mode = useBimRenderSettingsStore.getState().backgroundMode;
  const geometry = new THREE.BoxGeometry(widthM, heightM, depthM);
  const ghost = new THREE.Mesh(geometry, bodyMaterial(mode));
  ghost.castShadow = false;
  ghost.receiveShadow = false;
  ghost.userData[BIM_LOADING_GHOST_FLAG] = true;
  ghost.add(buildOutline(geometry, mode));
  return ghost;
}

/**
 * Το περίγραμμα ακμών του ghost. **Μη επιλέξιμο**: το `raycast = () => {}` (three.js idiom) το
 * κρατά έξω από κάθε picking — click-to-select, hover, αλλά και το 3Δ marquee του ADR-692. Ένα
 * βοηθητικό περίγραμμα δεν πρέπει ποτέ να είναι στόχος επιλογής.
 */
function buildOutline(box: THREE.BoxGeometry, mode: BackgroundMode): THREE.LineSegments {
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(box), outlineMaterial(mode));
  outline.raycast = () => {};
  outline.userData[BIM_LOADING_GHOST_FLAG] = true;
  return outline;
}

/**
 * ADR-693 Φ2 — ghost **αποκάλυψης**: ίδια εμφάνιση με το ghost φόρτωσης, αλλά με **δικό του**
 * υλικό ώστε η αδιαφάνειά του να σβήνει ανεξάρτητα (το `mesh-reveal-fade` το μεταλλάσσει και το
 * κάνει dispose). Χωρίς περίγραμμα: στην αποκάλυψη το πραγματικό πλέγμα είναι ήδη ορατό από κάτω
 * και μια γραμμή που σβήνει πάνω του διαβάζεται ως τεχνούργημα.
 *
 * **Μη επιλέξιμο** (`raycast` σβηστό): στόχος επιλογής είναι το πραγματικό πλέγμα, όχι το πέπλο
 * που σβήνει από πάνω του — αλλιώς για ~260ms μετά τη φόρτωση τα κλικ/marquee θα χτυπούσαν ένα
 * αντικείμενο-φάντασμα.
 *
 * Επιστρέφει το mesh ΚΑΙ το υλικό του, ώστε ο καλών να τα δώσει στο `registerRevealGhost` χωρίς
 * casts (το `Mesh.material` είναι union τύπος).
 */
export function buildRevealGhostBox(
  widthM: number,
  heightM: number,
  depthM: number,
): { readonly mesh: THREE.Mesh; readonly material: THREE.MeshStandardMaterial } {
  const mode = useBimRenderSettingsStore.getState().backgroundMode;
  const material = bodyMaterial(mode).clone();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(widthM, heightM, depthM), material);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.userData[BIM_LOADING_GHOST_FLAG] = true;
  mesh.raycast = () => {};
  // Το πέπλο ζωγραφίζεται ΜΕΤΑ το πλέγμα (ημιδιάφανο πάνω από αδιαφανές), αλλιώς το alpha-blend
  // γίνεται με ό,τι υπήρχε πριν στο framebuffer αντί για το ίδιο το μοντέλο.
  mesh.renderOrder = 1;
  return { mesh, material };
}

/** Είναι αυτό το αντικείμενο (ή παιδί ghost) placeholder φόρτωσης; */
export function isLoadingGhost(object: THREE.Object3D): boolean {
  return object.userData[BIM_LOADING_GHOST_FLAG] === true;
}

/**
 * Απελευθέρωση των cached υλικών. Καλείται ΜΟΝΟ σε πλήρη αποσύνδεση της εφαρμογής, από το
 * `disposeMaterialCatalog3D` — ίδια σύμβαση με τα terrain υλικά (ADR-665). Οι γεωμετρίες των ghost
 * ανήκουν στη σκηνή και τις απελευθερώνει ο `ThreeJsSceneManager.dispose`.
 */
export function disposeLoadingPlaceholderMaterials(): void {
  for (const mat of bodyMaterials.values()) mat.dispose();
  bodyMaterials.clear();
  for (const mat of outlineMaterials.values()) mat.dispose();
  outlineMaterials.clear();
}
