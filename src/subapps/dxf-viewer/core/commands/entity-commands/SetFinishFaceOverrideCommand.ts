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

import type { ISceneManager, SceneEntity } from '../interfaces';
import type { FinishFaceOverride, StructuralFinishSpec } from '../../../bim/finishes/structural-finish-types';
import { isFinishActive } from '../../../bim/finishes/structural-finish-types';
import { finishFaceRefForFaceKey, withFinishFaceOverride } from '../../../bim/finishes/finish-face-override-ops';
import {
  EntityFieldOverrideCommand,
  validateFaceKeyOverride,
  faceKeyOverrideData,
} from './entity-field-override-command';

/** Minimal shape: stored footprint (κολόνα) / outline (δοκάρι geometry· πλάκα params) + params.finish. */
interface FinishPaintableEntity {
  readonly params?: {
    readonly finish?: StructuralFinishSpec;
    /** ADR-534 Φ6b — outline πλάκας (SlabParams.outline): το stored footprint για finishFaceRef. */
    readonly outline?: { readonly vertices?: readonly { x: number; y: number }[] };
  };
  readonly geometry?: {
    readonly footprint?: { readonly vertices?: readonly { x: number; y: number }[] };
    readonly outline?: { readonly vertices?: readonly { x: number; y: number }[] };
  };
}

/** Το stored footprint για finishFaceRef: κολόνα → footprint, δοκάρι → geometry.outline, πλάκα → params.outline. */
function finishFootprintVertices(entity: FinishPaintableEntity): readonly { x: number; y: number }[] | undefined {
  return entity.geometry?.footprint?.vertices ?? entity.geometry?.outline?.vertices ?? entity.params?.outline?.vertices;
}

export class SetFinishFaceOverrideCommand extends EntityFieldOverrideCommand<StructuralFinishSpec> {
  readonly name = 'SetFinishFaceOverride';
  readonly type = 'set-finish-face-override';

  constructor(
    entityId: string,
    private readonly faceKey: string,
    private readonly value: FinishFaceOverride | null,
    sceneManager: ISceneManager,
  ) {
    super(entityId, sceneManager);
  }

  protected snapshotStates(): { prev: StructuralFinishSpec | undefined; next: StructuralFinishSpec | undefined } | null {
    const entity = this.sceneManager.getEntity(this.entityId) as unknown as FinishPaintableEntity | undefined;
    const spec = entity?.params?.finish;
    const verts = entity ? finishFootprintVertices(entity) : undefined;
    // Χωρίς ενεργό σοβά ή έγκυρο footprint → τίποτα να βαφτεί (no-op, μηδέν history entry effect).
    if (!isFinishActive(spec) || !verts) return null;
    const ref = finishFaceRefForFaceKey(verts, this.faceKey);
    if (!ref) return null; // top/bottom/hole → όχι κάθετη όψη σοβά
    return { prev: spec, next: withFinishFaceOverride(spec, ref, this.value) };
  }

  /** Merge του (νέου/παλιού) finish spec στα params του τρέχοντος entity. */
  protected writeValue(spec: StructuralFinishSpec | undefined): boolean {
    const entity = this.sceneManager.getEntity(this.entityId) as unknown as
      { params?: Record<string, unknown> } | undefined;
    if (!entity || !spec) return false;
    this.sceneManager.updateEntity(
      this.entityId,
      { params: { ...entity.params, finish: spec } } as unknown as Partial<SceneEntity>,
    );
    return true;
  }

  validate(): string | null {
    return validateFaceKeyOverride(this.entityId, this.faceKey);
  }

  getDescription(): string {
    return `Set finish face override (${this.faceKey}) on ${this.entityId}`;
  }

  protected serializeData(): Record<string, unknown> {
    return faceKeyOverrideData(this.entityId, this.faceKey, this.value);
  }
}
