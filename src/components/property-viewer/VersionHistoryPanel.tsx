'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/providers/NotificationProvider';
import { X } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { ScrollArea } from '../ui/scroll-area';
import { Skeleton } from '../ui/skeleton';
import { VersionList, type VersionHistoryItem } from './version-history/VersionList';
import { VersionDetails } from './version-history/VersionDetails';
import { BUILDING_IDS } from '@/config/building-ids-config';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Version interface instead of any
interface FloorplanVersion {
    id: string;
    buildingId: string;
    timestamp: { toDate: () => Date };
    author: { name: string };
    message: string;
    type: 'milestone' | 'auto' | 'manual';
    size: number;
    stats: { polygons: number; objects: number };
    thumbnail: string;
    diff?: { added: string[]; removed: string[]; modified: string[]; changes: number };
}

// 🏢 ENTERPRISE: Mock version data - NO HARDCODED building IDs
// 🏢 ENTERPRISE: Convert FloorplanVersion to VersionHistoryItem
const toVersionHistoryItem = (v: FloorplanVersion): VersionHistoryItem => ({
    id: v.id,
    message: v.message,
    type: v.type,
    timestamp: v.timestamp.toDate(),
    author: v.author,
    stats: v.stats,
    size: v.size,
    thumbnail: v.thumbnail,
    diff: v.diff ? {
        added: v.diff.added,
        modified: v.diff.modified,
        removed: v.diff.removed
    } : undefined
});

const mockVersions: FloorplanVersion[] = [
    {
        id: 'v_1722956400000',
        buildingId: BUILDING_IDS.LEGACY_BUILDING_1,
        timestamp: { toDate: () => new Date(1722956400000) },
        author: { name: 'Γιώργος Παπαδόπουλος' },
        message: 'Αρχική διάταξη ορόφου',
        type: 'milestone',
        size: 15320,
        stats: { polygons: 5, objects: 12 },
        thumbnail: 'https://placehold.co/128x128.png'
    },
    {
        id: 'v_1722960000000',
        buildingId: BUILDING_IDS.LEGACY_BUILDING_1,
        timestamp: { toDate: () => new Date(1722960000000) },
        author: { name: 'Μαρία Ιωάννου' },
        message: 'Αυτόματη αποθήκευση',
        type: 'auto',
        size: 15450,
        stats: { polygons: 5, objects: 12 },
        thumbnail: 'https://placehold.co/128x128.png',
        diff: { added: [], removed: [], modified: ['prop-2'], changes: 1 }
    },
    {
        id: 'v_1722963600000',
        buildingId: BUILDING_IDS.LEGACY_BUILDING_1,
        timestamp: { toDate: () => new Date(1722963600000) },
        author: { name: 'Γιώργος Παπαδόπουλος' },
        message: 'Προσθήκη νέας αποθήκης',
        type: 'manual',
        size: 16100,
        stats: { polygons: 6, objects: 14 },
        thumbnail: 'https://placehold.co/128x128.png',
        diff: { added: ['prop-7'], removed: [], modified: [], changes: 1 }
    }
];

export function VersionHistoryPanel({ buildingId, isOpen, onClose }: { buildingId: string; isOpen: boolean; onClose: () => void; }) {
    const iconSizes = useIconSizes();
    const colors = useSemanticColors();
    const notifications = useNotifications();
    // 🏢 ENTERPRISE: i18n hook
    const { t } = useTranslation('properties');
    // 🏢 ENTERPRISE: Proper types - using VersionHistoryItem for display compatibility
    const [versions, setVersions] = useState<VersionHistoryItem[]>([]);
    const [selectedVersion, setSelectedVersion] = useState<VersionHistoryItem | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            // Simulate fetching data
            setTimeout(() => {
                // 🏢 ENTERPRISE: Convert FloorplanVersion to VersionHistoryItem for display
                const converted = mockVersions
                    .sort((a,b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime())
                    .map(toVersionHistoryItem);
                setVersions(converted);
                setLoading(false);
            }, 500);
        }
    }, [isOpen, buildingId]);

    const handleRestore = async (versionId: string) => {
        if (!confirm(t('versionHistory.restoreConfirm'))) return;
        notifications.info(`💬 ${t('versionHistory.restoring', { versionId })}`);
        // In a real app, you would call the versioning system here.
        setTimeout(() => {
             notifications.success(`✅ ${t('versionHistory.restored')}`);
             onClose();
        }, 1000);
    };

    const handleCreateMilestone = async () => {
        const name = prompt(t('versionHistory.milestoneName'));
        if (!name) return;
        notifications.info(`🚩 ${t('versionHistory.creatingMilestone', { name })}`);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className={`${colors.bg.primary} rounded-lg shadow-xl w-full max-w-5xl h-[80vh] flex flex-col`}>
                <div className="p-6 border-b flex items-center justify-between shrink-0">
                    <h2 className="text-2xl font-bold">{t('versionHistory.title')}</h2>
                    <div className="flex items-center gap-4">
                        <Button onClick={handleCreateMilestone}>{t('versionHistory.createMilestone')}</Button>
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <X className={iconSizes.md} />
                        </Button>
                    </div>
                </div>
                
                <div className="flex-1 flex overflow-hidden">
                    <ScrollArea className="w-2/3 border-r">
                        {loading ? (
                            <div className="p-4 space-y-2">
                                {Array.from({length: 5}).map((_, i) => <Skeleton key={i} className={`${iconSizes.xl6} w-full`} />)}
                            </div>
                        ) : (
                           <VersionList 
                                versions={versions}
                                selectedVersionId={selectedVersion?.id ?? null}
                                onSelect={setSelectedVersion}
                           />
                        )}
                    </ScrollArea>
                    
                    <ScrollArea className="w-1/3">
                         <VersionDetails version={selectedVersion} onRestore={handleRestore} />
                    </ScrollArea>
                </div>
            </div>
        </div>
    );
}
