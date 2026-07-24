/**
 * import-embedded-materials — ADR-691 §3.β/§4.1 + ADR-694 Φ6. **DI orchestrator** που παίρνει τα
 * embedded υλικά ενός εισαγόμενου glTF/GLB μοντέλου (`readEmbeddedGltfMaterials`, ADR-691 §5) και τα
 * **προάγει** σε πραγματικά `bmat_*` της βιβλιοθήκης — `glTF material index → bmat_*`. Η γεωμετρία
 * ΔΕΝ ξαναβάφεται (§3.β/§4 απόφαση): ο caller χρησιμοποιεί το αποτέλεσμα μόνο για
 * `params.embeddedMaterialIds`.
 *
 * **Μηδέν Firebase/React εδώ (καθαρό io layer, testable):** όπως το `import-foreign-textures.ts`,
 * όλες οι εξαρτήσεις (`saveMaterial`/`uploadAlbedo`/`hashFile`/…) περνούν injected μέσω
 * {@link ForeignTextureImporterDeps}. Ο button τις καλωδιώνει με τα SSoT services.
 *
 * **N.18 — μηδέν sibling clone:** οι υφές ΔΕΝ ξαναγράφονται εδώ· γίνεται **delegate ΑΥΤΟΥΣΙΟ** στο
 * `importForeignTextures` (ADR-678 Βήμα 3) — μία κλήση για ΟΛΑ τα textured embedded υλικά μαζί, ώστε
 * να κερδίζεται δωρεάν το content-hash dedup του (cross-session + within-import). Ομοίως, η απόφαση
 * «γνωστό & υγιές → reuse / γνωστό & σπασμένο → repair στο ΙΔΙΟ id» γίνεται delegate αυτούσιο στο
 * `foreignAndBrokenTextures` (ADR-678 Βήμα 3, το μονοπάτι `.dae`).
 *
 * **Αλγόριθμος (ADR-691 §4.1 + ADR-694 Φ6):**
 *   1. **Label** ανά υλικό: `material.name` αν υπάρχει, αλλιώς ντετερμινιστικό
 *      `` `${sourceLabel} ${index+1}` `` (τα ανώνυμα glTF υλικά — συχνά — αποκτούν ταυτότητα).
 *      Μοναδικότητα labels ΜΕΣΑ στο import: 2η εμφάνιση ίδιου label → suffix με τον glTF index.
 *   2. **Health pre-pass (Φ6α)**: ποια textured υλικά με **γνωστό** όνομα έχουν σπασμένο albedo →
 *      στόχοι repair. Async, γι' αυτό τρέχει **πριν** το sync/pure classify (βλ. §Φ6α παρακάτω).
 *   3. **Nestor DNA** (`isUnchangedNestorMaterial`) → skip· δικό μας εξαγόμενο υλικό, όχι ξένο.
 *   4. **Γνωστό όνομα** (`resolveKnownId`) **& υγιές** → reuse — αυτό είναι το **idempotency** σε 2η
 *      εισαγωγή του ίδιου μοντέλου. Γνωστό **αλλά σπασμένο** → ΔΕΝ γίνεται σιωπηλό reuse· πέφτει στο
 *      textured μονοπάτι ως repair (ίδιο id, μηδέν διπλότυπο).
 *   5. **Έχει υφή** → delegate `importForeignTextures` (μία κλήση, batch, με τα `repairIds`)·
 *      created/reused διαχωρίζονται με βάση το αν το επιστρεφόμενο id προϋπήρχε (cross-session) ή
 *      έχει ήδη εμφανιστεί μέσα σ' αυτό το batch (within-import dedup).
 *   6. **Χωρίς υφή** → νέο `bmat_*` με `appearance {baseColorHex, metalness, roughness, opacity}`
 *      (ADR-687 Φ1/Φ4 schema) — το χρώμα του συνεργάτη γίνεται πραγματικό υλικό, όχι μόνο ετικέτα.
 *   7. **Appearance backfill (Φ6β)**: κάθε textured υλικό που κατέληξε σε id και **αποδεδειγμένα**
 *      δεν έχει `appearance` το αποκτά από το μέσο χρώμα της υφής του (βλ. §Φ6β παρακάτω).
 *   8. **Απομόνωση ανά υλικό:** αποτυχία save ΕΝΟΣ color-only υλικού δεν ρίχνει την υπόλοιπη
 *      εισαγωγή (try/catch ανά υλικό) — ίδιο συμβόλαιο με το `importForeignTextures` (ΠΟΤΕ throw).
 *   9. Κενή είσοδος → κενό αποτέλεσμα, **μηδέν** κλήσεις στα deps.
 *
 * ## ADR-694 Φ6α — γιατί το by-name reuse δεν αρκούσε (ground truth 2026-07-25)
 *
 * Τέσσερα υπάρχοντα υλικά (`Mat.1`, `Mat`, `Mat#ID12`, `Scene_Material3`) είχαν `albedoUrl` προς
 * **ανύπαρκτο** αρχείο (403) και `appearance: null` → γκρι πλακίδιο στη μπάρα «Υλικά όψης», για
 * πάντα. Ρίζα: το by-name reuse έκανε `continue` **πριν** από κάθε έλεγχο υγείας, άρα το υλικό δεν
 * έφτανε ποτέ στο `importForeignTextures` — ούτε ξανα-ανέβαινε η υφή, ούτε αποκτούσε χρώμα. Sticky
 * όσα re-imports κι αν γίνονταν. Το DAE μονοπάτι είχε ήδη τη λύση· εδώ απλώς **καλωδιώνεται**.
 *
 * @see ./import-foreign-textures — importForeignTextures (delegate ΑΥΤΟΥΣΙΟ, ADR-678 Βήμα 3)
 * @see ./import-collada-appearance — foreignAndBrokenTextures (το SSoT της απόφασης reuse/repair)
 * @see ./known-import-materials — KnownMaterialResolver / resolveKnownId
 * @see ./resolve-import-appearance — isUnchangedNestorMaterial (Nestor DNA φίλτρο)
 * @see ../mesh3d-roundtrip/glb-embedded-materials — EmbeddedGltfMaterial (η πηγή, Agent 1)
 * @see ../../bim/types/bim-material-types — SaveBimMaterialInput / BimMaterialAppearance
 * @see docs/centralized-systems/reference/adrs/ADR-691-imported-mesh-embedded-material-extraction.md §3.β, §4.1
 */

