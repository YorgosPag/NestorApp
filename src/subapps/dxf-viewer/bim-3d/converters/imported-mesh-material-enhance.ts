/**
 * imported-mesh-material-enhance — ADR-683 Φ4: αναβαθμίζει τα υλικά ενός ΞΕΝΟΥ εισαγόμενου
 * πλέγματος (`imported-mesh`) στο 3Δ, όταν το partner `.glb` ήρθε με χαμένα υλικά.
 *
 * ## Γιατί υπάρχει (μετρημένο, 2026-07-22)
 *
 * Ο `GLTFLoader` κρατά ΑΚΕΡΑΙΑ ό,τι υλικά έχει το αρχείο — ο Νέστωρ δεν τα πειράζει. Όταν όμως το
 * export (C4D → Blender → glTF) καταρρεύσει τα υλικά σε default (`baseColorFactor 0.8` γκρι,
 * `metallic 0`, `roughness 1`, καμία υφή), το «πιστό» αποτέλεσμα είναι «άσπρο πλαστικό». Αυτός ο
 * enhancer γεφυρώνει το κενό: χαρτογραφεί το **όνομα** υλικού (το μόνο που επιβίωσε) σε PBR preset.
 *
 * ## Belt-and-suspenders gate (Google-level, μη διαπραγματεύσιμο)
 *
 * Το preset εφαρμόζεται ΜΟΝΟ όταν **και τα δύο** ισχύουν:
 *   1. το πηγαίο υλικό μοιάζει **αδιαμόρφωτο-default** ({@link looksUnauthoredDefault}), ΚΑΙ
 *   2. το όνομά του λύνεται σε preset ({@link resolveImportedMaterialPreset}).
 *
 * Έτσι, αν ο συνεργάτης διορθώσει το export και στείλει σωστά PBR/textured υλικά, το gate #1
 * γίνεται `false` και τα καλά υλικά περνούν **ανέγγιχτα**. Το safety-net δεν μάχεται ποτέ ένα καλό
 * αρχείο — ούτε ξαναβάφει authored χρώματα.
 *
 * ## Ιδιοκτησία υλικών (three.js clone SSoT)
 *
 * Ο `bimMeshCache.getInstance` επιστρέφει `template.clone(true)` — ο κλώνος **μοιράζεται** τα
 * materials με το template (το three.js δεν κλωνοποιεί materials). Γι' αυτό **αντικαθιστούμε** το
 * reference με ΝΕΟ material (δεν μεταλλάσσουμε το κοινό) και **δεν κάνουμε dispose** το παλιό (το
 * κατέχει το template). Το νέο material το κατέχει το instance → ασφαλές teardown.
 *
 * @see ../../bim/materials/imported-material-presets — ο pure keyword resolver (SSoT, κοινός με 2Δ)
 * @see ../materials/pbr-material-builder — η ΜΟΝΑΔΙΚΗ MeshStandardMaterial factory (`buildMat`, N.18)
 * @see ./imported-mesh-to-three — ο caller (μετά το `meshToObject3D`)
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §10.6
 */

import * as THREE from 'three';
import { buildMat } from '../materials/pbr-material-builder';
import {
  resolveImportedMaterialPreset,
  type ImportedMaterialPreset,
} from '../../bim/materials/imported-material-presets';
// ADR-686 — user appearance override (χρώμα/υλικό/υφή) πάνω από το embedded/preset υλικό.
import { resolveFaceMaterial } from '../materials/face-appearance-material';
import { slotFaceKey, type FaceAppearanceMap } from '../../bim/types/face-appearance-types';

/** Πάνω από αυτό το metalness το υλικό θεωρείται authored (μη-default) → δεν αγγίζεται. */
const AUTHORED_METALNESS = 0.1;
/** Κάτω από αυτή τη φωτεινότητα (σε linear r) το γκρι θεωρείται authored σκούρο → δεν αγγίζεται. */
const DEFAULT_GRAY_MIN_VALUE = 0.5;
/** Μέγιστη απόκλιση καναλιών για να θεωρηθεί ένα χρώμα «ουδέτερο γκρι». */
const GRAY_CHANNEL_TOLERANCE = 0.04;

/**
 * Μοιάζει το υλικό «αδιαμόρφωτο default» (Blender/glTF export που έχασε το υλικό); True μόνο για
 * **ανοιχτό ουδέτερο γκρι, μη-μεταλλικό, χωρίς υφή** — δηλαδή το κλασικό `[0.8,0.8,0.8]` default.
 * Ό,τι έχει texture, metalness, ή authored (σκούρο/έγχρωμο) χρώμα → `false` (authored, σεβαστό).
 */
