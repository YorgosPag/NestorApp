'use client';

import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProjectBadge } from '@/core/badges';
import { ThemeProgressBar } from '@/core/progress/ThemeProgressBar';
import { Briefcase } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { Project } from '@/types/project';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { cn } from '@/lib/utils';
import { getProjectLabel } from '@/lib/project-utils';
import { useCompanyRelationships } from '@/services/relationships/hooks/useEnterpriseRelationships';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService, type ProjectUpdatedPayload } from '@/services/realtime';


function CompanyProjectsTable({ companyId }: { companyId: string }) {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('contacts');
    const iconSizes = useIconSizes();
    const { quick } = useBorderTokens();
    const [projects, setProjects] = useState<Project[]>([]);

    // 🚀 ENTERPRISE RELATIONSHIP ENGINE: Hook για centralized company-projects relationship
    const companyRelationships = useCompanyRelationships(companyId);

    useEffect(() => {
        let isMounted = true;
        const fetchProjects = async () => {
            try {
                // 🏗️ ENTERPRISE: Loading projects μέσω centralized Relationship Engine
                console.log(`🏗️ ENTERPRISE CompanyProjectsTable: Loading projects for company ${companyId}`);
                const companyProjects = await companyRelationships.getProjects();
                if (isMounted) {
                    setProjects([...companyProjects] as Project[]);
                    console.log(`✅ ENTERPRISE CompanyProjectsTable: Loaded ${companyProjects.length} projects for company ${companyId}`);
                }
            } catch (error) {
                console.error("Failed to fetch projects for company:", error);
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
            console.log('🔄 [CompanyProjectsTable] Applying update for project:', payload.projectId);

            setProjects(prev => prev.map(project =>
                project.id === payload.projectId
                    ? { ...project, ...payload.updates }
                    : project
            ));
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
                                            showPercentage={true}
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
