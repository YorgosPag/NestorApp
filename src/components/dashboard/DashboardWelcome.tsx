'use client';

import { useTranslation } from '@/i18n';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// ============================================================================
// Dashboard Welcome — Time-based greeting header (ADR-179)
// ============================================================================

interface DashboardWelcomeProps {
  displayName: string | null;
}

function getGreetingKey(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

export function DashboardWelcome({ displayName }: DashboardWelcomeProps) {
  const { t } = useTranslation('dashboard');
  const colors = useSemanticColors();
  const greetingKey = getGreetingKey();

  const greeting = t(`home.greeting.${greetingKey}`);
  const name = displayName || '';

  return (
    <header className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        {greeting}{name ? `, ${name}` : ''}
      </h1>
      <p className={`mt-1 text-sm ${colors.text.muted}`}>
        {t('home.subtitle')}
      </p>
    </header>
  );
}
