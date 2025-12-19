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

    const { start, end, selectedText } = getSelection(textareaRef.current);
    const textToInsert = selectedText || placeholder;
    
    const newValue = 
      value.substring(0, start) + 
      before + textToInsert + after + 
      value.substring(end);
    
    onChange(newValue);
    
    restoreCaret(textareaRef.current, start + before.length + textToInsert.length);
  }, [value, onChange, textareaRef]);

  const insertList = useCallback((prefix: string) => {
    if (!textareaRef.current) return;
    
    const { start } = getSelection(textareaRef.current);
    const listItems = [`${prefix} Πρώτο στοιχείο`, `${prefix} Δεύτερο στοιχείο`, `${prefix} Τρίτο στοιχείο`];
    const textToInsert = '\n' + listItems.join('\n') + '\n';
    
    const newValue = value.substring(0, start) + textToInsert + value.substring(start);
    onChange(newValue);

    restoreCaret(textareaRef.current, start + textToInsert.length);
  }, [value, onChange, textareaRef]);

  const formatBold = useCallback(() => applyFormatting('**', '**', 'έντονο κείμενο'), [applyFormatting]);
  const formatItalic = useCallback(() => applyFormatting('*', '*', 'πλάγιο κείμενο'), [applyFormatting]);
  const formatUnderline = useCallback(() => applyFormatting('<u>', '</u>', 'υπογραμμισμένο κείμενο'), [applyFormatting]);
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
