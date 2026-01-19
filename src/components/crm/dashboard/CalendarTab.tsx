
'use client';

import React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-utils';

export function CalendarTab() {
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('crm');
  const [date, setDate] = React.useState<Date | undefined>(new Date());

  return (
    <div className={`${colors.bg.primary} rounded-lg shadow p-6`}>
      <h2 className="text-lg font-semibold mb-4">{t('calendar.title')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="rounded-md border"
          />
        </div>
        <div>
          <h3 className="font-medium mb-2">{t('calendar.appointmentsFor')} {date ? formatDate(date.toISOString()) : t('calendar.today')}</h3>
          {/* 🏢 ENTERPRISE: Mock appointments with i18n */}
          <div className="space-y-3">
            <div className={`${colors.bg.infoSubtle} p-3 rounded-lg`}>
              <p className="font-medium text-sm">{t('calendar.mock.tourWithClient')}</p>
              <p className={`text-xs ${colors.text.info}`}>{t('calendar.mock.tourLocation')}</p>
            </div>
             <div className={`${colors.bg.accentSubtle} p-3 rounded-lg`}>
              <p className="font-medium text-sm">{t('calendar.mock.callWithCompany')}</p>
              <p className={`text-xs ${colors.text.accent}`}>{t('calendar.mock.onlineMeeting')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
