/**
 * collada-to-glb — ADR-690: μετατρέπει `.dae` (COLLADA) σε in-memory `.glb`, **μέσα στον browser**,
 * ώστε το `.dae` να τροφοδοτεί το **υπάρχον** glTF geometry pipeline (ΜΗΔΕΝ διπλότυπο μονοπάτι).
 *
 * **Γιατί μετατροπή και όχι ξεχωριστός COLLADA importer:** ο `ColladaLoader` του three είναι
 * legacy/maintenance· ο `GLTFLoader`/`GLTFExporter` είναι το συνιστώμενο. Είναι και η web πρακτική
 * των μεγάλων (Autodesk Viewer / Speckle / three.js editor τυποποιούν σε glTF στην είσοδο). Έτσι το
 * `parseGltfScene → ImportedMeshImportDialog → importGltfMeshes` (ADR-683 Φ3β) τρέχει **αυτούσιο**.
 *
 * **THREE → `.glb`:** επαναχρησιμοποιεί τον SSoT {@link serialiseGlb} (ADR-668) — δεν ξαναγράφεται ο
 * `GLTFExporter`. Ο `serialiseGlb` γράφει `embedImages:true`, άρα οι υφές **ενσωματώνονται** στο glb.
 *
 * **Η παγίδα των υφών (ADR-690 §4):** το `.dae` αναφέρει υφές ως σκέτα ονόματα loose αρχείων
 * (`HMI_3D01.jpg`). Ο browser δεν διαβάζει `F:\`. Ο χρήστης επιλέγει τα `.jpg` **μαζί** με το `.dae`,
 * και το `LoadingManager.setURLModifier` χαρτογραφεί `filename → URL.createObjectURL(file)` ώστε ο
 * `ColladaLoader` να τα βρίσκει. Υφές που δεν δόθηκαν → επιστρέφονται στο `missingTextures` (actionable
 * warning, Revit «missing assets»), ποτέ σιωπηλό crash.
 *
 * @see ../../export/core/mesh3d/mesh3d-serialise — serialiseGlb (SSoT THREE→glb)
 * @see ./gltf-scene-parse — parseGltfScene (ο in-memory .glb μπαίνει εκεί)
 * @see docs/centralized-systems/reference/adrs/ADR-690-native-dae-collada-geometry-import.md
 */

import * as THREE from 'three';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { serialiseGlb } from '../../export/core/mesh3d/mesh3d-serialise';

/** Το τελευταίο τμήμα μετά από `/` ή `\`, πεζά — για case-insensitive αντιστοίχιση ονόματος αρχείου. */
export function textureBasename(url: string): string {
  const match = /[^/\\]+$/.exec(url);
  return (match ? match[0] : url).toLowerCase();
}

/** `basename (πεζά) → File` από τα αρχεία εικόνων που επέλεξε ο χρήστης δίπλα στο `.dae`. */
export function indexImagesByBasename(files: readonly File[]): Map<string, File> {
  const byName = new Map<string, File>();
  for (const file of files) byName.set(textureBasename(file.name), file);
  return byName;
}

export interface ColladaToGlbResult {
  /** Αυτάρκες glb (υφές ενσωματωμένες) — έτοιμο για `parseGltfScene` + upload. */
  readonly glb: ArrayBuffer;
  /** Ονόματα υφών που το `.dae` αναφέρει αλλά ο χρήστης δεν επέλεξε (basename, πεζά). */
  readonly missingTextures: readonly string[];
}

/**
 * Μια υφή είναι «σπασμένη» όταν η εικόνα της απέτυχε να φορτώσει (η υφή που ο χρήστης δεν έδωσε →
 * 404). `HTMLImageElement` σε broken state έχει `naturalWidth === 0`.
 */
function isBrokenTexture(texture: THREE.Texture): boolean {
  const image = texture.image as { width?: number; naturalWidth?: number } | null | undefined;
  if (!image) return true;
  return (image.naturalWidth ?? image.width ?? 0) === 0;
}

