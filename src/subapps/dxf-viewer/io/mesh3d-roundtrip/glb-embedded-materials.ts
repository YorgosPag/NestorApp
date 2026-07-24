/**
 * glb-embedded-materials — ADR-691 §4.1/§5: διαβάζει τα **embedded υλικά** ενός `.glb`/`.gltf`
 * απευθείας από τον **container** (binary/JSON), όχι από τα φορτωμένα `THREE.Material`.
 *
 * **Γιατί container και όχι `THREE`:** χρειαζόμαστε τα **αυθεντικά bytes** της υφής baseColor
 * ώστε το SHA-256 content-hash dedup του `importForeignTextures` (ADR-678 Βήμα 3) να είναι
 * **σταθερό cross-session**. Ένα re-encode μέσω `GLTFLoader` → `THREE.Texture` → canvas θα
 * παρήγαγε διαφορετικά bytes σε κάθε browser/session → ασταθές hash → μηδενικό dedup.
 *
 * **Pure module:** μηδέν THREE.js, μηδέν DOM/canvas, μηδέν `atob`/Node `Buffer` — καθαρό
 * binary(GLB)/JSON(glTF) parsing. Γι' αυτό είναι 100% testable σε jest χωρίς browser/three stubs.
 *
 * **Join key (ADR-691 §4.1 #3):** ο επιστρεφόμενος `index` είναι ο δείκτης στο `materials[]` του
 * glTF — **όχι** το όνομα. Τα ξένα υλικά είναι συχνά ανώνυμα (μετρημένο στο ADR-686)· το
 * name-join θα τα έχανε σιωπηλά.
 *
 * **Χρωματικός χώρος:** το glTF `baseColorFactor` είναι **linear**. Το `colorHex` που βλέπει ο
 * χρήστης πρέπει να είναι **sRGB** (ίδια σύμβαση με το `collectGltfMaterials` που καλεί
 * `THREE.Color.getHexString()` — αυτό κάνει ακριβώς linear-working-space → sRGB κάτω από την
 * κουκούλα). Εδώ εφαρμόζεται η ίδια μετάβαση με το χέρι (χωρίς `THREE.Color`) και μετά
 * επαναχρησιμοποιείται το υπάρχον SSoT {@link rgbUnitToHex} για το τελικό hex string (N.18: μηδέν
 * δεύτερη υλοποίηση μετατροπής RGB→hex).
 *
 * @see ./collada-to-glb — ο άλλος καταναλωτής container-επιπέδου (ίδιο πνεύμα: pure, καμία THREE εξάρτηση στο core)
 * @see ../mesh3d-material-import/rgb-unit-hex — SSoT μετατροπής RGB μονάδας → hex
 * @see ./gltf-scene-parse — `collectGltfMaterials` (το ανάλογο μέσω THREE, για render-time χρώματα)
 * @see docs/centralized-systems/reference/adrs/ADR-691-imported-mesh-embedded-material-extraction.md §4.1, §5
 */

import { rgbUnitToHex } from '../mesh3d-material-import/rgb-unit-hex';

/** Μια εικόνα ενσωματωμένη σε glTF/GLB — αυθεντικά bytes + mime, όπως ακριβώς είναι στον container. */
export interface EmbeddedGltfTexture {
  /** Τα αυθεντικά bytes της εικόνας, όπως ακριβώς είναι στον container. */
  readonly bytes: Uint8Array;
  /** π.χ. 'image/png' | 'image/jpeg'. */
  readonly mimeType: string;
  /** Συνθετικό ΣΤΑΘΕΡΟ όνομα αρχείου (ντετερμινιστικό ανά index), π.χ. `gltf-mat-3.png`. */
  readonly fileName: string;
}

/** Ένα υλικό `materials[i]` ενός glTF/GLB, με το χρώμα του ήδη σε sRGB και την υφή του (αν έχει). */
export interface EmbeddedGltfMaterial {
  /** Ο δείκτης στο `materials[]` του glTF — ΤΟ join key όλου του ADR-691. */
  readonly index: number;
  /** `null` όταν το υλικό είναι ανώνυμο (πολύ συχνό σε ξένα μοντέλα). */
  readonly name: string | null;
  /** `#rrggbb` σε **sRGB** (βλ. προσοχή χρωματικού χώρου στο header). */
  readonly colorHex: string;
  /** 0..1 από `baseColorFactor[3]`. Default 1. */
  readonly opacity: number;
  /** 0..1 από `metallicFactor`. **Default κατά glTF spec = 1**. */
  readonly metalness: number;
  /** 0..1 από `roughnessFactor`. **Default κατά glTF spec = 1**. */
  readonly roughness: number;
  /** Η baseColorTexture, ή `null`. */
  readonly albedo: EmbeddedGltfTexture | null;
}

