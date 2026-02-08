// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
// 🏢 ENTERPRISE: Refactored to use centralized systems (2026-02-08)
'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Plus,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Calendar
} from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { getTasksStats } from '@/services/tasks.service';
import CreateTaskModal from '@/components/crm/dashboard/dialogs/CreateTaskModal';
import { TasksTab } from '@/components/crm/dashboard/TasksTab';
import { useTranslation } from 'react-i18next';
// 🏢 ENTERPRISE: Auth hook for race condition prevention
import { useAuth } from '@/auth/contexts/AuthContext';
// 🏢 ENTERPRISE: Centralized systems
import { PageContainer, ListContainer } from '@/core/containers';
import { PageHeader } from '@/core/headers';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';

// 🏢 ENTERPRISE: Task statistics interface
interface TaskStats {
  total: number;
  pending: number;
  overdue: number;
  completed: number;
  dueToday: number;
  dueThisWeek: number;
}

export default function CrmTasksPage() {
  const { t } = useTranslation('crm');
  const layout = useLayoutClasses();
  // 🏢 ENTERPRISE: Auth context for race condition prevention
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const fetchStats = async () => {
    if (!isAuthenticated) return;
    try {
      setLoadingStats(true);
      const statsData = await getTasksStats(null);
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching task stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchStats();
    }
  }, [refreshTrigger, authLoading, isAuthenticated]);

  const handleTaskCreated = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // 🏢 ENTERPRISE: Stats cards using centralized UnifiedDashboard pattern
  const dashboardStats = useMemo<DashboardStat[]>(() => ([
    { title: t('tasks.stats.total'), value: loadingStats ? '...' : stats?.total ?? 0, icon: Clock, color: 'blue', description: t('tasks.stats.totalDesc') },
    { title: t('tasks.stats.pending'), value: loadingStats ? '...' : stats?.pending ?? 0, icon: AlertTriangle, color: 'yellow', description: t('tasks.stats.pendingDesc') },
    { title: t('tasks.stats.overdue'), value: loadingStats ? '...' : stats?.overdue ?? 0, icon: AlertTriangle, color: 'red', description: t('tasks.stats.overdueDesc') },
    { title: t('tasks.stats.completed'), value: loadingStats ? '...' : stats?.completed ?? 0, icon: CheckCircle, color: 'green', description: t('tasks.stats.completedDesc') },
    { title: t('tasks.stats.today'), value: loadingStats ? '...' : stats?.dueToday ?? 0, icon: Calendar, color: 'purple', description: t('tasks.stats.todayDesc') },
    { title: t('tasks.stats.thisWeek'), value: loadingStats ? '...' : stats?.dueThisWeek ?? 0, icon: TrendingUp, color: 'indigo', description: t('tasks.stats.thisWeekDesc') }
  ]), [stats, loadingStats, t]);

  return (
    <PageContainer ariaLabel={t('tasks.title')}>
      <Toaster position="top-right" />

      {/* 🏢 ENTERPRISE: Centralized PageHeader */}
      <PageHeader
        variant="sticky-rounded"
        layout="single-row"
        title={{
          icon: Clock,
          title: t('tasks.title'),
          subtitle: t('tasks.description')
        }}
        actions={{
          addButton: {
            label: t('tasks.newTask'),
            onClick: () => setShowCreateModal(true),
            icon: Plus
          }
        }}
      />

      {/* 🏢 ENTERPRISE: Centralized UnifiedDashboard */}
      <section className={layout.widthFull} aria-label={t('tasks.stats.total')}>
        <UnifiedDashboard
          stats={dashboardStats}
          columns={6}
          className={`${layout.dashboardPadding} overflow-hidden`}
        />
      </section>

      {/* 🏢 ENTERPRISE: Task list with centralized ListContainer */}
      <ListContainer>
        <section className={`${layout.flexColGap4} flex-1 min-h-0`}>
          <TasksTab onTaskCreated={handleTaskCreated} />
        </section>
      </ListContainer>

      <CreateTaskModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onTaskCreated={handleTaskCreated}
      />
    </PageContainer>
  );
}