/**
 * **Κρίσιμο (ADR-690 §4):** αφαιρεί από κάθε υλικό τους texture slots των οποίων η εικόνα απέτυχε να
 * φορτώσει. Χωρίς αυτό, ο `GLTFExporter` (`embedImages:true`) καλεί `ctx.drawImage(brokenImage)` →
 * `InvalidStateError` → η **ολόκληρη** μετατροπή σκάει και η γεωμετρία χάνεται. Με αυτό, η υφή που
 * λείπει απλώς παραλείπεται (missing warning), αλλά **το mesh μπαίνει** — Revit «missing assets».
 *
 * Generic διάσχιση όλων των texture properties (`instanceof THREE.Texture`) ώστε να πιάνει κάθε slot
 * (`map`/`specularMap`/`normalMap`/`bumpMap`/…) που μπορεί να βάλει ο `ColladaLoader`, χωρίς λίστα.
 */
function stripBrokenTextures(root: THREE.Object3D): void {
  const seen = new Set<THREE.Material>();
  root.traverse((object) => {
    const material = (object as THREE.Mesh).material;
    if (!material) return;
    for (const single of Array.isArray(material) ? material : [material]) {
      if (seen.has(single)) continue;
      seen.add(single);
      const slots = single as unknown as Record<string, unknown>;
      let changed = false;
      for (const key of Object.keys(slots)) {
        const value = slots[key];
        if (value instanceof THREE.Texture && isBrokenTexture(value)) {
          value.dispose();
          slots[key] = null;
          changed = true;
        }
      }
      if (changed) single.needsUpdate = true;
    }
  });
}

/**
 * Χτίζει `LoadingManager` που λύνει κάθε αίτημα υφής προς το αντίστοιχο επιλεγμένο αρχείο (object URL).
 * Ό,τι δεν βρεθεί καταγράφεται στο `missing` και αφήνεται ως έχει (θα αποτύχει «καθαρά»: ο loader
 * χειρίζεται το σφάλμα, το mesh μπαίνει χωρίς αυτή την υφή). Data URIs περνούν ανέγγιχτα.
 */
function buildTextureManager(
  imagesByName: ReadonlyMap<string, File>,
  createdUrls: string[],
  missing: Set<string>,
): THREE.LoadingManager {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    if (url.startsWith('data:')) return url;
    const key = textureBasename(url);
    const file = imagesByName.get(key);
    if (!file) {
      missing.add(key);
      return url;
    }
    const objectUrl = URL.createObjectURL(file);
    createdUrls.push(objectUrl);
    return objectUrl;
  });
  return manager;
}

/**
 * Μετατρέπει το κείμενο ενός `.dae` σε `.glb` (ArrayBuffer). Οι υφές φορτώνονται από τα `imageFiles`
 * του χρήστη μέσω `setURLModifier` και ενσωματώνονται στο glb από τον `serialiseGlb`.
 *
 * Ο `ColladaLoader.parse` είναι σύγχρονος αλλά **ουρά** τα texture loads στον manager· περιμένουμε το
 * `onLoad` πριν τη σειριοποίηση, ώστε ο `GLTFExporter` να δει πλήρως φορτωμένες εικόνες (αλλιώς
 * ενσωματώνει κενές). Χωρίς καμία υφή (`onStart` δεν πυροδοτήθηκε) → σειριοποιούμε αμέσως.
 */
export async function colladaToGlb(
  daeText: string,
  imageFiles: readonly File[],
): Promise<ColladaToGlbResult> {
  const imagesByName = indexImagesByBasename(imageFiles);
  const createdUrls: string[] = [];
  const missing = new Set<string>();
  const manager = buildTextureManager(imagesByName, createdUrls, missing);

  let texturesQueued = false;
  manager.onStart = () => { texturesQueued = true; };

  const loader = new ColladaLoader(manager);
  // `path = ''` — τα ονόματα υφών λύνονται ως σκέτα basenames μέσω του setURLModifier, όχι από φάκελο.
  const collada = loader.parse(daeText, '');

  if (texturesQueued) {
    await new Promise<void>((resolve) => { manager.onLoad = () => resolve(); });
  }

  try {
    // ADR-690 §4 — υφές που δεν φορτώθηκαν (ο χρήστης δεν τις έδωσε) αφαιρούνται ΠΡΙΝ τη σειριοποίηση,
    // αλλιώς ο GLTFExporter σκάει σε broken image και χάνεται όλη η γεωμετρία.
    stripBrokenTextures(collada.scene);
    const glb = await serialiseGlb(collada.scene);
    return { glb, missingTextures: [...missing] };
  } finally {
    for (const objectUrl of createdUrls) URL.revokeObjectURL(objectUrl);
  }
}
