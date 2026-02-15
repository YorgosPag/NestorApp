'use client';

import React from 'react';
import { Briefcase, Eye } from 'lucide-react';
import { EntityDetailsHeader } from '@/core/entity-headers';
import { GRADIENT_HOVER_EFFECTS } from '@/components/ui/effects';
import type { Project } from '@/types/project';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ProjectDetailsHeader');

interface ProjectDetailsHeaderProps {
    project: Project;
}

export function ProjectDetailsHeader({ project }: ProjectDetailsHeaderProps) {
    // 🏢 ENTERPRISE: i18n hook
    const { t } = useTranslation('projects');

    // 🏢 ENTERPRISE: Actions — edit moved to inline (GeneralProjectTab)
    const actions = [
        {
            label: t('detailsHeader.showProject'),
            onClick: () => logger.info('Show project details'),
            icon: Eye,
            className: `bg-gradient-to-r from-blue-500 to-purple-600 ${GRADIENT_HOVER_EFFECTS.BLUE_PURPLE_DEEPER}`
        }
    ];

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
