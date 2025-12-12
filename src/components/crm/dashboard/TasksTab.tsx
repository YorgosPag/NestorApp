'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getAllTasks as getTasks, completeTask, deleteTask } from '@/services/tasks.service';
import { getOpportunities } from '@/services/opportunities.service';
import {
  Clock,
  CheckCircle,
  Phone,
  Users,
  Calendar,
  Mail,
  FileText,
  AlertCircle,
  Edit3,
  Trash2,
  User,
  MapPin,
  Search,
  Plus
} from 'lucide-react';
import { format, isToday, isPast, isTomorrow } from 'date-fns';
import { el } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import CreateTaskModal from './dialogs/CreateTaskModal';
import type { CrmTask, Opportunity, FirestoreishTimestamp } from '@/types/crm';
import type { CrmTaskType, CrmTaskPriority, CrmTaskStatus } from '@/types/crm-extra';
import { HOVER_BACKGROUND_EFFECTS, HOVER_SHADOWS } from '@/components/ui/effects';

type TimeframeFilter = 'all' | 'overdue' | 'today' | 'tomorrow' | 'week';

interface TaskFilters {
  status: 'all' | CrmTaskStatus;
  priority: 'all' | CrmTaskPriority;
  type: 'all' | CrmTaskType;
  timeframe: TimeframeFilter;
  searchTerm: string;
}

interface TaskMetadata {
    location?: string;
    [key: string]: unknown;
}

const TASK_TYPE_ICONS: Record<CrmTaskType, React.ElementType> = {
  call: Phone,
  meeting: Users,
  viewing: Calendar,
  follow_up: AlertCircle,
  email: Mail,
  document: FileText,
  other: Clock,
};

const PRIORITY_COLORS: Record<CrmTaskPriority, string> = {
  low: 'text-green-600 bg-green-100',
  medium: 'text-yellow-600 bg-yellow-100',
  high: 'text-orange-600 bg-orange-100',
  urgent: 'text-red-600 bg-red-100',
};

const STATUS_COLORS: Record<CrmTaskStatus, string> = {
  pending: 'text-blue-600 bg-blue-100',
  in_progress: 'text-purple-600 bg-purple-100',
  completed: 'text-green-600 bg-green-100',
  cancelled: 'text-gray-600 bg-gray-100',
};

const getDateColor = (dueDate?: FirestoreishTimestamp, status?: CrmTaskStatus) => {
    if (status === 'completed') return 'text-green-600';
    if (!dueDate) return 'text-gray-600';
    const date = new Date(dueDate as string); // Assuming string | Date
    if (isPast(date) && !isToday(date)) return 'text-red-600';
    if (isToday(date)) return 'text-blue-600';
    if (isTomorrow(date)) return 'text-purple-600';
    return 'text-gray-600';
};

const createFormatDueDate = (t: (key: string) => string) => (dueDate?: FirestoreishTimestamp) => {
    if (!dueDate) return t('tasks.noDate');
    const date = new Date(dueDate as string);
    if (isToday(date)) return `${t('tasks.today')} ${format(date, 'HH:mm')}`;
    if (isTomorrow(date)) return `${t('tasks.tomorrow')} ${format(date, 'HH:mm')}`;
    if (isPast(date)) return `${t('tasks.overdue')} ${format(date, 'dd/MM HH:mm')}`;
    return format(date, 'dd/MM/yyyy HH:mm', { locale: el });
};

