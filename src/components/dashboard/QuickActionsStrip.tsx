'use client';

import Link from 'next/link';
import { UserPlus, FolderPlus, Receipt, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { TRANSITION_PRESETS } from '@/components/ui/effects';
import { cn } from '@/lib/utils';
import '@/lib/design-system';

// ============================================================================
// Quick Actions Strip — Prominent action buttons (ADR-179)
// ============================================================================

interface QuickAction {
  labelKey: string;
  icon: typeof UserPlus;
  href: string;
  variant: 'blue' | 'purple' | 'green' | 'neutral';
}

const QUICK_ACTIONS: QuickAction[] = [
  { labelKey: 'newContact', icon: UserPlus, href: '/contacts/new/individual', variant: 'blue' },
  { labelKey: 'newProject', icon: FolderPlus, href: '/projects', variant: 'purple' },
  { labelKey: 'newInvoice', icon: Receipt, href: '/accounting/invoices', variant: 'green' },
  { labelKey: 'search', icon: Search, href: '/contacts', variant: 'neutral' },
];

const VARIANT_CLASSES: Record<QuickAction['variant'], string> = {
  blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900', // eslint-disable-line design-system/enforce-semantic-colors
  purple: 'bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950 dark:text-purple-300 dark:hover:bg-purple-900',
  green: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900',
  neutral: 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
};

export function QuickActionsStrip() {
  const { t } = useTranslation('dashboard');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  return (
    <section aria-label={t('home.sections.quickActions')} className="mb-8">
      <h2 className={cn("text-sm font-medium mb-3", colors.text.muted)}>
        {t('home.sections.quickActions')}
      </h2>
      <nav className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => (
          <Button
            key={action.labelKey}
            variant="ghost"
            size="sm"
            className={cn(
              'gap-2 font-medium',
              VARIANT_CLASSES[action.variant],
              TRANSITION_PRESETS.STANDARD_COLORS
            )}
            asChild
          >
            <Link href={action.href}>
              <action.icon className={iconSizes.sm} />
              {t(`home.actions.${action.labelKey}`)}
            </Link>
          </Button>
        ))}
      </nav>
    </section>
  );
}
