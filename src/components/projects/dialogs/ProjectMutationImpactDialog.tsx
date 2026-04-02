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
import type { ProjectMutationImpactPreview } from '@/types/project-mutation-impact';
import { cn } from '@/lib/utils';

interface ProjectMutationImpactDialogProps {
  open: boolean;
  preview: ProjectMutationImpactPreview | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function ProjectMutationImpactDialog({
  open,
  preview,
  onOpenChange,
  onConfirm,
}: ProjectMutationImpactDialogProps) {
  const { t } = useTranslation('projects');
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
            {t(`impactGuard.titles.${mode}`)}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <section className="space-y-4">
              <p>{preview ? t(preview.messageKey) : ''}</p>

              {preview && preview.changes.length > 0 && (
                <article className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    {t('impactGuard.sections.changes')}
                  </h4>
                  <ul className="space-y-2">
                    {preview.changes.map((change) => (
                      <li key={change.field} className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-foreground">
                            {t(`impactGuard.fields.${change.field}`)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {t(`impactGuard.kinds.${change.kind}`)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {change.previousValue
                            ? t('impactGuard.changeSummary.updated', {
                                from: change.previousValue,
                                to: change.nextValue ?? t('impactGuard.changeSummary.emptyValue'),
                              })
                            : t('impactGuard.changeSummary.created', {
                                to: change.nextValue ?? t('impactGuard.changeSummary.emptyValue'),
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
                    {t('impactGuard.sections.dependencies')}
                  </h4>
                  <ul className="space-y-2">
                    {preview.dependencies.map((dependency) => (
                      <li key={dependency.id} className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-foreground">
                            {t(`impactGuard.dependencies.${dependency.id}.label`)}
                          </span>
                          <span className={dependency.mode === 'block' ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}>
                            {t(`impactGuard.severity.${dependency.mode}`, { count: dependency.count })}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t(`impactGuard.dependencies.${dependency.id}.remediation`)}
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
