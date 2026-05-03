'use client';

import React, { useMemo } from 'react';
import { FolderPlus } from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { EntityDetailsHeader, createEntityAction } from '@/core/entity-headers';
import type { Project } from '@/types/project';
import { isProjectStatus, type ProjectStatus } from '@/constants/project-statuses';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ProjectStatusPill } from './ProjectStatusPill';
import '@/lib/design-system';

interface ProjectDetailsHeaderProps {
    project: Project;
    isEditing?: boolean;
    onStartEdit?: () => void;
    onSaveEdit?: () => void;
    onCancelEdit?: () => void;
    onNewProject?: () => void;
    onDeleteProject?: () => void;
    hideEditControls?: boolean;
    /** Hides only the Edit button (not Save/Cancel/Showcase/Delete). Used per-tab. */
    hideEditButton?: boolean;
    /**
     * "Fill then Create" mode — the project has no Firestore id yet. The pill
     * must skip the API call and delegate persistence to `onStatusChange`.
     */
    isCreateMode?: boolean;
    onStatusChange?: (next: ProjectStatus) => void;
    onShowcaseProject?: () => void;
}

export const ProjectDetailsHeader = React.memo(function ProjectDetailsHeader({
    project,
    isEditing,
    onStartEdit,
    onSaveEdit,
    onCancelEdit,
    onNewProject,
    onDeleteProject,
    hideEditControls = false,
    hideEditButton = false,
    isCreateMode = false,
    onStatusChange,
    onShowcaseProject,
}: ProjectDetailsHeaderProps) {
    const { t } = useTranslation(['projects', 'projects-data', 'projects-ika', 'trash']);

    const statusPill = useMemo(() => {
        if (!project.id) return undefined;
        // 🏢 ADR-300 §Addendum v2: defensive rendering. Never hide the pill
        // behind schema validation — legacy projects may carry non-canonical
        // or missing status values (e.g. 'active', 'Planning', undefined).
        // Silently hiding the control strands the user with no way to fix
        // the row. Instead, fall back to the placeholder CTA so the pill
        // acts as a repair path: click → pick valid status → persisted.
        const pillStatus: ProjectStatus | '' = isProjectStatus(project.status)
            ? project.status
            : '';
        return (
            <ProjectStatusPill
                projectId={project.id}
                status={pillStatus}
                draft={isCreateMode}
                onChange={onStatusChange}
            />
        );
    }, [project.id, project.status, isCreateMode, onStatusChange]);

    const actions = useMemo(() => [
        // New Project button
        ...(onNewProject ? [
            createEntityAction('new', t('detailsHeader.actions.new'), () => onNewProject(), { icon: FolderPlus })
        ] : []),
        // Edit Mode Actions
        ...(!hideEditControls ? (
            !isEditing ? [
                ...(!hideEditButton ? [createEntityAction('edit', t('detailsHeader.actions.edit'), () => onStartEdit?.())] : [])
            ] : [
                createEntityAction('save', t('detailsHeader.actions.save'), () => onSaveEdit?.()),
                createEntityAction('cancel', t('detailsHeader.actions.cancel'), () => onCancelEdit?.())
            ]
        ) : []),
        // Showcase Action (ADR-316)
        ...(!hideEditControls && onShowcaseProject ? [
            createEntityAction('showcase', t('detailsHeader.actions.showcase'), () => onShowcaseProject())
        ] : []),
        // Soft-delete Action (ADR-308 — moves to trash, not permanent delete)
        ...(!hideEditControls && onDeleteProject ? [
            createEntityAction('trash', t('moveToTrash', { ns: 'trash' }), () => onDeleteProject())
        ] : [])
    ], [isEditing, onStartEdit, onSaveEdit, onCancelEdit, onNewProject, onDeleteProject, hideEditControls, hideEditButton, onShowcaseProject, t]);

    return (
        <>
            {/* Desktop: Full header with CRUD actions */}
            <div className="hidden md:block">
                <EntityDetailsHeader
                    icon={NAVIGATION_ENTITIES.project.icon}
                    title={project.name}
                    titleAdornment={statusPill}
                    actions={actions}
                    variant="detailed"
                />
            </div>

            {/* Mobile: Hidden (no header duplication) */}
        </>
    );
});
