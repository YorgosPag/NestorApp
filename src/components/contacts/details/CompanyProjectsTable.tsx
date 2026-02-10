'use client';

import React, { useState, useEffect } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProjectBadge } from '@/core/badges';
import { ThemeProgressBar } from '@/core/progress/ThemeProgressBar';
import { Briefcase } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { Project, ProjectStatus } from '@/types/project';
import { PROJECT_STATUS_LABELS } from '@/types/project';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useCompanyRelationships } from '@/services/relationships/hooks/useEnterpriseRelationships';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService, type ProjectUpdatedPayload } from '@/services/realtime';


const logger = createModuleLogger('CompanyProjectsTable');

function CompanyProjectsTable({ companyId }: { companyId: string }) {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('contacts');
    const iconSizes = useIconSizes();
    const { quick } = useBorderTokens();
    const [projects, setProjects] = useState<Project[]>([]);
    const projectStatusValues = Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[];
    const isProjectStatus = (value?: string): value is ProjectStatus => !!value && projectStatusValues.includes(value as ProjectStatus);

    // 🚀 ENTERPRISE RELATIONSHIP ENGINE: Hook για centralized company-projects relationship
    const companyRelationships = useCompanyRelationships(companyId);

    useEffect(() => {
        let isMounted = true;
        const fetchProjects = async () => {
            try {
                // 🏗️ ENTERPRISE: Loading projects μέσω centralized Relationship Engine
                logger.info('Loading projects for company', { companyId });
                const companyProjects = await companyRelationships.getProjects();
                if (isMounted) {
                    setProjects([...companyProjects] as Project[]);
                    logger.info('Loaded projects for company', { count: companyProjects.length, companyId });
                }
            } catch (error) {
                logger.error('Failed to fetch projects for company', { error });
            }
        };

        fetchProjects();

        return () => {
            isMounted = false;
        };
    }, [companyId]);

    // 🏢 ENTERPRISE: Centralized Real-time Service (ZERO DUPLICATES)
    // Uses RealtimeService.subscribeToProjectUpdates() for cross-page sync
    useEffect(() => {
        const handleProjectUpdate = (payload: ProjectUpdatedPayload) => {
            logger.info('Applying update for project', { projectId: payload.projectId });

            setProjects(prev => prev.map(project => {
                if (project.id !== payload.projectId) {
                    return project;
                }
                const nextStatus = isProjectStatus(payload.updates.status)
                    ? payload.updates.status
                    : project.status;
                return {
                    ...project,
                    ...payload.updates,
                    status: nextStatus
                };
            }));
        };

        // Subscribe to project updates (same-page + cross-page)
        const unsubscribe = RealtimeService.subscribeToProjectUpdates(handleProjectUpdate, {
            checkPendingOnMount: false
        });

        return unsubscribe;
    }, []);

    if (projects.length === 0) {
        return (
            <div className="text-center text-sm text-muted-foreground py-4">
                {t('projects.empty')}
            </div>
        )
    }

    return (
        <div className="mt-4">
            <h4 className="font-semibold mb-2 text-sm flex items-center gap-2">
                <Briefcase className={`${iconSizes.sm} text-muted-foreground`}/>
                {t('projects.title')}
            </h4>
            <div className={quick.card}>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('projects.table.project')}</TableHead>
                            <TableHead>{t('projects.table.status')}</TableHead>
                            <TableHead className="text-right">{t('projects.table.progress')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {projects.map(project => (
                            <TableRow key={project.id}>
                                <TableCell className="font-medium">{project.name}</TableCell>
                                <TableCell>
                                    <ProjectBadge
                                      status={project.status}
                                      variant="outline"
                                      size="sm"
                                      className="text-xs"
                                    />
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="w-20">
                                        <ThemeProgressBar
                                            progress={project.progress}
                                            label=""
                                            size="sm"
                                            showPercentage
                                        />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
export { CompanyProjectsTable };
