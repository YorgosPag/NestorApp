'use client';

/**
 * ADR-344 Phase 5.H — TipTap editor overlay.
 *
 * Mounts a TipTap React `<EditorContent />` over the canvas while the
 * user is actively editing a text entity (Q1 — TipTap v3 path). The
 * editor is bound to:
 *   - `dxfTextExtensions` (Phase 4) — DXF-specific marks + StackNode.
 *   - `@tiptap/starter-kit` — Document, Paragraph, Text, Bold/Italic/
 *     Strike/Underline, History.
 *   - `Color` + `TextStyle` + `FontFamily` — color and font binding to
 *     the toolbar store.
 *   - `createYjsTipTapExtension` (Phase 4) — when a Y.Doc is supplied,
 *     enables real-time collaboration (Q4).
 *
 * On commit (Ctrl+Enter or `commit()` callback), the editor's JSON is
 * passed to the host as a `DxfTextNode` via Phase 4's `tipTapToDxfText`
 * — the host dispatches the resulting node through `CreateTextCommand`
 * or `UpdateMTextParagraphCommand` (Phase 6).
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import type { Content } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
// TipTap v3: TextStyle, Color and FontFamily are all named exports of the
// consolidated `@tiptap/extension-text-style` package — the standalone
// `@tiptap/extension-color` / `extension-font-family` modules no longer
// expose a default export. See ADR-344 Phase 6.E commit.
import { TextStyle, Color, FontFamily } from '@tiptap/extension-text-style';
import type { Doc as YDoc } from 'yjs';
import { cn } from '@/lib/utils';
import { dxfTextExtensions } from '../../text-engine/edit';
import { tipTapToDxfText, dxfTextToTipTap } from '../../text-engine/edit';
import { createYjsTipTapExtension } from '../../text-engine/collab';
import { useTextEditingStore } from '../../state/text-toolbar';
import { useVisualViewport } from './responsive';
import type { DxfTextNode } from '../../text-engine/types';
import type { TipTapDoc } from '../../text-engine/edit';

interface TextEditorOverlayProps {
  readonly entityId: string;
  readonly initial: DxfTextNode;
  /** Optional collaborative Y.Doc — when supplied, multi-user editing is live. */
  readonly yDoc?: YDoc;
  /** Pixel rectangle on the canvas where the overlay should appear. */
  readonly anchorRect: { readonly left: number; readonly top: number; readonly width: number; readonly height: number };
  /** Called when the user commits (Enter+Ctrl, blur, etc.) with the resulting DxfTextNode. */
  readonly onCommit: (next: DxfTextNode) => void;
  readonly onCancel: () => void;
}

export function TextEditorOverlay({
  entityId,
  initial,
  yDoc,
  anchorRect,
  onCommit,
  onCancel,
}: TextEditorOverlayProps) {
  const updateDraft = useTextEditingStore((s) => s.updateDraft);
  const beginEdit = useTextEditingStore((s) => s.beginEdit);
  const endEdit = useTextEditingStore((s) => s.endEdit);
  const { keyboardInset } = useVisualViewport();
  const committedRef = useRef(false);

  const extensions = useMemo(() => {
    const base = [
      StarterKit.configure({
        // Yjs handles undo/redo when collab is active — disable StarterKit's.
        undoRedo: yDoc ? false : undefined,
      }),
      TextStyle,
      Color,
      FontFamily,
      ...dxfTextExtensions,
    ];
    if (yDoc) {
      base.push(createYjsTipTapExtension({ doc: yDoc }));
    }
    return base;
  }, [yDoc]);

  const initialContent = useMemo<TipTapDoc | undefined>(() => {
    if (yDoc) return undefined; // Yjs owns the content when present.
    return dxfTextToTipTap(initial);
  }, [initial, yDoc]);

  const editor: Editor | null = useEditor(
    {
      immediatelyRender: false,
      extensions,
      content: initialContent as Content | undefined,
      autofocus: 'end',
      editorProps: {
        attributes: {
          class: cn(
            'outline-none focus:outline-none focus:ring-2 focus:ring-primary',
            'p-2 bg-background text-foreground rounded',
            'min-w-[120px] min-h-[1.5em]',
          ),
        },
      },
      onUpdate: ({ editor: e }) => {
        const json = e.getJSON() as unknown as TipTapDoc;
        try {
          const draft = tipTapToDxfText(json);
          updateDraft(draft);
        } catch {
          // Mid-edit invalid state — ignore until next tick.
        }
      },
    },
    [extensions],
  );

  // Sync edit session lifecycle in the store.
  useEffect(() => {
    beginEdit(entityId, initial);
    return () => {
      endEdit();
    };
  }, [entityId, initial, beginEdit, endEdit]);

  const commit = useCallback(() => {
    if (!editor || committedRef.current) return;
    committedRef.current = true;
    const json = editor.getJSON() as unknown as TipTapDoc;
    const next = tipTapToDxfText(json);
    onCommit(next);
  }, [editor, onCommit]);

  const cancel = useCallback(() => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCancel();
  }, [onCancel]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    },
    [commit, cancel],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
      onBlur={(e) => {
        // Commit only when focus genuinely leaves the overlay subtree.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          commit();
        }
      }}
      className={cn(
        'fixed z-40',
        'touch-pan-x touch-pan-y',
      )}
      style={{
        left: anchorRect.left,
        top: keyboardInset > 0 ? Math.min(anchorRect.top, window.innerHeight - keyboardInset - 120) : anchorRect.top,
        minWidth: anchorRect.width,
        minHeight: anchorRect.height,
      }}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
