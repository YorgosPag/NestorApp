'use client';

import React from 'react';
import { Users } from 'lucide-react';
import { SectionHeader } from '@/core/headers';

interface ContactsListHeaderProps {
    contactCount: number;
}

export function ContactsListHeader({
    contactCount
}: ContactsListHeaderProps) {
    return (
        <SectionHeader
            icon={Users}
            title="Επαφές"
            count={contactCount}
        />
    );
}
