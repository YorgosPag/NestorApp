'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ProjectBadge } from '@/core/badges';
import { Briefcase, Eye, Edit } from 'lucide-react';
import { EntityDetailsHeader } from '@/core/entity-headers';
import { cn } from '@/lib/utils';
import { GRADIENT_HOVER_EFFECTS } from '@/components/ui/effects';
import type { Project, ProjectStatus } from '@/types/project';
import { PROJECT_STATUS_LABELS } from '@/types/project';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// Removed hardcoded getStatusColor function - using centralized ProjectBadge instead


interface ProjectDetailsHeaderProps {
    project: Project;
    /** 🏢 ENTERPRISE: Callback for edit button (ADR-087) */
    onEdit?: () => void;
}

export function ProjectDetailsHeader({ project, onEdit }: ProjectDetailsHeaderProps) {
    // 🏢 ENTERPRISE: i18n hook
    const { t } = useTranslation('projects');

    // 🏢 ENTERPRISE: Build actions array dynamically (ADR-087)
    const actions = [
        {
            label: t('detailsHeader.showProject'),
            onClick: () => console.log('Show project details'),
            icon: Eye,
            className: `bg-gradient-to-r from-blue-500 to-purple-600 ${GRADIENT_HOVER_EFFECTS.BLUE_PURPLE_DEEPER}`
        }
    ];

    // 🏢 ENTERPRISE: Add edit action if callback provided (ADR-087)
    if (onEdit) {
        actions.unshift({
            label: t('projectHeader.edit'),
            onClick: onEdit,
            icon: Edit,
            className: `bg-gradient-to-r from-amber-500 to-orange-600 ${GRADIENT_HOVER_EFFECTS.BLUE_PURPLE_DEEPER}`
        });
    }

    return (
        <>
            {/* 🖥️ DESKTOP: Show full header with actions */}
            <div className="hidden md:block">
                <EntityDetailsHeader
                    icon={Briefcase}
                    title={project.name}
                    actions={actions}
                    variant="detailed"
                />
            </div>

            {/* 📱 MOBILE: Hidden (no header duplication) */}
        </>
    );
}
