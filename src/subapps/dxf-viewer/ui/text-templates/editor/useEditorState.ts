/**
 * ADR-344 Phase 7.D — Editor form state hook.
 *
 * Bundles the form fields (`name`, `category`, `contentText`) plus derived
 * state (`isDirty`, `unknownPlaceholders`, `nameError`) into a single hook
 * so the dialog component stays presentational.
 */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  classifyPlaceholders,
  TEXT_TEMPLATE_NAME_MAX,
  type TextTemplate,
  type TextTemplateCategory,
} from '@/subapps/dxf-viewer/text-engine/templates';
import { astToPlainText, plainTextToAst, EDITOR_AST_FALLBACK } from './text-ast-bridge';

interface UseEditorStateArgs {
  readonly seed: TextTemplate | null;
  readonly open: boolean;
}

export interface EditorStateResult {
  readonly name: string;
  readonly category: TextTemplateCategory;
  readonly contentText: string;
  readonly isDirty: boolean;
  readonly nameError: string | null;
  readonly contentError: string | null;
  readonly unknownPlaceholders: readonly string[];
  readonly setName: (v: string) => void;
  readonly setCategory: (v: TextTemplateCategory) => void;
  readonly setContentText: (v: string) => void;
  readonly insertAtCaret: (token: string) => void;
  readonly textareaRef: React.RefObject<HTMLTextAreaElement>;
  readonly buildSubmissionContent: () => ReturnType<typeof plainTextToAst>;
  readonly contentChanged: boolean;
}

const DEFAULT_CATEGORY: TextTemplateCategory = 'custom';

export function useEditorState({ seed, open }: UseEditorStateArgs): EditorStateResult {
  const [name, setName] = useState(seed?.name ?? '');
  const [category, setCategory] = useState<TextTemplateCategory>(seed?.category ?? DEFAULT_CATEGORY);
  const initialContentText = useMemo(
    () => (seed ? astToPlainText(seed.content) : ''),
    [seed],
  );
  const [contentText, setContentText] = useState(initialContentText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(seed?.name ?? '');
    setCategory(seed?.category ?? DEFAULT_CATEGORY);
    setContentText(seed ? astToPlainText(seed.content) : '');
  }, [seed, open]);

  const nameError = useMemo<string | null>(() => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return 'empty';
    if (trimmed.length > TEXT_TEMPLATE_NAME_MAX) return 'tooLong';
    return null;
  }, [name]);

  const contentError = useMemo<string | null>(
    () => (contentText.trim().length === 0 ? 'empty' : null),
    [contentText],
  );

  const unknownPlaceholders = useMemo(
    () => classifyPlaceholders(contentText).unknown,
    [contentText],
  );

  const contentChanged = contentText !== initialContentText;
  const isDirty =
    name !== (seed?.name ?? '') ||
    category !== (seed?.category ?? DEFAULT_CATEGORY) ||
    contentChanged;

  const insertAtCaret = useCallback((token: string) => {
    const el = textareaRef.current;
    if (!el) {
      setContentText((prev) => prev + token);
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + token + el.value.slice(end);
    setContentText(next);
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + token.length;
      el.setSelectionRange(caret, caret);
    });
  }, []);

  const buildSubmissionContent = useCallback(
    () => plainTextToAst(contentText, seed?.content ?? EDITOR_AST_FALLBACK),
    [contentText, seed],
  );

  return {
    name,
    category,
    contentText,
    isDirty,
    nameError,
    contentError,
    unknownPlaceholders,
    setName,
    setCategory,
    setContentText,
    insertAtCaret,
    textareaRef,
    buildSubmissionContent,
    contentChanged,
  };
}
