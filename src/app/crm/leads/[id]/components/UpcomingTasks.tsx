
'use client';

import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { CrmTask } from '@/types/crm';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { getTaskDateColor, formatTaskDate } from '../utils/dates';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

interface UpcomingTasksProps {
  tasks: CrmTask[];
  router: AppRouterInstance;
}

export function UpcomingTasks({ tasks, router }: UpcomingTasksProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { quick, radius } = useBorderTokens();
  const pendingTasks = useMemo(() => {
    return tasks
      .filter(task => task.status === 'pending' || task.status === 'in_progress')
      .sort((a, b) => new Date(a.dueDate as string).getTime() - new Date(b.dueDate as string).getTime());
  }, [tasks]);

  if (pendingTasks.length === 0) {
    return null;
  }

  return (
    <div className={`${colors.bg.primary} ${quick.card} shadow p-6`}>
      <h3 className={`text-lg font-semibold mb-4 ${colors.text.foreground}`}>Επερχόμενες Εργασίες</h3>
      <div className="space-y-3">
        {pendingTasks.slice(0, 5).map((task) => (
          <div key={task.id} className={`flex items-center justify-between p-3 ${colors.bg.secondary} ${radius.lg}`}>
            <div className="flex-1">
              <h5 className={`font-medium ${colors.text.foreground}`}>{task.title}</h5>
              <div className={`flex items-center gap-4 text-sm ${colors.text.muted} mt-1`}>
                <span className={getTaskDateColor(task.dueDate, task.status)}>
                  <Clock className={`${iconSizes.xs} inline mr-1`} />
                  {formatTaskDate(task.dueDate)}
                </span>
                <span className={`px-2 py-1 ${radius.full} text-xs ${
                  task.priority === 'urgent' ? `${colors.bg.error}/50 ${colors.text.error}` :
                  task.priority === 'high' ? `${colors.bg.warning}/50 ${colors.text.warning}` :
                  task.priority === 'medium' ? `${colors.bg.warning}/30 ${colors.text.warning}` :
                  `${colors.bg.success}/50 ${colors.text.success}`
                }`}>
                  {task.priority === 'urgent' ? 'Επείγουσα' : task.priority === 'high' ? 'Υψηλή' : task.priority === 'medium' ? 'Μεσαία' : 'Χαμηλή'}
                </span>
              </div>
            </div>
          </div>
        ))}
        {pendingTasks.length > 5 && (
          <div className="text-center">
            <button onClick={() => router.push('/crm/tasks')} className={`${colors.text.info} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} text-sm`}>
              Δείτε όλες τις εργασίες ({pendingTasks.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