import { toGreekTitleCase, transliterateGreekToLatin } from '@/utils/greek-text';
import { isUnchangedNestorMaterial } from './resolve-import-appearance';
import type { BimMaterial } from '../../bim/types/bim-material-types';
import type { KnownMaterialResolver } from './known-import-materials';
import {
  foreignAndBrokenTextures,
  type KnownMaterialHealthProbe,
} from './import-collada-appearance';
import {
  importForeignTextures,
  IMPORTED_TEXTURE_ATOE_CATEGORY,
  type ForeignTextureImporterDeps,
} from './import-foreign-textures';
import {
  backfillTexturedAppearance,
  type TextureAverageColorProbe,
} from './embedded-appearance-backfill';
// Type-only: το module γράφεται παράλληλα (Agent 1) — μηδέν runtime εξάρτηση από αυτό εδώ.
import type { EmbeddedGltfMaterial } from '../mesh3d-roundtrip/glb-embedded-materials';

/** Αποτέλεσμα της προαγωγής embedded υλικών σε βιβλιοθήκη (ADR-691 §4.1). */
export interface EmbeddedMaterialImportResult {
  /** `glTF material index → bmat_*`. Μόνο όσα λύθηκαν (skip/αποτυχία → απουσιάζουν, όχι throw). */
  readonly idByIndex: ReadonlyMap<number, string>;
  /** Πόσα νέα `bmat_*` δημιουργήθηκαν σ' αυτό το import (για toast). */
  readonly createdCount: number;
  /** Πόσα υπήρχαν ήδη και επαναχρησιμοποιήθηκαν/θεραπεύτηκαν — απόδειξη idempotency. */
  readonly reusedCount: number;
}

