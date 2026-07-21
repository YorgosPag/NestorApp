/**
 * dae-material-parse — ADR-678 Φ4. Καθαρός (pure, testable) COLLADA 1.4.1 (`.dae`) parser για το
 * round-trip C4D → Νέστωρ, **ανά όψη**.
 *
 * Είναι το αντίστοιχο του `obj-mtl-parse` (OBJ) και του `gltf-scene-parse` (glTF): παράγει **ακριβώς
 * το ίδιο σχήμα** (`ObjectMaterialAssignment[]` + `Map<name, ImportedMaterial>`) ώστε ο κοινός
 * πυρήνας `applyImportedAppearance` (match → resolve → SetFaceAppearanceCommand) να τρέξει
 * **αυτούσιος** — μηδέν δεύτερο μονοπάτι ανά format (N.18).
 *
 * Δεν φορτώνουμε γεωμετρία (three): για βάψιμο ανά όψη χρειαζόμαστε μόνο «ποιο node → ποιο υλικό ανά
 * όψη → ποιο χρώμα». Άρα ελαφρύ XML parsing (native `DOMParser` μέσω `@/lib/xml/xml-dom`), μηδέν
 * dependency.
 *
 * **Per-face (`faceMaterials`):** ο ΔΙΚΟΣ ΜΑΣ writer γράφει ένα `<triangles material="sym_i">` +
 * `<instance_material symbol="sym_i" target="#material_j">` ανά όψη, και (ADR-678 Φ4) τα ίδια τα
 * faceKeys σε `<extra><technique profile="NESTOR"><face_keys>`. Ζιπάρουμε `sym_i → faceKey_i` (το
 * `i` διαβάζεται από το `sym_i`, ΟΧΙ από τη θέση).
 *
 * **Ξένος (C4D-originated) `.dae` → per-object dominant.** Ground-truth (C4D R15.037, 2026-07-21): ο
 * native COLLADA exporter του C4D **δεν** διατηρεί ούτε το `<extra profile="NESTOR">` ούτε τα δικά μας
 * symbols (γράφει `symbol="Material1"` για όλα) — και **ενώνει** τα per-face groups σε ΕΝΑ `<triangles>`
 * ανά geometry. Άρα η ανά-όψη ταυτότητα χάνεται· μένει το ανά-στοιχείο υλικό. Ο parser διαβάζει τα
 * bindings **ανεξάρτητα από τη μορφή του symbol** (dominant = πρώτο ονομασμένο) και κάνει per-face ΜΟΝΟ
 * όταν υπάρχουν ΚΑΙ faceKeys (`<extra>`) ΚΑΙ `sym_i` indices. Node χωρίς `<extra>` → dominant, όπως OBJ.
 *
 * @see ./obj-mtl-parse — το αντίστοιχο για OBJ (ίδιο συμβόλαιο εξόδου)
 * @see ../../export/core/mesh3d/mesh3d-collada-geometry — η write-side (η δομή που καθρεφτίζουμε)
 * @see docs/centralized-systems/reference/adrs/ADR-678-c4d-obj-material-roundtrip-import.md
 */

import { parseXml, directChildren, firstChild } from '@/lib/xml/xml-dom';
import type { ObjectMaterialAssignment, ImportedMaterial } from './obj-mtl-parse';
import { rgbUnitToHex } from './rgb-unit-hex';
import { clamp01 } from '../../utils/scalar-math';

/** COLLADA `<extra>` technique profile των δικών μας metadata (mirror του write-side σταθεράς). */
const NESTOR_EXTRA_PROFILE = 'NESTOR';

/** Ό,τι χρειάζεται ο pipeline του ADR-678 από ένα επιστρεφόμενο `.dae`. */
export interface ColladaSceneImport {
  readonly objects: readonly ObjectMaterialAssignment[];
  /** Ισοδύναμο του `parseMtl` — όνομα υλικού → χρώμα/διαφάνεια (μόνο flat-color υλικά). */
  readonly materials: ReadonlyMap<string, ImportedMaterial>;
  /**
   * ADR-678 Βήμα 3 — `όνομα υλικού → filename (basename) της diffuse υφής` από το
   * `<library_images>`. Μόνο για textured effects (ξένη υφή που έβαλε ο συνεργάτης στο
   * C4D). Ο UI pre-pass ταιριάζει το filename με ένα εικόνα-`File` του `FileList`,
   * ανεβάζει, φτιάχνει νέο `bmat_*`, και βάφει την όψη μ' αυτό. Το κλειδί είναι το ΙΔΙΟ
   * `name` που δένει ο κόμβος (post-collision `<name>#<id>`).
   */
  readonly texturesByMaterialName: ReadonlyMap<string, string>;
}

