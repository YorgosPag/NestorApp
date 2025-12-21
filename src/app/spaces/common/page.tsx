'use client';

import React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  Users,
  Wifi,
  Coffee,
  Dumbbell,
  Trees,
  Shield,
  Building,
  TrendingUp,
} from 'lucide-react';

// Placeholder stats for Common Spaces
const commonStats: DashboardStat[] = [
  {
    title: 'Κοινόχρηστοι Χώροι',
    value: '42',
    description: 'Όλοι οι κοινόχρηστοι χώροι',
    icon: Users,
    color: 'blue',
    trend: { value: 0, label: 'Σταθερό' }
  },
  {
    title: 'Χώροι Αναψυχής',
    value: '18',
    description: 'Κοινές εστίες, λάντζες',
    icon: Coffee,
    color: 'green',
    trend: { value: 0, label: 'Σταθερό' }
  },
  {
    title: 'Χώροι Υπηρεσιών',
    value: '16',
    description: 'Τεχνικοί, διαχείρισης',
    icon: Shield,
    color: 'purple',
    trend: { value: 0, label: 'Σταθερό' }
  },
  {
    title: 'Εξωτερικοί Χώροι',
    value: '8',
    description: 'Κήποι, αυλές, ταράτσες',
    icon: Trees,
    color: 'orange',
    trend: { value: 0, label: 'Σταθερό' }
  }
];

export default function CommonSpacesPage() {
  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background">
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center px-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <h1 className="text-lg font-semibold">Κοινόχρηστοι Χώροι</h1>
              </div>
              <div className="ml-auto text-sm text-muted-foreground">
                Κοινές εστίες - Φυσικοί χώροι κοινής χρήσης
              </div>
            </div>
          </div>

          {/* Dashboard Stats */}
          <div className="p-6 space-y-6">
            <UnifiedDashboard
              title="Επισκόπηση Κοινόχρηστων Χώρων"
              stats={commonStats}
              variant="modern"
            />

            {/* Common Areas Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Εστίες & Λάντζες */}
              <div className="p-6 bg-card border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <Coffee className="h-5 w-5 text-green-500" />
                  </div>
                  <h3 className="font-semibold">Εστίες & Λάντζες</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Χώροι συνάντησης και αναψυχής
                </p>
                <div className="text-2xl font-bold">12</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Κοινές εστίες, λάντζες, καθιστικά
                </p>
              </div>

              {/* Γυμναστήρια & Spa */}
              <div className="p-6 bg-card border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Dumbbell className="h-5 w-5 text-blue-500" />
                  </div>
                  <h3 className="font-semibold">Γυμναστήρια & Spa</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Χώροι άθλησης και ευεξίας
                </p>
                <div className="text-2xl font-bold">6</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Γυμναστήρια, σάουνες, spa
                </p>
              </div>

              {/* Τεχνικοί Χώροι */}
              <div className="p-6 bg-card border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <Shield className="h-5 w-5 text-orange-500" />
                  </div>
                  <h3 className="font-semibold">Τεχνικοί Χώροι</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Χώροι μηχανολογικών εγκαταστάσεων
                </p>
                <div className="text-2xl font-bold">16</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Λεβητοστάσια, μηχανολογικά
                </p>
              </div>

              {/* Εξωτερικοί Χώροι */}
              <div className="p-6 bg-card border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Trees className="h-5 w-5 text-purple-500" />
                  </div>
                  <h3 className="font-semibold">Εξωτερικοί Χώροι</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Κήποι, αυλές, ταράτσες
                </p>
                <div className="text-2xl font-bold">8</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Κοινόχρηστοι εξωτερικοί χώροι
                </p>
              </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Εσωτερικοί Κοινόχρηστοι */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Εσωτερικοί Κοινόχρηστοι
                </h2>

                <div className="p-6 bg-card border rounded-lg">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Coffee className="h-4 w-4" />
                        Κοινές εστίες
                      </span>
                      <span className="font-medium">8 χώροι</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Wifi className="h-4 w-4" />
                        Business centers
                      </span>
                      <span className="font-medium">4 χώροι</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Dumbbell className="h-4 w-4" />
                        Γυμναστήρια
                      </span>
                      <span className="font-medium">6 χώροι</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        Κοινές αίθουσες
                      </span>
                      <span className="font-medium">16 χώροι</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Εξωτερικοί & Τεχνικοί */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Εξωτερικοί & Τεχνικοί
                </h2>

                <div className="p-6 bg-card border rounded-lg">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Trees className="h-4 w-4" />
                        Κοινόχρηστοι κήποι
                      </span>
                      <span className="font-medium">5 χώροι</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Coffee className="h-4 w-4" />
                        Ταράτσες - αυλές
                      </span>
                      <span className="font-medium">3 χώροι</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Λεβητοστάσια
                      </span>
                      <span className="font-medium">8 χώροι</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Wifi className="h-4 w-4" />
                        Μηχανολογικά
                      </span>
                      <span className="font-medium">8 χώροι</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Message */}
            <div className="p-4 bg-muted/50 border border-dashed rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4" />
                <span className="font-medium">Κοινόχρηστοι Χώροι</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Εδώ βλέπετε όλους τους κοινόχρηστους χώρους που υπάρχουν στα κτίρια.
                Περιλαμβάνονται εστίες, τεχνικοί χώροι, κήποι και λοιπές κοινές περιοχές.
              </p>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}