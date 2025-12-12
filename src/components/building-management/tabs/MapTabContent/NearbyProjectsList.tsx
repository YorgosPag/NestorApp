'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2 } from 'lucide-react';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { cn } from '@/lib/utils';

const nearbyProjects = [
    {
      id: 1,
      name: "Εμπορικό Κέντρο Κολωνάκι",
      distance: "200m",
      status: "active",
      type: "commercial",
      progress: 65
    },
    {
      id: 2, 
      name: "Κατοικίες Μαρασλή",
      distance: "350m",
      status: "completed",
      type: "residential",
      progress: 100
    },
    {
      id: 3,
      name: "Γραφεία Σκουφά",
      distance: "120m", 
      status: "planning",
      type: "office",
      progress: 15
    }
];

export function NearbyProjectsList() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Γειτονικά Έργα
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {nearbyProjects.map((project) => (
                        <div key={project.id} className={`flex items-center justify-between p-4 border rounded-lg ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} transition-colors`}>
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "w-3 h-3 rounded-full",
                                    project.status === 'active' ? 'bg-blue-500' :
                                        project.status === 'completed' ? 'bg-green-500' :
                                            'bg-yellow-500'
                                )}></div>
                                <div>
                                    <p className="font-medium">{project.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {project.distance} απόσταση • {project.type === 'commercial' ? 'Εμπορικό' :
                                            project.type === 'residential' ? 'Κατοικίες' : 'Γραφεία'}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-medium">{project.progress}%</div>
                                <div className="text-xs text-muted-foreground">
                                    {project.status === 'active' ? 'Σε εξέλιξη' :
                                        project.status === 'completed' ? 'Ολοκληρωμένο' :
                                            'Σχεδιασμός'}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
