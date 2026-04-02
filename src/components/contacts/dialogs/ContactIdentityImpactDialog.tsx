'use client';

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
import { ShieldAlert, TriangleAlert } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { cn } from '@/lib/utils';
import type { ContactIdentityImpactPreview } from '@/types/contact-identity-impact';
import type { IndividualIdentityFieldCategory } from '@/utils/contactForm/individual-identity-guard';

interface ContactIdentityImpactDialogProps {
  open: boolean;
  preview: ContactIdentityImpactPreview | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

function getCategoryClassName(category: IndividualIdentityFieldCategory): string {
  switch (category) {
    case 'display':
      return 'bg-muted text-muted-foreground';
    case 'identity':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300';
    case 'regulated':
      return 'bg-destructive/10 text-destructive';
  }
}

export function ContactIdentityImpactDialog({
  open,
  preview,
  onOpenChange,
  onConfirm,
}: ContactIdentityImpactDialogProps) {
  const { t } = useTranslation('contacts');
  const iconSizes = useIconSizes();

  const mode = preview?.mode ?? 'allow';
  const isBlocked = mode === 'block';
  const Icon = isBlocked ? ShieldAlert : TriangleAlert;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className={cn('flex items-center gap-2', isBlocked ? 'text-destructive' : 'text-amber-600 dark:text-amber-400')}>
            <Icon className={iconSizes.md} />
            {t(`identityImpact.titles.${mode}`)}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <section className="space-y-4">
              <p>{preview ? t(preview.messageKey) : ''}</p>

              {preview && preview.changes.length > 0 && (
                <article className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    {t('identityImpact.sections.changes')}
                  </h4>
                  <ul className="space-y-2">
                    {preview.changes.map((change) => (
                      <li key={change.field} className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className={cn('rounded px-2 py-0.5 text-[11px] font-medium uppercase', getCategoryClassName(change.category))}>
                              {t(`identityImpact.categories.${change.category}`)}
                            </span>
                            <span className="font-medium text-foreground">
                              {t(`identityImpact.fields.${change.field}`)}
                            </span>
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {change.isCleared
                            ? t('identityImpact.changeSummary.cleared', {
                                from: change.oldValue || t('identityImpact.changeSummary.emptyValue'),
                              })
                            : t('identityImpact.changeSummary.updated', {
                                from: change.oldValue || t('identityImpact.changeSummary.emptyValue'),
                                to: change.newValue || t('identityImpact.changeSummary.emptyValue'),
                              })}
                        </p>
                      </li>
                    ))}
                  </ul>
                </article>
              )}

              {preview && preview.dependencies.length > 0 && (
                <article className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    {t('identityImpact.sections.dependencies')}
                  </h4>
                  <ul className="space-y-2">
                    {preview.dependencies.map((dependency) => (
                      <li key={dependency.id} className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-foreground">
                            {t(`identityImpact.dependencies.${dependency.id}.label`)}
                          </span>
                          <span className={dependency.mode === 'block' ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}>
                            {t(`identityImpact.dependencySeverity.${dependency.mode}`, { count: dependency.count })}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t(`identityImpact.dependencies.${dependency.id}.remediation`)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </article>
              )}

              {preview && preview.affectedDomains.length > 0 && (
                <article className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    {t('identityImpact.sections.affectedDomains')}
                  </h4>
                  <ul className="space-y-2">
                    {preview.affectedDomains.map((domain) => (
                      <li key={domain} className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {t(`identityImpact.affectedDomains.${domain}.label`)}
                        </span>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t(`identityImpact.affectedDomains.${domain}.description`)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </article>
              )}
            </section>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('identityImpact.actions.cancel')}</AlertDialogCancel>
          {preview?.mode === 'warn' ? (
            <AlertDialogAction onClick={onConfirm} className="bg-amber-600 text-white hover:bg-amber-700">
              {t('identityImpact.actions.confirm')}
            </AlertDialogAction>
          ) : (
            <AlertDialogAction>{t('identityImpact.actions.understood')}</AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