/** Είσοδος του orchestrator — όλα injected, μηδέν Firebase/React. */
export interface ImportEmbeddedMaterialsInput {
  readonly materials: readonly EmbeddedGltfMaterial[];
  /** Base name του αρχείου προέλευσης — ονομασία **ανώνυμων** υλικών (`"<sourceLabel> <n>"`). */
  readonly sourceLabel: string;
  readonly resolveKnownId: KnownMaterialResolver;
  readonly deps: ForeignTextureImporterDeps;
  /**
   * ADR-691 Φ3 — το αντιπροσωπευτικό χρώμα μιας υφής (βλ. `./texture-average-color`). Injected
   * γιατί απαιτεί browser image decoding· απών → τα textured υλικά μένουν χωρίς `appearance`
   * (η προ-Φ3 συμπεριφορά), ώστε τα tests να τρέχουν χωρίς DOM.
   */
  readonly averageColorOf?: TextureAverageColorProbe;
}

// Το συμβόλαιο του probe ζει πλέον δίπλα στον καταναλωτή του (`./embedded-appearance-backfill`)·
// re-export ώστε οι υπάρχοντες callers (π.χ. `useEmbeddedMaterialImport`) να μη χρειαστεί να αλλάξουν.
export type { TextureAverageColorProbe };

/** `material.name` αν υπάρχει, αλλιώς ντετερμινιστικό όνομα βασισμένο στο πηγαίο αρχείο + index. */
function embeddedMaterialLabel(material: EmbeddedGltfMaterial, sourceLabel: string): string {
  return material.name ?? `${sourceLabel} ${material.index + 1}`;
}

