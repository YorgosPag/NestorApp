/**
 * EnsureSceneLayerCommand — ADR-929 Δ20 Σ1.2 · η αναιρέσιμη δημιουργία ΕΝΟΣ layer στο έγγραφο.
 *
 * ## Γιατί εντολή και όχι `upsertLayer`
 *
 * Τα layers ζουν σε δύο μέρη (ADR-721 §7): στο **έγγραφο** (`SceneModel.layersById`, που
 * αποθηκεύεται) και στη **runtime προβολή** (`LayerStore`, που ξαναγεμίζει από το έγγραφο σε
 * κάθε hydration). Ένα σκέτο `upsertLayer` φαίνεται στην οθόνη και **χάνεται σιωπηλά** στο
 * επόμενο hydration. Αυτή η εντολή γράφει το layer στο έγγραφο μέσω του ΙΔΙΟΥ writer σκηνής
 * που χρησιμοποιεί η δημιουργία οντοτήτων (`appendEntitiesToScene` → adapter επιπέδου), άρα:
 *   - αποθηκεύεται μαζί με τις οντότητες που θα το χρησιμοποιήσουν·
 *   - μπαίνει στο ΙΔΙΟ βήμα αναίρεσης όταν εκτελείται μέσα σε `runAsSingleUndo` (ADR-729)·
 *     στο Ctrl+Z οι οντότητες (μεταγενέστερες) φεύγουν πρώτα, το layer τελευταίο.
 *
 * Γράφει ΚΑΙ στην προβολή στο ίδιο tick (ίδιο συμβόλαιο με το `layer-flags-writer`), ώστε οι
 * οντότητες που προστίθενται αμέσως μετά να βρίσκουν το layer χωρίς να περιμένουν hydration·
 * το hydration που ακολουθεί γράφει το ΙΔΙΟ αντικείμενο → ο φρουρός ιδεμποτίας κάνει bail.
 *
 * ## Συμβόλαιο
 *   - execute (πρώτη φορά): αν υπάρχει ήδη layer με το ίδιο όνομα (χωρίς διάκριση πεζών,
 *     όπως ο validator ονομάτων) → no-op, `getLayerId()` = το υπάρχον. Αλλιώς προσθέτει.
 *   - undo: αφαιρεί ΜΟΝΟ ό,τι πρόσθεσε η ίδια (ποτέ υπάρχον layer).
 *   - redo: ξαναβάζει το ΙΔΙΟ αντικείμενο (ίδιο `lyr_*` id → οι οντότητες του redo ταιριάζουν).
 *
 * Η επικύρωση ονόματος (`guardLayerName`) γίνεται ΠΡΙΝ την κατασκευή, στην πόρτα
 * `services/named-layer.ts` — η εντολή δέχεται μόνο έγκυρο, ήδη κατασκευασμένο layer.
 *
 * @see services/named-layer.ts — η ΜΙΑ πόρτα «βρες ή φτιάξε» (καλεί αυτή την εντολή)
 * @see services/layer-flags-writer.ts — η αντίστοιχη πόρτα για τις ΙΔΙΟΤΗΤΕΣ layer
 * @see docs/centralized-systems/reference/adrs/ADR-721
 */

import type { SceneLayer, SceneModel } from '../../../types/scene';
import { upsertLayer, removeLayer } from '../../../stores/LayerStore';
import { LayerCommandBase } from './layer-command-base';

/** Η ελάχιστη θύρα προς το έγγραφο ενός επιπέδου (δομικά = `SceneAppendAccessor`). */
export interface SceneLayerDocumentPort {
  readonly levelId: string;
  getLevelScene: (levelId: string) => SceneModel | null;
  setLevelScene: (levelId: string, scene: SceneModel) => void;
}

/** Layer με το ίδιο όνομα (χωρίς διάκριση πεζών — ίδιος κανόνας με το `validateLayerName`). */
export function findSceneLayerByName(scene: SceneModel, name: string): SceneLayer | null {
  const lower = name.toLowerCase();
  for (const layer of Object.values(scene.layersById ?? {})) {
    if (layer.name.toLowerCase() === lower) return layer;
  }
  return null;
}

export class EnsureSceneLayerCommand extends LayerCommandBase {
  readonly name = 'EnsureSceneLayer';
  readonly type = 'layer-ensure';

  /** Το layer που πρόσθεσε η εντολή· `null` αν βρέθηκε υπάρχον (no-op). */
  private added: SceneLayer | null = null;
  private resolvedLayerId: string | null = null;

  constructor(
    private readonly layer: SceneLayer,
    private readonly port: SceneLayerDocumentPort,
  ) {
    super('layer-ensure');
  }

  execute(): void {
    if (this.wasExecuted) {
      this.redo();
      return;
    }
    this.wasExecuted = true;
    const scene = this.port.getLevelScene(this.port.levelId);
    if (!scene) return;
    const existing = findSceneLayerByName(scene, this.layer.name);
    if (existing) {
      this.resolvedLayerId = existing.id;
      return;
    }
    this.added = this.layer;
    this.resolvedLayerId = this.layer.id;
    this.write(scene, this.layer);
  }

  undo(): void {
    if (!this.added) return;
    const scene = this.port.getLevelScene(this.port.levelId);
    const id = this.added.id;
    if (scene?.layersById?.[id]) {
      const layersById: Record<string, SceneLayer> = { ...scene.layersById };
      delete layersById[id];
      this.port.setLevelScene(this.port.levelId, { ...scene, layersById });
    }
    removeLayer(id);
  }

  redo(): void {
    if (!this.added) return;
    const scene = this.port.getLevelScene(this.port.levelId);
    if (!scene || scene.layersById?.[this.added.id]) return;
    this.write(scene, this.added);
  }

  /** Το id του layer που ισχύει μετά το execute (νέο ή υπάρχον)· `null` χωρίς σκηνή. */
  getLayerId(): string | null {
    return this.resolvedLayerId;
  }

  /** TRUE αν η εντολή δημιούργησε το layer (FALSE = βρέθηκε υπάρχον). */
  didCreate(): boolean {
    return this.added !== null;
  }

  getDescription(): string {
    return `Ensure layer — ${this.layer.name}`;
  }

  protected serializeData(): Record<string, unknown> {
    return { levelId: this.port.levelId, layerId: this.layer.id, layerName: this.layer.name };
  }

  private write(scene: SceneModel, layer: SceneLayer): void {
    this.port.setLevelScene(this.port.levelId, {
      ...scene,
      layersById: { ...scene.layersById, [layer.id]: layer },
    });
    upsertLayer(layer);
  }
}
