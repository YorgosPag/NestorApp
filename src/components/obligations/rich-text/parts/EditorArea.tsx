"use client";

import { useRef, useEffect, useState, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';

interface EditorAreaProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  placeholder: string;
  minHeight: number;
  maxHeight: number;
  disabled: boolean;
}

export function EditorArea({
  value,
  onChange,
  onKeyDown,
  textareaRef,
  placeholder,
  minHeight,
  disabled
}: EditorAreaProps) {
  const [localValue, setLocalValue] = useState(value);
  const lastCursorPositionRef = useRef<number | null>(null);
  const isUpdatingFromParentRef = useRef(false);

  // Auto-resize textarea to fit content without scrolling
  const autoResize = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.max(minHeight, textarea.scrollHeight)}px`;
  }, [textareaRef, minHeight]);

  // Sync with parent value only when it changes externally (not from our onChange)
  useEffect(() => {
    if (value !== localValue && !isUpdatingFromParentRef.current) {
      setLocalValue(value);
      setTimeout(() => {
        if (textareaRef.current && lastCursorPositionRef.current !== null) {
          textareaRef.current.setSelectionRange(
            lastCursorPositionRef.current,
            lastCursorPositionRef.current
          );
        }
      }, 0);
    }
    isUpdatingFromParentRef.current = false;
  }, [value, localValue]);

  // Auto-resize whenever localValue changes
  useEffect(() => {
    requestAnimationFrame(autoResize);
  }, [localValue, autoResize]);

  // Handle user typing - update local state immediately, debounce parent update
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPosition = e.target.selectionStart;

    lastCursorPositionRef.current = cursorPosition;
    setLocalValue(newValue);
    isUpdatingFromParentRef.current = true;
    onChange(newValue);
  };

  // Handle programmatic input events (from formatting functions)
  const handleInput = (e: Event) => {
    if (e.target && 'value' in e.target) {
      const textarea = e.target as HTMLTextAreaElement;
      const newValue = textarea.value;
      const cursorPosition = textarea.selectionStart;

      lastCursorPositionRef.current = cursorPosition;
      setLocalValue(newValue);
      isUpdatingFromParentRef.current = true;
      onChange(newValue);
    }
  };

  // Attach input event listener for programmatic changes
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.addEventListener('input', handleInput);
      return () => textarea.removeEventListener('input', handleInput);
    }
  }, [onChange]);

  const handleCursorPositionUpdate = () => {
    if (textareaRef.current) {
      lastCursorPositionRef.current = textareaRef.current.selectionStart;
    }
  };

  return (
    <Textarea
      ref={textareaRef}
      value={localValue}
      onChange={handleChange}
      onKeyDown={onKeyDown}
      onClick={handleCursorPositionUpdate}
      onKeyUp={handleCursorPositionUpdate}
      placeholder={placeholder}
      className="font-mono text-sm resize-none overflow-hidden"
      style={{ minHeight: `${minHeight}px` }}
      disabled={disabled}
      aria-label="Rich text editor"
    />
  );
}
