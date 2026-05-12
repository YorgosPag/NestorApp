/**
 * ADR-344 Phase 6.E follow-up — UpdateTextAnnotationScalesCommand.
 *
 * Patches the per-entity annotation scale list on a TEXT/MTEXT entity.
 * Updates both the DxfTextNode AST fields (isAnnotative, annotationScales)
 * AND the flat entity fields so resolveAnnotativeEntity (Phase 11) can
 * read them at render time without textNode dependency.
 *
 * AutoCAD parity: equivalent to OBJECTSCALE Add/Delete. Setting a non-empty
 * list automatically marks the entity as annotative.
 */

import type { ICommand, ISceneManager, SerializedCommand } from '../interfaces';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import type { DxfTextNode, AnnotationScale } from '../../../text-engine/types';
import {
  noopAuditRecorder,
  type DxfTextSceneEntity,
  type IDxfTextAuditRecorder,
  type ILayerAccessProvider,
} from './types';
import { assertCanEditLayer } from './CanEditLayerGuard';
import { ensureTextNode } from '../../../text-engine/edit/ensure-text-node';

export interface UpdateTextAnnotationScalesCommandInput {
  readonly entityId: string;
  readonly annotationScales: readonly AnnotationScale[];
}

interface ScalesSnapshot {
  readonly textNode: DxfTextNode;
  readonly isAnnotative: boolean | undefined;
  readonly annotationScales: readonly AnnotationScale[] | undefined;
}

export class UpdateTextAnnotationScalesCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateTextAnnotationScales';
  readonly type = 'update-text-annotation-scales';
  readonly timestamp: number;

  private snapshot: ScalesSnapshot | null = null;
  private wasExecuted = false;

  constructor(
    private readonly input: UpdateTextAnnotationScalesCommandInput,
    private readonly sceneManager: ISceneManager,
    private readonly layerProvider: ILayerAccessProvider,
    private readonly auditRecorder: IDxfTextAuditRecorder = noopAuditRecorder,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    const entity = this.sceneManager.getEntity(this.input.entityId) as DxfTextSceneEntity | undefined;
    if (!entity) return;
    assertCanEditLayer({ layerName: entity.layer, provider: this.layerProvider });

    const safeNode = ensureTextNode(entity);
    if (!this.snapshot) {
      const raw = entity as Record<string, unknown>;
      this.snapshot = {
        textNode: safeNode,
        isAnnotative: raw['isAnnotative'] as boolean | undefined,
        annotationScales: raw['annotationScales'] as readonly AnnotationScale[] | undefined,
      };
    }

    const isAnnotative = this.input.annotationScales.length > 0;
    const nextNode: DxfTextNode = {
      ...safeNode,
      isAnnotative,
      annotationScales: this.input.annotationScales,
    };

    this.sceneManager.updateEntity(this.input.entityId, {
      textNode: nextNode,
      isAnnotative,
      annotationScales: this.input.annotationScales,
    });
    this.wasExecuted = true;

    this.auditRecorder.record({
      entityId: this.input.entityId,
      action: 'updated',
      changes: [
        {
          field: 'annotationScales',
          oldValue: this.snapshot.annotationScales ?? [],
          newValue: this.input.annotationScales,
        },
      ],
      commandName: this.name,
      timestamp: Date.now(),
    });
  }

  undo(): void {
    if (!this.snapshot || !this.wasExecuted) return;
    this.sceneManager.updateEntity(this.input.entityId, {
      textNode: this.snapshot.textNode,
      isAnnotative: this.snapshot.isAnnotative,
      annotationScales: this.snapshot.annotationScales,
    });
  }

  redo(): void {
    this.execute();
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Update annotation scales (${this.input.annotationScales.length})`;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        entityId: this.input.entityId,
        annotationScales: this.input.annotationScales as unknown as Record<string, unknown>[],
      },
      version: 1,
    };
  }

  validate(): string | null {
    if (!this.input.entityId) return 'entityId is required';
    return null;
  }

  getAffectedEntityIds(): string[] {
    return [this.input.entityId];
  }
}
