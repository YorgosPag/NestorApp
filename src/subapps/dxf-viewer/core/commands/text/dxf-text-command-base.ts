/**
 * @module core/commands/text/dxf-text-command-base
 * @description Template-Method bases for DXF text mutation commands (ADR-614).
 *
 * The `core/commands/text` family shared a large body of `ICommand`
 * boilerplate copy-pasted across every file: id/timestamp init, `redo()`,
 * `canMergeWith()`, the `serialize()` envelope, `getAffectedEntityIds()`, the
 * `validate()` entityId guard, and — most of all — the execute preamble
 * (`getEntity` → `assertCanEditLayer(resolveEntityLayerName(entity))` →
 * snapshot capture) plus the `undo()` restore. This module centralises all of
 * it behind two Template-Method roots, in the spirit of the AutoCAD / Revit
 * "transaction command" architecture (one lifecycle, thin leaves).
 *
 * Layering (mirrors ADR-610 attach/detach + ADR-613 guide bases):
 *   BaseCommand  (generic ICommand root — ADR-613)
 *     └─ DxfTextCommandBase       (single-entity text boilerplate + guarded resolve)
 *          └─ DxfTextNodeMutationCommand  (read → snapshot → mutate → audit / undo)
 *
 * @see ADR-614 (Text command SSoT)
 * @see ../base-command.ts (generic BaseCommand)
 * @since 2026-07-09
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type { DxfTextNode } from '../../../text-engine/types';
import { BaseCommand } from '../base-command';
import { assertCanEditLayer } from './CanEditLayerGuard';
// 🏢 ADR-358 Phase 9D-3: id-first reader SSoT
import { resolveEntityLayerName } from '../../../stores/LayerStore';
import { ensureTextNode } from '../../../text-engine/edit/ensure-text-node';
// ADR-344 Φ-3D — ο flat καθρέφτης `.text` συντηρείται σε κάθε εγγραφή του AST (βλ. `mirrorFlatText`).
import { extractFlatText } from '../../../utils/text-node-utils';
import {
  noopAuditRecorder,
  type DxfTextSceneEntity,
  type DxfTextAuditAction,
  type DxfTextAuditChange,
  type IDxfTextAuditRecorder,
  type ILayerAccessProvider,
} from './types';

/**
 * Resolve a text entity and assert its layer is editable (Q8 guard). Returns
 * `undefined` when the entity is gone so callers can no-op — mirroring every
 * legacy text command's `if (!entity) return`. Exposed as a free function so
 * multi-entity / no-layer outliers (ReplaceAll, Create) reuse it too.
 */
export function resolveEditableTextEntity(
  entityId: string,
  sceneManager: ISceneManager,
  layerProvider: ILayerAccessProvider,
): DxfTextSceneEntity | undefined {
  const entity = sceneManager.getEntity(entityId) as DxfTextSceneEntity | undefined;
  if (!entity) return undefined;
  // ADR-358 Phase 9D-3b: id-first via LayerStore, name fallback
  assertCanEditLayer({ layerName: resolveEntityLayerName(entity) ?? '', provider: layerProvider });
  return entity;
}

/**
 * Emit one audit event, stamping the command name + a fresh timestamp. Free
 * function so multi-entity / no-layer outliers (ReplaceAll, Create) that extend
 * {@link BaseCommand} directly share the same envelope construction.
 */
export function recordTextAudit(
  recorder: IDxfTextAuditRecorder,
  commandName: string,
  entityId: string,
  action: DxfTextAuditAction,
  changes: readonly DxfTextAuditChange[],
): void {
  recorder.record({ entityId, action, changes, commandName, timestamp: Date.now() });
}

/**
 * Shallow-merge two `{ patch }` command inputs (this-then-other precedence) for
 * drag-style command coalescing. Shared by the patch-mergeable text commands
 * (UpdateTextStyle / UpdateTextGeometry) so the merge rule lives in one place.
 */
export function mergePatchInputs<I extends { readonly patch: object }>(a: I, b: I): I {
  return { ...a, patch: { ...a.patch, ...b.patch } };
}

/** Shared "patch must not be empty" rule for patch-bearing text commands. */
export function validateNonEmptyPatch(patch: object | undefined): string | null {
  if (!patch || Object.keys(patch).length === 0) return 'patch must not be empty';
  return null;
}

/** Shared `<label> (fieldA, fieldB)` history description for patch commands. */
export function describePatchFields(label: string, patch: object): string {
  return `${label} (${Object.keys(patch).join(', ') || 'no fields'})`;
}

/** Minimal shape shared by every single-entity text command input. */
export interface SingleEntityInput {
  readonly entityId: string;
}

/**
 * Boilerplate base for single-entity DXF text commands. Owns the injected
 * collaborators, the affected-id contract and the entityId-first validation,
 * leaving concrete commands only their execute/undo behaviour and payload.
 */
export abstract class DxfTextCommandBase<I extends SingleEntityInput> extends BaseCommand {
  protected wasExecuted = false;

  constructor(
    protected readonly input: I,
    protected readonly sceneManager: ISceneManager,
    protected readonly layerProvider: ILayerAccessProvider,
    protected readonly auditRecorder: IDxfTextAuditRecorder = noopAuditRecorder,
  ) {
    super();
  }

