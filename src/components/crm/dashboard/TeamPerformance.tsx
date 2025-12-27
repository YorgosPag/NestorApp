
'use client';

import React from 'react';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';

export function TeamPerformance() {
    const colors = useSemanticColors();
    const { quick } = useBorderTokens();
    // 🏢 ENTERPRISE: Configurable team performance data
    const getTeamData = () => {
        try {
            const envTeamData = process.env.NEXT_PUBLIC_TEAM_PERFORMANCE_JSON;
            if (envTeamData) {
                return JSON.parse(envTeamData);
            }
        } catch (error) {
            console.warn('Failed to parse team performance data, using defaults');
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
            <h2 className="text-lg font-semibold mb-4">Απόδοση Ομάδας</h2>
            <table className="w-full text-left">
                <thead>
                    <tr className="border-b">
                        <th className="p-2">Μέλος</th>
                        <th className="p-2">Leads (Εβδομάδα)</th>
                        <th className="p-2">Κλεισμένες Πωλήσεις</th>
                    </tr>
                </thead>
                <tbody>
                    {team.map(member => (
                        <tr key={member.name} className={`border-b ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}>
                            <td className="p-2 font-medium">{member.name}</td>
                            <td className={`p-2 ${colors.text.muted}`}>{member.leads}</td>
                            <td className="p-2 text-green-600">{member.value}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
