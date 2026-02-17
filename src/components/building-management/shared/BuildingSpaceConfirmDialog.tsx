/**
 * BuildingSpaceConfirmDialog — Centralized confirmation dialog
 *
 * Replaces all window.confirm() calls in building space tabs
 * with the enterprise AlertDialog system (@/components/ui/alert-dialog).
 *
 * Supports 3 action types: delete, unlink, and generic.
 *
 * @module components/building-management/shared/BuildingSpaceConfirmDialog
 */

'use client';

import type { ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// ============================================================================
// TYPES
// ============================================================================

/** Visual variant of the confirm button */
type ConfirmVariant = 'destructive' | 'warning' | 'default';

interface BuildingSpaceConfirmDialogProps {
  /** Whether the dialog is visible */
  open: boolean;
  /** Called when the dialog wants to close */
  onOpenChange: (open: boolean) => void;
  /** Dialog title */
  title: string;
  /** Dialog description / body content */
  description: ReactNode;
  /** Label for the confirm button */
  confirmLabel?: string;
  /** Label for the cancel button */
  cancelLabel?: string;
  /** Called when user confirms the action */
  onConfirm: () => void;
  /** Shows loading spinner on the confirm button */
  loading?: boolean;
  /** Visual variant of the confirm button */
  variant?: ConfirmVariant;
}

// ============================================================================
// VARIANT STYLES
// ============================================================================

const VARIANT_CLASSES: Record<ConfirmVariant, string> = {
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  warning: 'bg-amber-600 text-white hover:bg-amber-700',
  default: '',
};

// ============================================================================
// COMPONENT
// ============================================================================

export function BuildingSpaceConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  loading = false,
  variant = 'destructive',
}: BuildingSpaceConfirmDialogProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('building');

  const resolvedConfirmLabel = confirmLabel || t('spaceActions.delete');
  const resolvedCancelLabel = cancelLabel || t('spaceConfirm.cancel');

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <section>{description}</section>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            {resolvedCancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={loading}
            className={VARIANT_CLASSES[variant]}
          >
            {loading && (
              <Loader2 size={iconSizes.numeric.sm} className="mr-2 animate-spin" />
            )}
            {resolvedConfirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
