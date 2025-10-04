'use client';

import React from 'react';
import { toast } from 'react-hot-toast';
import { Send, PhoneCall, Plus, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Opportunity } from '@/types/crm';

interface QuickActionsProps {
  lead: Opportunity;
  onEdit: () => void;
  onNewTask: () => void;
  onSendEmail?: () => void; // New callback for email modal
}

export function QuickActions({ lead, onEdit, onNewTask, onSendEmail }: QuickActionsProps) {
  const handleCall = () => {
    if (!lead.phone) {
      toast.error('Αυτό το lead δεν έχει τηλέφωνο');
      return;
    }
    window.location.href = `tel:${lead.phone}`;
  };

  const handleSendEmail = () => {
    if (!lead.email) {
      toast.error('Αυτό το lead δεν έχει email address');
      return;
    }
    
    // Call the parent's email modal handler
    onSendEmail?.();
  };

  return (
    <div className="bg-white dark:bg-card rounded-lg shadow p-6">
      <h4 className="font-medium mb-3">Γρήγορες Ενέργειες</h4>
      <div className="space-y-2">
        <Button
          onClick={handleSendEmail}
          disabled={!lead.email}
          className="w-full flex items-center justify-start gap-3 px-4 py-3 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-200 dark:hover:bg-blue-900/40"
        >
          <Send className="w-5 h-5" />
          Αποστολή Email
        </Button>
        <Button
          onClick={handleCall}
          disabled={!lead.phone}
          className="w-full flex items-center justify-start gap-3 px-4 py-3 bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-200 dark:hover:bg-green-900/40"
        >
          <PhoneCall className="w-5 h-5" />
          Κλήση
        </Button>
        <Button
          onClick={onNewTask}
          className="w-full flex items-center justify-start gap-3 px-4 py-3 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-200 dark:hover:bg-purple-900/40"
        >
          <Plus className="w-5 h-5" />
          Νέα Εργασία
        </Button>
        <Button
          onClick={onEdit}
          className="w-full flex items-center justify-start gap-3 px-4 py-3 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700/20 dark:text-gray-200 dark:hover:bg-gray-700/40"
        >
          <Edit3 className="w-5 h-5" />
          Επεξεργασία
        </Button>
      </div>
    </div>
  );
}
