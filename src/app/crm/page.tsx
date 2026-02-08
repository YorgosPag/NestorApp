// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Users, Phone, Target, ClipboardList, Filter, Users2, Bell, AppWindow, Mail, BarChart3, CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { COMPLEX_HOVER_EFFECTS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from 'react-i18next';

// 🌐 i18n: CRM sections use i18n keys
const crmSectionKeys = [
    { titleKey: 'crm.sections.dashboard.title', href: '/crm/dashboard', icon: BarChart, descKey: 'crm.sections.dashboard.description' },
    { titleKey: 'crm.sections.customers.title', href: '/crm/customers', icon: Users, descKey: 'crm.sections.customers.description' },
    { titleKey: 'crm.sections.communications.title', href: '/crm/communications', icon: Phone, descKey: 'crm.sections.communications.description' },
    { titleKey: 'crm.sections.emailAnalytics.title', href: '/crm/email-analytics', icon: BarChart3, descKey: 'crm.sections.emailAnalytics.description' },
    { titleKey: 'crm.sections.leads.title', href: '/crm/leads', icon: Target, descKey: 'crm.sections.leads.description' },
    { titleKey: 'crm.sections.tasks.title', href: '/crm/tasks', icon: ClipboardList, descKey: 'crm.sections.tasks.description' },
    { titleKey: 'crm.sections.calendar.title', href: '/crm/calendar', icon: CalendarDays, descKey: 'crm.sections.calendar.description' },
    { titleKey: 'crm.sections.pipeline.title', href: '/crm/pipeline', icon: Filter, descKey: 'crm.sections.pipeline.description' },
    { titleKey: 'crm.sections.teams.title', href: '/crm/teams', icon: Users2, descKey: 'crm.sections.teams.description' },
    { titleKey: 'crm.sections.notifications.title', href: '/crm/notifications', icon: Bell, descKey: 'crm.sections.notifications.description' },
]

export default function CrmPage() {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('crm');

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
            <div className={`flex ${iconSizes.xl2} items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg`}>
                <AppWindow className={`${iconSizes.lg} text-white`} />
            </div>
            <div>
                <h1 className="text-3xl font-bold text-foreground">{t('page.title')}</h1>
                <p className="text-lg text-muted-foreground">
                    {t('page.subtitle')}
                </p>
            </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {crmSectionKeys.map((section) => (
          <Link href={section.href} key={section.titleKey} legacyBehavior>
            <a className="block h-full">
              <Card className={`h-full cursor-pointer group flex flex-col ${COMPLEX_HOVER_EFFECTS.FEATURE_CARD}`}>
                <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                    <div className={`p-3 rounded-full bg-muted ${TRANSITION_PRESETS.STANDARD_COLORS}`}>
                      <section.icon className={`${iconSizes.lg} text-primary`} />
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
