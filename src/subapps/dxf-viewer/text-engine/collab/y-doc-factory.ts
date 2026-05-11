/**
 * ADR-344 Phase 4 — Y.Doc factory for collaborative DXF text editing.
 *
 * Each editable MTEXT entity in a drawing gets its own Y.Doc instance.
 * The doc carries:
 *   - one Y.XmlFragment (`'mtext'`) — the ProseMirror tree synced through
 *     `ySyncPlugin` and edited via TipTap;
 *   - one Y.Map (`'meta'`) — DXF entity metadata (insertion point, layer,
 *     attachment, rotation, annotation scales) that lives outside the
 *     ProseMirror tree but still needs collaborative sync.
 *
 * The Y.Doc id is the DXF entity's enterprise ID so re-joining a session
 * is idempotent.
 *
 * @module text-engine/collab/y-doc-factory
 */

import * as Y from 'yjs';

// ── Named structures inside every DXF-text Y.Doc ──────────────────────────────

export const DXF_TEXT_FRAGMENT_NAME = 'mtext';
export const DXF_METADATA_MAP_NAME = 'meta';

// ── Factory ───────────────────────────────────────────────────────────────────

export interface CreateYDocOptions {
  /** DXF entity enterprise ID (used as the Y.Doc.guid). */
  readonly entityId: string;
}

/**
 * Allocate a Y.Doc for one DXF text entity, pre-creating the named
 * fragment + metadata map so subscribers can hook them immediately.
 */
export function createDxfTextYDoc(opts: CreateYDocOptions): Y.Doc {
  const doc = new Y.Doc({ guid: opts.entityId });
  doc.getXmlFragment(DXF_TEXT_FRAGMENT_NAME);
  doc.getMap(DXF_METADATA_MAP_NAME);
  return doc;
}

/** Access the canonical text fragment for a given DXF-text Y.Doc. */
export function getDxfTextFragment(doc: Y.Doc): Y.XmlFragment {
  return doc.getXmlFragment(DXF_TEXT_FRAGMENT_NAME);
}

/** Access the canonical metadata map for a given DXF-text Y.Doc. */
export function getDxfMetadataMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(DXF_METADATA_MAP_NAME);
}

// ── Snapshot / restore (Q15 prep — IndexedDB draft recovery) ─────────────────

/**
 * Serialise the current Y.Doc state as a compact binary update.
 * Suitable for IndexedDB storage (auto-save / crash recovery, ADR-344 Q15).
 */
export function snapshotYDoc(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc);
}

/**
 * Re-apply a previously snapshotted state onto a fresh Y.Doc.
 * Use after createDxfTextYDoc to restore an auto-saved draft.
 */
export function restoreYDoc(doc: Y.Doc, snapshot: Uint8Array): void {
  Y.applyUpdate(doc, snapshot);
}
