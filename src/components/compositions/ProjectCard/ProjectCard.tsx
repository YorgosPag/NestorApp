'use client';

import React, { useState } from 'react';
import { BaseCard } from '@/components/core/BaseCard/BaseCard';
import { badgeVariants } from '@/components/ui/variants';
import { getStatusColor, getStatusBadgeClass } from '@/lib/design-system';
import { formatDate as formatIntlDate } from '@/lib/intl-utils';
import { MapPin, Calendar, Users, Target, Briefcase } from 'lucide-react';
import type { Project } from '@/types/project';

interface ProjectCardProps {
  project: Project & { company?: string };
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  companyName?: string;
}

const getProjectStatusLabel = (status: string) => {
  const statusLabels: Record<string, string> = {
    'active': 'Ενεργό',
    'planning': 'Σχεδιασμός',
    'construction': 'Κατασκευή',
    'completed': 'Ολοκληρωμένο',
    'on-hold': 'Σε Αναμονή',
    'cancelled': 'Ακυρωμένο'
  };
  return statusLabels[status] || status;
};

const getProjectPriority = (priority?: string) => {
  const priorityLabels: Record<string, string> = {
    'high': 'Υψηλή',
    'medium': 'Μέση',
    'low': 'Χαμηλή'
  };
  return priority ? priorityLabels[priority] || priority : undefined;
};

export function ProjectCard({ 
  project, 
  isSelected, 
  onClick,
  companyName
}: ProjectCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return 'Μη καθορισμένη';
    return formatIntlDate(new Date(date));
  };

  const calculateProgress = () => {
    if (project.progress !== undefined) return project.progress;
    // Calculate based on status if no explicit progress
    switch (project.status) {
      case 'planning': return 25;
      case 'construction': return 60;
      case 'completed': return 100;
      default: return 0;
    }
  };

  const priority = getProjectPriority(project.priority);

  return (
    <BaseCard
      // Βασικές ιδιότητες
      title={project.name}
      subtitle={project.description}
      
      // Header configuration
      headerConfig={{
        backgroundGradient: "from-purple-100 via-blue-50 to-indigo-100 dark:from-purple-950 dark:via-blue-950 dark:to-indigo-900",
        logo: <Briefcase className="w-8 h-8 text-purple-600 dark:text-purple-400" />,
        showProgress: true,
        progressValue: calculateProgress(),
        progressColor: getStatusColor(project.status || 'active', 'bg')
      }}
      
      // Selection state
      isSelected={isSelected}
      onSelectionChange={() => onClick({} as React.MouseEvent)}
      
      // Favorites
      isFavorite={isFavorite}
      onFavoriteChange={setIsFavorite}
      
      // Status badges
      statusBadges={[
        {
          label: getProjectStatusLabel(project.status || 'active'),
          className: getStatusBadgeClass(project.status || 'active')
        },
        companyName && {
          label: companyName,
          className: badgeVariants({ variant: 'outline', size: 'sm' })
        },
        priority && {
          label: `Προτεραιότητα: ${priority}`,
          className: badgeVariants({ 
            variant: project.priority === 'high' ? 'error-outline' : 
                     project.priority === 'medium' ? 'warning-outline' : 'info-outline',
            size: 'sm' 
          })
        }
      ].filter(Boolean)}
      
      // Content sections
      contentSections={[
        // Company/Client section
        (project.company || project.client) && {
          title: 'Πελάτης',
          content: (
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{project.company || project.client}</span>
            </div>
          )
        },
        
        // Location section
        project.location && {
          title: 'Τοποθεσία',
          content: (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{project.location}</span>
            </div>
          )
        },
        
        // Timeline section
        {
          title: 'Χρονοδιάγραμμα',
          content: (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Έναρξη:</span>
                <span>{formatDate(project.startDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Λήξη:</span>
                <span>{formatDate(project.endDate)}</span>
              </div>
            </div>
          )
        },
        
        // Progress section
        {
          title: 'Πρόοδος',
          content: (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Ολοκλήρωση</span>
                <span className="font-medium">{calculateProgress()}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${calculateProgress()}%`,
                    backgroundColor: `hsl(var(--status-${project.status === 'completed' ? 'success' : project.status === 'construction' ? 'warning' : 'info'}))`
                  }}
                />
              </div>
            </div>
          )
        },
        
        // Budget section (if available)
        project.budget && {
          title: 'Προϋπολογισμός',
          content: (
            <div className="text-lg font-semibold text-green-600 dark:text-green-400">
              €{typeof project.budget === 'number' ? project.budget.toLocaleString() : project.budget}
            </div>
          )
        },
        
        // Team size (if available)
        project.teamSize && {
          title: 'Μέγεθος Ομάδας',
          content: (
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{project.teamSize} μέλη</span>
            </div>
          )
        }
      ].filter(Boolean)}
      
      // Actions
      actions={[
        {
          label: 'Προβολή',
          onClick: () => onClick({} as React.MouseEvent),
          variant: 'default'
        },
        {
          label: 'Επεξεργασία',
          onClick: () => console.log('Edit project', project.id),
          variant: 'outline'
        }
      ]}
      
      // Click handlers
      onClick={(e) => onClick(e)}
      className="transition-all duration-300 hover:shadow-xl group"
    />
  );
}