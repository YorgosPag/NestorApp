'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Car, 
  BarChart3,
  Package,
  Ruler
} from 'lucide-react';
import type { ParkingStats } from '@/types/parking';
import { formatCurrency } from '@/lib/intl-utils';

interface ParkingStatsSummaryProps {
    stats: ParkingStats;
}

export function ParkingStatsSummary({ stats }: ParkingStatsSummaryProps) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="flex items-center gap-2 p-3 bg-card border rounded-lg">
            <Car className="w-4 h-4 text-blue-600" />
            <div>
              <div className="text-sm font-medium">{stats.totalSpots}</div>
              <div className="text-xs text-muted-foreground">Σύνολο</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-3 bg-card border rounded-lg">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <div>
              <div className="text-sm font-medium">{stats.soldSpots}</div>
              <div className="text-xs text-muted-foreground">Πουλημένες</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-3 bg-card border rounded-lg">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <div>
              <div className="text-sm font-medium">{stats.ownerSpots}</div>
              <div className="text-xs text-muted-foreground">Οικοπεδούχου</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-3 bg-card border rounded-lg">
            <div className="w-3 h-3 rounded-full bg-gray-500" />
            <div>
              <div className="text-sm font-medium">{stats.availableSpots}</div>
              <div className="text-xs text-muted-foreground">Διαθέσιμες</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-3 bg-card border rounded-lg">
            <BarChart3 className="w-4 h-4 text-green-600" />
            <div>
              <div className="text-sm font-medium">{formatCurrency(stats.totalValue)}</div>
              <div className="text-xs text-muted-foreground">Συν. Αξία</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-3 bg-card border rounded-lg">
            <Ruler className="w-4 h-4 text-purple-600" />
            <div>
              <div className="text-sm font-medium">{stats.totalArea.toFixed(1)} m²</div>
              <div className="text-xs text-muted-foreground">Εμβαδόν</div>
            </div>
          </div>
        </div>
    );
}
