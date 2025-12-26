
'use client';

import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import type { ProjectListItemProps } from './types';
import { EntityDetailsHeader } from '@/core/entity-headers';
import { ProjectBadge } from '@/core/badges';
import { Briefcase } from 'lucide-react';
import { PROJECT_STATUS_LABELS } from '@/types/project';
import { HOVER_SHADOWS, TRANSITION_PRESETS, HOVER_BORDER_EFFECTS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';

// Removed duplicate imports - now using EntityDetailsHeader
import { LocationRow } from './parts/LocationRow';
import { ProgressBlock } from './parts/ProgressBlock';
import { StatsGrid } from './parts/StatsGrid';
import { CompletionRow } from './parts/CompletionRow';
import { RowActions } from './parts/RowActions';
import { SelectedStripe } from './parts/SelectedStripe';
import { FavoriteButton } from './parts/FavoriteButton';

export function ProjectListItem({
    project,
    isSelected,
    isFavorite,
    onSelect,
    onToggleFavorite,
    companyName,
}: ProjectListItemProps) {
    const { quick } = useBorderTokens();

    return (
        <TooltipProvider>
            <Card
                className={cn(
                    `relative p-4 rounded-lg border cursor-pointer ${TRANSITION_PRESETS.STANDARD_ALL} group ${HOVER_SHADOWS.ENHANCED}`,
                    isSelected
                    ? `${quick.selected} bg-blue-50 dark:bg-blue-950/20 shadow-sm`
                    : `border-border ${HOVER_BORDER_EFFECTS.BLUE} bg-card ${HOVER_BACKGROUND_EFFECTS.ACCENT}`
                )}
                onClick={onSelect}
                role="button"
                aria-pressed={isSelected}
            >
                <FavoriteButton isFavorite={isFavorite} onToggleFavorite={onToggleFavorite} />

                {/* EntityDetailsHeader with centralized ProjectBadge */}
                <EntityDetailsHeader
                    icon={Briefcase}
                    title={project.name}
                    subtitle={companyName}
                    variant="compact"
                    className="mb-3"
                >
                    <div className="flex gap-2 mt-2 mb-2">
                        <ProjectBadge status={project.status} size="sm" />
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-secondary text-secondary-foreground rounded-full">
                            {project.progress}% ολοκληρωμένο
                        </span>
                    </div>
                    <LocationRow address={project.address} city={project.city} />
                </EntityDetailsHeader>
                
                <ProgressBlock progress={project.progress} />
                <StatsGrid project={project} />
                <CompletionRow completionDate={project.completionDate} />
                <RowActions onToggleFavorite={onToggleFavorite} isFavorite={isFavorite} />
                <SelectedStripe isSelected={isSelected} />
            </Card>
        </TooltipProvider>
    );
}
