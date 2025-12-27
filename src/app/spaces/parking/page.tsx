'use client';

import React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  Car,
  Truck,
  MapPin,
  TrendingUp,
  BarChart3,
  Building2,
  Square,
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// Placeholder stats for Parking Spaces
const parkingStats: DashboardStat[] = [
  {
    title: 'Συνολικές Θέσεις',
    value: '437',
    description: 'Όλες οι θέσεις στάθμευσης',
    icon: Car,
    color: 'blue',
    trend: { value: 0, label: 'Σταθερό' }
  },
  {
    title: 'Υπόγεια Parking',
    value: '298',
    description: 'Κλειστά υπόγεια',
    icon: Building2,
    color: 'purple',
    trend: { value: 0, label: 'Σταθερό' }
  },
  {
    title: 'Υπαίθρια Parking',
    value: '139',
    description: 'Εξωτερικές θέσεις',
    icon: Square,
    color: 'orange',
    trend: { value: 0, label: 'Σταθερό' }
  },
  {
    title: 'Μέσος Όρος/Κτίριο',
    value: '18.2',
    description: 'Θέσεις ανά κτίριο',
    icon: TrendingUp,
    color: 'green',
    trend: { value: 0, label: 'Σταθερό' }
  }
];

export default function ParkingPage() {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  return (
    <TooltipProvider>
      <div className={`flex h-screen ${colors.bg.primary}`}>
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className={`border-b ${colors.bg.primary}/95 backdrop-blur supports-[backdrop-filter]:${colors.bg.primary}/60`}>
            <div className="flex h-14 items-center px-4">
              <div className="flex items-center gap-2">
                <Car className={`${iconSizes.md} text-muted-foreground`} />
                <h1 className="text-lg font-semibold">Θέσεις Στάθμευσης</h1>
              </div>
              <div className="ml-auto text-sm text-muted-foreground">
                Χώροι στάθμευσης - Φυσικές θέσεις και περιοχές parking
              </div>
            </div>
          </div>

          {/* Dashboard Stats */}
          <div className="p-6 space-y-6">
            <UnifiedDashboard
              title="Επισκόπηση Θέσεων Στάθμευσης"
              stats={parkingStats}
              variant="modern"
            />

            {/* Parking Types */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Υπόγεια Section */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Building2 className={iconSizes.md} />
                  Υπόγεια Parking
                </h2>

                <div className="space-y-3">
                  {/* Κλειστά Υπόγεια */}
                  <div className={`p-4 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 ${colors.bg.info}/10 rounded-lg`}>
                        <Building2 className={`${iconSizes.sm} text-blue-500`} />
                      </div>
                      <h3 className="font-medium">Κλειστά Υπόγεια</h3>
                      <span className={`ml-auto ${colors.bg.info}/20 ${colors.text.info} px-2 py-1 rounded text-sm font-medium`}>
                        234
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Εσωτερικές θέσεις με οροφή και τοίχους
                    </p>
                  </div>

                  {/* Ημι-υπαίθρια Υπόγεια */}
                  <div className={`p-4 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 ${colors.bg.success}/10 rounded-lg`}>
                        <Square className={`${iconSizes.sm} text-green-500`} />
                      </div>
                      <h3 className="font-medium">Ημι-υπαίθρια</h3>
                      <span className={`ml-auto ${colors.bg.success}/20 ${colors.text.success} px-2 py-1 rounded text-sm font-medium`}>
                        64
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Υπόγεια με μερική στέγαση ή στο ημίυπαίθριο
                    </p>
                  </div>
                </div>
              </div>

              {/* Εξωτερικά Section */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Square className={iconSizes.md} />
                  Εξωτερικά Parking
                </h2>

                <div className="space-y-3">
                  {/* Υπαίθρια */}
                  <div className={`p-4 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 ${colors.bg.warning}/10 rounded-lg`}>
                        <Square className={`${iconSizes.sm} text-orange-500`} />
                      </div>
                      <h3 className="font-medium">Υπαίθρια</h3>
                      <span className={`ml-auto ${colors.bg.warning}/20 ${colors.text.warning} px-2 py-1 rounded text-sm font-medium`}>
                        89
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Εξωτερικές θέσεις χωρίς στέγαση
                    </p>
                  </div>

                  {/* Σκεπαστά */}
                  <div className={`p-4 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 ${colors.bg.warning}/10 rounded-lg`}>
                        <Building2 className={`${iconSizes.sm} text-purple-500`} />
                      </div>
                      <h3 className="font-medium">Σκεπαστά</h3>
                      <span className={`ml-auto ${colors.bg.warning}/20 ${colors.text.warning} px-2 py-1 rounded text-sm font-medium`}>
                        50
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Εξωτερικές θέσεις με στέγαση ή υπόστεγο
                    </p>
                  </div>
                </div>

                {/* Ειδικά Parking */}
                <div className={`p-6 bg-card ${quick.card}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 ${colors.bg.error}/10 rounded-lg`}>
                      <Truck className={`${iconSizes.md} text-red-500`} />
                    </div>
                    <h3 className="font-semibold">Ειδικές Θέσεις</h3>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Μηχανές</span>
                      <span className="font-medium">23 θέσεις</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Φορτηγά/Βαν</span>
                      <span className="font-medium">8 θέσεις</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">ΑΜΕΑ</span>
                      <span className="font-medium">12 θέσεις</span>
                    </div>
                    <div className="border-t pt-3 mt-3">
                      <div className="flex justify-between items-center font-semibold">
                        <span>Σύνολο ειδικών</span>
                        <span>43 θέσεις</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Message */}
            <div className={`p-4 bg-muted/50 ${quick.card}`}>
              <div className="flex items-center gap-2 text-sm">
                <Car className={iconSizes.sm} />
                <span className="font-medium">Θέσεις Στάθμευσης</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Εδώ βλέπετε όλες τις φυσικές θέσεις στάθμευσης που υπάρχουν στα κτίρια.
                Δεν περιλαμβάνονται στοιχεία πώλησης - μόνο η φυσική κατανομή και χαρακτηριστικά.
              </p>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}