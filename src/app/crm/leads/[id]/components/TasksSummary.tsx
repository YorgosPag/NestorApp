
'use client';

import React, { useMemo } from 'react';
import { Clock, CheckCircle } from 'lucide-react';
import type { CrmTask } from '@/types/crm';

interface TasksSummaryProps {
  tasks: CrmTask[];
  loading: boolean;
}

export function TasksSummary({ tasks, loading }: TasksSummaryProps) {
  const { pendingTasks, completedTasks } = useMemo(() => {
    if (!tasks) return { pendingTasks: [], completedTasks: [] };
    return {
      pendingTasks: tasks.filter(task => task.status === 'pending' || task.status === 'in_progress'),
      completedTasks: tasks.filter(task => task.status === 'completed'),
    };
  }, [tasks]);

  return (
    <div className="bg-white dark:bg-card rounded-lg shadow p-6">
      <h4 className="font-medium mb-3">Εργασίες</h4>
      {loading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-600" />
              Εκκρεμείς
            </span>
            <span className="font-medium">{pendingTasks.length}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              Ολοκληρωμένες
            </span>
            <span className="font-medium">{completedTasks.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}
