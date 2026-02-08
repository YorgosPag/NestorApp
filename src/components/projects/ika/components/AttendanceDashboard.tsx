'use client';

/**
 * =============================================================================
 * AttendanceDashboard — Summary cards for attendance status
 * =============================================================================
 *
 * Displays 4 real-time summary cards: Present, Absent, Off-Site, Hours Today.
 * Enterprise pattern: Procore-style dashboard with RAG status indicators.
 *
 * @module components/projects/ika/components/AttendanceDashboard
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System (Phase 2)
 */

import React from 'react';
import { UserCheck, UserX, MapPinOff, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';
import type { ProjectDailySummary } from '../contracts';

interface AttendanceDashboardProps {
  /** Project-level daily summary */
  summary: ProjectDailySummary;
}

/**
 * Formats minutes as HH:MM string
 */
function formatHoursMinutes(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}

export function AttendanceDashboard({ summary }: AttendanceDashboardProps) {
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const typography = useTypography();
  const spacing = useSpacingTokens();

  const cards = [
    {
      key: 'present',
      label: t('ika.timesheetTab.dashboard.present'),
      value: summary.presentCount,
      subtitle: `${t('ika.timesheetTab.dashboard.of')} ${summary.totalWorkers}`,
      icon: UserCheck,
      colorText: colors.text.success,
      colorBg: colors.bg.success,
    },
    {
      key: 'absent',
      label: t('ika.timesheetTab.dashboard.absent'),
      value: summary.absentCount,
      subtitle: `${t('ika.timesheetTab.dashboard.of')} ${summary.totalWorkers}`,
      icon: UserX,
      colorText: colors.text.error,
      colorBg: colors.bg.error,
    },
    {
      key: 'offSite',
      label: t('ika.timesheetTab.dashboard.offSite'),
      value: summary.offSiteCount + summary.onBreakCount,
      subtitle: `${t('ika.timesheetTab.dashboard.of')} ${summary.totalWorkers}`,
      icon: MapPinOff,
      colorText: colors.text.warning,
      colorBg: colors.bg.warning,
    },
    {
      key: 'hours',
      label: t('ika.timesheetTab.dashboard.hoursToday'),
      value: formatHoursMinutes(summary.totalHoursToday),
      subtitle: null,
      icon: Clock,
      colorText: colors.text.info,
      colorBg: colors.bg.info,
    },
  ];

  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4', spacing.gap.md)}>
      {cards.map((card) => (
        <Card key={card.key}>
          <CardContent className={cn('flex items-center', spacing.padding.md)}>
            <div className={cn('rounded-lg', spacing.padding.sm, card.colorBg)}>
              <card.icon className={cn(iconSizes.lg, card.colorText)} />
            </div>
            <div className={spacing.margin.left.md}>
              <p className={cn(typography.card.statValue, card.colorText)}>
                {card.value}
              </p>
              <p className={typography.card.statLabel}>
                {card.label}
              </p>
              {card.subtitle && (
                <p className="text-xs text-muted-foreground">{card.subtitle}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
