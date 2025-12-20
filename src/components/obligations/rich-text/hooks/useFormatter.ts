"use client";

import { useCallback } from 'react';
import { getSelection, setSelection, restoreCaret } from '../utils/selection';

interface UseFormatterProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (newValue: string) => void;
}

export function useFormatter({ textareaRef, value, onChange }: UseFormatterProps) {
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
  }, [onChange, textareaRef]);

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

  const insertList = useCallback((prefix: string) => {
    if (!textareaRef.current) return;

    // Get current value directly from textarea
    const currentValue = textareaRef.current.value;
    const { start } = getSelection(textareaRef.current);
    const listItems = [`${prefix} Πρώτο στοιχείο`, `${prefix} Δεύτερο στοιχείο`, `${prefix} Τρίτο στοιχείο`];
    const textToInsert = '\n' + listItems.join('\n') + '\n';

    const newValue = currentValue.substring(0, start) + textToInsert + currentValue.substring(start);

    // Update textarea value directly first
    textareaRef.current.value = newValue;

    // Then trigger onChange event to sync with parent
    const event = new Event('input', { bubbles: true });
    textareaRef.current.dispatchEvent(event);

    restoreCaret(textareaRef.current, start + textToInsert.length);
  }, [onChange, textareaRef]);

  const formatBold = useCallback(() => {
    console.log('formatBold called in useFormatter'); // DEBUG
    applyFormatting('**', '**', 'έντονο κείμενο');
  }, [applyFormatting]);

  const formatItalic = useCallback(() => {
    console.log('formatItalic called in useFormatter'); // DEBUG
    applyFormatting('*', '*', 'πλάγιο κείμενο');
  }, [applyFormatting]);

  const formatUnderline = useCallback(() => {
    console.log('formatUnderline called in useFormatter'); // DEBUG
    applyFormatting('<u>', '</u>', 'υπογραμμισμένο κείμενο');
  }, [applyFormatting]);
  const insertBulletList = useCallback(() => insertList('-'), [insertList]);
  const insertNumberedList = useCallback(() => insertList('1.'), [insertList]);
  const insertQuote = useCallback(() => applyFormatting('\n> ', '', 'Παράθεση'), [applyFormatting]);

  return {
    formatBold,
    formatItalic,
    formatUnderline,
    insertBulletList,
    insertNumberedList,
    insertQuote
  };
}
