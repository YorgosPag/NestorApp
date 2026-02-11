"use client";

import { useRef, useEffect, useState } from 'react';
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
  maxHeight,
  disabled
}: EditorAreaProps) {
  const [localValue, setLocalValue] = useState(value);
  const lastCursorPositionRef = useRef<number | null>(null);
  const isUpdatingFromParentRef = useRef(false);

  // Sync with parent value only when it changes externally (not from our onChange)
  useEffect(() => {
    if (value !== localValue && !isUpdatingFromParentRef.current) {
      setLocalValue(value);
      // Restore cursor position if we have it
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

  // Handle user typing - update local state immediately, debounce parent update
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPosition = e.target.selectionStart;

    // Store cursor position
    lastCursorPositionRef.current = cursorPosition;

    // Update local state immediately (no re-render from parent)
    setLocalValue(newValue);

    // Mark that we're updating parent to avoid sync conflicts
    isUpdatingFromParentRef.current = true;

    // Notify parent of change
    onChange(newValue);
  };

  // Handle programmatic input events (from formatting functions)
  const handleInput = (e: Event) => {
    if (e.target && 'value' in e.target) {
      const textarea = e.target as HTMLTextAreaElement;
      const newValue = textarea.value;
      const cursorPosition = textarea.selectionStart;

      // Store cursor position
      lastCursorPositionRef.current = cursorPosition;

      // Update local state immediately
      setLocalValue(newValue);

      // Mark that we're updating parent to avoid sync conflicts
      isUpdatingFromParentRef.current = true;

      // Notify parent of change
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

  // Store cursor position on click and keyup
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
      className="font-mono text-sm resize-none"
      style={{
        minHeight: `${minHeight}px`,
        maxHeight: `${maxHeight}px`
      }}
      disabled={disabled}
      aria-label="Rich text editor"
    />
  );
}

