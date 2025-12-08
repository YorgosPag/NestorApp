'use client';

import React from 'react';
import { Users, Search, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ContactsListHeaderProps {
    contactCount: number;
    searchTerm: string;
    onSearchChange: (term: string) => void;
    showToolbar?: boolean;
    onToolbarToggle?: (show: boolean) => void;
}

export function ContactsListHeader({
    contactCount,
    searchTerm,
    onSearchChange,
    showToolbar = false,
    onToolbarToggle
}: ContactsListHeaderProps) {
    return (
        <div className="p-3 border-b bg-card flex items-center gap-2">
            {/* Left: Icon + Title */}
            <div className="flex items-center gap-2 flex-shrink-0">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-sm whitespace-nowrap">
                    Επαφές ({contactCount})
                </span>
            </div>

            {/* Center: Search Field */}
            <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                    placeholder="Αναζήτηση επαφών..."
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="pl-7 h-8 text-sm"
                />
            </div>

            {/* Right: Toolbar Toggle Button - Mobile Only */}
            {onToolbarToggle && (
                <Button
                    onClick={() => onToolbarToggle(!showToolbar)}
                    size="sm"
                    variant={showToolbar ? "default" : "outline"}
                    className="h-8 px-2 flex-shrink-0 md:hidden"
                    title="Εργαλειοθήκη"
                >
                    <Settings className="h-3 w-3" />
                </Button>
            )}
        </div>
    );
}
