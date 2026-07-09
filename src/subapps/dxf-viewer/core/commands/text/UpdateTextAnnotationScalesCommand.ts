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
 *
 * ADR-614 — boilerplate inherited from {@link DxfTextCommandBase}; the flat
 * mirror fields require a richer snapshot, so execute/undo are bespoke here.
 */

import type { DxfTextNode, AnnotationScale } from '../../../text-engine/types';
import { ensureTextNode } from '../../../text-engine/edit/ensure-text-node';
import { DxfTextCommandBase } from './dxf-text-command-base';

export interface UpdateTextAnnotationScalesCommandInput {
  readonly entityId: string;
  readonly annotationScales: readonly AnnotationScale[];
}

interface ScalesSnapshot {
  readonly textNode: DxfTextNode;
  readonly isAnnotative: boolean | undefined;
  readonly annotationScales: readonly AnnotationScale[] | undefined;
}

export class UpdateTextAnnotationScalesCommand extends DxfTextCommandBase<UpdateTextAnnotationScalesCommandInput> {
  readonly name = 'UpdateTextAnnotationScales';
  readonly type = 'update-text-annotation-scales';

  private snapshot: ScalesSnapshot | null = null;

  execute(): void {
    const entity = this.resolveEntity();
    if (!entity) return;

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

    this.sceneManager.updateEntity(this.entityId, {
      textNode: nextNode,
      isAnnotative,
      annotationScales: this.input.annotationScales,
    });
    this.wasExecuted = true;
    this.recordAudit('updated', [
      {
        field: 'annotationScales',
        oldValue: this.snapshot.annotationScales ?? [],
        newValue: this.input.annotationScales,
      },
    ]);
  }

  undo(): void {
    if (!this.snapshot || !this.wasExecuted) return;
    this.sceneManager.updateEntity(this.entityId, {
      textNode: this.snapshot.textNode,
      isAnnotative: this.snapshot.isAnnotative,
      annotationScales: this.snapshot.annotationScales,
    });
  }

  getDescription(): string {
    return `Update annotation scales (${this.input.annotationScales.length})`;
  }

  protected serializeData(): Record<string, unknown> {
    return {
      entityId: this.entityId,
      annotationScales: this.input.annotationScales as unknown as Record<string, unknown>[],
    };
  }
}
