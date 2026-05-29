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
  { labelKey: 'newContact', icon: UserPlus, href: '/contacts?create=true', variant: 'blue' },
  { labelKey: 'newProject', icon: FolderPlus, href: '/projects', variant: 'purple' },
  { labelKey: 'newInvoice', icon: Receipt, href: '/accounting/invoices', variant: 'green' },
  { labelKey: 'search', icon: Search, href: '/contacts', variant: 'neutral' },
];

// ✅ ADR-365 follow-up: vivid colored quick-action chips (no dark navy icons)
const VARIANT_CLASSES: Record<QuickAction['variant'], string> = {
  blue: 'bg-[hsl(var(--bg-info))]/20 text-[hsl(var(--text-info))] hover:bg-[hsl(var(--bg-info))]/30',
  purple: 'bg-[hsl(var(--status-purple))]/12 text-[hsl(var(--status-purple))] hover:bg-[hsl(var(--status-purple))]/20',
  green: 'bg-[hsl(var(--bg-success))]/10 text-[hsl(var(--text-success))] hover:bg-[hsl(var(--bg-success))]/20',
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