export function TasksTab() {
  const { t } = useTranslation('crm');
  const formatDueDate = useMemo(() => createFormatDueDate(t), [t]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [leads, setLeads] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [filters, setFilters] = useState<TaskFilters>({
    status: 'all',
    priority: 'all',
    type: 'all',
    timeframe: 'all',
    searchTerm: ''
  });

  const fetchData = useCallback(async () => {
    let isMounted = true;
    setLoading(true);
    try {
      const [tasksData, leadsData] = await Promise.all([
        getTasks(),
        getOpportunities()
      ]);
      if(isMounted) {
        setTasks(tasksData);
        setLeads(leadsData);
        setError(null);
      }
    } catch (err) {
      if(isMounted) {
        setError(t('tasks.messages.loadError'));
        console.error('Error fetching tasks:', err);
      }
    } finally {
      if(isMounted) {
        setLoading(false);
      }
    }
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    fetchData();
  }, []); // 🔧 FIX: Removed fetchData to prevent infinite loop - load once on mount

  const filteredTasks = useMemo(() => {
    let list = [...tasks];

    if (filters.status !== 'all') list = list.filter(t => t.status === filters.status);
    if (filters.priority !== 'all') list = list.filter(t => t.priority === filters.priority);
    if (filters.type !== 'all') list = list.filter(t => t.type === filters.type);

    if (filters.timeframe !== 'all') {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekFromNow = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

      list = list.filter(t => {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate as string);
        switch (filters.timeframe) {
          case 'overdue': return isPast(d) && !isToday(d) && t.status !== 'completed';
          case 'today': return isToday(d);
          case 'tomorrow': return isTomorrow(d);
          case 'week': return d >= todayStart && d <= weekFromNow;
          default: return true;
        }
      });
    }

    if (filters.searchTerm) {
      const q = filters.searchTerm.toLowerCase();
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      const da = a.dueDate ? new Date(a.dueDate as string).getTime() : Infinity;
      const db = b.dueDate ? new Date(b.dueDate as string).getTime() : Infinity;
      return da - db;
    });

    return list;
  }, [tasks, filters]);

  const handleFilterChange = useCallback((key: keyof TaskFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value as any }));
  }, []);

  const handleCompleteTask = useCallback(async (taskId?: string, taskTitle?: string) => {
    if (!taskId || !taskTitle) return;
    try {
      await completeTask(taskId);
      toast.success(t('tasks.messages.completed', { title: taskTitle }));
      fetchData();
    } catch (error) {
      toast.error(t('tasks.messages.completeError'));
    }
  }, [t]); // 🔧 FIX: Removed fetchData to prevent infinite loop

  const handleDeleteTask = useCallback(async (taskId?: string, taskTitle?: string) => {
    if (!taskId || !taskTitle) return;
    if (window.confirm(t('tasks.messages.deleteConfirm', { title: taskTitle }))) {
      try {
        await deleteTask(taskId);
        toast.success(t('tasks.messages.deleted', { title: taskTitle }));
        fetchData();
      } catch (error) {
        toast.error(t('tasks.messages.deleteError'));
      }
    }
  }, [t]); // 🔧 FIX: Removed fetchData to prevent infinite loop

  const getLeadName = useCallback((leadId?: string) => leads.find(l => l.id === leadId)?.fullName || null, [leads]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  if (error) {
    return (
        <div className="p-6 text-center text-red-500">{error}</div>
    )
  }

  return (
    <div className="bg-white dark:bg-card rounded-lg shadow space-y-6">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('tasks.title')}</h2>
          <Button size="sm" onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {t('tasks.newTask')}
          </Button>
        </div>
      </div>

      <div className="px-6 space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder={t('tasks.searchPlaceholder')} value={filters.searchTerm} onChange={(e) => handleFilterChange('searchTerm', e.target.value)} className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <select value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
            <option value="all">{t('tasks.status.all')}</option>
            <option value="pending">{t('tasks.status.pending')}</option>
            <option value="in_progress">{t('tasks.status.in_progress')}</option>
            <option value="completed">{t('tasks.status.completed')}</option>
            <option value="cancelled">{t('tasks.status.cancelled')}</option>
          </select>
          <select value={filters.priority} onChange={(e) => handleFilterChange('priority', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
            <option value="all">{t('tasks.priority.all')}</option>
            <option value="urgent">{t('tasks.priority.urgent')}</option>
            <option value="high">{t('tasks.priority.high')}</option>
            <option value="medium">{t('tasks.priority.medium')}</option>
            <option value="low">{t('tasks.priority.low')}</option>
          </select>
          <select value={filters.type} onChange={(e) => handleFilterChange('type', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
            <option value="all">{t('tasks.type.all')}</option>
            {Object.keys(TASK_TYPE_ICONS).map(type => <option key={type} value={type}>{t(`tasks.type.${type}`)}</option>)}
          </select>
          <select value={filters.timeframe} onChange={(e) => handleFilterChange('timeframe', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
            <option value="all">{t('tasks.timeframe.all')}</option>
            <option value="overdue">{t('tasks.timeframe.overdue')}</option>
            <option value="today">{t('tasks.timeframe.today')}</option>
            <option value="tomorrow">{t('tasks.timeframe.tomorrow')}</option>
            <option value="week">{t('tasks.timeframe.week')}</option>
          </select>
          <button onClick={() => setFilters({ status: 'all', priority: 'all', type: 'all', timeframe: 'all', searchTerm: '' })} className={`px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm ${HOVER_BACKGROUND_EFFECTS.LIGHT}`}>
            {t('tasks.clearFilters')}
          </button>
        </div>

        {/* Task List */}
        <div className="space-y-3">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12"><p>{t('tasks.noTasks')}</p></div>
          ) : (
            filteredTasks.map((task) => {
              const TaskIcon = TASK_TYPE_ICONS[task.type] || Clock;
              const leadName = getLeadName(task.leadId);
              const meta = (task.metadata || {}) as TaskMetadata;
              return (
                <div key={task.id} className={`bg-background p-4 rounded-lg border ${HOVER_SHADOWS.SUBTLE}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${task.status === 'completed' ? 'bg-green-100' : 'bg-blue-100'}`}>
                          <TaskIcon className={`w-4 h-4 ${task.status === 'completed' ? 'text-green-600' : 'text-blue-600'}`} />
                        </div>
                        <h4 className={`font-medium ${task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'}`}>{task.title}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[task.status]}`}>{task.status}</span>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-center gap-4">
                          <span className={`flex items-center gap-1 ${getDateColor(task.dueDate, task.status)}`}><Clock className="w-3 h-3" />{formatDueDate(task.dueDate)}</span>
                          {leadName && <span className="flex items-center gap-1"><User className="w-3 h-3" />{leadName}</span>}
                          {meta.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{meta.location}</span>}
                        </div>
                        {task.description && <p className="text-gray-700 mt-2">{task.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {task.status !== 'completed' && <Button size="sm" variant="ghost" className="text-green-600" onClick={() => handleCompleteTask(task.id, task.title)} aria-label={t('tasks.actions.complete')}><CheckCircle className="w-4 h-4 mr-1" />{t('tasks.actions.complete')}</Button>}
                      <Button size="sm" variant="ghost" aria-label={t('tasks.actions.edit')}><Edit3 className="w-4 h-4 mr-1" />{t('tasks.actions.edit')}</Button>
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDeleteTask(task.id, task.title)} aria-label={t('tasks.actions.delete')}><Trash2 className="w-4 h-4 mr-1" />{t('tasks.actions.delete')}</Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      <CreateTaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onTaskCreated={fetchData} />
    </div>
  );
}
