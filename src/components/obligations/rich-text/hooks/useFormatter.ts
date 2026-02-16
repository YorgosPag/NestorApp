"use client";

import { useCallback } from 'react';
import { getSelection, restoreCaret } from '../utils/selection';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useFormatter');

interface UseFormatterProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (newValue: string) => void;
}

export function useFormatter(props: UseFormatterProps) {
  const { textareaRef } = props;
  const applyFormatting = useCallback((before: string, after: string = '', placeholder: string = '') => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const currentValue = textarea.value;
    let { start, end, selectedText } = getSelection(textarea);

    // Smart text selection: if nothing selected, select word at cursor
    if (start === end) {
      const wordBounds = findWordBounds(currentValue, start);
      start = wordBounds.start;
      end = wordBounds.end;
      selectedText = currentValue.substring(start, end);
    }

    const textToInsert = selectedText || placeholder;

    const newValue =
      currentValue.substring(0, start) +
      before + textToInsert + after +
      currentValue.substring(end);

    // Update textarea value directly first
    textarea.value = newValue;

    // Then trigger onChange event to sync with parent
    const event = new Event('input', { bubbles: true });
    textarea.dispatchEvent(event);

    // Position cursor after inserted text
    const newCursorPos = start + before.length + textToInsert.length + after.length;
    restoreCaret(textarea, newCursorPos);
  }, [textareaRef]);

  // Helper function to find word boundaries
  const findWordBounds = (text: string, position: number) => {
    const wordRegex = /\w/;
    let start = position;
    let end = position;

    // Find start of word
    while (start > 0 && wordRegex.test(text[start - 1])) {
      start--;
    }

    // Find end of word
    while (end < text.length && wordRegex.test(text[end])) {
      end++;
    }

    return { start, end };
  };

  // 🌐 i18n: List placeholders converted to i18n keys - 2026-01-18
  const insertList = useCallback((prefix: string) => {
    if (!textareaRef.current) return;

    // Get current value directly from textarea
    const currentValue = textareaRef.current.value;
    const { start } = getSelection(textareaRef.current);
    const listItems = [`${prefix} richText.placeholders.firstItem`, `${prefix} richText.placeholders.secondItem`, `${prefix} richText.placeholders.thirdItem`];
    const textToInsert = '\n' + listItems.join('\n') + '\n';

    const newValue = currentValue.substring(0, start) + textToInsert + currentValue.substring(start);

    // Update textarea value directly first
    textareaRef.current.value = newValue;

    // Then trigger onChange event to sync with parent
    const event = new Event('input', { bubbles: true });
    textareaRef.current.dispatchEvent(event);

    restoreCaret(textareaRef.current, start + textToInsert.length);
  }, [textareaRef]);

  // 🌐 i18n: Format placeholders converted to i18n keys - 2026-01-18
  const formatBold = useCallback(() => {
    logger.info('formatBold called'); // DEBUG
    applyFormatting('**', '**', 'richText.placeholders.boldText');
  }, [applyFormatting]);

  const formatItalic = useCallback(() => {
    logger.info('formatItalic called'); // DEBUG
    applyFormatting('*', '*', 'richText.placeholders.italicText');
  }, [applyFormatting]);

  const formatUnderline = useCallback(() => {
    logger.info('formatUnderline called'); // DEBUG
    applyFormatting('<u>', '</u>', 'richText.placeholders.underlineText');
  }, [applyFormatting]);
  const insertBulletList = useCallback(() => insertList('-'), [insertList]);
  const insertNumberedList = useCallback(() => insertList('1.'), [insertList]);
  const insertQuote = useCallback(() => applyFormatting('\n> ', '', 'richText.placeholders.quote'), [applyFormatting]);

  const formatColor = useCallback((cssClass: string) => {
    if (cssClass === 'doc-text-reset') {
      // Remove color wrapping — just keep selected text
      if (!textareaRef.current) return;
      const textarea = textareaRef.current;
      const currentValue = textarea.value;
      const { start, end, selectedText } = getSelection(textarea);
      // Strip surrounding <span class="doc-text-..."> and </span> if present
      const before = currentValue.substring(0, start);
      const after = currentValue.substring(end);
      const strippedBefore = before.replace(/<span class="doc-text-[a-z]+">\s*$/, '');
      const strippedAfter = after.replace(/^\s*<\/span>/, '');
      const newValue = strippedBefore + selectedText + strippedAfter;
      textarea.value = newValue;
      const event = new Event('input', { bubbles: true });
      textarea.dispatchEvent(event);
      restoreCaret(textarea, strippedBefore.length + selectedText.length);
    } else {
      applyFormatting(`<span class="${cssClass}">`, '</span>', 'κείμενο');
    }
  }, [applyFormatting, textareaRef]);

  return {
    formatBold,
    formatItalic,
    formatUnderline,
    formatColor,
    insertBulletList,
    insertNumberedList,
    insertQuote
  };
}
