/**
 * import-embedded-materials — ADR-691 §3.β/§4.1. **DI orchestrator** που παίρνει τα embedded υλικά
 * ενός εισαγόμενου glTF/GLB μοντέλου (`readEmbeddedGltfMaterials`, ADR-691 §5) και τα **προάγει** σε
 * πραγματικά `bmat_*` της βιβλιοθήκης — `glTF material index → bmat_*`. Η γεωμετρία ΔΕΝ ξαναβάφεται
 * (§3.β/§4 απόφαση): ο caller χρησιμοποιεί το αποτέλεσμα μόνο για `params.embeddedMaterialIds`.
 *
 * **Μηδέν Firebase/React εδώ (καθαρό io layer, testable):** όπως το `import-foreign-textures.ts`,
 * όλες οι εξαρτήσεις (`saveMaterial`/`uploadAlbedo`/`hashFile`/…) περνούν injected μέσω
 * {@link ForeignTextureImporterDeps}. Ο button τις καλωδιώνει με τα SSoT services.
 *
 * **N.18 — μηδέν sibling clone:** οι υφές ΔΕΝ ξαναγράφονται εδώ· γίνεται **delegate ΑΥΤΟΥΣΙΟ** στο
 * `importForeignTextures` (ADR-678 Βήμα 3) — μία κλήση για ΟΛΑ τα textured embedded υλικά μαζί, ώστε
 * να κερδίζεται δωρεάν το content-hash dedup του (cross-session + within-import).
 *
 * **Αλγόριθμος (ADR-691 §4.1):**
 *   1. **Label** ανά υλικό: `material.name` αν υπάρχει, αλλιώς ντετερμινιστικό
 *      `` `${sourceLabel} ${index+1}` `` (τα ανώνυμα glTF υλικά — συχνά — αποκτούν ταυτότητα).
 *      Μοναδικότητα labels ΜΕΣΑ στο import: 2η εμφάνιση ίδιου label → suffix με τον glTF index.
 *   2. **Nestor DNA** (`isUnchangedNestorMaterial`) → skip· δικό μας εξαγόμενο υλικό, όχι ξένο.
 *   3. **Γνωστό όνομα** (`resolveKnownId`) → reuse — αυτό είναι το **idempotency** σε 2η εισαγωγή του
 *      ίδιου μοντέλου (το πρώτο import έγραψε `nameEl = label`· το live library snapshot της 2ης
 *      φοράς το ξαναβρίσκει by name πριν αγγίξει υφές).
 *   4. **Έχει υφή** → delegate `importForeignTextures` (μία κλήση, batch)· created/reused
 *      διαχωρίζονται με βάση το αν το επιστρεφόμενο id προϋπήρχε (cross-session) ή έχει ήδη
 *      εμφανιστεί μέσα σ' αυτό το batch (within-import dedup — δύο labels, ίδια bytes → ΕΝΑ υλικό).
 *   5. **Χωρίς υφή** → νέο `bmat_*` με `appearance {baseColorHex, metalness, roughness, opacity}`
 *      (ADR-687 Φ1/Φ4 schema) — το χρώμα του συνεργάτη γίνεται πραγματικό υλικό, όχι μόνο ετικέτα.
 *   6. **Απομόνωση ανά υλικό:** αποτυχία save ΕΝΟΣ color-only υλικού δεν ρίχνει την υπόλοιπη
 *      εισαγωγή (try/catch ανά υλικό) — ίδιο συμβόλαιο με το `importForeignTextures` (ΠΟΤΕ throw).
 *   7. Κενή είσοδος → κενό αποτέλεσμα, **μηδέν** κλήσεις στα deps.
 *
 * @see ./import-foreign-textures — importForeignTextures (delegate ΑΥΤΟΥΣΙΟ, ADR-678 Βήμα 3)
 * @see ./known-import-materials — KnownMaterialResolver / resolveKnownId
 * @see ./resolve-import-appearance — isUnchangedNestorMaterial (Nestor DNA φίλτρο)
 * @see ../mesh3d-roundtrip/glb-embedded-materials — EmbeddedGltfMaterial (η πηγή, Agent 1)
 * @see ../../bim/types/bim-material-types — SaveBimMaterialInput / BimMaterialAppearance
 * @see docs/centralized-systems/reference/adrs/ADR-691-imported-mesh-embedded-material-extraction.md §3.β, §4.1
 */

import { toGreekTitleCase, transliterateGreekToLatin } from '@/utils/greek-text';
import { isUnchangedNestorMaterial } from './resolve-import-appearance';
import type { KnownMaterialResolver } from './known-import-materials';
import {
  importForeignTextures,
  IMPORTED_TEXTURE_ATOE_CATEGORY,
  type ForeignTextureImporterDeps,
} from './import-foreign-textures';
// Type-only: το module γράφεται παράλληλα (Agent 1) — μηδέν runtime εξάρτηση από αυτό εδώ.
import type { EmbeddedGltfMaterial } from '../mesh3d-roundtrip/glb-embedded-materials';

