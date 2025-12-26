'use client';

import React from 'react';
import { toast } from 'react-hot-toast';
import { Send, PhoneCall, Plus, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import type { Opportunity } from '@/types/crm';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';

interface QuickActionsProps {
  lead: Opportunity;
  onEdit: () => void;
  onNewTask: () => void;
  onSendEmail?: () => void; // New callback for email modal
}

export function QuickActions({ lead, onEdit, onNewTask, onSendEmail }: QuickActionsProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { quick } = useBorderTokens();
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
    <div className={`${colors.bg.primary} ${quick.card} shadow p-6`}>
      <h4 className="font-medium mb-3">Γρήγορες Ενέργειες</h4>
      <div className="space-y-2">
        <Button
          onClick={handleSendEmail}
          disabled={!lead.email}
          className={`w-full flex items-center justify-start gap-3 px-4 py-3 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-200 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`}
        >
          <Send className={iconSizes.md} />
          Αποστολή Email
        </Button>
        <Button
          onClick={handleCall}
          disabled={!lead.phone}
          className={`w-full flex items-center justify-start gap-3 px-4 py-3 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-200 ${INTERACTIVE_PATTERNS.SUCCESS_HOVER}`}
        >
          <PhoneCall className={iconSizes.md} />
          Κλήση
        </Button>
        <Button
          onClick={onNewTask}
          className={`w-full flex items-center justify-start gap-3 px-4 py-3 bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-200 ${INTERACTIVE_PATTERNS.PURPLE_HOVER}`}
        >
          <Plus className={iconSizes.md} />
          Νέα Εργασία
        </Button>
        <Button
          onClick={onEdit}
          className={`w-full flex items-center justify-start gap-3 px-4 py-3 bg-gray-50 text-gray-700 dark:bg-gray-700/20 dark:text-gray-200 ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
        >
          <Edit3 className={iconSizes.md} />
          Επεξεργασία
        </Button>
      </div>
    </div>
  );
}
