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
import { formatImpactValue } from '@/features/property-details/utils/impact-value-formatter';

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
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer', 'common-shared']);
  const iconSizes = useIconSizes();

  const mode = preview?.mode ?? 'allow';
  const isBlocked = mode === 'block';
  const Icon = isBlocked ? ShieldAlert : TriangleAlert;

  const message = preview?.messageKey === 'mutationImpact.block'
    ? t('impactGuard.messages.block')
    : preview?.messageKey === 'mutationImpact.warn'
      ? t('impactGuard.messages.warn')
      : preview?.messageKey === 'mutationImpact.unavailable'
        ? t('impactGuard.messages.unavailable')
        : t('impactGuard.messages.allow');

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
              ? t('impactGuard.titles.block')
              : t('impactGuard.titles.warn')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <section className="space-y-4">
              <p>{message}</p>

              {preview && preview.changes.length > 0 && (
                <article className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    {t('impactGuard.sections.changes')}
                  </h4>
                  <ul className="space-y-2">
                    {preview.changes.map((change) => (
                      <li key={change.field} className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-foreground">{getFieldLabel(change.field)}</span>
                          <span className="text-xs text-muted-foreground">{getKindLabel(change.kind)}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatImpactValue(t, change.field, change.previousValue)} {'->'} {formatImpactValue(t, change.field, change.nextValue)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </article>
              )}

              {preview && preview.dependencies.length > 0 && (
                <article className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    {t('impactGuard.sections.dependencies')}
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
          <AlertDialogCancel>{t('impactGuard.actions.cancel')}</AlertDialogCancel>
          {preview?.mode === 'warn' ? (
            <AlertDialogAction onClick={onConfirm} className="bg-amber-600 text-white hover:bg-amber-700">
              {t('impactGuard.actions.confirm')}
            </AlertDialogAction>
          ) : (
            <AlertDialogAction>{t('impactGuard.actions.understood')}</AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
