'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, AlertTriangle, Calendar, ClipboardList, Folder, Home, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { formatDate } from '@/lib/intl-utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { CrmTask, FirestoreishTimestamp } from '@/types/crm';
import { getTaskById } from '@/services/tasks.service';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

const resolveDate = (value: FirestoreishTimestamp | null | undefined): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  return null;
};

const getStatusVariant = (status: CrmTask['status']): BadgeVariant => {
  switch (status) {
    case 'completed':
      return 'default';
    case 'cancelled':
      return 'outline';
    case 'in_progress':
      return 'secondary';
    case 'pending':
    default:
      return 'outline';
  }
};

const getPriorityVariant = (priority: CrmTask['priority']): BadgeVariant => {
  switch (priority) {
    case 'urgent':
      return 'destructive';
    case 'high':
      return 'secondary';
    case 'medium':
      return 'outline';
    case 'low':
    default:
      return 'outline';
  }
};

export default function TaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const taskIdParam = params.taskId;
  const taskId = Array.isArray(taskIdParam) ? taskIdParam[0] : taskIdParam;

  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation('tasks');

  const [task, setTask] = useState<CrmTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatTaskDate = useCallback((value: FirestoreishTimestamp | null | undefined) => {
    const date = resolveDate(value);
    return date ? formatDate(date) : t('card.notDefined');
  }, [t]);

  const loadTask = useCallback(async () => {
    if (!taskId) {
      setError(t('detail.invalidTaskId'));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getTaskById(taskId);
      if (!data) {
        setNotFound(true);
        setTask(null);
      } else {
        setNotFound(false);
        setTask(data);
      }
    } catch (err) {
      setError(t('messages.loadingError'));
    } finally {
      setLoading(false);
    }
  }, [taskId, t]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  const handleBack = () => {
    router.push('/crm/tasks');
  };

  const statusLabel = useMemo(() => {
    if (!task) return '';
    return t(`status.${task.status}`, { defaultValue: task.status });
  }, [task, t]);

  const priorityLabel = useMemo(() => {
    if (!task) return '';
    return t(`priority.${task.priority}`, { defaultValue: task.priority });
  }, [task, t]);

  const typeLabel = useMemo(() => {
    if (!task) return '';
    return t(`types.${task.type}`, { defaultValue: task.type });
  }, [task, t]);

  if (loading) {
    return (
      <main className={`min-h-screen ${colors.bg.secondary} flex items-center justify-center`}>
        <section className="text-center" aria-live="polite">
          <AnimatedSpinner size="large" className="mx-auto mb-2" />
          <p className={`${colors.text.muted}`}>{t('detail.loading')}</p>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className={`min-h-screen ${colors.bg.secondary}`}>
        <section className="container mx-auto px-6 py-8">
          <article className={`${colors.bg.errorLight} ${getStatusBorder('error')} rounded-lg p-8 text-center`}>
            <AlertTriangle className={`${iconSizes.lg} ${colors.text.error} mx-auto mb-2`} />
            <h2 className={`text-xl font-semibold ${colors.text.error} mb-2`}>{t('detail.errorTitle')}</h2>
            <p className={`${colors.text.error} mb-4`}>{error}</p>
            <Button onClick={handleBack} variant="outline">
              {t('detail.backToTasks')}
            </Button>
          </article>
        </section>
      </main>
    );
  }

  if (notFound || !task) {
    return (
      <main className={`min-h-screen ${colors.bg.secondary}`}>
        <section className="container mx-auto px-6 py-8">
          <article className={`${colors.bg.primary} ${getStatusBorder('warning')} rounded-lg p-8 text-center`}>
            <AlertTriangle className={`${iconSizes.lg} ${colors.text.warning} mx-auto mb-2`} />
            <h2 className={`text-xl font-semibold ${colors.text.primary} mb-2`}>{t('detail.notFoundTitle')}</h2>
            <p className={`${colors.text.muted} mb-4`}>{t('detail.notFoundDescription')}</p>
            <Button onClick={handleBack} variant="outline">
              {t('detail.backToTasks')}
            </Button>
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className={`min-h-screen ${colors.bg.secondary}`}>
      <header className={`${colors.bg.primary} shadow-sm border-b`}>
        <div className="px-6 py-4">
          <nav className="flex items-center gap-4" aria-label={t('detail.aria.taskNavigation')}>
            <Button onClick={handleBack} variant="ghost" size="icon" aria-label={t('detail.backToTasks')}>
              <ArrowLeft className={iconSizes.md} />
            </Button>
            <div className="flex items-center gap-3">
              <ClipboardList className={`${iconSizes.lg} ${colors.text.info}`} />
              <div>
                <h1 className={`text-2xl font-bold ${colors.text.primary}`}>{task.title}</h1>
                <p className={`${colors.text.muted}`}>{t('detail.title')}</p>
              </div>
            </div>
          </nav>
        </div>
      </header>

      <section className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <article className="lg:col-span-2 space-y-6" aria-label={t('detail.sections.summary')}>
            <section className={`${colors.bg.primary} rounded-lg shadow p-6 space-y-4`}>
              <header className="flex flex-wrap items-center gap-3">
                <Badge variant={getStatusVariant(task.status)}>{statusLabel}</Badge>
                <Badge variant={getPriorityVariant(task.priority)}>{priorityLabel}</Badge>
                <Badge variant="outline">{typeLabel}</Badge>
              </header>
              {task.description && (
                <p className={`${colors.text.secondary}`}>{task.description}</p>
              )}
            </section>

            {(task.contactId || task.projectId || task.unitId) && (
              <section className={`${colors.bg.primary} rounded-lg shadow p-6`}>
                <h2 className={`text-lg font-semibold ${colors.text.primary} mb-4`}>{t('detail.sections.related')}</h2>
                <dl className="space-y-3">
                  {task.contactId && (
                    <div className="flex items-center gap-3">
                      <User className={`${iconSizes.sm} ${colors.text.muted}`} />
                      <div>
                        <dt className={`text-sm ${colors.text.muted}`}>{t('detail.labels.contactId')}</dt>
                        <dd className={`${colors.text.primary}`}>{task.contactId}</dd>
                      </div>
                    </div>
                  )}
                  {task.projectId && (
                    <div className="flex items-center gap-3">
                      <Folder className={`${iconSizes.sm} ${colors.text.muted}`} />
                      <div>
                        <dt className={`text-sm ${colors.text.muted}`}>{t('detail.labels.projectId')}</dt>
                        <dd className={`${colors.text.primary}`}>{task.projectId}</dd>
                      </div>
                    </div>
                  )}
                  {task.unitId && (
                    <div className="flex items-center gap-3">
                      <Home className={`${iconSizes.sm} ${colors.text.muted}`} />
                      <div>
                        <dt className={`text-sm ${colors.text.muted}`}>{t('detail.labels.unitId')}</dt>
                        <dd className={`${colors.text.primary}`}>{task.unitId}</dd>
                      </div>
                    </div>
                  )}
                </dl>
              </section>
            )}
          </article>

          <aside className="space-y-6" aria-label={t('detail.sections.metadata')}>
            <section className={`${colors.bg.primary} rounded-lg shadow p-6`}>
              <h2 className={`text-lg font-semibold ${colors.text.primary} mb-4`}>{t('detail.sections.metadata')}</h2>
              <dl className="space-y-4">
                <div>
                  <dt className={`text-sm ${colors.text.muted}`}>{t('detail.labels.assignedTo')}</dt>
                  <dd className={`${colors.text.primary}`}>{task.assignedTo}</dd>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className={`${iconSizes.sm} ${colors.text.muted} mt-0.5`} />
                  <div>
                    <dt className={`text-sm ${colors.text.muted}`}>{t('detail.labels.dueDate')}</dt>
                    <dd className={`${colors.text.primary}`}>{formatTaskDate(task.dueDate ?? null)}</dd>
                  </div>
                </div>
                <div>
                  <dt className={`text-sm ${colors.text.muted}`}>{t('detail.labels.createdAt')}</dt>
                  <dd className={`${colors.text.primary}`}>{formatTaskDate(task.createdAt)}</dd>
                </div>
                <div>
                  <dt className={`text-sm ${colors.text.muted}`}>{t('detail.labels.updatedAt')}</dt>
                  <dd className={`${colors.text.primary}`}>{formatTaskDate(task.updatedAt)}</dd>
                </div>
                {task.completedAt && (
                  <div>
                    <dt className={`text-sm ${colors.text.muted}`}>{t('detail.labels.completedAt')}</dt>
                    <dd className={`${colors.text.primary}`}>{formatTaskDate(task.completedAt)}</dd>
                  </div>
                )}
              </dl>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
