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
import type { PropertyMutationImpactPreview } from '@/types/property-mutation-impact';

interface PropertyMutationImpactDialogProps {
  open: boolean;
  preview: PropertyMutationImpactPreview | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function PropertyMutationImpactDialog({
  open,
  preview,
  onOpenChange,
  onConfirm,
}: PropertyMutationImpactDialogProps) {
  const { t } = useTranslation('properties');
  const iconSizes = useIconSizes();

  const mode = preview?.mode ?? 'allow';
  const isBlocked = mode === 'block';
  const Icon = isBlocked ? ShieldAlert : TriangleAlert;

  const message = preview?.messageKey === 'mutationImpact.block'
    ? t('impactGuard.messages.block', { defaultValue: 'This change is blocked because dependent property workflows would be put at risk.' })
    : preview?.messageKey === 'mutationImpact.warn'
      ? t('impactGuard.messages.warn', { defaultValue: 'This change affects downstream property workflows. Review the impact before continuing.' })
      : preview?.messageKey === 'mutationImpact.unavailable'
        ? t('impactGuard.messages.unavailable', { defaultValue: 'The impact preview could not complete reliably. Saving was blocked to protect linked records.' })
        : t('impactGuard.messages.allow', { defaultValue: 'No downstream impact was detected.' });

  const getFieldLabel = (field: string): string => t(`impactGuard.fields.${field}`, { defaultValue: field });
  const getKindLabel = (kind: string): string => t(`impactGuard.kinds.${kind}`, { defaultValue: kind });
  const getDependencyLabel = (id: string): string => t(`impactGuard.dependencies.${id}.label`, { defaultValue: id });
  const getDependencySeverity = (mode: 'warn' | 'block', count: number): string =>
    t(`impactGuard.severity.${mode}`, { count, defaultValue: `${mode} (${count})` });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className={cn('flex items-center gap-2', isBlocked ? 'text-destructive' : 'text-amber-600 dark:text-amber-400')}>
            <Icon className={iconSizes.md} />
            {mode === 'block'
              ? t('impactGuard.titles.block', { defaultValue: 'Property change blocked' })
              : t('impactGuard.titles.warn', { defaultValue: 'Review property impact' })}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <section className="space-y-4">
              <p>{message}</p>

              {preview && preview.changes.length > 0 && (
                <article className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    {t('impactGuard.sections.changes', { defaultValue: 'Changes' })}
                  </h4>
                  <ul className="space-y-2">
                    {preview.changes.map((change) => (
                      <li key={change.field} className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-foreground">{getFieldLabel(change.field)}</span>
                          <span className="text-xs text-muted-foreground">{getKindLabel(change.kind)}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {(change.previousValue ?? t('impactGuard.emptyValue', { defaultValue: 'empty' }))} {'->'} {(change.nextValue ?? t('impactGuard.emptyValue', { defaultValue: 'empty' }))}
                        </p>
                      </li>
                    ))}
                  </ul>
                </article>
              )}

              {preview && preview.dependencies.length > 0 && (
                <article className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    {t('impactGuard.sections.dependencies', { defaultValue: 'Dependencies' })}
                  </h4>
                  <ul className="space-y-2">
                    {preview.dependencies.map((dependency) => (
                      <li key={dependency.id} className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-foreground">{getDependencyLabel(dependency.id)}</span>
                          <span className={dependency.mode === 'block' ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}>
                            {getDependencySeverity(dependency.mode, dependency.count)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </article>
              )}
            </section>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('impactGuard.actions.cancel', { defaultValue: 'Cancel' })}</AlertDialogCancel>
          {preview?.mode === 'warn' ? (
            <AlertDialogAction onClick={onConfirm} className="bg-amber-600 text-white hover:bg-amber-700">
              {t('impactGuard.actions.confirm', { defaultValue: 'Continue' })}
            </AlertDialogAction>
          ) : (
            <AlertDialogAction>{t('impactGuard.actions.understood', { defaultValue: 'Understood' })}</AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
