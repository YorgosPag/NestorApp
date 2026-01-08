'use client';

import React from 'react';
import { Home } from 'lucide-react';
import { GenericListHeader } from '@/components/shared/GenericListHeader';

interface UnitsListHeaderProps {
    unitCount: number;
    showToolbar?: boolean;
    onToolbarToggle?: (show: boolean) => void;
}

export function UnitsListHeader({
    unitCount,
    showToolbar = false,
    onToolbarToggle
}: UnitsListHeaderProps) {

    return (
        <div>
            {/* 🏢 ENTERPRISE CENTRALIZED GenericListHeader - ΜΙΑ ΠΗΓΗ ΑΛΗΘΕΙΑΣ */}
            {/* 🏢 local_4.log: hideSearch=true - Search is handled in CompactToolbar/list area */}
            <GenericListHeader
                icon={Home}
                entityName="Μονάδες"
                itemCount={unitCount}
                hideSearch={true}
                showToolbar={showToolbar}
                onToolbarToggle={onToolbarToggle}
            />

        </div>
    );
}