  /** The single entity this command mutates. */
  protected get entityId(): string {
    return this.input.entityId;
  }

  /** Resolve + layer-guard this command's target entity (undefined if gone). */
  protected resolveEntity(): DxfTextSceneEntity | undefined {
    return resolveEditableTextEntity(this.entityId, this.sceneManager, this.layerProvider);
  }

  /** Emit an audit event for this command, stamping name + fresh timestamp. */
  protected recordAudit(
    action: DxfTextAuditAction,
    changes: readonly DxfTextAuditChange[],
    entityId: string = this.entityId,
  ): void {
    recordTextAudit(this.auditRecorder, this.name, entityId, action, changes);
  }

  getAffectedEntityIds(): string[] {
    return [this.entityId];
  }

  validate(): string | null {
    if (!this.entityId) return 'entityId is required';
    return this.validatePayload();
  }

  /** Payload-specific validation beyond the entityId presence check. */
  protected validatePayload(): string | null {
    return null;
  }
}

/**
 * ADR-344 Φ-3D — κάθε patch που αγγίζει το `textNode` συγχρονίζει ΚΑΙ τον flat καθρέφτη `text`.
 *
 * Το `textNode` (AST) είναι το canonical· το flat `.text` είναι **παράγωγος καθρέφτης** που
 * ο import γεμίζει μία φορά (`dxf-text-converters`: `plainText = extractFlatText(textNode)`)
 * και μετά κανείς δεν ξαναγγίζει. Κάθε text command έγραφε μόνο το AST, οπότε ο καθρέφτης
 * έμενε στο ΠΡΟ-ΕΠΕΞΕΡΓΑΣΙΑΣ κείμενο για πάντα (Giorgio 2026-07-28: «ο καμβάς κρατάει το
 * αρχικό κείμενο»).
 *
 * Το render path διορθώθηκε να διαβάζει το canonical (`project-scene-text` →
 * `resolveEntityText`)· αυτό εδώ είναι το **belt-and-suspenders** (N.7.2 #4) για κάθε
 * καταναλωτή που διαβάζει το scene `.text` απευθείας — export DXF/TEK, clip, snap — και
 * για όποιον γραφτεί αύριο. Ένας καθρέφτης που δεν συντηρείται είναι χειρότερος από
 * ανύπαρκτος: μοιάζει έγκυρος.
 *
 * Ισχύει **και στο `undo()`** — αλλιώς η αναίρεση θα επανέφερε το AST αφήνοντας τον
 * καθρέφτη στο νέο κείμενο, δηλαδή θα δημιουργούσε το ίδιο σφάλμα ανάποδα.
 */
function mirrorFlatText(updates: Partial<SceneEntity>): Partial<SceneEntity> {
  const node = (updates as { textNode?: DxfTextNode }).textNode;
  return node ? { ...updates, text: extractFlatText(node) } as Partial<SceneEntity> : updates;
}

/** Outcome of a text-node mutation: the scene patch + the audit changes. */
export interface TextNodeMutationResult {
  /** Partial scene entity patch applied via `sceneManager.updateEntity`. */
  readonly updates: Partial<SceneEntity>;
  /** Field-level diff recorded on the audit trail. */
  readonly changes: readonly DxfTextAuditChange[];
  /** Audit verb — defaults to `'updated'`. */
  readonly action?: DxfTextAuditAction;
}

/**
 * Template-Method base for the dominant single-entity text mutation: read the
 * working node → snapshot it once → apply a domain patch → commit → audit;
 * `undo()` restores the snapshot. Concrete commands implement only
 * {@link applyMutation} (+ optional {@link readNode}/{@link restoreUpdates})
 * and their serialized payload.
 */
export abstract class DxfTextNodeMutationCommand<
  I extends SingleEntityInput,
> extends DxfTextCommandBase<I> {
  protected snapshot: DxfTextNode | null = null;

  execute(): void {
    const entity = this.resolveEntity();
    if (!entity) return;
    const node = this.readNode(entity);
    if (!this.snapshot) this.snapshot = node;
    const result = this.applyMutation(entity, node, this.snapshot);
    if (!result) return;
    this.sceneManager.updateEntity(this.entityId, mirrorFlatText(result.updates));
    this.wasExecuted = true;
    this.recordAudit(result.action ?? 'updated', result.changes);
  }

  undo(): void {
    if (!this.snapshot || !this.wasExecuted) return;
    this.sceneManager.updateEntity(this.entityId, mirrorFlatText(this.restoreUpdates(this.snapshot)));
  }

  /** How to read the working node. Defaults to migration-safe `ensureTextNode`. */
  protected readNode(entity: DxfTextSceneEntity): DxfTextNode {
    return ensureTextNode(entity);
  }

  /** Scene patch that reverts the mutation. Defaults to restoring the node. */
  protected restoreUpdates(snapshot: DxfTextNode): Partial<SceneEntity> {
    return { textNode: snapshot };
  }

  /**
   * Domain mutation. Return the scene patch + audit changes, or `null` to
   * no-op (e.g. nothing matched) — leaving `wasExecuted` false so undo is inert.
   */
  protected abstract applyMutation(
    entity: DxfTextSceneEntity,
    node: DxfTextNode,
    snapshot: DxfTextNode,
  ): TextNodeMutationResult | null;
}