// ============================================================================
// Ελάχιστα τυποποιημένα σχήματα του raw glTF JSON (μόνο ό,τι διαβάζουμε εδώ)
// ============================================================================

interface GltfJsonTextureRef {
  readonly index?: number;
}

interface GltfJsonMaterialPbr {
  readonly baseColorFactor?: readonly number[];
  readonly metallicFactor?: number;
  readonly roughnessFactor?: number;
  readonly baseColorTexture?: GltfJsonTextureRef;
}

interface GltfJsonMaterial {
  readonly name?: string;
  readonly pbrMetallicRoughness?: GltfJsonMaterialPbr;
}

interface GltfJsonTexture {
  readonly source?: number;
}

interface GltfJsonImage {
  readonly uri?: string;
  readonly mimeType?: string;
  readonly bufferView?: number;
}

interface GltfJsonBufferView {
  readonly byteOffset?: number;
  readonly byteLength?: number;
}

interface GltfJsonDocument {
  readonly materials?: readonly GltfJsonMaterial[];
  readonly textures?: readonly GltfJsonTexture[];
  readonly images?: readonly GltfJsonImage[];
  readonly bufferViews?: readonly GltfJsonBufferView[];
}

/** Μια εικόνα ήδη αναλυμένη σε bytes+mime (πριν γίνει `EmbeddedGltfTexture` — λείπει το `fileName`). */
type ResolvedImage = { readonly bytes: Uint8Array; readonly mimeType: string };

// ============================================================================
// GLB binary container (κεφαλίδα 12 bytes + chunks) — spec: glTF 2.0 §Binary
// ============================================================================

const GLB_MAGIC = 0x46546c67; // 'glTF'
const GLB_CHUNK_TYPE_JSON = 0x4e4f534a; // 'JSON'
const GLB_CHUNK_TYPE_BIN = 0x004e4942; // 'BIN\0'
const GLB_HEADER_LENGTH = 12;

/** Σκέτο JSON κείμενο + προαιρετικό BIN chunk, εξαγμένα από ένα `.glb` ArrayBuffer. Little-endian. */
function parseGlbChunks(buffer: ArrayBuffer): { readonly json: string; readonly bin: Uint8Array | null } | null {
  if (buffer.byteLength < GLB_HEADER_LENGTH) return null;
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== GLB_MAGIC) return null;

  const totalLength = view.getUint32(8, true);
  let offset = GLB_HEADER_LENGTH;
  let json: string | null = null;
  let bin: Uint8Array | null = null;

  while (offset + 8 <= buffer.byteLength && offset < totalLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    if (chunkEnd > buffer.byteLength) break;

    if (chunkType === GLB_CHUNK_TYPE_JSON) {
      json = new TextDecoder('utf-8').decode(new Uint8Array(buffer, chunkStart, chunkLength));
    } else if (chunkType === GLB_CHUNK_TYPE_BIN) {
      bin = new Uint8Array(buffer.slice(chunkStart, chunkEnd));
    }
    offset = chunkEnd;
  }

  return json !== null ? { json, bin } : null;
}

/** `.glb` ArrayBuffer → `{doc, bin}`. `null` αν το magic/chunks δεν είναι έγκυρα — ποτέ throw. */
function parseGlbContainer(
  buffer: ArrayBuffer,
): { readonly doc: GltfJsonDocument; readonly bin: Uint8Array | null } | null {
  const chunks = parseGlbChunks(buffer);
  if (!chunks) return null;
  try {
    return { doc: JSON.parse(chunks.json) as GltfJsonDocument, bin: chunks.bin };
  } catch {
    return null;
  }
}

/** `.gltf` JSON κείμενο → `{doc, bin:null}` (χωρίς BIN chunk — οι εικόνες πρέπει να είναι data-URI). */
function parseGltfJsonText(text: string): { readonly doc: GltfJsonDocument; readonly bin: null } | null {
  try {
    return { doc: JSON.parse(text) as GltfJsonDocument, bin: null };
  } catch {
    return null;
  }
}

