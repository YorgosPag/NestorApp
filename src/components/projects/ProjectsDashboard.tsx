'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Briefcase,
  TrendingUp,
  BarChart3,
  Ruler,
  Calendar,
} from 'lucide-react';

interface ProjectsDashboardProps {
  stats: {
    totalProjects: number;
    activeProjects: number;
    totalValue: number;
    totalArea: number;
    averageProgress: number;
  };
}

export function ProjectsDashboard({ stats }: ProjectsDashboardProps) {
  return (
    <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Σύνολο Έργων</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.totalProjects}</p>
              </div>
              <Briefcase className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-green-600 dark:text-green-400">Ενεργά Έργα</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.activeProjects}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-purple-600 dark:text-purple-400">Συνολική Αξία</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  €{(stats.totalValue / 1000000).toFixed(1)}M
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-orange-600 dark:text-orange-400">Συνολική Επιφάνεια</p>
                <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                  {(stats.totalArea / 1000).toFixed(1)}K m²
                </p>
              </div>
              <Ruler className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-200 bg-cyan-50/50 dark:bg-cyan-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-cyan-600 dark:text-cyan-400">Μέση Πρόοδος</p>
                <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">{stats.averageProgress}%</p>
              </div>
              <Calendar className="h-8 w-8 text-cyan-500" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
