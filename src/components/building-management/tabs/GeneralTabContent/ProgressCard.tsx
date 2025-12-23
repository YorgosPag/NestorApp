'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CommonBadge } from '@/core/badges';
import { ThemeProgressBar } from '@/core/progress/ThemeProgressBar';
import { TrendingUp } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

interface ProgressCardProps {
    progress: number;
}

export function ProgressCard({ progress }: ProgressCardProps) {
  const iconSizes = useIconSizes();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className={iconSizes.md} />
          Πρόοδος Έργου
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Ποσοστό Ολοκλήρωσης</Label>
            <CommonBadge
              status="building"
              customLabel={`${progress}% Ολοκληρωμένο`}
              className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
            />
          </div>
          <ThemeProgressBar
            progress={progress}
            label="Ποσοστό Ολοκλήρωσης"
            size="md"
            showPercentage={false}
          />
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
            <div className={cn("p-2 rounded text-center", progress >= 25 ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600")}>
              <div className="font-medium">Θεμέλια</div>
              <div>0-25%</div>
            </div>
            <div className={cn("p-2 rounded text-center", progress >= 50 ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600")}>
              <div className="font-medium">Κατασκευή</div>
              <div>25-50%</div>
            </div>
            <div className={cn("p-2 rounded text-center", progress >= 75 ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600")}>
              <div className="font-medium">Ολοκληρώσεις</div>
              <div>50-75%</div>
            </div>
            <div className={cn("p-2 rounded text-center", progress >= 100 ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600")}>
              <div className="font-medium">Παράδοση</div>
              <div>75-100%</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
