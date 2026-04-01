/**
 * 📍 Branch Address Delete Confirmation Dialog
 *
 * Simple confirmation before removing a branch address.
 * No API call needed — downstream systems reference the contact ID,
 * not individual branch addresses.
 *
 * @module components/contacts/dialogs/BranchDeleteConfirmDialog
 * @enterprise ADR-277 — Address Impact Guard
 */

'use client';

import '@/lib/design-system';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { MapPin } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// ============================================================================
// TYPES
// ============================================================================

interface BranchDeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BranchDeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
}: BranchDeleteConfirmDialogProps) {
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();

  const bd = (key: string) => t(`contacts.addressImpact.branchDelete.${key}`);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <MapPin className={iconSizes.md} />
            {bd('title')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {bd('body')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>{bd('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            {bd('confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
