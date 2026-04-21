/**
 * 🏢 Company Identity Impact Confirmation Dialog
 *
 * Shows when company identity field changes would affect downstream records.
 * Distinguishes live references (projects, properties, obligations) from
 * snapshots (invoices, APY certificates) that are frozen at creation.
 *
 * Displays which fields changed with old → new values, color-coded by category.
 *
 * @module components/contacts/dialogs/CompanyIdentityImpactDialog
 * @enterprise ADR-278 — Company Identity Field Guard
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
import { ShieldAlert, TriangleAlert } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import type { IdentityFieldChange } from '@/utils/contactForm/company-identity-guard';
import { resolveIdentityDisplay } from '@/utils/contactForm/identity-display-resolver';

// ============================================================================
// TYPES
// ============================================================================

interface CompanyIdentityImpactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changes: ReadonlyArray<IdentityFieldChange>;
  projects: number;
  properties: number;
  obligations: number;
  parking?: number;
  storage?: number;
  invoices: number;
  apyCertificates: number;
  onConfirm: () => void;
  mode?: 'warn' | 'block';
  message?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CompanyIdentityImpactDialog({
  open,
  onOpenChange,
  changes,
  projects,
  properties,
  obligations,
  parking = 0,
  storage = 0,
  invoices,
  apyCertificates,
  onConfirm,
  mode = 'warn',
  message,
}: CompanyIdentityImpactDialogProps) {
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  const { t: tForm } = useTranslation('forms');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  const ci = (key: string, params?: Record<string, string | number>) =>
    t(`contacts.companyIdentityImpact.${key}`, params);

  const fieldLabel = (field: string) =>
    t(`contacts.companyIdentityImpact.fields.${field}`);

  const totalLive = projects + properties + obligations + parking + storage;
  const hasSnapshots = invoices > 0 || apyCertificates > 0;
  const isBlocked = mode == 'block';
  const Icon = isBlocked ? ShieldAlert : TriangleAlert;
  const title = isBlocked ? ci('unavailableTitle') : ci('title');
  const body = message ?? ci(isBlocked ? 'unavailableBody' : 'body');

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className={cn('flex items-center gap-2', isBlocked ? 'text-destructive' : 'text-amber-600 dark:text-amber-400')}>
            <Icon className={iconSizes.md} />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <section className="space-y-3">
              <p>{body}</p>

              {/* Changed fields summary */}
              <article className="space-y-1.5">
                <ul className="space-y-1">
                  {changes.map((change) => {
                    const oldDisplay = resolveIdentityDisplay(change.field, change.oldValue, tForm);
                    const newDisplay = resolveIdentityDisplay(change.field, change.newValue, tForm);
                    return (
                      <li
                        key={change.field}
                        className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm"
                      >
                        <span className="font-medium text-foreground">
                          {fieldLabel(change.field)}
                        </span>
                        <span className={cn('ml-auto text-xs', colors.text.muted)}>
                          {change.isCleared
                            ? ci('fieldCleared', { oldValue: oldDisplay })
                            : ci('fieldChanged', { oldValue: oldDisplay, newValue: newDisplay })}
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
                    {projects > 0 && (
                      <li className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
                        <span className="font-medium text-foreground">{ci('depProjects')}</span>
                        <span className={colors.text.muted}>{ci('count', { count: projects })}</span>
                      </li>
                    )}
                    {properties > 0 && (
                      <li className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
                        <span className="font-medium text-foreground">{ci('depProperties')}</span>
                        <span className={colors.text.muted}>{ci('count', { count: properties })}</span>
                      </li>
                    )}
                    {obligations > 0 && (
                      <li className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
                        <span className="font-medium text-foreground">{ci('depObligations')}</span>
                        <span className={colors.text.muted}>{ci('count', { count: obligations })}</span>
                      </li>
                    )}
                    {parking > 0 && (
                      <li className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
                        <span className="font-medium text-foreground">{ci('depParking')}</span>
                        <span className={colors.text.muted}>{ci('count', { count: parking })}</span>
                      </li>
                    )}
                    {storage > 0 && (
                      <li className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
                        <span className="font-medium text-foreground">{ci('depStorage')}</span>
                        <span className={colors.text.muted}>{ci('count', { count: storage })}</span>
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

              {!isBlocked && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  {ci('warningLive', { count: totalLive })}
                </p>
              )}
            </section>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>{ci('cancel')}</AlertDialogCancel>
          {isBlocked ? (
            <AlertDialogAction>
              {ci('understood')}
            </AlertDialogAction>
          ) : (
            <AlertDialogAction
              onClick={onConfirm}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {ci('confirm')}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
