/**
 * import-foreign-textures — ADR-678 Βήμα 3. Ο async **pre-pass** που, από τις ξένες υφές ενός
 * επιστρεφόμενου `.dae` (C4D `<library_images>`), δημιουργεί νέα `bmat_*` υλικά στη βιβλιοθήκη και
 * επιστρέφει `όνομα υλικού C4D → νέο bmat_*`. Ο caller επαυξάνει μ' αυτό τον resolver
 * ({@link withImportedMaterials}) και ο sync πυρήνας βάφει τις όψεις — μηδέν αλλαγή στον core.
 *
 * **Πρακτική μεγάλων (Maxon «Save Project with Assets» / Revit appearance-asset link):** ο
 * συνεργάτης στέλνει το `.dae` **μαζί με τα αρχεία εικόνων**· εδώ τα ταιριάζουμε (by basename),
 * ανεβάζουμε το albedo, και φτιάχνουμε ένα υλικό ανά μοναδική υφή.
 *
 * **Content-hash dedup (εντολή Giorgio):** η ίδια φωτογραφία-υφή που ξαναέρχεται (ίδια bytes) →
 * ίδιο SHA-256 → reuse του υπάρχοντος υλικού, ποτέ διπλότυπο — και **cross-session** (ελέγχει το
 * `pbrTextures.albedoHash` όλων των live υλικών) **και within-import** (ίδιο hash σε πολλά effects
 * → ΕΝΑ υλικό).
 *
 * **Dependency injection (καθαρό io layer, testable):** ο `save`/`update`/`uploadAlbedo`/`hashFile`
 * περνούν έξωθεν — αυτό το module δεν ξέρει από Firebase/React. Ο button τα καλωδιώνει με τα SSoT
 * (`MaterialLibraryService`, `uploadMaterialTextureMap`, `sha256HexOfFile`).
 *
 * @see ./texture-content-hash — sha256HexOfFile (dedup key)
 * @see ../../bim/services/MaterialLibraryService — saveMaterial/updateMaterial (νέο bmat_*)
 * @see ../../bim/services/bim-material-texture-upload.service — uploadMaterialTextureMap (albedo)
 * @see ./known-import-materials — withImportedMaterials (επαύξηση resolver)
 * @see docs/centralized-systems/reference/adrs/ADR-678-c4d-obj-material-roundtrip-import.md §Βήμα 3
 */

import { transliterateGreekToLatin, toGreekTitleCase } from '@/utils/greek-text';
import type {
  BimMaterial,
  SaveBimMaterialInput,
  UpdateBimMaterialPatch,
} from '../../bim/types/bim-material-types';

/**
 * Generic best-fit ΑΤΟΕ για αυτόματα υλικά υφής (επιφανειακή επίστρωση/χρωματισμός). Ο χρήστης το
 * διορθώνει στο material editor αν το υλικό αφορά κοστολόγηση — η κατηγορία μπαίνει ρητά ως 'other'.
 */
const IMPORTED_TEXTURE_ATOE_CATEGORY = 'OIK-77.01';

/** Οι εξαρτήσεις (injected) που χρειάζεται ο pre-pass — μηδέν άμεση εξάρτηση σε Firebase/React. */
export interface ForeignTextureImporterDeps {
  readonly existingMaterials: readonly BimMaterial[];
  readonly saveMaterial: (input: SaveBimMaterialInput) => Promise<BimMaterial>;
  readonly updateMaterial: (id: string, patch: UpdateBimMaterialPatch) => Promise<void>;
  /** Ανεβάζει το albedo της υφής για το νέο υλικό· επιστρέφει το download URL. */
  readonly uploadAlbedo: (file: File, materialId: string) => Promise<string>;
  /** Σταθερή ταυτότητα περιεχομένου (SHA-256 hex) των bytes της εικόνας. */
  readonly hashFile: (file: Blob) => Promise<string>;
  /** Rollback ενός μισο-δημιουργημένου υλικού όταν αποτύχει το upload/update (μηδέν orphan). */
  readonly deleteMaterial: (id: string) => Promise<void>;
}

/**
 * Το τελευταίο segment ενός path (basename). **Decode** (percent-encoded παραλλαγή) ώστε το parsed
 * filename να ταιριάζει με το OS-decoded `File.name` (κρίσιμο για ελληνικά/με-κενό ονόματα — ο C4D
 * γράφει π.χ. `file:///F:/…/Ξερό-bark-21.jpg` με `%20` κενά). Malformed % → raw (guarded).
 */
function baseNameDecoded(name: string): string {
  let decoded = name;
  try { decoded = decodeURIComponent(name); } catch { /* malformed % → raw */ }
  const parts = decoded.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || name;
}

/** Ίδιο basename, lowercase — για case-insensitive ταίριασμα filename↔File. */
function baseNameLower(name: string): string {
  return baseNameDecoded(name).toLowerCase();
}

/** `basename(lower) → File` από την επιλογή του χρήστη (τελευταίο κερδίζει σε διπλό basename). */
function indexImagesByName(imageFiles: readonly File[]): Map<string, File> {
  const out = new Map<string, File>();
  for (const f of imageFiles) out.set(baseNameLower(f.name), f);
  return out;
}

