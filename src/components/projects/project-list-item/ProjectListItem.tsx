
'use client';

import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import type { ProjectListItemProps } from './types';

import { Header } from './parts/Header';
import { MetaBadges } from './parts/MetaBadges';
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
    return (
        <TooltipProvider>
            <Card
                className={cn(
                    "relative p-4 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md group",
                    isSelected
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20 shadow-sm"
                    : "border-border hover:border-blue-300 bg-card hover:bg-accent/50"
                )}
                onClick={onSelect}
                role="button"
                aria-pressed={isSelected}
            >
                <FavoriteButton isFavorite={isFavorite} onToggleFavorite={onToggleFavorite} />

                <div className="mb-3">
                    <Header project={project} />
                    <MetaBadges status={project.status} companyName={companyName} />
                    <LocationRow address={project.address} city={project.city} />
                </div>
                
                <ProgressBlock progress={project.progress} />
                <StatsGrid project={project} />
                <CompletionRow completionDate={project.completionDate} />
                <RowActions onToggleFavorite={onToggleFavorite} isFavorite={isFavorite} />
                <SelectedStripe isSelected={isSelected} />
            </Card>
        </TooltipProvider>
    );
}
