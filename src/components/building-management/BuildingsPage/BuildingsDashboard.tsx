
'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Building,
  TrendingUp,
  BarChart3,
  MapPin,
  Calendar,
  Home
} from 'lucide-react';

interface BuildingsDashboardProps {
  stats: {
    totalBuildings: number;
    activeProjects: number;
    totalValue: number;
    totalArea: number;
    averageProgress: number;
    totalUnits: number;
  };
}

export function BuildingsDashboard({ stats }: BuildingsDashboardProps) {
  return (
    <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Σύνολο Κτιρίων</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.totalBuildings}</p>
              </div>
              <Building className="h-8 w-8 text-blue-500" />
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
              <MapPin className="h-8 w-8 text-orange-500" />
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

        <Card className="border-pink-200 bg-pink-50/50 dark:bg-pink-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-pink-600 dark:text-pink-400">Σύνολο Μονάδων</p>
                <p className="text-2xl font-bold text-pink-700 dark:text-pink-300">{stats.totalUnits}</p>
              </div>
              <Home className="h-8 w-8 text-pink-500" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
