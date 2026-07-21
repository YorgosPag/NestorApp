/**
 * ADR-668 — mesh naming for the 3Δ export («όροφος → κατηγορία», απόφαση Giorgio).
 *
 * Το OBJ είναι **επίπεδο** format: δεν έχει δέντρο, μόνο `o <name>` ανά αντικείμενο. Οπότε η
 * ιεραρχία κωδικοποιείται ως **πρόθεμα ονόματος** (`Ισόγειο_Wall_w-123`), ώστε στο Object
 * Manager του C4D τα αντικείμενα να μπαίνουν σε σειρά ανά όροφο/κατηγορία και να επιλέγονται
 * μαζικά. Το glTF, που ΕΧΕΙ πραγματικό δέντρο, παίρνει τα ίδια ονόματα σε φωλιασμένα nodes.
 *
 * **Γιατί λατινικά slugs για την κατηγορία και ΟΧΙ i18n:** ένα εξαγόμενο αρχείο δεν επιτρέπεται
 * να αλλάζει περιεχόμενο επειδή ο χρήστης γύρισε το UI στα αγγλικά. Το `bimType` είναι σταθερό
 * δεδομένο του μοντέλου· το όνομα ορόφου έρχεται από τα δεδομένα του χρήστη (`level.name`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-668-mesh3d-export-obj-gltf.md
 */

import { transliterateGreekToLatin, toGreekTitleCase } from '@/utils/greek-text';
import type { BimMeshIdentity } from './mesh3d-identity';

const UNKNOWN_CATEGORY = 'Misc';

/**
 * ADR-668 — πρόθεμα για ό,τι ήταν **σβηστό στην οθόνη** τη στιγμή της εξαγωγής (V/G, isolate,
 * κλειστό layer, discipline). Απόφαση Giorgio 2026-07-17: εξάγονται **όλα**, αλλά ο χρήστης
 * πρέπει να μπορεί να τα ξανακρύψει στο C4D με μία κίνηση.
 *
 * **Γιατί όνομα και όχι flag:** κανένα από τα δύο formats δεν κουβαλά ορατότητα — το OBJ δεν
 * έχει καν την έννοια, και ο `GLTFExporter` του three δεν γράφει ποτέ `KHR_node_visibility`
 * (μετρημένο). Το όνομα είναι το μόνο κανάλι που επιβιώνει και στα δύο. Στο Object Manager
 * του C4D: search «HIDDEN» → select all → ένα κλικ στα dots.
 *
 * Μπαίνει **πρώτο** ώστε τα κρυμμένα να ταξινομούνται μαζί, όχι σκόρπια ανά όροφο.
 */
export const HIDDEN_NAME_PREFIX = 'HIDDEN';

/**
 * SSoT για το «καθαρό» όνομα υλικού: strip του `HIDDEN_` προθέματος. Το κρυμμένο υλικό εξάγεται ως
 * `HIDDEN_<name>` (OBJ) αλλά αναφέρεται στο **ίδιο** λογικό υλικό. Ζει εδώ (THREE-free naming SSoT)
 * ώστε να το μοιράζονται και η export πλευρά (`buildMaterialBaseline`/`buildExportManifest`) και ο
 * **pure** import πυρήνας (`resolve-import-appearance`) χωρίς να σέρνεται το THREE στο import.
 */
export function stripHiddenPrefix(name: string): string {
  const prefix = `${HIDDEN_NAME_PREFIX}_`;
  return name.startsWith(prefix) ? name.slice(prefix.length) : name;
}

/**
 * Πώς γράφονται τα ελληνικά ονόματα ορόφων ανά format (απόφαση Giorgio 2026-07-17):
 *   'unicode' → glTF. Το spec **επιβάλλει UTF-8** → «Ισόγειο» ταξιδεύει αυτούσιο.
 *   'latin'   → OBJ. Το format **δεν ορίζει encoding**· το C4D **R15 (2013)** διαβάζει τα bytes
 *               ως latin-1 → τα ελληνικά θα γίνονταν κουτάκια. Άρα «Ισόγειο» → «Isogeio».
 */
export type MeshNameCharset = 'unicode' | 'latin';

export interface MeshNameOptions {
  /** Εμφανιζόμενο όνομα ορόφου· κενό → παραλείπεται το πρόθεμα (single-floor export). */
  readonly floorName: string;
  /** Ήταν σβηστό στην οθόνη → παίρνει `HIDDEN_`. */
  readonly hidden: boolean;
  readonly charset: MeshNameCharset;
}

/**
 * OBJ-ασφαλές όνομα: το `o` token τερματίζεται σε whitespace, οπότε κενά **σπάνε** το όνομα σε
 * δύο. Κρατάμε λατινικά/ελληνικά/ψηφία και `_.-`, τα υπόλοιπα γίνονται `_`.
 */
export function sanitizeMeshNamePart(raw: string): string {
  const collapsed = raw
    .trim()
    .replace(/[^\p{Script=Latin}\p{Script=Greek}0-9_.-]+/gu, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
  return collapsed.length > 0 ? collapsed : UNKNOWN_CATEGORY;
}

/**
 * Το όνομα ορόφου στο charset του format. Το transliteration είναι lowercase by design
 * (φτιαγμένο για fuzzy search), οπότε το ξανα-κεφαλαιοποιούμε: «Ισόγειο» → «isogeio» →
 * «Isogeio» — αναγνώσιμο στο Object Manager, όχι κραυγή.
 */
export function encodeFloorNamePart(floorName: string, charset: MeshNameCharset): string {
  if (charset === 'unicode') return sanitizeMeshNamePart(floorName);
  return sanitizeMeshNamePart(toGreekTitleCase(transliterateGreekToLatin(floorName)));
}

/** 'wall' → 'Wall', 'slab-opening' → 'SlabOpening'. Σταθερό, γλωσσικά ουδέτερο. */
export function categorySlug(bimType: string | null): string {
  if (bimType === null || bimType.length === 0) return UNKNOWN_CATEGORY;
  return bimType
    .split('-')
    .filter((p) => p.length > 0)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

/**
 * `[HIDDEN_]<Όροφος>_<Κατηγορία>_<id>` — π.χ. `Ισόγειο_Wall_w-42`, `HIDDEN_Isogeio_Rebar_r-7`.
 *
 * @param identity   ταυτότητα από `resolveBimMeshIdentity`
 * @param fallbackIndex  όταν λείπει `bimId` (π.χ. joint rebar) — κρατά τα ονόματα μοναδικά
 */
export function buildMeshName(
  identity: BimMeshIdentity,
  fallbackIndex: number,
  options: MeshNameOptions,
): string {
  const category = categorySlug(identity.bimType);
  const id = identity.bimId ?? `${fallbackIndex}`;
  const parts: string[] = [];

  if (options.hidden) parts.push(HIDDEN_NAME_PREFIX);
  if (options.floorName.length > 0) parts.push(encodeFloorNamePart(options.floorName, options.charset));
  parts.push(category, sanitizeMeshNamePart(id));

  return parts.join('_');
}
