'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/i18n';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DimStyleCreateDialogProps {
  open: boolean;
  mode: 'create' | 'duplicate';
  initialName?: string;
  existingNames: readonly string[];
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export function DimStyleCreateDialog({
  open,
  mode,
  initialName = '',
  existingNames,
  onConfirm,
  onCancel,
}: DimStyleCreateDialogProps) {
  const { t } = useTranslation('dxf-viewer-panels');
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setError(null);
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [open, initialName]);

  const ns = mode === 'create' ? 'createDialog' : 'duplicateDialog';
  const title = t(`panels.dimensions.${ns}.title`);
  const placeholder = t(`panels.dimensions.${ns}.placeholder`);
  const confirmLabel = t(`panels.dimensions.${ns}.confirm`);
  const cancelLabel = t(`panels.dimensions.${ns}.cancel`);

  const validate = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return t('panels.dimensions.createDialog.errorEmpty');
    if (existingNames.includes(trimmed)) return t('panels.dimensions.createDialog.errorDuplicate');
    return null;
  };

  const handleConfirm = () => {
    const validationError = validate(name);
    if (validationError) {
      setError(validationError);
      return;
    }
    onConfirm(name.trim());
  };

  // ADR-364: Escape handled by Radix Dialog onEscapeKeyDown → onOpenChange → onCancel.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirm();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (error) setError(validate(e.target.value));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1.5 py-2">
          <Input
            ref={inputRef}
            value={name}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-invalid={!!error}
            aria-describedby={error ? 'dim-style-name-error' : undefined}
          />
          {error && (
            <p id="dim-style-name-error" className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button size="sm" onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
