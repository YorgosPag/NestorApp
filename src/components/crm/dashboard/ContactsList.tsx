'use client';

import React from 'react';
import { ContactBadge } from '@/core/badges';
import { Button } from '@/components/ui/button';
import { HOVER_BACKGROUND_EFFECTS, HOVER_TEXT_EFFECTS } from '@/components/ui/effects';
import type { ContactStatus } from '@/core/types/BadgeTypes';

// 🏢 ENTERPRISE: Typed contact interface for demo data
interface DemoContact {
    name: string;
    company: string;
    status: ContactStatus;
}

export function ContactsList() {
    const contacts: DemoContact[] = [
        { name: 'Γιώργος Παπαδόπουλος', company: 'Tech Solutions', status: 'active' },
        { name: 'Μαρία Ιωάννου', company: 'Creative Designs', status: 'active' },
        { name: 'Κώστας Βασιλείου', company: 'BuildCo', status: 'inactive' },
        { name: 'Ελένη Δημητρίου', company: 'Real Estate Experts', status: 'active' }
    ];
    return (
        <div className="p-6">
            <table className="w-full text-left">
                <thead>
                    <tr className="border-b">
                        <th className="p-3">Όνομα</th>
                        <th className="p-3">Εταιρεία</th>
                        <th className="p-3">Κατάσταση</th>
                        <th className="p-3">Ενέργειες</th>
                    </tr>
                </thead>
                <tbody>
                    {contacts.map(contact => (
                        <tr key={contact.name} className={`border-b ${HOVER_BACKGROUND_EFFECTS.LIGHT}`}>
                            <td className="p-3 font-medium">{contact.name}</td>
                            <td className="p-3 text-gray-600 dark:text-gray-400">{contact.company}</td>
                            <td className="p-3">
                                <ContactBadge
                                  status={contact.status}
                                  size="sm"
                                />
                            </td>
                            <td className="p-3">
                                <Button variant="ghost" size="sm" className={`text-blue-600 ${HOVER_TEXT_EFFECTS.BLUE}`}>Προβολή</Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
