/**
 * imported-mesh-identity-suggest — ADR-683 **Φ3.1β** (§10.2, μέτρα τριβής 1 + 2).
 *
 * Η ανάθεση ταυτότητας είναι **η μία χειροκίνητη πληροφορία ολόκληρης της φάσης**. Ένα `.glb` με 40
 * κάγκελα σημαίνει 40 φορές το ίδιο dialog — γι' αυτό η πρόταση δεν είναι καλλωπισμός: είναι η
 * διαφορά ανάμεσα σε «χρησιμοποιήσιμο» και «θα το κάνω αργότερα» (και το «αργότερα» δεν έρχεται).
 *
 * ## Δύο πηγές που απαντούν σε **διαφορετικές** ερωτήσεις
 *
 * Το όνομα κόμβου λέει **τι είναι** το αντικείμενο (`Rail_01` → κάγκελο). Το όνομα υλικού λέει
 * **από τι είναι φτιαγμένο** (`Inox_304` → ανοξείδωτο, με τιμή). Δεν ανταγωνίζονται — **συνδυάζονται**:
 * το άρθρο ΑΤΟΕ βγαίνει από το όνομα (σημασιολογία), το `materialId` από το υλικό (τιμή).
 * Έτσι ένα `Rail_01` με υλικό `Inox_304` προτείνει «Κάγκελα μπαλκονιού σε τρέχοντα μέτρα, από
 * ανοξείδωτο 304» — κάτι που **καμία** από τις δύο πηγές δεν ήξερε μόνη της.
 *
 * ## Τι ΔΕΝ κάνει
 *
 * **Δεν μαντεύει από τη γεωμετρία.** Καμία «είναι λεπτό και μακρύ, άρα κάγκελο» ευρετική: το §3
 * το απαγορεύει ρητά και το ίδιο κουτί 10×1×0,05 m είναι είτε κάγκελο είτε διακοσμητικός τοίχος.
 * Όταν καμία πηγή δεν μιλά, η πρόταση είναι **`null`** και ο χρήστης διαλέγει — ποτέ μια αυθαίρετη
 * προεπιλογή που θα περνούσε αδιάβαστη στην προμέτρηση.
 *
 * Η πρόταση είναι **πάντα** πρόταση: ο dialog την προσυμπληρώνει, ο χρήστης την αλλάζει ελεύθερα.
 *
 * @see ./imported-mesh-boq — `assignableBoqUnits` (ο έλεγχος στον οποίο υπόκειται κάθε πρόταση)
 * @see ../../../io/mesh3d-material-import/known-import-materials — `buildKnownMaterialResolver`
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §10.2
 */

import { findSubCategory } from '@/config/boq-subcategories';
import type { BimMaterial } from '../../types/bim-material-types';
import type { KnownMaterialResolver } from '../../../io/mesh3d-material-import/known-import-materials';
import { assignableBoqUnits } from './imported-mesh-boq';
import type {
  ImportedMeshBoqIdentity,
  ImportedMeshBoqUnit,
  ImportedMeshParams,
} from './imported-mesh-types';

// ─── Κανόνες ονόματος ─────────────────────────────────────────────────────────

/**
 * Ένας κανόνας «όνομα κόμβου → άρθρο ΑΤΟΕ». Τα `tokens` είναι **ήδη κανονικοποιημένα** (πεζά) και
 * ελέγχονται ως υποσυμβολοσειρές: ο συνεργάτης γράφει `Rail_01`, `railing_A`, `ΚΑΓΚΕΛΟ-2`.
 */
interface NodeNameRule {
  readonly tokens: readonly string[];
  /** Υποκατηγορία ΑΤΟΕ — ο τίτλος αντλείται από τον κατάλογο, ποτέ γραμμένος εδώ. */
  readonly subCategoryCode: string;
  /** Η σημασιολογικά σωστή μονάδα για αυτό το είδος (υπόκειται σε `assignableBoqUnits`). */
  readonly unit: ImportedMeshBoqUnit;
}

/**
 * Οι κανόνες, **ειδικότερος πρώτα**. Η σειρά είναι σημασιολογική, όχι τυχαία: το `stair_rail`
 * περιέχει και `rail`, οπότε ο κανόνας του κάγκελου σκάλας πρέπει να ρωτηθεί πριν τον γενικό.
 *
 * Καλύπτονται **μόνο** τα είδη που το ADR-683 ονομάζει ρητά ως τυπικό περιεχόμενο εισαγωγής
 * («κάγκελα, έπιπλα, βλάστηση») **και** έχουν αντίστοιχο άρθρο ΑΤΟΕ. Η **βλάστηση δεν έχει** —
 * και γι' αυτό δεν υπάρχει κανόνας για αυτήν: ένα δέντρο δεν είναι οικοδομική εργασία, και μια
 * ψεύτικη αντιστοίχιση θα το χρέωνε στον εργολάβο.
 */
const NODE_NAME_RULES: readonly NodeNameRule[] = [
  { tokens: ['stair_rail', 'stairrail', 'κάγκελο σκάλας', 'καγκελο σκαλας'], subCategoryCode: 'OIK-12.2', unit: 'm' },
  { tokens: ['rail', 'railing', 'handrail', 'balustrade', 'κάγκελ', 'καγκελ', 'χειρολισθήρ', 'χειρολισθηρ'], subCategoryCode: 'OIK-12.1', unit: 'm' },
  { tokens: ['pergola', 'canopy', 'πέργκολ', 'περγκολ', 'στέγαστρ', 'στεγαστρ'], subCategoryCode: 'OIK-12.5', unit: 'm2' },
  { tokens: ['garage_door', 'shutter', 'ρολ', 'γκαραζόπορτ', 'γκαραζοπορτ'], subCategoryCode: 'OIK-12.6', unit: 'pcs' },
  { tokens: ['wardrobe', 'closet', 'ντουλάπ', 'ντουλαπ'], subCategoryCode: 'OIK-16.2', unit: 'pcs' },
  { tokens: ['kitchen', 'κουζίν', 'κουζιν'], subCategoryCode: 'OIK-16.1', unit: 'pcs' },
];

