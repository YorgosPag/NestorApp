// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import { useState, useEffect } from 'react';
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
import { TasksTab } from '@/components/crm/dashboard/TasksTab'; // Reusing TasksTab which is essentially a list
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from 'react-i18next';

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
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  // 🏢 ENTERPRISE: Proper type instead of any
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const fetchStats = async () => {
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
    fetchStats();
  }, [refreshTrigger]);

  const handleTaskCreated = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const statsCards = [
    { title: t('tasks.stats.total'), value: stats?.total || 0, icon: Clock, color: 'blue', description: t('tasks.stats.totalDesc') },
    { title: t('tasks.stats.pending'), value: stats?.pending || 0, icon: AlertTriangle, color: 'yellow', description: t('tasks.stats.pendingDesc') },
    { title: t('tasks.stats.overdue'), value: stats?.overdue || 0, icon: AlertTriangle, color: 'red', description: t('tasks.stats.overdueDesc') },
    { title: t('tasks.stats.completed'), value: stats?.completed || 0, icon: CheckCircle, color: 'green', description: t('tasks.stats.completedDesc') },
    { title: t('tasks.stats.today'), value: stats?.dueToday || 0, icon: Calendar, color: 'purple', description: t('tasks.stats.todayDesc') },
    { title: t('tasks.stats.thisWeek'), value: stats?.dueThisWeek || 0, icon: TrendingUp, color: 'indigo', description: t('tasks.stats.thisWeekDesc') }
  ];

  const getColorClasses = (color: string) => {
    const colorMappings: Record<string, string> = {
      blue: `${colors.text.info} ${colors.bg.info}`,
      yellow: `${colors.text.warning} ${colors.bg.warning}`,
      red: `${colors.text.error} ${colors.bg.error}`,
      green: `${colors.text.success} ${colors.bg.success}`,
      purple: `${colors.text.warning} ${colors.bg.warning}`,
      indigo: `${colors.text.info} ${colors.bg.info}`
    };
    return colorMappings[color] || `${colors.text.muted} ${colors.bg.hover}`;
  };

  return (
    <>
      <Toaster position="top-right" />
      
      <main className={`min-h-screen ${colors.bg.secondary}`}>
        <header className={`${colors.bg.primary} shadow-sm border-b`}>
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className={`${iconSizes.lg} ${colors.text.info}`} />
                <div>
                  <h1 className="text-2xl font-bold ${colors.text.foreground}">{t('tasks.title')}</h1>
                  <p className="${colors.text.muted} mt-1">{t('tasks.description')}</p>
                </div>
              </div>

              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className={`${iconSizes.sm} mr-2`} />
                {t('tasks.newTask')}
              </Button>
            </div>
          </div>
        </header>

        <section className="container mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
            {statsCards.map((card, index) => (
              <article key={index} className={`${colors.bg.primary} rounded-lg shadow p-6`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm ${colors.text.muted} mb-1">{card.title}</p>
                    {loadingStats ? (
                      <Skeleton className={`${iconSizes.xl} w-12 rounded-md`} />
                    ) : (
                      <p className="text-2xl font-bold ${colors.text.foreground}">{card.value}</p>
                    )}
                    <p className={`text-xs ${colors.text.muted} mt-1`}>{card.description}</p>
                  </div>
                  <div className={`${iconSizes.xl2} rounded-full flex items-center justify-center ${getColorClasses(card.color)}`}>
                    <card.icon className={iconSizes.md} />
                  </div>
                </div>
              </article>
            ))}
          </div>

          <TasksTab />
        </section>
      </main>

      <CreateTaskModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onTaskCreated={handleTaskCreated}
      />
    </>
  );
}
