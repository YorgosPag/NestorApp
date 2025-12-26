
'use client';

import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { CrmTask } from '@/types/crm';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { getTaskDateColor, formatTaskDate } from '../utils/dates';

interface UpcomingTasksProps {
  tasks: CrmTask[];
  router: any;
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
      <h3 className="text-lg font-semibold mb-4">Επερχόμενες Εργασίες</h3>
      <div className="space-y-3">
        {pendingTasks.slice(0, 5).map((task) => (
          <div key={task.id} className={`flex items-center justify-between p-3 ${colors.bg.secondary} ${radius.lg}`}>
            <div className="flex-1">
              <h5 className="font-medium text-gray-900 dark:text-foreground">{task.title}</h5>
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-muted-foreground mt-1">
                <span className={getTaskDateColor(task.dueDate, task.status)}>
                  <Clock className={`${iconSizes.xs} inline mr-1`} />
                  {formatTaskDate(task.dueDate)}
                </span>
                <span className={`px-2 py-1 ${radius.full} text-xs ${
                  task.priority === 'urgent' ? `${colors.bg.error}/50 text-red-700` :
                  task.priority === 'high' ? `${colors.bg.warning}/50 text-orange-700` :
                  task.priority === 'medium' ? `${colors.bg.warning}/30 text-yellow-700` :
                  `${colors.bg.success}/50 text-green-700`
                }`}>
                  {task.priority === 'urgent' ? 'Επείγουσα' : task.priority === 'high' ? 'Υψηλή' : task.priority === 'medium' ? 'Μεσαία' : 'Χαμηλή'}
                </span>
              </div>
            </div>
          </div>
        ))}
        {pendingTasks.length > 5 && (
          <div className="text-center">
            <button onClick={() => router.push('/crm/tasks')} className={`text-blue-600 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} text-sm`}>
              Δείτε όλες τις εργασίες ({pendingTasks.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
