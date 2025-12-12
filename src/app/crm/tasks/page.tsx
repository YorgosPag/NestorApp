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

export default function CrmTasksPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [stats, setStats] = useState<any>(null);
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
    { title: 'Συνολικές Εργασίες', value: stats?.total || 0, icon: Clock, color: 'blue', description: 'Όλες οι εργασίες' },
    { title: 'Εκκρεμείς', value: stats?.pending || 0, icon: AlertTriangle, color: 'yellow', description: 'Προς εκτέλεση' },
    { title: 'Εκπρόθεσμες', value: stats?.overdue || 0, icon: AlertTriangle, color: 'red', description: 'Πέρασε η ημερομηνία' },
    { title: 'Ολοκληρωμένες', value: stats?.completed || 0, icon: CheckCircle, color: 'green', description: 'Έχουν ολοκληρωθεί' },
    { title: 'Σήμερα', value: stats?.dueToday || 0, icon: Calendar, color: 'purple', description: 'Με deadline σήμερα' },
    { title: 'Αυτή την εβδομάδα', value: stats?.dueThisWeek || 0, icon: TrendingUp, color: 'indigo', description: 'Με deadline εντός εβδομάδας' }
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, string> = {
      blue: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
      yellow: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30',
      red: 'text-red-600 bg-red-100 dark:bg-red-900/30',
      green: 'text-green-600 bg-green-100 dark:bg-green-900/30',
      purple: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30',
      indigo: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30'
    };
    return colors[color] || 'text-gray-600 bg-gray-100';
  };

  return (
    <>
      <Toaster position="top-right" />
      
      <main className="min-h-screen bg-gray-50 dark:bg-background">
        <header className="bg-white dark:bg-card shadow-sm border-b">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-6 h-6 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground">Εργασίες</h1>
                  <p className="text-gray-600 dark:text-muted-foreground mt-1">Διαχείριση εργασιών και υπενθυμίσεων</p>
                </div>
              </div>
              
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Νέα Εργασία
              </Button>
            </div>
          </div>
        </header>

        <section className="container mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
            {statsCards.map((card, index) => (
              <article key={index} className="bg-white dark:bg-card rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-gray-600 dark:text-muted-foreground mb-1">{card.title}</p>
                    {loadingStats ? (
                      <Skeleton className="h-8 w-12 rounded-md" />
                    ) : (
                      <p className="text-2xl font-bold text-gray-900 dark:text-foreground">{card.value}</p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-muted-foreground/80 mt-1">{card.description}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getColorClasses(card.color)}`}>
                    <card.icon className="w-5 h-5" />
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