/** Αποτέλεσμα της προαγωγής embedded υλικών σε βιβλιοθήκη (ADR-691 §4.1). */
export interface EmbeddedMaterialImportResult {
  /** `glTF material index → bmat_*`. Μόνο όσα λύθηκαν (skip/αποτυχία → απουσιάζουν, όχι throw). */
  readonly idByIndex: ReadonlyMap<number, string>;
  /** Πόσα νέα `bmat_*` δημιουργήθηκαν σ' αυτό το import (για toast). */
  readonly createdCount: number;
  /** Πόσα υπήρχαν ήδη και επαναχρησιμοποιήθηκαν — απόδειξη idempotency. */
  readonly reusedCount: number;
}

/** Είσοδος του orchestrator — όλα injected, μηδέν Firebase/React. */
export interface ImportEmbeddedMaterialsInput {
  readonly materials: readonly EmbeddedGltfMaterial[];
  /** Base name του αρχείου προέλευσης — ονομασία **ανώνυμων** υλικών (`"<sourceLabel> <n>"`). */
  readonly sourceLabel: string;
  readonly resolveKnownId: KnownMaterialResolver;
  readonly deps: ForeignTextureImporterDeps;
}

/** `material.name` αν υπάρχει, αλλιώς ντετερμινιστικό όνομα βασισμένο στο πηγαίο αρχείο + index. */
function embeddedMaterialLabel(material: EmbeddedGltfMaterial, sourceLabel: string): string {
  return material.name ?? `${sourceLabel} ${material.index + 1}`;
}

/**
 * Μοναδικά labels μέσα στο import: αν δύο υλικά καταλήγουν στο ίδιο βασικό label (π.χ. δύο ίδια
 * ονομασμένα ξένα υλικά), το 2ο+ παίρνει suffix με τον δικό του glTF index — ντετερμινιστικό,
 * ποτέ silent collision.
 */
function assignUniqueLabels(
  materials: readonly EmbeddedGltfMaterial[],
  sourceLabel: string,
): ReadonlyMap<number, string> {
  const labelByIndex = new Map<number, string>();
  const seenBase = new Set<string>();
  for (const material of materials) {
    const base = embeddedMaterialLabel(material, sourceLabel);
    const label = seenBase.has(base) ? `${base} #${material.index}` : base;
    seenBase.add(base);
    labelByIndex.set(material.index, label);
  }
  return labelByIndex;
}

/** Ανθρώπινο αγγλικό όνομα από το label (ίδιο transliteration μοτίβο με `import-foreign-textures`). */
function toNameEn(label: string): string {
  const latin = toGreekTitleCase(transliterateGreekToLatin(label)).trim();
  return latin || label;
}

/**
 * Textured embedded υλικά → **μία** batch κλήση στο `importForeignTextures` (N.18: delegate
 * αυτούσιο). Το created/reused διαχωρίζεται με βάση το αν το επιστρεφόμενο id προϋπήρχε στη
 * βιβλιοθήκη (cross-session reuse) ή έχει ήδη εμφανιστεί μέσα σ' αυτό το batch (within-import
 * content-hash dedup — δύο labels με ίδια bytes → ΕΝΑ id, το 2ο μετράει ως reused).
 */
async function importTexturedMaterials(
  textured: readonly EmbeddedGltfMaterial[],
  labelByIndex: ReadonlyMap<number, string>,
  deps: ForeignTextureImporterDeps,
  idByIndex: Map<number, string>,
): Promise<{ readonly createdCount: number; readonly reusedCount: number }> {
  const indexByLabel = new Map<string, number>();
  const texturesByMaterialName = new Map<string, string>();
  const imageFiles: File[] = [];

  for (const material of textured) {
    const albedo = material.albedo;
    if (!albedo) continue; // defensive· ο caller φιλτράρει ήδη μόνο textured εδώ
    const label = labelByIndex.get(material.index) ?? `${material.index}`;
    indexByLabel.set(label, material.index);
    texturesByMaterialName.set(label, albedo.fileName);
    imageFiles.push(new File([new Uint8Array(albedo.bytes)], albedo.fileName, { type: albedo.mimeType }));
  }

  const existingIdsBefore = new Set(deps.existingMaterials.map((m) => m.id));
  const result = await importForeignTextures(texturesByMaterialName, imageFiles, deps);

  let createdCount = 0;
  let reusedCount = 0;
  const seenThisBatch = new Set<string>();
  for (const [label, id] of result.created) {
    const index = indexByLabel.get(label);
    if (index === undefined) continue;
    idByIndex.set(index, id);
    if (existingIdsBefore.has(id) || seenThisBatch.has(id)) {
      reusedCount += 1;
    } else {
      createdCount += 1;
      seenThisBatch.add(id);
    }
  }
  return { createdCount, reusedCount };
}

