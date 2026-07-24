/**
 * embedded-appearance-backfill — ADR-691 Φ3 / ADR-694 Φ6β. Δίνει στα **textured** εισαγόμενα υλικά
 * ένα πραγματικό `appearance` με `baseColorHex` = το **μέσο χρώμα της υφής τους**.
 *
 * ## Γιατί (ground truth 2026-07-24)
 *
 * Το `importForeignTextures` (ADR-678) ξέρει μόνο από υφές και γράφει `appearance: null`· και το
 * χρώμα που *υπάρχει* στο αρχείο είναι άχρηστο (ο C4D γράφει `Color 204,204,204` και αφήνει το
 * πορτοκαλί στο jpg). Αποτέλεσμα: κάθε καταναλωτής που ρωτά «τι χρώμα είναι αυτό το υλικό;» — το
 * swatch της μπάρας «Υλικά όψης», ο 2Δ color resolver, το flat fallback — έπαιρνε **γκρι**. Το μέσο
 * χρώμα της υφής είναι η απάντηση που δίνουν Revit/C4D στο ίδιο ερώτημα.
 *
 * ## ADR-694 Φ6β — γιατί δεν αρκούσαν τα νεοδημιουργημένα
 *
 * Μέχρι το Φ6 βάφονταν **μόνο** τα `freshlyCreated`. Τα 4 ιστορικά υλικά (`Mat.1`, `Mat`,
 * `Mat#ID12`, `Scene_Material3`) όμως ήταν *reused/repaired* → έμεναν για πάντα με
 * `appearance: null`, δηλαδή γκρι πλακίδιο. Τώρα καλύπτονται, υπό τον αυστηρό όρο του
 * {@link needsAppearance}.
 *
 * ## Γιατί ξεχωριστό module
 *
 * Ο orchestrator ({@link ./import-embedded-materials}) κρατά τη **ροή** (classify → upload/repair →
 * counters)· εδώ ζει μια αυτοτελής ερώτηση («ποιος δικαιούται χρώμα και ποιο;») με το δικό της
 * αυστηρό συμβόλαιο. N.7.1: ένα αρχείο = μία ευθύνη.
 *
 * @see ./import-embedded-materials — ο μοναδικός καλών (ροή εισαγωγής embedded υλικών)
 * @see ./texture-average-color — ο (injected) υπολογισμός του μέσου χρώματος, gamma-correct (Φ7)
 * @see docs/centralized-systems/reference/adrs/ADR-694-storage-asset-custody-and-material-identity.md §Φ6β
 */

import type { BimMaterial } from '../../bim/types/bim-material-types';
import type { ForeignTextureImporterDeps } from './import-foreign-textures';
import type { EmbeddedGltfMaterial } from '../mesh3d-roundtrip/glb-embedded-materials';

/** Bytes εικόνας → αντιπροσωπευτικό `#rrggbb`, ή `null` όταν δεν υπολογίζεται. Ποτέ δεν πετά. */
export type TextureAverageColorProbe = (image: Blob) => Promise<string | null>;

/** Είσοδος του appearance backfill (option bag — ονόματα πεδίων, όχι θέσεις ορισμάτων). */
export interface AppearanceBackfillInput {
  /** ΟΛΑ τα textured υλικά του import — και τα νεοδημιουργημένα και τα reused/repaired. */
  readonly materials: readonly EmbeddedGltfMaterial[];
  readonly idByIndex: ReadonlyMap<number, string>;
  readonly filesByIndex: ReadonlyMap<number, File>;
  /** Τα ids που **δημιουργήθηκαν** σ' αυτό το import (άρα εξ ορισμού `appearance: null`). */
  readonly freshIds: ReadonlySet<string>;
  readonly deps: ForeignTextureImporterDeps;
  /** Απών → μηδέν βαφή, δηλαδή ακριβώς η προ-Φ3 συμπεριφορά (tests χωρίς DOM). */
  readonly averageColorOf: TextureAverageColorProbe | undefined;
}

/**
 * 🔴 **ΑΠΑΡΑΒΑΤΟ (ADR-694 Φ6β):** γεμίζουμε `appearance` **μόνο** όταν μπορούμε να **αποδείξουμε**
 * ότι λείπει:
 *   - μόλις **το φτιάξαμε εμείς** (`freshIds`) → εξ ορισμού `appearance: null` → γέμισμα·
 *   - υπάρχον υλικό **ορατό** στο snapshot με `appearance == null` → γέμισμα (αυτό θεραπεύει τα 4
 *     ιστορικά γκρι πλακίδια)·
 *   - οτιδήποτε άλλο (έχει ήδη `appearance` που όρισε ο χρήστης **ή** δεν το βλέπουμε καν στο
 *     snapshot) → **ΠΟΤΕ** άγγιγμα. Άγνοια ≠ άδειο.
 */
export function needsAppearance(
  id: string,
  freshIds: ReadonlySet<string>,
  existingById: ReadonlyMap<string, BimMaterial>,
): boolean {
  if (freshIds.has(id)) return true;
  const existing = existingById.get(id);
  return existing !== undefined && existing.appearance == null;
}

/**
 * Τρέχει το backfill για κάθε textured υλικό που κατέληξε σε id. **Ποτέ δεν πετά**: αποτυχία
 * probe/update απομονώνεται ανά υλικό — η υφή ανέβηκε ήδη, μόνο το χρώμα λείπει (μηδέν παλινδρόμηση).
 */
export async function backfillTexturedAppearance(input: AppearanceBackfillInput): Promise<void> {
  const { materials, idByIndex, filesByIndex, freshIds, deps, averageColorOf } = input;
  if (!averageColorOf || materials.length === 0) return;
  const existingById = new Map(deps.existingMaterials.map((m) => [m.id, m] as const));

  for (const material of materials) {
    const id = idByIndex.get(material.index);
    const file = filesByIndex.get(material.index);
    if (!id || !file || !needsAppearance(id, freshIds, existingById)) continue;
    try {
      const baseColorHex = await averageColorOf(file);
      if (!baseColorHex) continue;
      await deps.updateMaterial(id, {
        appearance: {
          baseColorHex,
          metalness: material.metalness,
          roughness: material.roughness,
          opacity: material.opacity,
        },
      });
    } catch {
      // Per-material isolation — η υφή ανέβηκε ήδη· μόνο το χρώμα λείπει.
    }
  }
}
