
'use client';

import React from 'react';
import { Mail, PhoneCall, Calendar, Plus } from 'lucide-react';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';

export function QuickActions() {
  const iconSizes = useIconSizes();
  const actions = [
    { label: 'Νέο Email', icon: Mail },
    { label: 'Καταγραφή Κλήσης', icon: PhoneCall },
    { label: 'Νέο Ραντεβού', icon: Calendar },
    { label: 'Νέα Εργασία', icon: Plus },
  ];
  return (
    <section className="bg-white dark:bg-card rounded-lg shadow p-6" aria-labelledby="quick-actions-title">
      <h2 id="quick-actions-title" className="text-lg font-semibold mb-4">Γρήγορες Ενέργειες</h2>
      <nav className="grid grid-cols-2 gap-4" aria-label="Γρήγορες ενέργειες CRM">
        {actions.map((action, idx) => (
          <button key={idx} className={`flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${TRANSITION_PRESETS.STANDARD_COLORS}`}>
            <action.icon className={`${iconSizes.lg} text-blue-600 mb-2`} />
            <span className="text-sm font-medium text-gray-800">{action.label}</span>
          </button>
        ))}
      </nav>
    </section>
  );
}
