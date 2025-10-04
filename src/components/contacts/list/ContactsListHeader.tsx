'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { Users } from 'lucide-react';

interface ContactsListHeaderProps {
    contactCount: number;
}

export function ContactsListHeader({
    contactCount
}: ContactsListHeaderProps) {
    return (
        <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
            <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-sm">
                    <Users className="w-4 h-4 text-white" />
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-foreground">Επαφές</h3>
                    <p className="text-xs text-muted-foreground">
                        {contactCount} επαφές συνολικά
                    </p>
                </div>
            </div>
        </div>
    );
}
