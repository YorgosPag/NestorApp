'use client';

import React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  Package,
  Warehouse,
  Archive,
  Building,
  TrendingUp,
  BarChart3,
  MapPin,
} from 'lucide-react';

// Placeholder stats for Storage Spaces
const storageStats: DashboardStat[] = [
  {
    title: 'Συνολικές Αποθήκες',
    value: '324',
    description: 'Όλοι οι χώροι αποθήκευσης',
    icon: Package,
    color: 'orange',
    trend: { value: 0, label: 'Σταθερό' }
  },
  {
    title: 'Μεγάλες Αποθήκες',
    value: '89',
    description: '>50 τ.μ.',
    icon: Warehouse,
    color: 'blue',
    trend: { value: 0, label: 'Σταθερό' }
  },
  {
    title: 'Μικρές Αποθήκες',
    value: '167',
    description: '<50 τ.μ.',
    icon: Archive,
    color: 'purple',
    trend: { value: 0, label: 'Σταθερό' }
  },
  {
    title: 'Συνολική Επιφάνεια',
    value: '8,450 τ.μ.',
    description: 'Χώρος αποθήκευσης',
    icon: TrendingUp,
    color: 'green',
    trend: { value: 0, label: 'Σταθερό' }
  }
];

export default function StoragePage() {
  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background">
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center px-4">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-muted-foreground" />
                <h1 className="text-lg font-semibold">Αποθήκες</h1>
              </div>
              <div className="ml-auto text-sm text-muted-foreground">
                Χώροι αποθήκευσης - Φυσικές αποθήκες και χώροι αποθηκών
              </div>
            </div>
          </div>

          {/* Dashboard Stats */}
          <div className="p-6 space-y-6">
            <UnifiedDashboard
              title="Επισκόπηση Χώρων Αποθήκευσης"
              stats={storageStats}
              variant="modern"
            />

            {/* Storage Types */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Μεγάλες Αποθήκες */}
              <div className="p-6 bg-card border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <Warehouse className="h-5 w-5 text-orange-500" />
                  </div>
                  <h3 className="font-semibold">Μεγάλες Αποθήκες</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Χώροι αποθήκευσης άνω των 50 τ.μ.
                </p>
                <div className="text-2xl font-bold">89</div>
                <div className="space-y-2 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Υπόγειες</span>
                    <span>42</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ισόγειες</span>
                    <span>31</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Υπέργειες</span>
                    <span>16</span>
                  </div>
                </div>
              </div>

              {/* Μικρές Αποθήκες */}
              <div className="p-6 bg-card border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Archive className="h-5 w-5 text-blue-500" />
                  </div>
                  <h3 className="font-semibold">Μικρές Αποθήκες</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Χώροι αποθήκευσης έως 50 τ.μ.
                </p>
                <div className="text-2xl font-bold">167</div>
                <div className="space-y-2 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Υπόγειες</span>
                    <span>89</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ισόγειες</span>
                    <span>51</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Υπέργειες</span>
                    <span>27</span>
                  </div>
                </div>
              </div>

              {/* Ειδικές Αποθήκες */}
              <div className="p-6 bg-card border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <Building className="h-5 w-5 text-green-500" />
                  </div>
                  <h3 className="font-semibold">Ειδικές Αποθήκες</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Κελάρια, τεχνικοί χώροι, κ.ά.
                </p>
                <div className="text-2xl font-bold">68</div>
                <div className="space-y-2 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Κελάρια</span>
                    <span>34</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Τεχνικά</span>
                    <span>19</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Λοιπά</span>
                    <span>15</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Message */}
            <div className="p-4 bg-muted/50 border border-dashed rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Package className="h-4 w-4" />
                <span className="font-medium">Χώροι Αποθήκευσης</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Εδώ βλέπετε όλους τους φυσικούς χώρους αποθήκευσης που υπάρχουν στα κτίρια.
                Δεν περιλαμβάνονται στοιχεία πώλησης - μόνο η φυσική κατανομή και χαρακτηριστικά.
              </p>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}