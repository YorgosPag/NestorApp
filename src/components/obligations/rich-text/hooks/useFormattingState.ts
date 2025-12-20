"use client";

import { useState, useEffect, useRef } from 'react';

interface FormattingState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

export function useFormattingState(
  textareaRef: React.RefObject<HTMLTextAreaElement>,
  value: string
) {
  const [formattingState, setFormattingState] = useState<FormattingState>({
    bold: false,
    italic: false,
    underline: false
  });

  const detectFormattingAtCursor = () => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const text = textarea.value;

    // Get surrounding text (20 chars before and after cursor)
    const before = text.substring(Math.max(0, cursorPos - 20), cursorPos);
    const after = text.substring(cursorPos, Math.min(text.length, cursorPos + 20));
    const surrounding = before + after;

    // Check if cursor is inside formatting tags
    const isBold = isInsideFormatting(before, after, '**', '**');
    const isItalic = isInsideFormatting(before, after, '*', '*') && !isBold; // Exclude bold
    const isUnderline = isInsideFormatting(before, after, '<u>', '</u>');

    setFormattingState({
      bold: isBold,
      italic: isItalic,
      underline: isUnderline
    });
  };

  // Helper function to detect if cursor is inside formatting
  const isInsideFormatting = (
    before: string,
    after: string,
    openTag: string,
    closeTag: string
  ): boolean => {
    // Find last occurrence of opening tag in before text
    const lastOpenIndex = before.lastIndexOf(openTag);
    if (lastOpenIndex === -1) return false;

    // Get text after the last opening tag in before text
    const afterLastOpen = before.substring(lastOpenIndex + openTag.length);

    // Count unmatched opening tags
    const openCount = (afterLastOpen.match(new RegExp(escapeRegExp(openTag), 'g')) || []).length;
    const closeCountInBefore = (afterLastOpen.match(new RegExp(escapeRegExp(closeTag), 'g')) || []).length;

    // If tags are balanced in before text, we're not inside
    if (openCount <= closeCountInBefore) return false;

    // Check if there's a matching closing tag in after text
    const firstCloseIndex = after.indexOf(closeTag);
    return firstCloseIndex !== -1; // We're inside if there's a close tag ahead
  };

  // Helper to escape regex special characters
  const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  // Update formatting state when cursor moves or content changes
  useEffect(() => {
    detectFormattingAtCursor();
  }, [value]);

  // Listen for cursor movement
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleSelectionChange = () => {
      detectFormattingAtCursor();
    };

    textarea.addEventListener('click', handleSelectionChange);
    textarea.addEventListener('keyup', handleSelectionChange);
    textarea.addEventListener('keydown', handleSelectionChange);

    return () => {
      textarea.removeEventListener('click', handleSelectionChange);
      textarea.removeEventListener('keyup', handleSelectionChange);
      textarea.removeEventListener('keydown', handleSelectionChange);
    };
  }, []);

  return formattingState;
}