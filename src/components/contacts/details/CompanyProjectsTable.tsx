'use client';

import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProjectBadge } from '@/core/badges';
import { ThemeProgressBar } from '@/core/progress/ThemeProgressBar';
import { Briefcase } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { Project } from '@/types/project';
import { cn } from '@/lib/utils';
import { getProjectLabel } from '@/lib/project-utils';
import { useCompanyRelationships } from '@/services/relationships/hooks/useEnterpriseRelationships';


function CompanyProjectsTable({ companyId }: { companyId: string }) {
    const iconSizes = useIconSizes();
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
                    setProjects(companyProjects);
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

    if (projects.length === 0) {
        return (
            <div className="text-center text-sm text-muted-foreground py-4">
                Δεν βρέθηκαν έργα για αυτή την εταιρεία.
            </div>
        )
    }

    return (
        <div className="mt-4">
            <h4 className="font-semibold mb-2 text-sm flex items-center gap-2">
                <Briefcase className={`${iconSizes.sm} text-muted-foreground`}/>
                Σχετικά Έργα
            </h4>
            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Έργο</TableHead>
                            <TableHead>Κατάσταση</TableHead>
                            <TableHead className="text-right">Πρόοδος</TableHead>
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
