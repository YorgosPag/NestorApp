
'use client';

import React from 'react';
import { Mail, PhoneCall, MessageSquare } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';

export function RecentActivities() {
    const iconSizes = useIconSizes();
    const colors = useSemanticColors();
    const { quick } = useBorderTokens();
    const activities = [
        { icon: Mail, text: "Email από Γ. Παπαδόπουλο", time: "2 λεπτά πριν" },
        { icon: PhoneCall, text: "Κλήση σε TechCorp", time: "15 λεπτά πριν" },
        { icon: MessageSquare, text: "Σημείωση για Μ. Ιωάννου", time: "1 ώρα πριν" },
    ];
    return (
        <section className={`${colors.bg.primary} ${quick.card} p-6`} aria-labelledby="recent-activities-title">
            <h2 id="recent-activities-title" className="text-lg font-semibold mb-4">Πρόσφατη Δραστηριότητα</h2>
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
