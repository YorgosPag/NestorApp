// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Users, Phone, Target, ClipboardList, Filter, Users2, Bell, AppWindow, BarChart3, CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { COMPLEX_HOVER_EFFECTS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn, getSpacingClass } from '@/lib/design-system';

// 🌐 i18n: CRM sections use i18n keys
const crmSectionKeys = [
    { titleKey: 'sections.dashboard.title', href: '/crm/dashboard', icon: BarChart, descKey: 'sections.dashboard.description' },
    { titleKey: 'sections.customers.title', href: '/crm/customers', icon: Users, descKey: 'sections.customers.description' },
    { titleKey: 'sections.communications.title', href: '/crm/communications', icon: Phone, descKey: 'sections.communications.description' },
    { titleKey: 'sections.emailAnalytics.title', href: '/crm/email-analytics', icon: BarChart3, descKey: 'sections.emailAnalytics.description' },
    { titleKey: 'sections.leads.title', href: '/crm/leads', icon: Target, descKey: 'sections.leads.description' },
    { titleKey: 'sections.tasks.title', href: '/crm/tasks', icon: ClipboardList, descKey: 'sections.tasks.description' },
    { titleKey: 'sections.calendar.title', href: '/crm/calendar', icon: CalendarDays, descKey: 'sections.calendar.description' },
    { titleKey: 'sections.pipeline.title', href: '/crm/pipeline', icon: Filter, descKey: 'sections.pipeline.description' },
    { titleKey: 'sections.teams.title', href: '/crm/teams', icon: Users2, descKey: 'sections.teams.description' },
    { titleKey: 'sections.notifications.title', href: '/crm/notifications', icon: Bell, descKey: 'sections.notifications.description' },
]

export default function CrmPage() {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('crm');
  const pagePadding = getSpacingClass('p', 'lg');
  const sectionMargin = getSpacingClass('m', 'lg', 'b');

  return (
    <div className={pagePadding}>
      <div className={sectionMargin}>
        <div className={cn('flex items-center gap-3 mb-2')}>
            <div className={cn('flex items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg', iconSizes.xl2)}>
                <AppWindow className={cn(iconSizes.lg, 'text-white')} />
            </div>
            <div>
                <h1 className="text-3xl font-bold text-foreground">{t('page.title')}</h1>
                <p className="text-lg text-muted-foreground">
                    {t('page.subtitle')}
                </p>
            </div>
        </div>
      </div>
      <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6')}>
        {crmSectionKeys.map((section) => (
          <Link href={section.href} key={section.titleKey} legacyBehavior>
            <a className="block h-full">
              <Card className={cn('h-full cursor-pointer group flex flex-col', COMPLEX_HOVER_EFFECTS.FEATURE_CARD)}>
                <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                    <div className={cn('p-3 rounded-full bg-muted', TRANSITION_PRESETS.STANDARD_COLORS)}>
                      <section.icon className={cn(iconSizes.lg, 'text-primary')} />
                    </div>
                    <CardTitle className="text-lg">{t(section.titleKey)}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  <CardDescription>{t(section.descKey)}</CardDescription>
                </CardContent>
              </Card>
            </a>
          </Link>
        ))}
      </div>
    </div>
  );
}
