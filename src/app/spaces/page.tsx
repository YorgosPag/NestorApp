'use client';

import React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  Home,
  Package,
  Car,
  Users,
  Layout,
  TrendingUp,
  BarChart3,
  MapPin,
} from 'lucide-react';

// Placeholder stats for Physical Spaces
const spacesStats: DashboardStat[] = [
  {
    title: 'Συνολικοί Χώροι',
    value: '1,247',
    description: 'Όλοι οι φυσικοί χώροι',
    icon: Layout,
    color: 'blue',
    trend: { value: 0, label: 'Σταθερό' }
  },
  {
    title: 'Διαμερίσματα',
    value: '486',
    description: 'Κατοικήσιμοι χώροι',
    icon: Home,
    color: 'green',
    trend: { value: 0, label: 'Σταθερό' }
  },
  {
    title: 'Αποθήκες',
    value: '324',
    description: 'Χώροι αποθήκευσης',
    icon: Package,
    color: 'orange',
    trend: { value: 0, label: 'Σταθερό' }
  },
  {
    title: 'Θέσεις Στάθμευσης',
    value: '437',
    description: 'Χώροι parking',
    icon: Car,
    color: 'purple',
    trend: { value: 0, label: 'Σταθερό' }
  }
];

export default function SpacesPage() {
  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background">
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center px-4">
              <div className="flex items-center gap-2">
                <Layout className="h-5 w-5 text-muted-foreground" />
                <h1 className="text-lg font-semibold">Χώροι</h1>
              </div>
              <div className="ml-auto text-sm text-muted-foreground">
                Φυσικοί χώροι - Τι υπάρχει και πού βρίσκεται
              </div>
            </div>
          </div>

          {/* Dashboard Stats */}
          <div className="p-6 space-y-6">
            <UnifiedDashboard
              title="Επισκόπηση Φυσικών Χώρων"
              stats={spacesStats}
              variant="modern"
            />

            {/* Navigation Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Διαμερίσματα Card */}
              <div className="p-6 bg-card border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Home className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold">Διαμερίσματα</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Κατοικήσιμοι χώροι σε όλα τα κτίρια
                </p>
                <div className="text-2xl font-bold">486</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Διαμερίσματα, μεζονέτες, γκαρσονιέρες
                </p>
              </div>

              {/* Αποθήκες Card */}
              <div className="p-6 bg-card border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <Package className="h-5 w-5 text-orange-500" />
                  </div>
                  <h3 className="font-semibold">Αποθήκες</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Χώροι αποθήκευσης και αποθηκών
                </p>
                <div className="text-2xl font-bold">324</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Πωλήσιμες και κοινόχρηστες
                </p>
              </div>

              {/* Parking Card */}
              <div className="p-6 bg-card border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Car className="h-5 w-5 text-blue-500" />
                  </div>
                  <h3 className="font-semibold">Θέσεις Στάθμευσης</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Θέσεις parking εσωτερικές και εξωτερικές
                </p>
                <div className="text-2xl font-bold">437</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Υπόγεια, σκεπαστά, υπαίθρια
                </p>
              </div>

              {/* Κοινόχρηστοι Card */}
              <div className="p-6 bg-card border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <Users className="h-5 w-5 text-green-500" />
                  </div>
                  <h3 className="font-semibold">Κοινόχρηστοι Χώροι</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Κοινές εστίες, διάδρομοι, υπηρεσίες
                </p>
                <div className="text-2xl font-bold">42</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Κοινόχρηστοι και υπηρεσιών
                </p>
              </div>
            </div>

            {/* Info Message */}
            <div className="p-4 bg-muted/50 border border-dashed rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Layout className="h-4 w-4" />
                <span className="font-medium">Φυσικοί Χώροι</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Εδώ βλέπετε όλους τους φυσικούς χώρους που υπάρχουν στα κτίρια.
                Δεν περιλαμβάνονται στοιχεία πώλησης - μόνο η φυσική κατανομή και τοποθεσία.
              </p>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}