'use client';

import React from 'react';
import { Briefcase } from 'lucide-react';
import { EntityDetailsHeader, createEntityAction } from '@/core/entity-headers';
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

    // 🏢 ENTERPRISE: Actions via centralized presets
    const actions = [
        createEntityAction('view', t('detailsHeader.showProject'), () => logger.info('Show project details'))
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
