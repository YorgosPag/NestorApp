/**
 * ADR-344 Phase 6.A — Shared types for DXF text commands.
 *
 * Bridges between the rich DxfTextNode AST (text-engine/types) and the
 * generic SceneEntity model (core/commands/interfaces). Each DXF text
 * entity in the scene carries its full AST under `textNode`.
 *
 * Audit recording is an injected abstraction (Q12). Production wires a
 * concrete recorder that POSTs to /api/audit-trail/record once Phase 7
 * persists DXF text entities to Firestore. Tests inject mocks.
 */

import type { SceneEntity } from '../interfaces';
import type { DxfTextNode } from '../../../text-engine/types';
import type { Point2D } from '../../../rendering/types/Types';

// ── Scene model bridge ────────────────────────────────────────────────────────

/** Scene-level shape of a DXF TEXT/MTEXT entity carrying its rich AST. */
export interface DxfTextSceneEntity extends SceneEntity {
  type: 'text' | 'mtext';
  position: Point2D;
  /** Authoritative source for text content & formatting. */
  textNode: DxfTextNode;
}

// ── Audit (Q12) ───────────────────────────────────────────────────────────────

/** Action verbs recorded for DXF text mutations. */
export type DxfTextAuditAction = 'created' | 'updated' | 'deleted';

/** One field-level diff entry. */
export interface DxfTextAuditChange {
  readonly field: string;
  readonly oldValue: unknown;
  readonly newValue: unknown;
}

/** Audit payload emitted by a text command after successful execute(). */
export interface DxfTextAuditEvent {
  readonly entityId: string;
  readonly action: DxfTextAuditAction;
  readonly changes: readonly DxfTextAuditChange[];
  readonly commandName: string;
  readonly timestamp: number;
}

/**
 * Audit recorder abstraction.
 *
 * `record` is fire-and-forget: audit failures never block the command.
 * Production impl POSTs to /api/audit-trail/record. Tests inject a spy.
 */
export interface IDxfTextAuditRecorder {
  record(event: DxfTextAuditEvent): void;
}

/** No-op recorder used when audit is disabled (e.g. early-phase wiring). */
export const noopAuditRecorder: IDxfTextAuditRecorder = {
  record: () => {},
};

// ── Layer guard (Q8) ──────────────────────────────────────────────────────────

/** Minimal layer info needed by CanEditLayerGuard. */
export interface LayerSnapshot {
  readonly name: string;
  readonly locked: boolean;
  readonly frozen: boolean;
}

/** Permission-aware layer source. */
export interface ILayerAccessProvider {
  getLayer(name: string): LayerSnapshot | undefined;
  /** Capability gate: can the current user unlock layers? */
  canUnlockLayer: boolean;
}

/** Thrown when a mutation targets a locked layer the user cannot unlock. */
export class CanEditLayerError extends Error {
  readonly layerName: string;
  constructor(layerName: string) {
    super(`Layer "${layerName}" is locked and the current user cannot unlock it.`);
    this.name = 'CanEditLayerError';
    this.layerName = layerName;
  }
}