/** Κανονικοποίηση για case-insensitive αναζήτηση (mirror `known-import-materials.norm`). */
function norm(value: string): string {
  return value.trim().toLowerCase();
}

/** Ο πρώτος κανόνας του οποίου κάποιο token εμφανίζεται στο όνομα, ή `undefined`. */
function matchNodeName(nodeName: string): NodeNameRule | undefined {
  const haystack = norm(nodeName);
  if (!haystack) return undefined;
  return NODE_NAME_RULES.find((rule) => rule.tokens.some((token) => haystack.includes(token)));
}

// ─── Πρόταση ─────────────────────────────────────────────────────────────────

/** Από πού προέκυψε η πρόταση — ο dialog το εξηγεί στον χρήστη αντί να «ξέρει» σιωπηλά. */
export type IdentitySuggestionSource = 'name' | 'material' | 'name+material';

export interface ImportedMeshIdentitySuggestion extends ImportedMeshBoqIdentity {
  readonly source: IdentitySuggestionSource;
}

export interface SuggestIdentityInput {
  readonly params: ImportedMeshParams;
  /** Ο lookup «όνομα υλικού → Νέστωρ material id» (`buildKnownMaterialResolver`). */
  readonly resolveMaterialId?: KnownMaterialResolver;
  /** Η ζωντανή βιβλιοθήκη υλικών — για `atoeCategory` / `defaultUnit` / `nameEl`. */
  readonly materials?: readonly BimMaterial[];
}

/**
 * Η πρώτη μονάδα που είναι **πράγματι** ανατεθειμένη για αυτό το πλέγμα + άρθρο, δίνοντας
 * προτεραιότητα στην προτιμώμενη. Επιστρέφει `undefined` όταν η τομή είναι κενή — δηλαδή όταν το
 * άρθρο απαιτεί μέγεθος που αυτή η γεωμετρία δεν μετρά (π.χ. σκυρόδεμα σε ανοιχτό πλέγμα).
 */
function resolveUnit(
  params: ImportedMeshParams,
  categoryCode: string,
  preferred: ImportedMeshBoqUnit | undefined,
): ImportedMeshBoqUnit | undefined {
  const assignable = assignableBoqUnits(params, categoryCode);
  if (preferred && assignable.includes(preferred)) return preferred;
  return assignable[0];
}

/** Το υλικό της βιβλιοθήκης που αντιστοιχεί στο αποθηκευμένο όνομα υλικού του κόμβου. */
function matchMaterial(input: SuggestIdentityInput): BimMaterial | undefined {
  const name = input.params.sourceMaterialName;
  if (!name || !input.resolveMaterialId || !input.materials?.length) return undefined;
  const id = input.resolveMaterialId(name);
  return id ? input.materials.find((m) => m.id === id) : undefined;
}

/**
 * Προτείνει ταυτότητα κοστολόγησης για ένα εισαγόμενο πλέγμα, ή **`null`** όταν καμία πηγή δεν
 * δίνει σημασιολογία (§3: ποτέ μαντεψιά από γεωμετρία).
 *
 * Ιεραρχία, όταν μιλούν και οι δύο πηγές:
 *   - **άρθρο + τίτλος** ← το όνομα κόμβου (τι *είναι* το αντικείμενο)·
 *   - **`materialId`** ← το υλικό (φέρνει και την τιμή, `defaultUnitCost`)·
 *   - **μονάδα** ← η προτίμηση του κανόνα ονόματος, **αν** επιτρέπεται· αλλιώς η πρώτη επιτρεπτή.
 *
 * Όταν μιλά **μόνο** το υλικό, το άρθρο του (`atoeCategory`) και το όνομά του γίνονται η πρόταση:
 * είναι λιγότερη πληροφορία, αλλά αληθινή.
 */
export function suggestImportedMeshIdentity(
  input: SuggestIdentityInput,
): ImportedMeshIdentitySuggestion | null {
  const rule = matchNodeName(input.params.nodeName);
  const material = matchMaterial(input);
  if (!rule && !material) return null;

  const categoryCode = rule?.subCategoryCode ?? material?.atoeCategory ?? '';
  if (!categoryCode) return null;

  const unit = resolveUnit(input.params, categoryCode, rule?.unit ?? material?.defaultUnit);
  // Καμία τίμια μονάδα για αυτόν τον συνδυασμό → καμία πρόταση. Ο χρήστης βλέπει καθαρό dialog και
  // την εξήγηση του gating, αντί για μια προσυμπληρωμένη επιλογή που ο ίδιος ο έλεγχος απορρίπτει.
  if (!unit) return null;

  const titleEL = rule
    ? findSubCategory(rule.subCategoryCode)?.nameEL ?? input.params.nodeName
    : material?.nameEl ?? input.params.nodeName;

  const source: IdentitySuggestionSource =
    rule && material ? 'name+material' : rule ? 'name' : 'material';

  return {
    categoryCode,
    unit,
    titleEL,
    ...(material ? { materialId: material.id } : {}),
    source,
  };
}
