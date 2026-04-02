'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getSpacingClass } from '@/lib/design-system';

export interface PromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  value: string;
  onValueChange: (value: string) => void;
  onConfirm: () => void | Promise<void>;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  disabled?: boolean;
}

export function PromptDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  value,
  onValueChange,
  onConfirm,
  confirmText,
  cancelText,
  loading = false,
  disabled = false,
}: PromptDialogProps) {
  const { t } = useTranslation('common');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <div className={getSpacingClass('stack', 'sm')}>
          {label ? <label className="text-sm font-medium">{label}</label> : null}
          <Input
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder={placeholder}
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {cancelText || t('buttons.cancel', 'Cancel')}
          </Button>
          <Button onClick={() => void onConfirm()} disabled={disabled || loading || value.trim().length === 0}>
            {loading ? <Spinner size="small" color="inherit" /> : (confirmText || t('buttons.confirm', 'Confirm'))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PromptDialog;
