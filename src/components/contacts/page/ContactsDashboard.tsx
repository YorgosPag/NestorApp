'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Users,
  Building2,
  Landmark,
  Activity,
  UserPlus,
  BarChart3,
} from 'lucide-react';

interface ContactsDashboardProps {
  stats: {
    totalContacts: number;
    individuals: number;
    companies: number;
    services: number;
    active: number;
    newThisMonth: number;
  };
}

export function ContactsDashboard({ stats }: ContactsDashboardProps) {
  return (
    <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Σύνολο</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.totalContacts}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-green-600 dark:text-green-400">Φυσικά Πρόσωπα</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.individuals}</p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-purple-600 dark:text-purple-400">Νομικά Πρόσωπα</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{stats.companies}</p>
              </div>
              <Building2 className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-orange-600 dark:text-orange-400">Υπηρεσίες</p>
                <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{stats.services}</p>
              </div>
              <Landmark className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-200 bg-cyan-50/50 dark:bg-cyan-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-cyan-600 dark:text-cyan-400">Ενεργές</p>
                <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">{stats.active}</p>
              </div>
              <Activity className="h-8 w-8 text-cyan-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-pink-200 bg-pink-50/50 dark:bg-pink-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-pink-600 dark:text-pink-400">Νέες (Μήνας)</p>
                <p className="text-2xl font-bold text-pink-700 dark:text-pink-300">{stats.newThisMonth}</p>
              </div>
              <UserPlus className="h-8 w-8 text-pink-500" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
