/**
 * 📍 Address Impact Confirmation Dialog
 *
 * Shows when a HQ address change would affect downstream records.
 * Distinguishes live references (properties, payment plans) from
 * snapshots (invoices, APY certificates) that are frozen at creation.
 *
 * @module components/contacts/dialogs/AddressImpactDialog
 * @enterprise ADR-277 — Address Impact Guard
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
import { MapPin } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import '@/lib/design-system';

// ============================================================================
// TYPES
// ============================================================================

interface AddressImpactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addressLabel: string;
  properties: number;
  paymentPlans: number;
  invoices: number;
  apyCertificates: number;
  onConfirm: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AddressImpactDialog({
  open,
  onOpenChange,
  addressLabel,
  properties,
  paymentPlans,
  invoices,
  apyCertificates,
  onConfirm,
}: AddressImpactDialogProps) {
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  const ai = (key: string, params?: Record<string, string | number>) =>
    t(`contacts.addressImpact.${key}`, params);

  const totalLive = properties + paymentPlans;
  const hasSnapshots = invoices > 0 || apyCertificates > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <MapPin className={iconSizes.md} />
            {ai('title')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <section className="space-y-3">
              <p>{ai('body', { addressLabel })}</p>

              {/* Live references — will auto-read updated address */}
              {totalLive > 0 && (
                <article className="space-y-1.5">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    {ai('sectionLive')}
                  </h4>
                  <ul className="space-y-1.5">
                    {properties > 0 && (
                      <li className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
                        <span className="font-medium text-foreground">{ai('depProperties')}</span>
                        <span className={colors.text.muted}>{ai('count', { count: properties })}</span>
                      </li>
                    )}
                    {paymentPlans > 0 && (
                      <li className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
                        <span className="font-medium text-foreground">{ai('depPaymentPlans')}</span>
                        <span className={colors.text.muted}>{ai('count', { count: paymentPlans })}</span>
                      </li>
                    )}
                  </ul>
                </article>
              )}

              {/* Snapshot references — informational, frozen at creation */}
              {hasSnapshots && (
                <article className="space-y-1.5 opacity-60">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    {ai('sectionSnapshot')}
                  </h4>
                  <ul className="space-y-1.5">
                    {invoices > 0 && (
                      <li className={cn("flex items-center justify-between rounded-md border border-border/50 px-3 py-2 text-sm", colors.text.muted)}>
                        <span>{ai('depInvoices')}</span>
                        <span>{ai('count', { count: invoices })}</span>
                      </li>
                    )}
                    {apyCertificates > 0 && (
                      <li className={cn("flex items-center justify-between rounded-md border border-border/50 px-3 py-2 text-sm", colors.text.muted)}>
                        <span>{ai('depApyCertificates')}</span>
                        <span>{ai('count', { count: apyCertificates })}</span>
                      </li>
                    )}
                  </ul>
                </article>
              )}

              <p className="text-sm text-amber-600 dark:text-amber-400">
                {ai('warningLive', { count: totalLive })}
              </p>
            </section>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>{ai('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {ai('confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
