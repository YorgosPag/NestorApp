
'use client';

import React from 'react';
import { Briefcase } from 'lucide-react';
import type { Project } from '../types';

interface HeaderProps {
    project: Project;
}

export function Header({ project }: HeaderProps) {
    return (
        <div className="flex items-start gap-2 mb-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
                <Briefcase className="w-4 h-4 text-muted-foreground" />
                <h4 className="font-medium text-sm text-foreground leading-tight line-clamp-2">
                    {project.name}
                </h4>
            </div>
        </div>
    );
}