// ============================================================================
// base64 (χωρίς `atob`/Node `Buffer` — καθαρός decoder, δουλεύει παντού)
// ============================================================================

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** RFC 4648 base64 → bytes. Αγνοεί whitespace/padding· άγνωστοι χαρακτήρες παραλείπονται σιωπηλά. */
function decodeBase64(base64: string): Uint8Array {
  const clean = base64.replace(/\s/g, '').replace(/=+$/, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));

  let byteIndex = 0;
  let buffer = 0;
  let bitsCollected = 0;

  for (let i = 0; i < clean.length; i += 1) {
    const charIndex = BASE64_ALPHABET.indexOf(clean[i]);
    if (charIndex === -1) continue;
    buffer = (buffer << 6) | charIndex;
    bitsCollected += 6;
    if (bitsCollected >= 8) {
      bitsCollected -= 8;
      bytes[byteIndex] = (buffer >> bitsCollected) & 0xff;
      byteIndex += 1;
    }
  }

  return bytes;
}

const DATA_URI_PATTERN = /^data:([^;,]*)(;base64)?,(.*)$/s;

/** `data:<mime>;base64,<payload>` → bytes + mime. `null` αν δεν είναι base64 data-URI (μόνη μορφή που γράφουν οι glTF exporters). */
function parseDataUri(uri: string): { readonly mimeType: string | null; readonly bytes: Uint8Array } | null {
  const match = DATA_URI_PATTERN.exec(uri);
  if (!match) return null;
  const [, mime, isBase64, payload] = match;
  if (!isBase64) return null;
  return { mimeType: mime || null, bytes: decodeBase64(payload) };
}

// ============================================================================
// Εικόνες: bufferView (GLB) ή data-URI (GLB/glTF) → bytes+mime. Εξωτερικό uri → null (καμία λήψη).
// ============================================================================

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

/** Sniff mime από τα magic bytes όταν ο container δεν το δηλώνει ρητά. Fallback: PNG. */
function sniffMimeType(bytes: Uint8Array): string {
  if (PNG_SIGNATURE.every((b, i) => bytes[i] === b)) return 'image/png';
  if (JPEG_SIGNATURE.every((b, i) => bytes[i] === b)) return 'image/jpeg';
  return 'image/png';
}

/** Επέκταση αρχείου από mime, για το συνθετικό `fileName`. */
function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  return 'png';
}

/**
 * Μία εγγραφή `images[i]` → bytes+mime, ή `null` (εξωτερικό αρχείο / λείπει bufferView-BIN /
 * κατεστραμμένη αναφορά). Ποτέ throw — ο καλών βλέπει `albedo: null`, όχι σφάλμα εισαγωγής.
 */
function resolveImageBytes(
  image: GltfJsonImage | undefined,
  bufferViews: readonly GltfJsonBufferView[],
  bin: Uint8Array | null,
): ResolvedImage | null {
  if (!image) return null;

  if (typeof image.uri === 'string') {
    if (!image.uri.startsWith('data:')) return null; // εξωτερικό αρχείο — δεν κατεβάζουμε τίποτα
    const parsed = parseDataUri(image.uri);
    if (!parsed) return null;
    return { bytes: parsed.bytes, mimeType: image.mimeType ?? parsed.mimeType ?? sniffMimeType(parsed.bytes) };
  }

  if (typeof image.bufferView === 'number' && bin) {
    const view = bufferViews[image.bufferView];
    if (!view || typeof view.byteLength !== 'number') return null;
    const start = view.byteOffset ?? 0;
    const bytes = bin.slice(start, start + view.byteLength);
    return { bytes, mimeType: image.mimeType ?? sniffMimeType(bytes) };
  }

  return null;
}

/** `images[]` → πίνακας αναλυμένων bytes/mime (ή `null` ανά θέση), μία διέλευση, ίδια θέση/index. */
function buildImagesTable(doc: GltfJsonDocument, bin: Uint8Array | null): ReadonlyArray<ResolvedImage | null> {
  const bufferViews = doc.bufferViews ?? [];
  return (doc.images ?? []).map((image) => resolveImageBytes(image, bufferViews, bin));
}

// ============================================================================
// Υλικά: linear→sRGB χρώμα + PBR factors + albedo texture
// ============================================================================

