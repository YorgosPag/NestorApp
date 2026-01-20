
'use client';

import React from 'react';
import { Mail, PhoneCall, MessageSquare } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function RecentActivities() {
    const iconSizes = useIconSizes();
    const colors = useSemanticColors();
    const { quick } = useBorderTokens();
    // 🏢 ENTERPRISE: i18n support
    const { t } = useTranslation('crm');

    const activities = [
        { icon: Mail, text: t('dashboard.recentActivities.emailFrom', { name: 'Γ. Παπαδόπουλο' }), time: t('dashboard.recentActivities.time.minutesAgo', { count: 2 }) },
        { icon: PhoneCall, text: t('dashboard.recentActivities.callTo', { name: 'TechCorp' }), time: t('dashboard.recentActivities.time.minutesAgo', { count: 15 }) },
        { icon: MessageSquare, text: t('dashboard.recentActivities.noteFor', { name: 'Μ. Ιωάννου' }), time: t('dashboard.recentActivities.time.hoursAgo', { count: 1 }) },
    ];
    return (
        <section className={`${colors.bg.primary} ${quick.card} p-6`} aria-labelledby="recent-activities-title">
            <h2 id="recent-activities-title" className="text-lg font-semibold mb-4">{t('dashboard.recentActivities.title')}</h2>
            <ul className="space-y-4" role="list">
                {activities.map((activity, idx) => (
                    <li key={idx} className="flex items-center gap-3">
                        <div className={`${colors.bg.secondary} p-2 rounded-lg`}>
                            <activity.icon className={`${iconSizes.md} ${colors.text.muted}`} />
                        </div>
                        <div>
                            <p className="text-sm font-medium">{activity.text}</p>
                            <p className={`text-xs ${colors.text.muted}`}>{activity.time}</p>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}
