"use client";

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
  return (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
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
