'use client';

import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProjectBadge } from '@/core/badges';
import { Progress } from '@/components/ui/progress';
import { Briefcase } from 'lucide-react';
import type { Project } from '@/types/project';
import { cn } from '@/lib/utils';
import { getProgressColor } from '@/lib/project-utils';
import { getProjectLabel } from '@/lib/project-utils';
import { getProjectsByCompanyId } from '@/services/projects.service';


function CompanyProjectsTable({ companyId }: { companyId: string }) {
    const [projects, setProjects] = useState<Project[]>([]);

    useEffect(() => {
        let isMounted = true;
        const fetchProjects = async () => {
            try {
                const companyProjects = await getProjectsByCompanyId(companyId);
                if (isMounted) {
                    setProjects(companyProjects);
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
                <Briefcase className="w-4 h-4 text-muted-foreground"/>
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
                                    <div className="flex items-center justify-end gap-2">
                                        <span className={cn("text-xs font-semibold", getProgressColor(project.progress))}>
                                            {project.progress}%
                                        </span>
                                        <Progress value={project.progress} className="w-20 h-1.5" />
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