function looksUnauthoredDefault(mat: THREE.MeshStandardMaterial): boolean {
  if (mat.map || mat.metalnessMap || mat.roughnessMap || mat.normalMap) return false;
  if (mat.metalness >= AUTHORED_METALNESS) return false;
  const { r, g, b } = mat.color;
  const isNeutralGray =
    Math.abs(r - g) < GRAY_CHANNEL_TOLERANCE && Math.abs(g - b) < GRAY_CHANNEL_TOLERANCE;
  const isLight = r >= DEFAULT_GRAY_MIN_VALUE;
  return isNeutralGray && isLight;
}

/**
 * Χτίζει το preset material μέσω της ΜΟΝΑΔΙΚΗΣ factory (`buildMat`, N.18) και προσαρμόζει τα δύο
 * πεδία που διαφέρουν για ΞΕΝΑ πλέγματα: (α) διατηρεί το `side` της πηγής (τα partner meshes είναι
 * συχνά `DoubleSide` με ασυνεπές winding — το FrontSide του `buildMat` θα άφηνε τρύπες), και (β)
 * απενεργοποιεί το `polygonOffset` (είναι για coplanar BIM overlays, άσχετο με μεμονωμένο mesh).
 */
function buildPresetMaterial(
  preset: ImportedMaterialPreset,
  source: THREE.MeshStandardMaterial,
): THREE.MeshStandardMaterial {
  const mat = buildMat({
    color: preset.color,
    roughness: preset.roughness,
    metalness: preset.metalness,
    transparent: preset.transparent,
    opacity: preset.opacity,
  });
  mat.side = source.side;
  mat.polygonOffset = false;
  mat.name = source.name; // ιχνηλασιμότητα + idempotency (2η διέλευση δεν το ξαναπιάνει)
  return mat;
}

/**
 * Επιστρέφει το αναβαθμισμένο material για ΕΝΑ slot, ή το **ίδιο** αν δεν πληρούνται τα gates.
 * Το όνομα ζει πάνω στο ίδιο το three material (ο `GLTFLoader` το μεταφέρει από το glTF).
 */
function enhanceSlot(material: THREE.Material): THREE.Material {
  if (!(material instanceof THREE.MeshStandardMaterial)) return material;
  if (!looksUnauthoredDefault(material)) return material;
  const preset = resolveImportedMaterialPreset(material.name);
  if (!preset) return material;
  return buildPresetMaterial(preset, material);
}

/**
 * ADR-686 — το υλικό ΕΝΟΣ slot με το **user override** να νικά (Revit/C4D base+override):
 *   1. αν το `faceAppearance` έχει override για αυτό το slot (`slot:${name}`) ή base (`'*'`) →
 *      το επιλυμένο material (χρώμα/flat catalog/textured PBR) μέσω του κοινού `resolveFaceMaterial`
 *      SSoT — ΙΔΙΟ resolver με τα δομικά, μηδέν δεύτερος μηχανισμός βαφής (η απάντηση στο «διπλοτυπία;»)·
 *   2. αλλιώς → ADR-683 preset safety-net (αμετάβλητο).
 *
 * Το override material **κλωνοποιείται** από το κοινό cached singleton για να διατηρήσει το `side`
 * (τα partner meshes είναι συχνά `DoubleSide` με ασυνεπές winding· το FrontSide του shared θα άφηνε
 * τρύπες) + να σβήσει το `polygonOffset` — χωρίς να μολύνει το cached που μοιράζονται τα δομικά.
 */
function resolveSlotMaterial(
  source: THREE.Material,
  faceAppearance: FaceAppearanceMap | undefined,
): THREE.Material {
  if (faceAppearance) {
    const resolved = resolveFaceMaterial(slotFaceKey(source.name), faceAppearance, source);
    if (resolved !== source) {
      const mat = resolved.clone();
      mat.side = source.side;
      if (mat instanceof THREE.MeshStandardMaterial) mat.polygonOffset = false;
      return mat;
    }
  }
  return enhanceSlot(source);
}

/**
 * Χτίζει επί τόπου όλα τα mesh materials ενός εισαγόμενου Object3D με προτεραιότητα: **user override**
 * (ADR-686) → **preset safety-net** (ADR-683) → **embedded**. No-op override σε placeholder κουτί
 * (cache miss). Χειρίζεται single material και material array (multi-slot meshes, π.χ. καρέκλα = 4 slots).
 */
export function applyImportedMeshMaterials(
  object: THREE.Object3D,
  faceAppearance?: FaceAppearanceMap,
): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const material = child.material;
    child.material = Array.isArray(material)
      ? material.map((m) => resolveSlotMaterial(m, faceAppearance))
      : resolveSlotMaterial(material, faceAppearance);
  });
}
