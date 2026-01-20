
'use client';

import React from 'react';
import { Mail, PhoneCall, Calendar, Plus } from 'lucide-react';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function QuickActions() {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { quick } = useBorderTokens();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('crm');
  const actions = [
    { label: t('quickActions.newEmail'), icon: Mail },
    { label: t('quickActions.logCall'), icon: PhoneCall },
    { label: t('quickActions.newAppointment'), icon: Calendar },
    { label: t('quickActions.newTask'), icon: Plus },
  ];
  return (
    <section className={`${colors.bg.primary} ${quick.card} p-6`} aria-labelledby="quick-actions-title">
      <h2 id="quick-actions-title" className="text-lg font-semibold mb-4">{t('quickActions.title')}</h2>
      <nav className="grid grid-cols-2 gap-4" aria-label={t('quickActions.ariaLabel')}>
        {actions.map((action, idx) => (
          <button key={idx} className={`flex flex-col items-center justify-center p-4 ${colors.bg.secondary} rounded-lg ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${TRANSITION_PRESETS.STANDARD_COLORS}`}>
            <action.icon className={`${iconSizes.lg} ${colors.text.info} mb-2`} />
            <span className={`text-sm font-medium ${colors.text.foreground}`}>{action.label}</span>
          </button>
        ))}
      </nav>
    </section>
  );
}
