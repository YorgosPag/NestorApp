/**
 * SET FINISH FACE OVERRIDE COMMAND — ADR-449 PART B Slice C (per-face σοβάς «Paint» writer).
 *
 * Undoable set/clear του per-face **σοβά** override (`params.finish.faceOverrides[ref]`) σε ΕΝΑ
 * δομικό στοιχείο. Αδελφό του `SetFaceAppearanceCommand` (ADR-539) αλλά για το **δέρμα** (σοβάς)
 * αντί για το **σώμα**: το picking χτυπά τον πυρήνα → `side:i` faceKey → `finishFaceRef` της ακμής
 * i του stored footprint → κλειδί στο element spec. Η σιλουέτα (Slice B `pushFinishOverrideEdges`)
 * διαβάζει το ίδιο key → η βαμμένη όψη εμφανίζεται στο ενιαίο blanket (2D+3D).
 *
 *   - value = FinishFaceOverride → βάψε/ντύσε αυτή την όψη σοβά
 *   - value = null               → καθάρισε το override (επιστροφή σε ομοιόμορφο κέλυφος)
 *
 * No-op όταν το στοιχείο δεν έχει ενεργό finish spec (κανένας σοβάς να βαφτεί) ή το faceKey δεν
 * είναι πλευρά (`top`/`bottom` = οριζόντια, εκτός vertical-skin). Snapshot του ΠΛΗΡΟΥΣ spec στο
 * πρώτο `execute()` → undo/redo = pure re-applies. Persist μέσω `signalEntitiesAttached` SSoT.
 *
 * @see core/commands/entity-commands/SetFaceAppearanceCommand.ts — το αδελφό (σώμα, ADR-539)
 * @see bim/finishes/finish-face-override-ops.ts — finishFaceRefForFaceKey + withFinishFaceOverride
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md §PART B
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { FinishFaceOverride, StructuralFinishSpec } from '../../../bim/finishes/structural-finish-types';
import { isFinishActive } from '../../../bim/finishes/structural-finish-types';
import { finishFaceRefForFaceKey, withFinishFaceOverride } from '../../../bim/finishes/finish-face-override-ops';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { signalEntitiesAttached } from './attach-persist-signal';

/** Minimal shape: stored footprint (κολόνα) ή outline (δοκάρι) + params.finish. */
interface FinishPaintableEntity {
  readonly params?: { readonly finish?: StructuralFinishSpec };
  readonly geometry?: {
    readonly footprint?: { readonly vertices?: readonly { x: number; y: number }[] };
    readonly outline?: { readonly vertices?: readonly { x: number; y: number }[] };
  };
}

/** Το stored footprint για finishFaceRef: κολόνα → footprint, δοκάρι → outline. */
function finishFootprintVertices(entity: FinishPaintableEntity): readonly { x: number; y: number }[] | undefined {
  return entity.geometry?.footprint?.vertices ?? entity.geometry?.outline?.vertices;
}

export class SetFinishFaceOverrideCommand implements ICommand {
  readonly id: string;
  readonly name = 'SetFinishFaceOverride';
  readonly type = 'set-finish-face-override';
  readonly timestamp: number;

  private prev: StructuralFinishSpec | undefined;
  private next: StructuralFinishSpec | undefined;
  private resolved = false;
  private wasExecuted = false;

  constructor(
    private readonly entityId: string,
    private readonly faceKey: string,
    private readonly value: FinishFaceOverride | null,
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    if (!this.resolved) {
      this.resolved = true;
      const entity = this.sceneManager.getEntity(this.entityId) as unknown as FinishPaintableEntity | undefined;
      const spec = entity?.params?.finish;
      const verts = entity ? finishFootprintVertices(entity) : undefined;
      // Χωρίς ενεργό σοβά ή έγκυρο footprint → τίποτα να βαφτεί (no-op, μηδέν history entry effect).
      if (!isFinishActive(spec) || !verts) return;
      const ref = finishFaceRefForFaceKey(verts, this.faceKey);
      if (!ref) return; // top/bottom/hole → όχι κάθετη όψη σοβά
      this.prev = spec;
      this.next = withFinishFaceOverride(spec, ref, this.value);
      this.wasExecuted = true;
    }
    if (this.wasExecuted) this.apply(this.next);
  }

  undo(): void {
    if (this.wasExecuted) this.apply(this.prev);
  }

  redo(): void {
    if (this.wasExecuted) this.apply(this.next);
  }

  /** Merge του (νέου/παλιού) finish spec στα params του τρέχοντος entity + persist. */
  private apply(spec: StructuralFinishSpec | undefined): void {
    const entity = this.sceneManager.getEntity(this.entityId) as unknown as
      { params?: Record<string, unknown> } | undefined;
    if (!entity || !spec) return;
    this.sceneManager.updateEntity(
      this.entityId,
      { params: { ...entity.params, finish: spec } } as unknown as Partial<SceneEntity>,
    );
    signalEntitiesAttached(this.sceneManager, [this.entityId]);
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Set finish face override (${this.faceKey}) on ${this.entityId}`;
  }

  getAffectedEntityIds(): string[] {
    return [this.entityId];
  }

  validate(): string | null {
    if (!this.entityId) return 'Entity id is required';
    if (!this.faceKey) return 'faceKey is required';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { entityId: this.entityId, faceKey: this.faceKey, value: this.value },
      version: 1,
    };
  }
}