/** Το label ενός index με ντετερμινιστικό fallback (ποτέ `undefined` στη ροή). */
function labelOf(labelByIndex: ReadonlyMap<number, string>, index: number): string {
  return labelByIndex.get(index) ?? `${index}`;
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

/** Τα bytes του albedo ενός textured υλικού ως `File` (ένα αντίγραφο ανά import, μοιραζόμενο). */
function buildAlbedoFiles(materials: readonly EmbeddedGltfMaterial[]): ReadonlyMap<number, File> {
  const byIndex = new Map<number, File>();
  for (const material of materials) {
    const albedo = material.albedo;
    if (!albedo) continue;
    byIndex.set(
      material.index,
      new File([new Uint8Array(albedo.bytes)], albedo.fileName, { type: albedo.mimeType }),
    );
  }
  return byIndex;
}

/**
 * ADR-694 Φ6α — ποια **textured** embedded υλικά με ΓΝΩΣΤΟ όνομα έχουν **σπασμένο** albedo, ώστε να
 * μπουν σε repair αντί για σιωπηλό reuse. Επιστρέφει `glTF index → υπάρχον bmat_*` (στόχοι repair).
 *
 * **N.18 — πώς αποφεύγεται το sibling clone:** η ίδια η απόφαση («Nestor DNA → skip· `tex_` → skip·
 * άγνωστο → foreign· γνωστό & σπασμένο → repair στο ΙΔΙΟ id») ΔΕΝ ξαναγράφεται· γίνεται **delegate
 * ΑΥΤΟΥΣΙΟ** στο {@link foreignAndBrokenTextures} (ADR-678 Βήμα 3). Το μόνο που κάνει αυτή η
 * συνάρτηση είναι **προσαρμογή σχήματος**: `EmbeddedGltfMaterial[]` (index-based) ↔ το
 * `Map<όνομα, αρχείο>` που ζητά το SSoT. Εξετάστηκε η εναλλακτική «εξαγωγή κοινού πυρήνα σε τρίτο
 * module» και απορρίφθηκε: το υπάρχον συμβόλαιο καλύπτει ήδη πλήρως το ερώτημα, οπότε ο νέος
 * πυρήνας θα ήταν wrapper χωρίς περιεχόμενο (και θα άγγιζε αρχεία άλλου μονοπατιού χωρίς λόγο).
 *
 * **Ο probe είναι προαιρετικός** (`deps.isAlbedoReachable`): απών → κενό αποτέλεσμα, δηλαδή
 * **ακριβώς** η προηγούμενη συμπεριφορά (κάθε γνωστό όνομα = reuse). Μηδέν παλινδρόμηση, και τα
 * tests χωρίς Firebase περνούν αναλλοίωτα.
 */
async function findBrokenKnownMaterials(
  materials: readonly EmbeddedGltfMaterial[],
  labelByIndex: ReadonlyMap<number, string>,
  resolveKnownId: KnownMaterialResolver,
  deps: ForeignTextureImporterDeps,
): Promise<ReadonlyMap<number, string>> {
  const probe = deps.isAlbedoReachable;
  if (!probe) return new Map();

  const indexByLabel = new Map<string, number>();
  const texturesByLabel = new Map<string, string>();
  for (const material of materials) {
    if (!material.albedo) continue;
    const label = labelOf(labelByIndex, material.index);
    indexByLabel.set(label, material.index);
    texturesByLabel.set(label, material.albedo.fileName);
  }
  if (texturesByLabel.size === 0) return new Map();

  const { repairIds } = await foreignAndBrokenTextures(
    texturesByLabel, resolveKnownId, brokenAlbedoProbe(deps.existingMaterials, probe),
  );
  const byIndex = new Map<number, string>();
  for (const [label, id] of repairIds) {
    const index = indexByLabel.get(label);
    if (index !== undefined) byIndex.set(index, id);
  }
  return byIndex;
}

/**
 * `bmat_* → «είναι σπασμένο;»` πάνω από το `isAlbedoReachable` του συμβολαίου. Υλικό εκτός snapshot
 * ή χωρίς `albedoUrl` = τετριμμένα **υγιές** (τίποτα να σπάσει) — ίδια σημασιολογία με το
 * `isExistingAlbedoHealthy` του `import-foreign-textures`.
 */
function brokenAlbedoProbe(
  existingMaterials: readonly BimMaterial[],
  isAlbedoReachable: (material: BimMaterial) => Promise<boolean>,
): KnownMaterialHealthProbe {
  const byId = new Map(existingMaterials.map((m) => [m.id, m] as const));
  return async (materialId: string): Promise<boolean> => {
    const material = byId.get(materialId);
    if (!material?.pbrTextures?.albedoUrl) return false;
    return !(await isAlbedoReachable(material));
  };
}

/** Είσοδος του textured μονοπατιού (option bag — ονόματα πεδίων, όχι θέσεις ορισμάτων). */
interface TexturedImportInput {
  readonly textured: readonly EmbeddedGltfMaterial[];
  readonly labelByIndex: ReadonlyMap<number, string>;
  readonly filesByIndex: ReadonlyMap<number, File>;
  /** ADR-694 Φ6α — `glTF index → υπάρχον bmat_*` για repair in-place (σπασμένο albedo). */
  readonly repairByIndex: ReadonlyMap<number, string>;
  readonly deps: ForeignTextureImporterDeps;
  readonly idByIndex: Map<number, string>;
}

/** Τι έγινε στο textured μονοπάτι — τα `freshIds` τροφοδοτούν το appearance backfill (Φ6β). */
interface TexturedImportOutcome {
  readonly createdCount: number;
  readonly reusedCount: number;
  /** Τα ids που **δημιουργήθηκαν** σ' αυτό το import (άρα εξ ορισμού `appearance: null`). */
  readonly freshIds: ReadonlySet<string>;
}

/**
 * Textured embedded υλικά → **μία** batch κλήση στο `importForeignTextures` (N.18: delegate
 * αυτούσιο), με τα `repairIds` του Φ6α ώστε ένα γνωστό-αλλά-σπασμένο υλικό να θεραπευτεί **στο ίδιο
 * id**. Το created/reused διαχωρίζεται με βάση το αν το επιστρεφόμενο id προϋπήρχε στη βιβλιοθήκη
 * (cross-session reuse ή repair) ή έχει ήδη εμφανιστεί μέσα σ' αυτό το batch (within-import
 * content-hash dedup — δύο labels με ίδια bytes → ΕΝΑ id, το 2ο μετράει ως reused).
 */
async function importTexturedMaterials(input: TexturedImportInput): Promise<TexturedImportOutcome> {
  const { textured, labelByIndex, filesByIndex, repairByIndex, deps, idByIndex } = input;
  const indexByLabel = new Map<string, number>();
  const texturesByMaterialName = new Map<string, string>();
  const repairIds = new Map<string, string>();
  const imageFiles: File[] = [];

  for (const material of textured) {
    const file = filesByIndex.get(material.index);
    if (!material.albedo || !file) continue; // defensive· ο caller φιλτράρει ήδη μόνο textured εδώ
    const label = labelOf(labelByIndex, material.index);
    indexByLabel.set(label, material.index);
    texturesByMaterialName.set(label, material.albedo.fileName);
    const repairId = repairByIndex.get(material.index);
    if (repairId) repairIds.set(label, repairId);
    imageFiles.push(file);
  }

  const existingIdsBefore = new Set(deps.existingMaterials.map((m) => m.id));
  const result = await importForeignTextures(texturesByMaterialName, imageFiles, deps, repairIds);
  return tallyTextureOutcome(result.created, indexByLabel, idByIndex, existingIdsBefore);
}

/** Γράφει τα λυμένα ids στο `idByIndex` και μετρά created vs reused (βλ. {@link importTexturedMaterials}). */
function tallyTextureOutcome(
  created: ReadonlyMap<string, string>,
  indexByLabel: ReadonlyMap<string, number>,
  idByIndex: Map<number, string>,
  existingIdsBefore: ReadonlySet<string>,
): TexturedImportOutcome {
  let createdCount = 0;
  let reusedCount = 0;
  const freshIds = new Set<string>();
  for (const [label, id] of created) {
    const index = indexByLabel.get(label);
    if (index === undefined) continue;
    idByIndex.set(index, id);
    if (existingIdsBefore.has(id) || freshIds.has(id)) {
      reusedCount += 1;
    } else {
      createdCount += 1;
      freshIds.add(id);
    }
  }
  return { createdCount, reusedCount, freshIds };
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

/** Ο loop των color-only υλικών με per-material isolation (§4.1 #10)· επιστρέφει πόσα δημιουργήθηκαν. */
async function createColourMaterials(
  colorOnly: readonly EmbeddedGltfMaterial[],
  labelByIndex: ReadonlyMap<number, string>,
  deps: ForeignTextureImporterDeps,
  idByIndex: Map<number, string>,
): Promise<number> {
  let createdCount = 0;
  for (const material of colorOnly) {
    try {
      const id = await createColourMaterial(material, labelOf(labelByIndex, material.index), deps);
      idByIndex.set(material.index, id);
      createdCount += 1;
    } catch {
      // Per-material isolation (§4.1 #10) — η υπόλοιπη εισαγωγή προχωρά, το υλικό μένει άλυτο.
    }
  }
  return createdCount;
}

/** Ενδιάμεσο αποτέλεσμα του classify φίλτρου (πριν την ασύγχρονη επεξεργασία textured/color-only). */
interface ClassifiedMaterials {
  readonly idByIndex: Map<number, string>;
  readonly reusedCount: number;
  /** Textured υλικά που πάνε στο upload/repair μονοπάτι (άγνωστα ή γνωστά-με-σπασμένο-albedo). */
  readonly textured: readonly EmbeddedGltfMaterial[];
  /** ADR-694 Φ6β — textured υλικά που έγιναν by-name reuse & είναι **υγιή**: μηδέν upload, αλλά
   * υποψήφια για appearance backfill (η υφή τους είναι στα χέρια μας, τζάμπα). */
  readonly texturedReused: readonly EmbeddedGltfMaterial[];
  readonly colorOnly: readonly EmbeddedGltfMaterial[];
}

/**
 * Nestor DNA skip (§4.1 #2) + γνωστό-όνομα reuse (§4.1 #3) φίλτρα, sync/pure. Ό,τι απομένει
 * διαχωρίζεται σε textured/color-only για τα δύο ασύγχρονα μονοπάτια δημιουργίας.
 *
 * **ADR-694 Φ6α:** το `repairByIndex` (αποτέλεσμα του async pre-pass) κρατά αυτή τη συνάρτηση
 * **sync/pure** — ο health probe έγινε *πριν*, όχι εδώ. Ένα γνωστό όνομα που είναι στόχος repair
 * ΔΕΝ γίνεται reuse· πέφτει στο textured μονοπάτι, όπου το `importForeignTextures` θα ξανα-ανεβάσει
 * την υφή **στο ίδιο id**. Άρα σταθερό id, μηδέν διπλότυπο, και η βλάβη σπάει το sticky.
 */
function classifyMaterials(
  materials: readonly EmbeddedGltfMaterial[],
  labelByIndex: ReadonlyMap<number, string>,
  resolveKnownId: KnownMaterialResolver,
  repairByIndex: ReadonlyMap<number, string>,
): ClassifiedMaterials {
  const idByIndex = new Map<number, string>();
  let reusedCount = 0;
  const textured: EmbeddedGltfMaterial[] = [];
  const texturedReused: EmbeddedGltfMaterial[] = [];
  const colorOnly: EmbeddedGltfMaterial[] = [];

  for (const material of materials) {
    const label = labelOf(labelByIndex, material.index);
    if (isUnchangedNestorMaterial(label)) continue; // Nestor DNA· όχι ξένο

    const knownId = resolveKnownId(label);
    if (knownId && !repairByIndex.has(material.index)) {
      idByIndex.set(material.index, knownId);
      reusedCount += 1;
      if (material.albedo) texturedReused.push(material);
      continue;
    }

    if (material.albedo) textured.push(material);
    else colorOnly.push(material);
  }

  return { idByIndex, reusedCount, textured, texturedReused, colorOnly };
}

/**
 * ADR-691 §3.β/§4.1 + ADR-694 Φ6 — προάγει τα embedded υλικά ενός εισαγόμενου glTF/GLB μοντέλου σε
 * πραγματικά `bmat_*` της βιβλιοθήκης. **ΠΟΤΕ δεν πετά**: αποτυχία σε ένα υλικό (save/upload)
 * απομονώνεται· τα υπόλοιπα προχωρούν κανονικά. Κενή είσοδος → κενό αποτέλεσμα, μηδέν κλήσεις.
 */
export async function importEmbeddedMeshMaterials(
  input: ImportEmbeddedMaterialsInput,
): Promise<EmbeddedMaterialImportResult> {
  const { materials, sourceLabel, resolveKnownId, deps, averageColorOf } = input;
  if (materials.length === 0) return { idByIndex: new Map(), createdCount: 0, reusedCount: 0 };

  const labelByIndex = assignUniqueLabels(materials, sourceLabel);
  // Φ6α: ο health probe είναι async → τρέχει ΠΡΙΝ, ώστε το classify να μείνει sync/pure.
  const repairByIndex = await findBrokenKnownMaterials(materials, labelByIndex, resolveKnownId, deps);
  const { idByIndex, reusedCount: knownReused, textured, texturedReused, colorOnly } =
    classifyMaterials(materials, labelByIndex, resolveKnownId, repairByIndex);

  const allTextured = [...textured, ...texturedReused];
  const filesByIndex = buildAlbedoFiles(allTextured);
  let createdCount = 0;
  let reusedCount = knownReused;
  let freshIds: ReadonlySet<string> = new Set<string>();

  if (textured.length > 0) {
    const outcome = await importTexturedMaterials({
      textured, labelByIndex, filesByIndex, repairByIndex, deps, idByIndex,
    });
    createdCount += outcome.createdCount;
    reusedCount += outcome.reusedCount;
    freshIds = outcome.freshIds;
  }

  createdCount += await createColourMaterials(colorOnly, labelByIndex, deps, idByIndex);
  await backfillTexturedAppearance({
    materials: allTextured, idByIndex, filesByIndex, freshIds, deps, averageColorOf,
  });

  return { idByIndex, createdCount, reusedCount };
}
