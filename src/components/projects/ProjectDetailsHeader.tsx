'use client';

import React, { useMemo } from 'react';
import { FolderPlus } from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { EntityDetailsHeader, createEntityAction } from '@/core/entity-headers';
import type { Project } from '@/types/project';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ProjectDetailsHeaderProps {
    project: Project;
    isEditing?: boolean;
    onStartEdit?: () => void;
    onSaveEdit?: () => void;
    onCancelEdit?: () => void;
    onNewProject?: () => void;
    onDeleteProject?: () => void;
    hideEditControls?: boolean;
}

export const ProjectDetailsHeader = React.memo(function ProjectDetailsHeader({
    project,
    isEditing,
    onStartEdit,
    onSaveEdit,
    onCancelEdit,
    onNewProject,
    onDeleteProject,
    hideEditControls = false
}: ProjectDetailsHeaderProps) {
    const { t } = useTranslation('projects');

    const actions = useMemo(() => [
        // New Project button
        ...(onNewProject ? [
            createEntityAction('new', t('detailsHeader.actions.new'), () => onNewProject(), { icon: FolderPlus })
        ] : []),
        // Edit Mode Actions
        ...(!hideEditControls ? (
            !isEditing ? [
                createEntityAction('edit', t('detailsHeader.actions.edit'), () => onStartEdit?.())
            ] : [
                createEntityAction('save', t('detailsHeader.actions.save'), () => onSaveEdit?.()),
                createEntityAction('cancel', t('detailsHeader.actions.cancel'), () => onCancelEdit?.())
            ]
        ) : []),
        // Delete Action
        ...(!hideEditControls && onDeleteProject ? [
            createEntityAction('delete', t('detailsHeader.actions.delete'), () => onDeleteProject())
        ] : [])
    ], [isEditing, onStartEdit, onSaveEdit, onCancelEdit, onNewProject, onDeleteProject, hideEditControls, t]);

    return (
        <>
            {/* Desktop: Full header with CRUD actions */}
            <div className="hidden md:block">
                <EntityDetailsHeader
                    icon={NAVIGATION_ENTITIES.project.icon}
                    title={project.name}
                    actions={actions}
                    variant="detailed"
                />
            </div>

            {/* Mobile: Hidden (no header duplication) */}
        </>
    );
});
