/**
 * 🔗 Name Change Cascade Confirmation Dialog
 *
 * Shows when a contact name change would cascade to properties
 * and payment plans. Lets the user confirm or cancel.
 *
 * @module components/contacts/dialogs/NameChangeCascadeDialog
 * @enterprise ADR-249 — Name Cascade Safety
 */

'use client';

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
import { RefreshCw } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

// ============================================================================
// TYPES
// ============================================================================

interface NameChangeCascadeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oldName: string;
  newName: string;
  properties: number;
  paymentPlans: number;
  onConfirm: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function NameChangeCascadeDialog({
  open,
  onOpenChange,
  oldName,
  newName,
  properties,
  paymentPlans,
  onConfirm,
}: NameChangeCascadeDialogProps) {
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  const nc = (key: string, params?: Record<string, string | number>) =>
    t(`contacts.nameCascade.${key}`, params);

  const totalAffected = properties + paymentPlans;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <RefreshCw className={iconSizes.md} />
            {nc('title')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <section className="space-y-3">
              <p>{nc('body', { oldName, newName })}</p>

              <ul className="space-y-1.5">
                {properties > 0 && (
                  <li className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
                    <span className="font-medium text-foreground">{nc('depProperties')}</span>
                    <span className={colors.text.muted}>
                      {nc('count', { count: properties })}
                    </span>
                  </li>
                )}
                {paymentPlans > 0 && (
                  <li className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
                    <span className="font-medium text-foreground">{nc('depPaymentPlans')}</span>
                    <span className={colors.text.muted}>
                      {nc('count', { count: paymentPlans })}
                    </span>
                  </li>
                )}
              </ul>

              <p className="text-sm text-amber-600 dark:text-amber-400">
                {nc('warning', { count: totalAffected })}
              </p>
            </section>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>{nc('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {nc('confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
