/**
 * named-layer — η **ΜΙΑ πόρτα** «βρες ή φτιάξε layer με όνομα» στο ενεργό έγγραφο.
 *
 * ADR-929 Δ20 Σ1.2. Την ξαναχρησιμοποιούν τα Σ2/Σ3/Σ4/Σ7 (τοίχοι, ανοίγματα, κείμενα…) και
 * κάθε εργαλείο που γράφει σε «δικό του» layer.
 *
 * ## Το όνομα του layer είναι ΔΕΔΟΜΕΝΟ, όχι ετικέτα οθόνης
 *
 * Το όνομα ταξιδεύει στο DXF, το βρίσκει ο `getLayerByName`, και πάνω του κάθεται η ταυτότητα
 * του layer για τον χρήστη. Αν ακολουθούσε τη γλώσσα της οθόνης, ο ίδιος άνθρωπος θα έβγαζε
 * διπλά layers (`ΔΙΑΣΤΑΣΕΙΣ` + `Dimensions`) για το ίδιο πράγμα. Γι' αυτό:
 *   - **διαστάσεις** → το όνομα το αποφασίζει το `DimStyle.targetLayer` του στυλ που
 *     χρησιμοποιήθηκε — το αντίστοιχο του AutoCAD `DIMLAYER` (όνομα layer· `"."` = τρέχον).
 *     Τα πρότυπα δίνουν ήδη `ΔΙΑΣΤΑΣΕΙΣ` (Nestor/ISO) ή `A-ANNO-DIMS` (AIA NCS `*-ANNO-DIMS`).
 *   - το i18n ανήκει στις **ετικέτες** (όνομα βήματος αναίρεσης, μηνύματα) — όχι εδώ.
 *
 * ## Συμβόλαιο
 *   - **Ιδεμποτικό**: υπάρχον layer (χωρίς διάκριση πεζών, ίδιος κανόνας με τον validator) ⇒
 *     επιστρέφει το id του και **δεν** γράφει τίποτα στο ιστορικό (κανένα κενό βήμα undo).
 *   - **Αναιρέσιμο**: νέο layer ⇒ `EnsureSceneLayerCommand` στο `CommandHistory`· μέσα σε
 *     `runAsSingleUndo` ενώνεται με τις οντότητες που ακολουθούν (ένα Ctrl+Z).
 *   - **Fail-closed**: άκυρο όνομα (validator AutoCAD-strict) ή χωρίς σκηνή ⇒ `ok: false` με
 *     λόγο· ποτέ σιωπηλή εγγραφή στο layer «0».
 *
 * @see core/commands/layer/EnsureSceneLayerCommand.ts — η αναιρέσιμη εγγραφή
 * @see services/shared/layer-naming-guard.ts — ο φρουρός ονόματος
 * @see systems/dimensions/dim-style-templates.ts — τα `targetLayer` των προτύπων
 */

import { createSceneLayer } from '../types/entities';
import type { DimStyle } from '../types/dimension';
import type { SceneModel } from '../types/scene';
import { getGlobalCommandHistory, type CommandHistory } from '../core/commands/CommandHistory';
import {
  EnsureSceneLayerCommand,
  findSceneLayerByName,
} from '../core/commands/layer/EnsureSceneLayerCommand';
import { guardLayerName } from './shared/layer-naming-guard';
import type { LayerNameValidationError } from './layer-name-validator';
import { getCurrentLayerId, getDefaultLayerId } from '../stores/LayerStore';

/** Ό,τι περιγράφει ένα layer προς δημιουργία (ταυτότητα + προέλευση τα ορίζει η πόρτα). */
export type NamedLayerSpec = Omit<Parameters<typeof createSceneLayer>[0], 'id' | 'source' | 'sourceName'>;

/** AutoCAD `DIMLAYER`: η τιμή `"."` σημαίνει «στο τρέχον layer». */
export const DIM_LAYER_USE_CURRENT = '.';

/** Ελάχιστη πρόσβαση στο έγγραφο επιπέδου — δομικά = `SceneAppendAccessor`. */
export interface NamedLayerAccessor {
  readonly currentLevelId: string | null;
  getLevelScene: (levelId: string) => SceneModel | null;
  setLevelScene: (levelId: string, scene: SceneModel) => void;
}

/** Γιατί δεν υπάρχει layer να γραφτεί κάτι — ΕΝΑ λεξιλόγιο για την εγγραφή και την προεπισκόπηση. */
export type NamedLayerRefusal = 'no-scene' | 'no-layer' | LayerNameValidationError;

export type EnsureNamedLayerResult =
  | { readonly ok: true; readonly layerId: string; readonly created: boolean }
  | { readonly ok: false; readonly reason: NamedLayerRefusal };

/**
 * ADR-929 Δ20 Σ1.3β — πού **θα** γραφτούν οι διαστάσεις ενός στυλ, **χωρίς** να γραφτεί τίποτα (προεπισκόπηση).
 * Ίδια επίλυση με το {@link ensureDimensionLayer}: ό,τι λέει εδώ το πάνελ, αυτό κάνει η έγκριση.
 */