/** Η εμφάνιση ενός `<effect>`: flat χρώμα (ή `null` για textured) + διαφάνεια. */
interface EffectAppearance {
  readonly colorHex: string | null;
  readonly opacity: number;
}

/** Opacity σε 0..1· μη-πεπερασμένο → 1 (αδιαφανές). Delegate στο SSoT `clamp01` (ADR-071). */
function opacityOrOpaque(n: number): number {
  return Number.isFinite(n) ? clamp01(n) : 1;
}

/** Πρώτος απόγονος (οποιοδήποτε βάθος) με δοσμένο tag, ή `null`. */
function firstDescendant(el: Element, tag: string): Element | null {
  return el.getElementsByTagName(tag)[0] ?? null;
}

/** Το `#id` reference ενός attribute (χωρίς το `#`), ή `null`. */
function refId(el: Element | null, attr: string): string | null {
  const raw = el?.getAttribute(attr);
  return raw ? raw.replace(/^#/, '') : null;
}

/**
 * Η εμφάνιση ενός `<effect>`: το flat `<diffuse><color>` (sRGB 0..1, direct child του diffuse ώστε να
 * ΜΗΝ μπερδευτεί με το `<transparent><color>`) + το `<transparency><float>` opacity. Textured effect
 * (`<diffuse><texture>`, χωρίς `<color>`) → `colorHex: null`.
 */
function effectAppearance(effect: Element): EffectAppearance {
  const diffuse = firstDescendant(effect, 'diffuse');
  const colorEl = diffuse ? firstChild(diffuse, 'color') : null;
  const colorHex = colorEl?.textContent
    ? rgbUnitToHex(colorEl.textContent.trim().split(/\s+/))
    : null;
  const floatEl = firstDescendant(effect, 'transparency');
  const floatText = floatEl ? firstChild(floatEl, 'float')?.textContent : null;
  const opacity = floatText ? opacityOrOpaque(Number(floatText)) : 1;
  return { colorHex, opacity };
}

/** `effectId → EffectAppearance` από το `<library_effects>`. */
function parseEffects(root: Element): Map<string, EffectAppearance> {
  const out = new Map<string, EffectAppearance>();
  const lib = firstDescendant(root, 'library_effects');
  if (!lib) return out;
  for (const effect of directChildren(lib, 'effect')) {
    const id = effect.getAttribute('id');
    if (id) out.set(id, effectAppearance(effect));
  }
  return out;
}

/**
 * Το τελευταίο segment ενός URI/path (basename)· **decode** (COLLADA `<init_from>` = percent-encoded
 * URI ανά RFC 3986· ο C4D γράφει π.χ. `my%20wood.png`, ελληνικά ως `%CE%BE…`) → καθαρισμός `file://`
 * prefix + backslashes. Χωρίς decode, το ελληνικό/με-κενό filename δεν ταιριάζει με το OS-decoded
 * `File.name` → σιωπηλά αβαφή όψη. Malformed encoding → raw (guarded).
 */
function baseName(uri: string): string {
  let decoded = uri;
  try { decoded = decodeURIComponent(uri); } catch { /* malformed % → κράτα το raw */ }
  const clean = decoded.replace(/^file:\/+/i, '').replace(/\\/g, '/');
  const parts = clean.split('/');
  return parts[parts.length - 1] || uri;
}

/** `imageId → filename (basename)` από το `<library_images>` (COLLADA 1.4.1 `<init_from>` = URI). */
function parseImages(root: Element): Map<string, string> {
  const out = new Map<string, string>();
  const lib = firstDescendant(root, 'library_images');
  if (!lib) return out;
  for (const image of directChildren(lib, 'image')) {
    const id = image.getAttribute('id');
    const initFrom = firstDescendant(image, 'init_from')?.textContent?.trim();
    if (id && initFrom) out.set(id, baseName(initFrom));
  }
  return out;
}

/**
 * Το filename της diffuse υφής ενός `<effect>` (ή `null` αν flat). Ακολουθεί την τυπική COLLADA
 * 1.4.1 αλυσίδα `diffuse<texture[@texture=samplerSid]>` → `newparam[@sid=samplerSid]/sampler2D/
 * source=surfaceSid` → `newparam[@sid=surfaceSid]/surface/init_from=imageId` → `<image>` filename.
 *
 * **Ανθεκτικό σε παραλλαγές exporter (C4D R15 vs δικός μας writer):** (α) αν το `texture` δείχνει
 * κατευθείαν στο surface· (β) αν σπάσει η αλυσίδα, πέφτει στο μοναδικό surface→image του effect·
 * (γ) αν το init_from κρατά URI αντί για image id· (δ) αν υπάρχει texture μα μία μόνο εικόνα στο
 * αρχείο. Ground-truth C4D R15 θα κουρδίσει τυχόν επιπλέον παραλλαγή (ADR-678 §Βήμα 3).
 */
function effectTextureFileName(effect: Element, imagesById: ReadonlyMap<string, string>): string | null {
  const samplerToSurface = new Map<string, string>();
  const surfaceToImage = new Map<string, string>();
  for (const np of Array.from(effect.getElementsByTagName('newparam'))) {
    const sid = np.getAttribute('sid');
    if (!sid) continue;
    const sampler = firstDescendant(np, 'sampler2D');
    const source = sampler ? firstChild(sampler, 'source')?.textContent?.trim() : null;
    if (source) samplerToSurface.set(sid, source);
    const surface = firstDescendant(np, 'surface');
    const img = surface ? firstChild(surface, 'init_from')?.textContent?.trim() : null;
    if (img) surfaceToImage.set(sid, img);
  }

  const diffuse = firstDescendant(effect, 'diffuse');
  const textureEl = diffuse ? firstChild(diffuse, 'texture') : null;
  // ΜΟΝΟ diffuse-textured effects μετράνε. Χωρίς `<diffuse><texture>` (flat χρώμα, ή texture μόνο σε
  // bump/normal/specular channel — συχνό σε C4D υλικά) → flat: μην αρπάξεις κατά λάθος το bump image.
  if (!textureEl) return null;
  const samplerSid = textureEl.getAttribute('texture');

  let imageRef: string | null = null;
  if (samplerSid) {
    const surfaceSid = samplerToSurface.get(samplerSid) ?? samplerSid;
    imageRef = surfaceToImage.get(surfaceSid) ?? surfaceToImage.get(samplerSid) ?? null;
  }
  imageRef ??= [...surfaceToImage.values()][0] ?? null;

  if (imageRef && imagesById.has(imageRef)) return imagesById.get(imageRef) ?? null;
  if (imageRef) return baseName(imageRef);
  if (imagesById.size === 1) return [...imagesById.values()][0] ?? null;
  return null;
}

/** `effectId → filename υφής` για textured effects (surface→sampler→image chain). */
function parseEffectTextures(root: Element): Map<string, string> {
  const out = new Map<string, string>();
  const images = parseImages(root);
  const lib = firstDescendant(root, 'library_effects');
  if (!lib || images.size === 0) return out;
  for (const effect of directChildren(lib, 'effect')) {
    const id = effect.getAttribute('id');
    if (!id) continue;
    const fileName = effectTextureFileName(effect, images);
    if (fileName) out.set(id, fileName);
  }
  return out;
}

/** `materialId → όνομα υλικού` + flat χρώματα + `όνομα → filename υφής` (textured). */
function parseMaterials(root: Element): {
  nameById: Map<string, string>;
  materials: Map<string, ImportedMaterial>;
  texturesByName: Map<string, string>;
} {
  const effects = parseEffects(root);
  const effectTextures = parseEffectTextures(root);
  const nameById = new Map<string, string>();
  const materials = new Map<string, ImportedMaterial>();
  const texturesByName = new Map<string, string>();
  const lib = firstDescendant(root, 'library_materials');
  if (!lib) return { nameById, materials, texturesByName };
  for (const mat of directChildren(lib, 'material')) {
    const id = mat.getAttribute('id');
    const rawName = mat.getAttribute('name');
    if (!id || !rawName) continue;
    const effectUrl = refId(firstChild(mat, 'instance_effect'), 'url') ?? '';
    const appearance = effects.get(effectUrl);
    // Duplicate COLLADA material NAMES είναι νόμιμα (ground-truth C4D R15: γράφει πολλά "Mat"). Το
    // binding γίνεται by **ID** (μοναδικό), όχι by name. Αν δύο ids μοιράζονται όνομα ΑΛΛΑ κουβαλούν
    // ΔΙΑΦΟΡΕΤΙΚΟ flat χρώμα (π.χ. γκρι "Mat" + ροζ "Mat"), το δεύτερο θα κρυβόταν πίσω από το πρώτο
    // στον name-keyed πίνακα → κατέβαινε ΛΑΘΟΣ χρώμα. Κάνουμε το όνομα μοναδικό (`<name>#<id>`) ΜΟΝΟ
    // στη σύγκρουση, ώστε ο κόμβος (δένει by id) να πάρει το ΔΙΚΟ του χρώμα. Ίδιο χρώμα/όνομα → κοινό
    // όνομα (τα Nestor `bmat_*`/`mat-*` που dedup-άρουν νόμιμα δεν χαλάνε το name-based matching).
    const textureFile = effectTextures.get(effectUrl);
    const existingFlat = materials.get(rawName);
    const existingTex = texturesByName.get(rawName);
    // Collision (→ rename `${rawName}#${id}`) όταν το ΙΔΙΟ όνομα ξαναχρησιμοποιείται με ΔΙΑΦΟΡΕΤΙΚΗ
    // ταυτότητα (C4D R15 γράφει πολλά "Mat"). Το binding γίνεται by **id** (μοναδικό), οπότε
    // κάνουμε το όνομα μοναδικό ΜΟΝΟ στη σύγκρουση ώστε ο κόμβος να πάρει το ΔΙΚΟ του χρώμα/υφή:
    //  • flat vs flat με άλλο χρώμα· • textured vs textured με άλλη υφή· • ανάμιξη flat↔textured
    //    (αλλιώς το ίδιο όνομα θα έδενε ΚΑΙ flat χρώμα ΚΑΙ υφή → cross-contamination στον resolver).
    // ⚠️ `appearance?.colorHex != null` (nullish): textured effect έχει `colorHex === null` — το παλιό
    // `!== undefined` περνούσε (`null !== undefined`) και έσκαγε σε `null.toLowerCase()`.
    const flatCollides = existingFlat !== undefined && appearance?.colorHex != null
      && existingFlat.colorHex.toLowerCase() !== appearance.colorHex.toLowerCase();
    const texCollides = existingTex !== undefined && textureFile !== undefined
      && existingTex.toLowerCase() !== textureFile.toLowerCase();
    const mixedCollides = (textureFile !== undefined && existingTex === undefined && existingFlat !== undefined)
      || (appearance?.colorHex != null && existingFlat === undefined && existingTex !== undefined);
    const name = (flatCollides || texCollides || mixedCollides) ? `${rawName}#${id}` : rawName;
    nameById.set(id, name);
    // Μόνο flat-color υλικά μπαίνουν στον πίνακα· textured ταξιδεύουν με το όνομα (name-based resolve).
    if (appearance?.colorHex && !materials.has(name)) {
      materials.set(name, { name, colorHex: appearance.colorHex, opacity: appearance.opacity });
    }
    // ADR-678 Βήμα 3 — textured effect: κρατάμε `όνομα → filename υφής` (ίδιο `name` που δένει ο κόμβος).
    if (textureFile && !texturesByName.has(name)) texturesByName.set(name, textureFile);
  }
  return { nameById, materials, texturesByName };
}

/** `sym_5` → `5`· οτιδήποτε άλλο (π.χ. το `Material1` του C4D) → `null`. */
function symbolIndex(symbol: string | null): number | null {
  const m = symbol ? /^sym_(\d+)$/.exec(symbol) : null;
  return m ? Number(m[1]) : null;
}

/** Τα υλικά ενός node: κατά `sym_i` index (per-face) + κατά σειρά εμφάνισης (per-object dominant). */
interface NodeBindings {
  /** `sym_i → όνομα υλικού` — μόνο για bindings με `sym_<index>` symbol (δικός μας writer). */
  readonly bySymbolIndex: Map<number, string | null>;
  /** Ονόματα υλικών στη σειρά εμφάνισης — για dominant (δουλεύει και για ξένο symbol, π.χ. C4D). */
  readonly ordered: (string | null)[];
}

/** Τα `<instance_material>` ενός node (μέσω `bind_material`) → per-face index + ordered list. */
function nodeBindings(node: Element, nameById: ReadonlyMap<string, string>): NodeBindings {
  const bySymbolIndex = new Map<number, string | null>();
  const ordered: (string | null)[] = [];
  const techCommon = firstDescendant(node, 'technique_common');
  if (!techCommon) return { bySymbolIndex, ordered };
  for (const im of directChildren(techCommon, 'instance_material')) {
    const target = refId(im, 'target');
    const name = target ? nameById.get(target) ?? null : null;
    ordered.push(name);
    const idx = symbolIndex(im.getAttribute('symbol'));
    if (idx !== null) bySymbolIndex.set(idx, name);
  }
  return { bySymbolIndex, ordered };
}

/** Τα faceKeys ενός node από το `<extra><technique profile="NESTOR"><face_keys>`, ή `null`. */
function nodeFaceKeys(node: Element): readonly string[] | null {
  for (const extra of directChildren(node, 'extra')) {
    for (const tech of directChildren(extra, 'technique')) {
      if (tech.getAttribute('profile') !== NESTOR_EXTRA_PROFILE) continue;
      const faceKeysEl = firstChild(tech, 'face_keys');
      if (!faceKeysEl) continue;
      const keys = directChildren(faceKeysEl, 'k').map((k) => k.textContent?.trim() ?? '');
      if (keys.length > 0) return keys;
    }
  }
  return null;
}

/** Το κυρίαρχο (πρώτο ονομασμένο) υλικό ενός node. */
function firstNamed(names: readonly (string | null)[]): string | null {
  return names.find((n) => n !== null) ?? null;
}

/**
 * Ένα `<node>` → assignment. Per-face (`faceMaterials`) ΜΟΝΟ όταν υπάρχουν ΚΑΙ `<extra>` faceKeys ΚΑΙ
 * `sym_i` bindings (δικός μας `.dae`)· αλλιώς dominant per-object (ξένος/C4D `.dae`, όπως OBJ).
 */
function parseNode(node: Element, nameById: ReadonlyMap<string, string>): ObjectMaterialAssignment {
  const objectName = node.getAttribute('name') ?? '';
  const { bySymbolIndex, ordered } = nodeBindings(node, nameById);
  const materialName = firstNamed(ordered);
  const faceKeys = nodeFaceKeys(node);
  if (faceKeys === null || bySymbolIndex.size === 0) return { objectName, materialName };

  const faceMaterials = new Map<string, string | null>();
  faceKeys.forEach((fk, i) => faceMaterials.set(fk, bySymbolIndex.get(i) ?? null));
  return { objectName, materialName, faceMaterials };
}

/**
 * Περνά το `.dae` κείμενο → objects (ταυτότητα + υλικό ανά όψη) + πίνακας flat χρωμάτων. Ρίχνει αν
 * το XML δεν είναι έγκυρο ή δεν είναι COLLADA (`parseXml` με expectedRoot).
 */
export function parseColladaScene(daeText: string): ColladaSceneImport {
  const root = parseXml(daeText, 'COLLADA');
  const { nameById, materials, texturesByName } = parseMaterials(root);
  const objects: ObjectMaterialAssignment[] = [];
  const scenes = firstDescendant(root, 'library_visual_scenes');
  if (scenes) {
    for (const vs of directChildren(scenes, 'visual_scene')) {
      for (const node of directChildren(vs, 'node')) {
        objects.push(parseNode(node, nameById));
      }
    }
  }
  return { objects, materials, texturesByMaterialName: texturesByName };
}