/** Ανθρώπινο αγγλικό όνομα από ελληνικό (transliteration SSoT)· fallback στο πρωτότυπο. */
function toNameEn(name: string): string {
  const latin = toGreekTitleCase(transliterateGreekToLatin(name)).trim();
  return latin || name;
}

/**
 * Δημιουργεί ΕΝΑ company-scope υλικό υφής: save → upload albedo → update(pbrTextures+hash).
 *
 * **Rollback (μηδέν orphan):** αν αποτύχει το upload/update ΜΕΤΑ το save, το `bmat_*` doc μένει
 * χωρίς `pbrTextures.albedoHash` → **αόρατο στο content-hash dedup** → επόμενο import ίδιας υφής
 * φτιάχνει διπλότυπο για πάντα. Οπότε σβήνουμε το μισο-δημιουργημένο doc και ρίχνουμε ώστε ο loop να
 * το προσπεράσει (η όψη κρατά ό,τι είχε — graceful degradation, όπως το texture bundle).
 */
async function createTextureMaterial(
  materialName: string,
  file: File,
  albedoHash: string,
  deps: ForeignTextureImporterDeps,
): Promise<string> {
  const saved = await deps.saveMaterial({
    scope: 'company',
    nameEl: materialName,
    nameEn: toNameEn(materialName),
    category: 'other',
    atoeCategory: IMPORTED_TEXTURE_ATOE_CATEGORY,
    defaultUnit: 'm2',
  });
  try {
    const albedoUrl = await deps.uploadAlbedo(file, saved.id);
    await deps.updateMaterial(saved.id, {
      pbrTextures: { albedoUrl, normalUrl: null, roughnessUrl: null, aoUrl: null, tileSizeM: 1, albedoHash },
    });
    return saved.id;
  } catch (err) {
    await deps.deleteMaterial(saved.id).catch(() => { /* best-effort rollback· μην κρύψεις το αρχικό */ });
    throw err;
  }
}

/** Αποτέλεσμα του pre-pass: τι δημιουργήθηκε + ποιες υφές λείπουν (για actionable warning). */
export interface ForeignTextureImportResult {
  /** `όνομα υλικού → bmat_*` για τις υφές που ανέβηκαν/βρέθηκαν. */
  readonly created: ReadonlyMap<string, string>;
  /** Filenames υφών που το `.dae` αναφέρει αλλά ΔΕΝ βρέθηκαν στα επιλεγμένα αρχεία (Revit «missing
   * assets»). Ο C4D συχνά γράφει absolute path άλλου δίσκου· ο χρήστης πρέπει να τις στείλει μαζί. */
  readonly missing: readonly string[];
}

/**
 * Για κάθε ξένη υφή (`όνομα υλικού → filename`), βρίσκει την εικόνα, κάνει content-hash dedup, και
 * (αν νέα) δημιουργεί υλικό. Επιστρέφει τα δημιουργημένα **και** τα filenames που λείπουν. Υφή χωρίς
 * επιλεγμένη εικόνα → μπαίνει στο `missing` (ο caller ειδοποιεί) και προσπερνιέται (η όψη κρατά ό,τι
 * είχε — ποτέ throw, όπως το texture bundle).
 */
export async function importForeignTextures(
  texturesByMaterialName: ReadonlyMap<string, string>,
  imageFiles: readonly File[],
  deps: ForeignTextureImporterDeps,
): Promise<ForeignTextureImportResult> {
  const created = new Map<string, string>();
  const missing: string[] = [];
  const missingSeen = new Set<string>();
  if (texturesByMaterialName.size === 0) return { created, missing };

  const imagesByName = indexImagesByName(imageFiles);
  // content hash → material id: seed cross-session από τα live υλικά που κουβαλούν albedoHash,
  // μετά συσσωρεύει within-import ώστε ίδια υφή σε πολλά effects → ΕΝΑ νέο υλικό.
  const idByHash = new Map<string, string>();
  for (const m of deps.existingMaterials) {
    const h = m.pbrTextures?.albedoHash;
    if (h) idByHash.set(h.toLowerCase(), m.id);
  }

  for (const [materialName, fileName] of texturesByMaterialName) {
    const file = imagesByName.get(baseNameLower(fileName));
    if (!file) {
      const display = baseNameDecoded(fileName);
      if (!missingSeen.has(display)) { missingSeen.add(display); missing.push(display); }
      continue;
    }
    const hash = (await deps.hashFile(file)).toLowerCase();
    const existingId = idByHash.get(hash);
    if (existingId) {
      created.set(materialName, existingId);
      continue;
    }
    // Per-texture isolation: μια αποτυχία save/upload/update ΜΙΑΣ υφής δεν ρίχνει ΟΛΟ το import — η
    // συγκεκριμένη όψη μένει αβαφή, οι υπόλοιπες βάφονται κανονικά (documented contract, ποτέ throw).
    try {
      const id = await createTextureMaterial(materialName, file, hash, deps);
      idByHash.set(hash, id);
      created.set(materialName, id);
    } catch { /* skip αυτή την υφή· η όψη κρατά ό,τι είχε */ }
  }
  return { created, missing };
}
