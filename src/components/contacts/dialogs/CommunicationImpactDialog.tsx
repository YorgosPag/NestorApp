/**
 * 📧 Communication Impact Confirmation Dialog
 *
 * Shows when primary communication field changes would affect downstream records.
 * Distinguishes live references (properties, payment plans, projects) from
 * snapshots (invoices, APY certificates) that are frozen at creation.
 *
 * Displays which fields changed with old -> new values, with type-specific icons.
 *
 * @module components/contacts/dialogs/CommunicationImpactDialog
 * @enterprise ADR-280 — Communication Field Impact Detection
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
import { Mail, Phone, Globe } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { getStatusColor } from '@/lib/design-system';
import type { CommunicationFieldChange, CommunicationChangeType } from '@/utils/contactForm/communication-impact-guard';

// ============================================================================
// TYPES
// ============================================================================

interface CommunicationImpactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changes: ReadonlyArray<CommunicationFieldChange>;
  properties: number;
  paymentPlans: number;
  projects: number;
  invoices: number;
  apyCertificates: number;
  onConfirm: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Icon and color for each change type */
function getChangeTypeVisuals(changeType: CommunicationChangeType) {
  switch (changeType) {
    case 'primaryEmailChanged':
      return { Icon: Mail, className: getStatusColor('info', 'text') };
    case 'primaryPhoneChanged':
      return { Icon: Phone, className: getStatusColor('active', 'text') };
    case 'corporateWebsiteChanged':
      return { Icon: Globe, className: 'text-purple-600 dark:text-purple-400' };
    default:
      return { Icon: Mail, className: 'text-amber-600 dark:text-amber-400' };
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CommunicationImpactDialog({
  open,
  onOpenChange,
  changes,
  properties,
  paymentPlans,
  projects,
  invoices,
  apyCertificates,
  onConfirm,
}: CommunicationImpactDialogProps) {
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  const ci = (key: string, params?: Record<string, string | number>) =>
    t(`contacts.communicationImpact.${key}`, params);

  const changeLabel = (changeType: CommunicationChangeType) =>
    t(`contacts.communicationImpact.changeTypes.${changeType}`);

  const totalLive = properties + paymentPlans + projects;
  const hasSnapshots = invoices > 0 || apyCertificates > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <Mail className={iconSizes.md} />
            {ci('title')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <section className="space-y-3">
              <p>{ci('body')}</p>

              {/* Changed fields summary */}
              <article className="space-y-1.5">
                <ul className="space-y-1">
                  {changes.map((change) => {
                    const { Icon, className } = getChangeTypeVisuals(change.changeType);
                    return (
                      <li
                        key={change.changeType}
                        className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm"
                      >
                        <Icon className={cn('h-4 w-4 shrink-0', className)} />
                        <span className="font-medium text-foreground">
                          {changeLabel(change.changeType)}
                        </span>
                        <span className={cn('ml-auto text-xs', colors.text.muted)}>
                          {ci('fieldChanged', { oldValue: change.oldValue, newValue: change.newValue })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </article>

              {/* Live references — will auto-read updated contact data */}
              {totalLive > 0 && (
                <article className="space-y-1.5">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    {ci('sectionLive')}
                  </h4>
                  <ul className="space-y-1.5">
                    {properties > 0 && (
                      <li className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
                        <span className="font-medium text-foreground">{ci('depProperties')}</span>
                        <span className={colors.text.muted}>{ci('count', { count: properties })}</span>
                      </li>
                    )}
                    {paymentPlans > 0 && (
                      <li className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
                        <span className="font-medium text-foreground">{ci('depPaymentPlans')}</span>
                        <span className={colors.text.muted}>{ci('count', { count: paymentPlans })}</span>
                      </li>
                    )}
                    {projects > 0 && (
                      <li className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
                        <span className="font-medium text-foreground">{ci('depProjects')}</span>
                        <span className={colors.text.muted}>{ci('count', { count: projects })}</span>
                      </li>
                    )}
                  </ul>
                </article>
              )}

              {/* Snapshot references — informational, frozen at creation */}
              {hasSnapshots && (
                <article className="space-y-1.5 opacity-60">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    {ci('sectionSnapshot')}
                  </h4>
                  <ul className="space-y-1.5">
                    {invoices > 0 && (
                      <li className={cn("flex items-center justify-between rounded-md border border-border/50 px-3 py-2 text-sm", colors.text.muted)}>
                        <span>{ci('depInvoices')}</span>
                        <span>{ci('count', { count: invoices })}</span>
                      </li>
                    )}
                    {apyCertificates > 0 && (
                      <li className={cn("flex items-center justify-between rounded-md border border-border/50 px-3 py-2 text-sm", colors.text.muted)}>
                        <span>{ci('depApyCertificates')}</span>
                        <span>{ci('count', { count: apyCertificates })}</span>
                      </li>
                    )}
                  </ul>
                </article>
              )}

              <p className="text-sm text-amber-600 dark:text-amber-400">
                {ci('warningLive', { count: totalLive })}
              </p>
            </section>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>{ci('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {ci('confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
