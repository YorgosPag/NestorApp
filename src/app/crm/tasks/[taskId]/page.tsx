'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, AlertTriangle, Calendar, ClipboardList, Filter, Folder, Home, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { formatDate } from '@/lib/intl-utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn, getResponsiveClass, getSpacingClass } from '@/lib/design-system';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { UserProfileDocument } from '@/auth/types/auth.types';
import type { CrmTask, FirestoreishTimestamp } from '@/types/crm';
import { getTaskById } from '@/services/tasks.service';
import { PageContainer, ListContainer } from '@/core/containers';
import { PageHeader } from '@/core/headers';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { AdvancedFiltersPanel, defaultTaskFilters, taskFiltersConfig, type TaskFilterState } from '@/components/core/AdvancedFilters';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTypography } from '@/hooks/useTypography';
import { SafeHTMLContent } from '@/components/shared/email/EmailContentRenderer';
import { useContactName } from '@/components/contacts/relationships/hooks/useContactName';

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

  const layout = useLayoutClasses();
  const spacing = useSpacingTokens();
  const typography = useTypography();
  const iconSizes = useIconSizes();
  const { getStatusBorder, quick } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation('tasks');
  const sectionSpacing = getSpacingClass('m', 'md', 'b');
  const { t: tFilters } = useTranslation('filters');

  const [task, setTask] = useState<CrmTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TaskFilterState>(defaultTaskFilters);

  // Resolve contact name from Firestore ID
  const { contactName, loading: contactNameLoading } = useContactName(task?.contactId ?? undefined);

  // Resolve assignedTo display name from Firestore users collection
  const [assignedToName, setAssignedToName] = useState<string>('');
  useEffect(() => {
    if (!task?.assignedTo) return;

    const resolveUserName = async () => {
      try {
        const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, task.assignedTo));
        if (userDoc.exists()) {
          const userData = userDoc.data() as UserProfileDocument;
          setAssignedToName(userData.displayName || userData.email || task.assignedTo);
        } else {
          setAssignedToName(task.assignedTo);
        }
      } catch {
        setAssignedToName(task.assignedTo);
      }
    };

    resolveUserName();
  }, [task?.assignedTo]);
  const [showFilters, setShowFilters] = useState(false);

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
    } catch {
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

  const dashboardStats = useMemo<DashboardStat[]>(() => {
    if (!task) return [];

    const statusColors: Record<CrmTask['status'], DashboardStat['color']> = {
      pending: 'yellow',
      in_progress: 'blue',
      completed: 'green',
      cancelled: 'gray'
    };

    const priorityColors: Record<CrmTask['priority'], DashboardStat['color']> = {
      low: 'blue',
      medium: 'yellow',
      high: 'orange',
      urgent: 'red'
    };

    return [
      {
        title: tFilters('fields.status'),
        value: statusLabel,
        icon: AlertTriangle,
        color: statusColors[task.status]
      },
      {
        title: tFilters('fields.priority'),
        value: priorityLabel,
        icon: ClipboardList,
        color: priorityColors[task.priority]
      },
      {
        title: t('detail.labels.dueDate'),
        value: formatTaskDate(task.dueDate ?? null),
        icon: Calendar,
        color: 'indigo'
      },
      {
        title: t('detail.labels.assignedTo'),
        value: assignedToName || task.assignedTo,
        icon: User,
        color: 'purple'
      }
    ];
  }, [assignedToName, formatTaskDate, priorityLabel, statusLabel, t, tFilters, task]);

  if (loading) {
    return (
      <PageContainer ariaLabel={t('detail.title')} className={layout.minHeightScreen}>
        <section className={`${layout.flex1} ${layout.centerContent} ${layout.textCenter}`} aria-live="polite">
          <AnimatedSpinner size="large" className={`${layout.centerHorizontal} ${spacing.margin.bottom.sm}`} />
          <p className={colors.text.muted}>{t('detail.loading')}</p>
        </section>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer ariaLabel={t('detail.title')} className={layout.minHeightScreen}>
        <section className={`${layout.flex1} ${spacing.padding.x.lg} ${spacing.padding.y.lg}`}>
          <article className={`${colors.bg.errorLight} ${getStatusBorder('error')} ${quick.card} ${spacing.padding.lg} ${layout.textCenter}`}>
            <AlertTriangle className={`${iconSizes.lg} ${colors.text.error} ${layout.centerHorizontal} ${spacing.margin.bottom.sm}`} />
            <h2 className={`${typography.heading.lg} ${colors.text.error} ${spacing.margin.bottom.sm}`}>{t('detail.errorTitle')}</h2>
            <p className={`${colors.text.error} ${spacing.margin.bottom.md}`}>{error}</p>
            <Button onClick={handleBack} variant="outline">
              {t('detail.backToTasks')}
            </Button>
          </article>
        </section>
      </PageContainer>
    );
  }

  if (notFound || !task) {
    return (
      <PageContainer ariaLabel={t('detail.title')} className={layout.minHeightScreen}>
        <section className={`${layout.flex1} ${spacing.padding.x.lg} ${spacing.padding.y.lg}`}>
          <article className={`${colors.bg.primary} ${getStatusBorder('warning')} ${quick.card} ${spacing.padding.lg} ${layout.textCenter}`}>
            <AlertTriangle className={`${iconSizes.lg} ${colors.text.warning} ${layout.centerHorizontal} ${spacing.margin.bottom.sm}`} />
            <h2 className={`${typography.heading.lg} ${colors.text.primary} ${spacing.margin.bottom.sm}`}>{t('detail.notFoundTitle')}</h2>
            <p className={`${colors.text.muted} ${spacing.margin.bottom.md}`}>{t('detail.notFoundDescription')}</p>
            <Button onClick={handleBack} variant="outline">
              {t('detail.backToTasks')}
            </Button>
          </article>
        </section>
      </PageContainer>
    );
  }

  return (
    <PageContainer ariaLabel={t('detail.title')}>
      <PageHeader
        variant="sticky-rounded"
        layout="compact"
        spacing="compact"
        title={{
          icon: ClipboardList,
          title: task.title,
          subtitle: t('detail.title')
        }}
        actions={{
          customActions: [
            <Button key="back" onClick={handleBack} variant="outline" size="sm">
              <ArrowLeft className={`${iconSizes.sm} ${layout.buttonIconSpacing}`} />
              {t('detail.backToTasks')}
            </Button>,
            <Button
              key="mobile-filters"
              type="button"
              variant={showFilters ? 'default' : 'outline'}
              size="icon"
              className={getResponsiveClass('md', 'hidden')}
              onClick={() => setShowFilters(!showFilters)}
              aria-label={tFilters('title')}
            >
              <Filter className={iconSizes.sm} />
            </Button>
          ].filter(Boolean) as ReactNode[]
        }}
      />

      <section className={cn(layout.widthFull, 'overflow-hidden', sectionSpacing)} aria-label={t('detail.sections.summary')}>
        <UnifiedDashboard
          stats={dashboardStats}
          columns={4}
          className={`${layout.dashboardPadding} overflow-hidden`}
        />
      </section>

      <section className={layout.widthFull} aria-label={tFilters('title')}>
        <aside className={cn('hidden', getResponsiveClass('md', 'block'))} role="complementary" aria-label={tFilters('title')}>
          <AdvancedFiltersPanel
            config={taskFiltersConfig}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </aside>

        {showFilters && (
          <aside className={getResponsiveClass('md', 'hidden')} role="complementary" aria-label={tFilters('title')}>
            <AdvancedFiltersPanel
              config={taskFiltersConfig}
              filters={filters}
              onFiltersChange={setFilters}
              defaultOpen
            />
          </aside>
        )}
      </section>

      <ListContainer>
        <section className={`${layout.flex1} ${layout.flexColGap4} min-h-0`} aria-label={t('detail.sections.summary')}>
          <div className={`${layout.responsiveFlexRow} ${layout.flex1} ${layout.listItemsGap}`}>
            <article className={`${layout.flex1} ${layout.flexColGap4} min-w-0`}>
              <section className={`${quick.card} ${colors.bg.primary} ${spacing.padding.lg} ${spacing.spaceBetween.md}`}>
                <header className={`${layout.flexCenterGap2} flex-wrap`}>
                  <Badge variant={getStatusVariant(task.status)}>{statusLabel}</Badge>
                  <Badge variant={getPriorityVariant(task.priority)}>{priorityLabel}</Badge>
                  <Badge variant="outline">{typeLabel}</Badge>
                </header>
                {task.description && (
                  <div className={`${typography.body.sm} ${colors.text.secondary}`}>
                    <SafeHTMLContent html={task.description} />
                  </div>
                )}
              </section>

              {(task.contactId || task.projectId || task.unitId) && (
                <section className={`${quick.card} ${colors.bg.primary} ${spacing.padding.lg}`}>
                  <h2 className={`${typography.heading.md} ${colors.text.primary} ${spacing.margin.bottom.md}`}>{t('detail.sections.related')}</h2>
                  <dl className={spacing.spaceBetween.sm}>
                    {task.contactId && (
                      <div className={layout.flexCenterGap2}>
                        <User className={`${iconSizes.sm} ${colors.text.muted}`} />
                        <div>
                          <dt className={`${typography.label.simple} ${colors.text.muted}`}>{t('detail.labels.contactId')}</dt>
                          <dd className={`${typography.body.sm} ${colors.text.primary}`}>
                            {contactNameLoading ? t('detail.loadingPlaceholder') : (contactName || task.contactId)}
                          </dd>
                        </div>
                      </div>
                    )}
                    {task.projectId && (
                      <div className={layout.flexCenterGap2}>
                        <Folder className={`${iconSizes.sm} ${colors.text.muted}`} />
                        <div>
                          <dt className={`${typography.label.simple} ${colors.text.muted}`}>{t('detail.labels.projectId')}</dt>
                          <dd className={`${typography.body.sm} ${colors.text.primary}`}>{task.projectId}</dd>
                        </div>
                      </div>
                    )}
                    {task.unitId && (
                      <div className={layout.flexCenterGap2}>
                        <Home className={`${iconSizes.sm} ${colors.text.muted}`} />
                        <div>
                          <dt className={`${typography.label.simple} ${colors.text.muted}`}>{t('detail.labels.unitId')}</dt>
                          <dd className={`${typography.body.sm} ${colors.text.primary}`}>{task.unitId}</dd>
                        </div>
                      </div>
                    )}
                  </dl>
                </section>
              )}
            </article>

            <aside className={`${layout.flex1} ${layout.flexColGap4}`} aria-label={t('detail.sections.metadata')}>
              <section className={`${quick.card} ${colors.bg.primary} ${spacing.padding.lg}`}>
                <h2 className={`${typography.heading.md} ${colors.text.primary} ${spacing.margin.bottom.md}`}>{t('detail.sections.metadata')}</h2>
                <dl className={spacing.spaceBetween.md}>
                  <div>
                    <dt className={`${typography.label.simple} ${colors.text.muted}`}>{t('detail.labels.assignedTo')}</dt>
                    <dd className={`${typography.body.sm} ${colors.text.primary}`}>{assignedToName || task.assignedTo}</dd>
                  </div>
                  <div className={layout.flexCenterGap2}>
                    <Calendar className={`${iconSizes.sm} ${colors.text.muted}`} />
                    <div>
                      <dt className={`${typography.label.simple} ${colors.text.muted}`}>{t('detail.labels.dueDate')}</dt>
                      <dd className={`${typography.body.sm} ${colors.text.primary}`}>{formatTaskDate(task.dueDate ?? null)}</dd>
                    </div>
                  </div>
                  <div>
                    <dt className={`${typography.label.simple} ${colors.text.muted}`}>{t('detail.labels.createdAt')}</dt>
                    <dd className={`${typography.body.sm} ${colors.text.primary}`}>{formatTaskDate(task.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className={`${typography.label.simple} ${colors.text.muted}`}>{t('detail.labels.updatedAt')}</dt>
                    <dd className={`${typography.body.sm} ${colors.text.primary}`}>{formatTaskDate(task.updatedAt)}</dd>
                  </div>
                  {task.completedAt && (
                    <div>
                      <dt className={`${typography.label.simple} ${colors.text.muted}`}>{t('detail.labels.completedAt')}</dt>
                      <dd className={`${typography.body.sm} ${colors.text.primary}`}>{formatTaskDate(task.completedAt)}</dd>
                    </div>
                  )}
                </dl>
              </section>
            </aside>
          </div>
        </section>
      </ListContainer>
    </PageContainer>
  );
}
