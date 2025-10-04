'use client';

import React, { useState } from 'react';
import { 
  Users, Building, Phone, MessageSquare, Calendar,
  TrendingUp, Clock, Target, Plus
} from 'lucide-react';
import { OverviewTab } from './OverviewTab';
import { PipelineTab } from './PipelineTab';
import { ContactsTab } from './ContactsTab';
import { CommunicationsTab } from './CommunicationsTab';
import { TasksTab } from './TasksTab';
import { CalendarTab } from './CalendarTab';
import { PeriodSelector } from './PeriodSelector';
import { TelegramNotifications } from './TelegramNotifications';

export function CRMDashboardPageContent() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPeriod, setSelectedPeriod] = useState('week');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      {/* Header */}
      <div className="bg-white dark:bg-card shadow-sm border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground">CRM Dashboard</h1>
            <div className="flex items-center space-x-3">
              <TelegramNotifications />
              <PeriodSelector value={selectedPeriod} onChange={setSelectedPeriod} />
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Νέα Επαφή
              </button>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex space-x-6 mt-4">
            {[
              { id: 'overview', label: 'Επισκόπηση', icon: TrendingUp },
              { id: 'pipeline', label: 'Pipeline Πωλήσεων', icon: Target },
              { id: 'contacts', label: 'Επαφές', icon: Users },
              { id: 'communications', label: 'Επικοινωνίες', icon: MessageSquare },
              { id: 'tasks', label: 'Εργασίες', icon: Clock },
              { id: 'calendar', label: 'Ημερολόγιο', icon: Calendar }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                  activeTab === tab.id 
                    ? 'border-blue-600 text-blue-600' 
                    : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'pipeline' && <PipelineTab />}
        {activeTab === 'contacts' && <ContactsTab />}
        {activeTab === 'communications' && <CommunicationsTab />}
        {activeTab === 'tasks' && <TasksTab />}
        {activeTab === 'calendar' && <CalendarTab />}
      </div>
    </div>
  );
}