/**
 * Ένα color-only embedded υλικό → νέο `bmat_*` με `appearance` (ADR-687 Φ1/Φ4 schema). Per-material
 * isolation: αν αποτύχει το save, ρίχνεται εσωτερικά (caught από τον caller loop) — η υπόλοιπη
 * εισαγωγή προχωρά κανονικά (§4.1 #10, ίδιο συμβόλαιο με `importForeignTextures`).
 */
async function createColourMaterial(
  material: EmbeddedGltfMaterial,
  label: string,
  deps: ForeignTextureImporterDeps,
): Promise<string> {
  const saved = await deps.saveMaterial({
    scope: 'company',
    nameEl: label,
    nameEn: toNameEn(label),
    category: 'other',
    atoeCategory: IMPORTED_TEXTURE_ATOE_CATEGORY,
    defaultUnit: 'm2',
    appearance: {
      baseColorHex: material.colorHex,
      metalness: material.metalness,
      roughness: material.roughness,
      opacity: material.opacity,
    },
  });
  return saved.id;
}

/** Ενδιάμεσο αποτέλεσμα του classify φίλτρου (πριν την ασύγχρονη επεξεργασία textured/color-only). */
interface ClassifiedMaterials {
  readonly idByIndex: Map<number, string>;
  readonly reusedCount: number;
  readonly textured: readonly EmbeddedGltfMaterial[];
  readonly colorOnly: readonly EmbeddedGltfMaterial[];
}

/**
 * Nestor DNA skip (§4.1 #2) + γνωστό-όνομα reuse (§4.1 #3) φίλτρα, sync/pure. Ό,τι απομένει
 * διαχωρίζεται σε textured/color-only για τα δύο ασύγχρονα μονοπάτια δημιουργίας.
 */
function classifyMaterials(
  materials: readonly EmbeddedGltfMaterial[],
  labelByIndex: ReadonlyMap<number, string>,
  resolveKnownId: KnownMaterialResolver,
): ClassifiedMaterials {
  const idByIndex = new Map<number, string>();
  let reusedCount = 0;
  const textured: EmbeddedGltfMaterial[] = [];
  const colorOnly: EmbeddedGltfMaterial[] = [];

  for (const material of materials) {
    const label = labelByIndex.get(material.index) ?? `${material.index}`;
    if (isUnchangedNestorMaterial(label)) continue; // Nestor DNA· όχι ξένο

    const knownId = resolveKnownId(label);
    if (knownId) {
      idByIndex.set(material.index, knownId);
      reusedCount += 1;
      continue;
    }

    if (material.albedo) textured.push(material);
    else colorOnly.push(material);
  }

  return { idByIndex, reusedCount, textured, colorOnly };
}

/**
 * ADR-691 §3.β/§4.1 — προάγει τα embedded υλικά ενός εισαγόμενου glTF/GLB μοντέλου σε πραγματικά
 * `bmat_*` της βιβλιοθήκης. **ΠΟΤΕ δεν πετά**: αποτυχία σε ένα υλικό (save/upload) απομονώνεται· τα
 * υπόλοιπα προχωρούν κανονικά. Κενή είσοδος → κενό αποτέλεσμα, μηδέν κλήσεις.
 */
export async function importEmbeddedMeshMaterials(
  input: ImportEmbeddedMaterialsInput,
): Promise<EmbeddedMaterialImportResult> {
  const { materials, sourceLabel, resolveKnownId, deps } = input;
  if (materials.length === 0) return { idByIndex: new Map(), createdCount: 0, reusedCount: 0 };

  const labelByIndex = assignUniqueLabels(materials, sourceLabel);
  const { idByIndex, reusedCount: knownReusedCount, textured, colorOnly } =
    classifyMaterials(materials, labelByIndex, resolveKnownId);

  let createdCount = 0;
  let reusedCount = knownReusedCount;

  if (textured.length > 0) {
    const textureCounts = await importTexturedMaterials(textured, labelByIndex, deps, idByIndex);
    createdCount += textureCounts.createdCount;
    reusedCount += textureCounts.reusedCount;
  }

  for (const material of colorOnly) {
    const label = labelByIndex.get(material.index) ?? `${material.index}`;
    try {
      const id = await createColourMaterial(material, label, deps);
      idByIndex.set(material.index, id);
      createdCount += 1;
    } catch {
      // Per-material isolation (§4.1 #10) — η υπόλοιπη εισαγωγή προχωρά, το υλικό μένει άλυτο.
    }
  }

  return { idByIndex, createdCount, reusedCount };
}
