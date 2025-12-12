
'use client';

import React from 'react';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';

export function TeamPerformance() {
    const team = [
        { name: 'Γιώργος', leads: 12, value: '€85K' },
        { name: 'Μαρία', leads: 9, value: '€120K' },
        { name: 'Κώστας', leads: 7, value: '€60K' }
    ];
    return (
        <div className="bg-white dark:bg-card rounded-lg shadow p-6">
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
                            <td className="p-2 text-gray-600">{member.leads}</td>
                            <td className="p-2 text-green-600">{member.value}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
