
'use client';

import React from 'react';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { safeJsonParse } from '@/lib/json-utils';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';

const logger = createModuleLogger('TeamPerformance');

interface TeamMember {
    name: string;
    leads: number;
    value: string;
}

export function TeamPerformance() {
    const colors = useSemanticColors();
    const { quick } = useBorderTokens();
    // 🏢 ENTERPRISE: i18n support
    const { t } = useTranslation(['crm', 'crm-inbox']);
    // 🏢 ENTERPRISE: Configurable team performance data
    const getTeamData = () => {
        const envTeamData = process.env.NEXT_PUBLIC_TEAM_PERFORMANCE_JSON;
        if (envTeamData) {
            const parsed = safeJsonParse<TeamMember[]>(envTeamData, null as unknown as TeamMember[]);
            if (parsed !== null) return parsed;
            logger.warn('Failed to parse team performance data, using defaults');
        }

        // Default team data with configurable currency
        const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '€';
        return [
            { name: process.env.NEXT_PUBLIC_SAMPLE_EMPLOYEE_1 || 'Γιώργος', leads: 12, value: `${currency}85K` },
            { name: process.env.NEXT_PUBLIC_SAMPLE_EMPLOYEE_2 || 'Μαρία', leads: 9, value: `${currency}120K` },
            { name: process.env.NEXT_PUBLIC_SAMPLE_EMPLOYEE_3 || 'Κώστας', leads: 7, value: `${currency}60K` }
        ];
    };

    const team = getTeamData();
    return (
        <div className={`${colors.bg.primary} ${quick.card} p-6`}>
            <h2 className="text-lg font-semibold mb-4">{t('dashboard.teamPerformance.title')}</h2>
            <table className="w-full text-left">
                <thead>
                    <tr className="border-b">
                        <th className="p-2">{t('dashboard.teamPerformance.columns.member')}</th>
                        <th className="p-2">{t('dashboard.teamPerformance.columns.leadsWeek')}</th>
                        <th className="p-2">{t('dashboard.teamPerformance.columns.closedSales')}</th>
                    </tr>
                </thead>
                <tbody>
                    {team.map((member: TeamMember) => (
                        <tr key={member.name} className={`border-b ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}>
                            <td className="p-2 font-medium">{member.name}</td>
                            <td className={`p-2 ${colors.text.muted}`}>{member.leads}</td>
                            {/* eslint-disable-next-line design-system/enforce-semantic-colors */}
                            <td className="p-2 text-green-600">{member.value}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