/** Standard linear→sRGB transfer function, ανά κανάλι (0..1 → 0..1). */
function linearToSrgbUnit(component: number): number {
  const c = Math.min(1, Math.max(0, component));
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** `baseColorFactor` (linear, glTF default `[1,1,1,1]`) → `#rrggbb` sRGB, μέσω του SSoT {@link rgbUnitToHex}. */
function materialColorHex(baseColorFactor: readonly number[] | undefined): string {
  const [r, g, b] = baseColorFactor ?? [1, 1, 1, 1];
  return rgbUnitToHex([r, g, b].map(linearToSrgbUnit)) ?? '#ffffff';
}

/** `pbrMetallicRoughness.baseColorTexture` → `EmbeddedGltfTexture`, ή `null` αν λείπει οποιοδήποτε κρίκος της αλυσίδας. */
function buildAlbedo(
  materialIndex: number,
  baseColorTexture: GltfJsonTextureRef | undefined,
  doc: GltfJsonDocument,
  images: ReadonlyArray<ResolvedImage | null>,
): EmbeddedGltfTexture | null {
  if (typeof baseColorTexture?.index !== 'number') return null;
  const texture = (doc.textures ?? [])[baseColorTexture.index];
  if (!texture || typeof texture.source !== 'number') return null;
  const image = images[texture.source];
  if (!image) return null;

  return {
    bytes: image.bytes,
    mimeType: image.mimeType,
    fileName: `gltf-mat-${materialIndex}.${extensionForMime(image.mimeType)}`,
  };
}

/** Μία εγγραφή `materials[i]` → `EmbeddedGltfMaterial` πλήρες (χρώμα/PBR/albedo). */
function buildMaterial(
  index: number,
  material: GltfJsonMaterial,
  doc: GltfJsonDocument,
  images: ReadonlyArray<ResolvedImage | null>,
): EmbeddedGltfMaterial {
  const pbr = material.pbrMetallicRoughness ?? {};
  const baseColorFactor = pbr.baseColorFactor;
  const opacity = baseColorFactor && typeof baseColorFactor[3] === 'number' ? baseColorFactor[3] : 1;

  return {
    index,
    name: typeof material.name === 'string' && material.name.length > 0 ? material.name : null,
    colorHex: materialColorHex(baseColorFactor),
    opacity,
    metalness: typeof pbr.metallicFactor === 'number' ? pbr.metallicFactor : 1,
    roughness: typeof pbr.roughnessFactor === 'number' ? pbr.roughnessFactor : 1,
    albedo: buildAlbedo(index, pbr.baseColorTexture, doc, images),
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * `ArrayBuffer` **χωρίς** έγκυρο GLB magic → μπορεί κάλλιστα να είναι `.gltf` **κείμενο διαβασμένο ως
 * bytes**: ο caller κρατά ένα `File` (ADR-683 Φ3β — «τα ίδια bytes που αναλύθηκαν») και δεν ξέρει αν
 * μέσα του είναι binary ή JSON. Χωρίς αυτό το fallback κάθε `.gltf` θα επέστρεφε σιωπηλά μηδέν υλικά.
 * Μη-κείμενα bytes → `JSON.parse` αποτυγχάνει → `null`, δηλαδή η ίδια ασφαλής έξοδος.
 */
function parseAnyContainer(
  data: ArrayBuffer | string,
): { readonly doc: GltfJsonDocument; readonly bin: Uint8Array | null } | null {
  if (typeof data === 'string') return parseGltfJsonText(data);
  return parseGlbContainer(data) ?? parseGltfJsonText(new TextDecoder().decode(data));
}

/**
 * `ArrayBuffer` = `.glb` (binary container) **ή** `.gltf` κείμενο ως bytes · `string` = `.gltf` JSON.
 * ΠΟΤΕ δεν πετά: κατεστραμμένος/άγνωστος container → `[]`.
 */
export function readEmbeddedGltfMaterials(data: ArrayBuffer | string): readonly EmbeddedGltfMaterial[] {
  try {
    const parsed = parseAnyContainer(data);
    if (!parsed) return [];

    const images = buildImagesTable(parsed.doc, parsed.bin);
    return (parsed.doc.materials ?? []).map((material, index) => buildMaterial(index, material, parsed.doc, images));
  } catch {
    return [];
  }
}
