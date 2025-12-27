'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CommonBadge } from '@/core/badges';
import { ThemeProgressBar } from '@/core/progress/ThemeProgressBar';
import { TrendingUp } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

interface ProgressCardProps {
    progress: number;
}

export function ProgressCard({ progress }: ProgressCardProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

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
              className={`${colors.bg.info} ${colors.text.info}`}
            />
          </div>
          <ThemeProgressBar
            progress={progress}
            label="Ποσοστό Ολοκλήρωσης"
            size="md"
            showPercentage={false}
          />
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
            <div className={cn("p-2 rounded text-center", progress >= 25 ? `${colors.bg.success} ${colors.text.success}` : `${colors.bg.secondary} ${colors.text.muted}`)}>
              <div className="font-medium">Θεμέλια</div>
              <div>0-25%</div>
            </div>
            <div className={cn("p-2 rounded text-center", progress >= 50 ? `${colors.bg.success} ${colors.text.success}` : `${colors.bg.secondary} ${colors.text.muted}`)}>
              <div className="font-medium">Κατασκευή</div>
              <div>25-50%</div>
            </div>
            <div className={cn("p-2 rounded text-center", progress >= 75 ? `${colors.bg.success} ${colors.text.success}` : `${colors.bg.secondary} ${colors.text.muted}`)}>
              <div className="font-medium">Ολοκληρώσεις</div>
              <div>50-75%</div>
            </div>
            <div className={cn("p-2 rounded text-center", progress >= 100 ? `${colors.bg.success} ${colors.text.success}` : `${colors.bg.secondary} ${colors.text.muted}`)}>
              <div className="font-medium">Παράδοση</div>
              <div>75-100%</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
