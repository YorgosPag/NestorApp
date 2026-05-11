/**
 * ADR-344 Phase 4 — TipTap Extension that wires Y.Doc → ProseMirror.
 *
 * Wraps the y-prosemirror `ySyncPlugin` + `yUndoPlugin` + optional cursor
 * plugin into a single TipTap Extension. Mounting this extension on a
 * TipTap editor makes every edit flow through the supplied Y.Doc and
 * back out to all peer replicas.
 *
 * Cursor / selection presence is opt-in: pass an `awareness` (from any
 * y-protocol provider — y-websocket, y-webrtc, y-indexeddb…) to get
 * remote cursors painted on the editor surface.
 *
 * @module text-engine/collab/yjs-tiptap-extension
 */

import { Extension } from '@tiptap/core';
import { ySyncPlugin, yUndoPlugin, yCursorPlugin } from 'y-prosemirror';
import type * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';
import { getDxfTextFragment } from './y-doc-factory';

export interface YjsTipTapOptions {
  /** Y.Doc for this DXF entity (one per editable MTEXT). */
  readonly doc: Y.Doc;
  /** Optional Awareness instance — pass to enable remote cursors. */
  readonly awareness: Awareness | null;
  /** Local user display info for remote cursor labels. */
  readonly user: { readonly name: string; readonly color: string } | null;
}

/**
 * Build a TipTap Extension that syncs the editor state through the given
 * Y.Doc. Mount alongside the Document / Paragraph / Text / Bold /
 * Italic / Strike / Underline / History extensions in Phase 5.
 *
 * Note: `yUndoPlugin` replaces TipTap's built-in History — disable
 * History on the editor when this extension is present, otherwise undo
 * stacks compete.
 */
export function createYjsTipTapExtension(opts: YjsTipTapOptions): Extension {
  return Extension.create({
    name: 'dxfYjsCollab',
    priority: 1000,
    addProseMirrorPlugins() {
      const fragment = getDxfTextFragment(opts.doc);
      const plugins = [ySyncPlugin(fragment), yUndoPlugin()];
      if (opts.awareness) {
        if (opts.user) opts.awareness.setLocalStateField('user', opts.user);
        plugins.push(yCursorPlugin(opts.awareness));
      }
      return plugins;
    },
  });
}
