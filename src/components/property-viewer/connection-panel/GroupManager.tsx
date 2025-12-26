'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { X } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import type { PropertyGroup } from '@/types/connections';

interface GroupManagerProps {
    groups: PropertyGroup[];
    onDelete: (groupId: string) => void;
}

export function GroupManager({ groups, onDelete }: GroupManagerProps) {
    const iconSizes = useIconSizes();
    const { radius } = useBorderTokens();
    if (groups.length === 0) return null;

    return (
        <div className="border-t pt-3 space-y-2">
            <h5 className="text-xs font-medium">Ομάδες</h5>
            <div className="space-y-1">
                {groups.map(group => (
                    <div key={group.id} className={`flex justify-between items-center text-xs p-2 bg-muted ${radius.md}`}>
                        <span>{group.name}</span>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className={`${iconSizes.lg} p-0 text-destructive`}
                                    onClick={() => onDelete(group.id)}
                                    aria-label={`Διαγραφή ομάδας ${group.name}`}
                                >
                                    <X className={iconSizes.xs} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Διαγραφή Ομάδας</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                ))}
            </div>
        </div>
    );
}