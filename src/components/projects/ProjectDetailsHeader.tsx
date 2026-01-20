'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ProjectBadge } from '@/core/badges';
import { Briefcase, Eye } from 'lucide-react';
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
}

export function ProjectDetailsHeader({ project }: ProjectDetailsHeaderProps) {
    // 🏢 ENTERPRISE: i18n hook
    const { t } = useTranslation('projects');

    return (
        <>
            {/* 🖥️ DESKTOP: Show full header with actions */}
            <div className="hidden md:block">
                <EntityDetailsHeader
                    icon={Briefcase}
                    title={project.name}
                    actions={[
                        {
                            label: t('detailsHeader.showProject'),
                            onClick: () => console.log('Show project details'),
                            icon: Eye,
                            className: `bg-gradient-to-r from-blue-500 to-purple-600 ${GRADIENT_HOVER_EFFECTS.BLUE_PURPLE_DEEPER}`
                        }
                    ]}
                    variant="detailed"
                />
            </div>

            {/* 📱 MOBILE: Hidden (no header duplication) */}
        </>
    );
}
