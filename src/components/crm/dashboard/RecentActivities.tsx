
'use client';

import React from 'react';
import { Mail, PhoneCall, MessageSquare } from 'lucide-react';

export function RecentActivities() {
    const activities = [
        { icon: Mail, text: "Email από Γ. Παπαδόπουλο", time: "2 λεπτά πριν" },
        { icon: PhoneCall, text: "Κλήση σε TechCorp", time: "15 λεπτά πριν" },
        { icon: MessageSquare, text: "Σημείωση για Μ. Ιωάννου", time: "1 ώρα πριν" },
    ];
    return (
        <section className="bg-white dark:bg-card rounded-lg shadow p-6" aria-labelledby="recent-activities-title">
            <h2 id="recent-activities-title" className="text-lg font-semibold mb-4">Πρόσφατη Δραστηριότητα</h2>
            <ul className="space-y-4" role="list">
                {activities.map((activity, idx) => (
                    <li key={idx} className="flex items-center gap-3">
                        <div className="bg-gray-100 p-2 rounded-lg">
                            <activity.icon className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium">{activity.text}</p>
                            <p className="text-xs text-gray-500">{activity.time}</p>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}