export type DimensionLayerTarget =
  | { readonly kind: 'existing'; readonly name: string }
  | { readonly kind: 'create'; readonly name: string }
  | { readonly kind: 'current' }
  | { readonly kind: 'refused'; readonly reason: NamedLayerRefusal };

/**
 * Το layer των διαστάσεων ενός στυλ (`DimStyle.targetLayer`, ≡ `DIMLAYER`).
 * `null` ⇒ το στυλ δεν ορίζει layer (κενό ή `"."`) ⇒ ο caller μένει στο τρέχον/προεπιλεγμένο.
 */
export function resolveDimensionLayerSpec(style: Pick<DimStyle, 'targetLayer'>): NamedLayerSpec | null {
  const name = style.targetLayer.trim();
  if (name.length === 0 || name === DIM_LAYER_USE_CURRENT) return null;
  return { name };
}

/**
 * Βρες ή φτιάξε (αναιρέσιμα) το layer `spec.name` στο ενεργό επίπεδο του `accessor`.
 * Βλ. το συμβόλαιο στην κεφαλίδα του αρχείου.
 */
export function ensureNamedLayer(
  accessor: NamedLayerAccessor,
  spec: NamedLayerSpec,
  history: CommandHistory = getGlobalCommandHistory(),
): EnsureNamedLayerResult {
  const levelId = accessor.currentLevelId;
  const scene = levelId ? accessor.getLevelScene(levelId) : null;
  if (!levelId || !scene) return { ok: false, reason: 'no-scene' };

  const existing = findSceneLayerByName(scene, spec.name);
  if (existing) return { ok: true, layerId: existing.id, created: false };

  const guard = guardLayerName({ name: spec.name, scene });
  if (guard) return { ok: false, reason: guard.validationError };

  const layer = createSceneLayer({ ...spec, source: 'system-default' });
  const command = new EnsureSceneLayerCommand(layer, {
    levelId,
    getLevelScene: accessor.getLevelScene,
    setLevelScene: accessor.setLevelScene,
  });
  history.execute(command);
  const layerId = command.getLayerId();
  return layerId ? { ok: true, layerId, created: command.didCreate() } : { ok: false, reason: 'no-scene' };
}

/**
 * ADR-929 Δ20 Σ1.3 — το layer όπου γράφονται οι διαστάσεις ενός στυλ (≡ AutoCAD `DIMLAYER`):
 *   - όνομα ⇒ {@link ensureNamedLayer} (βρες ή φτιάξε, αναιρέσιμα)·
 *   - κενό ή `"."` ⇒ το **τρέχον** layer (ή το προεπιλεγμένο, αν δεν έχει οριστεί τρέχον).
 * Fail-closed: κανένα layer ⇒ `ok: false` — ο καλών **δεν** γράφει διαστάσεις (ποτέ σιωπηλά στο «0»).
 */
export function ensureDimensionLayer(
  accessor: NamedLayerAccessor,
  style: Pick<DimStyle, 'targetLayer'>,
  history: CommandHistory = getGlobalCommandHistory(),
): EnsureNamedLayerResult {
  const spec = resolveDimensionLayerSpec(style);
  if (spec) return ensureNamedLayer(accessor, spec, history);
  const layerId = currentDimensionLayerId();
  return layerId ? { ok: true, layerId, created: false } : { ok: false, reason: 'no-layer' };
}

/**
 * ADR-929 Δ20 Σ1.3β — η **ανάγνωση** του {@link ensureDimensionLayer}: ίδιοι κλάδοι, ίδια σειρά (σκηνή → υπάρχον →
 * φρουρός ονόματος → νέο), μηδέν εγγραφές. Για την προεπισκόπηση «σε ποιο επίπεδο, και αν θα δημιουργηθεί».
 */
export function planDimensionLayer(
  scene: SceneModel | null,
  style: Pick<DimStyle, 'targetLayer'>,
): DimensionLayerTarget {
  const spec = resolveDimensionLayerSpec(style);
  if (!spec) return currentDimensionLayerId() ? { kind: 'current' } : { kind: 'refused', reason: 'no-layer' };
  if (!scene) return { kind: 'refused', reason: 'no-scene' };
  const existing = findSceneLayerByName(scene, spec.name);
  if (existing) return { kind: 'existing', name: existing.name };
  const guard = guardLayerName({ name: spec.name, scene });
  if (guard) return { kind: 'refused', reason: guard.validationError };
  return { kind: 'create', name: spec.name };
}

/** `DIMLAYER` = `"."`/κενό ⇒ το τρέχον layer, αλλιώς το προεπιλεγμένο (ΕΝΑ σημείο για εγγραφή και προεπισκόπηση). */
function currentDimensionLayerId(): string | null {
  return getCurrentLayerId() || getDefaultLayerId() || null;
}
