'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, X, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditableTextProps {
  /** Current text value */
  value: string;
  /** Callback when text is saved */
  onSave: (newValue: string) => void;
  /** Optional placeholder when editing */
  placeholder?: string;
  /** CSS classes for the text display */
  className?: string;
  /** CSS classes for the input when editing */
  inputClassName?: string;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Show edit icon on hover */
  showEditIcon?: boolean;
  /** Input type (text, email, tel, etc.) */
  type?: string;
  /** Maximum length for the input */
  maxLength?: number;
  /** Whether field is required */
  required?: boolean;
}

export function EditableText({
  value,
  onSave,
  placeholder,
  className,
  inputClassName,
  disabled = false,
  showEditIcon = true,
  type = 'text',
  maxLength,
  required = false
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update editValue when value prop changes
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    if (disabled) return;
    setIsEditing(true);
    setEditValue(value);
  };

  const handleSave = () => {
    const trimmedValue = editValue.trim();

    // Validation
    if (required && !trimmedValue) {
      // Don't save empty required fields
      return;
    }

    onSave(trimmedValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn("flex-1", inputClassName)}
          maxLength={maxLength}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={handleSave}
          className="h-8 w-8 p-0"
          title="Αποθήκευση"
        >
          <Check className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCancel}
          className="h-8 w-8 p-0"
          title="Ακύρωση"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative inline-flex items-center gap-2",
        !disabled && "cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1",
        className
      )}
      onClick={handleStartEdit}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className={cn("flex-1", !value && "text-muted-foreground")}>
        {value || placeholder || "Κλικ για επεξεργασία..."}
      </span>

      {showEditIcon && !disabled && (isHovered || isEditing) && (
        <Edit className="w-3 h-3 text-muted-foreground opacity-70" />
      )}
    </div>
  );
}

export default EditableText;