'use client';

import React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  Package,
  Car,
  Users,
  Layout,
  TrendingUp,
  BarChart3,
  MapPin,
} from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

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
    icon: NAVIGATION_ENTITIES.unit.icon,
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
                <Layout className={`${iconSizes.md} ${colors.text.muted}`} />
                <h1 className="text-lg font-semibold">Χώροι</h1>
              </div>
              <div className={`ml-auto text-sm ${colors.text.muted}`}>
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
              <div className={`p-6 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    {React.createElement(NAVIGATION_ENTITIES.unit.icon, { className: `${iconSizes.md} ${NAVIGATION_ENTITIES.unit.color}` })}
                  </div>
                  <h3 className="font-semibold">Διαμερίσματα</h3>
                </div>
                <p className={`text-sm ${colors.text.muted} mb-2`}>
                  Κατοικήσιμοι χώροι σε όλα τα κτίρια
                </p>
                <div className="text-2xl font-bold">486</div>
                <p className={`text-xs ${colors.text.muted} mt-1`}>
                  Διαμερίσματα, μεζονέτες, γκαρσονιέρες
                </p>
              </div>

              {/* Αποθήκες Card */}
              <div className={`p-6 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 ${colors.bg.warning}/10 rounded-lg`}>
                    <Package className={`${iconSizes.md} ${colors.text.warning}`} />
                  </div>
                  <h3 className="font-semibold">Αποθήκες</h3>
                </div>
                <p className={`text-sm ${colors.text.muted} mb-2`}>
                  Χώροι αποθήκευσης και αποθηκών
                </p>
                <div className="text-2xl font-bold">324</div>
                <p className={`text-xs ${colors.text.muted} mt-1`}>
                  Πωλήσιμες και κοινόχρηστες
                </p>
              </div>

              {/* Parking Card */}
              <div className={`p-6 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 ${colors.bg.info}/10 rounded-lg`}>
                    <Car className={`${iconSizes.md} ${colors.text.info}`} />
                  </div>
                  <h3 className="font-semibold">Θέσεις Στάθμευσης</h3>
                </div>
                <p className={`text-sm ${colors.text.muted} mb-2`}>
                  Θέσεις parking εσωτερικές και εξωτερικές
                </p>
                <div className="text-2xl font-bold">437</div>
                <p className={`text-xs ${colors.text.muted} mt-1`}>
                  Υπόγεια, σκεπαστά, υπαίθρια
                </p>
              </div>

              {/* Κοινόχρηστοι Card */}
              <div className={`p-6 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 ${colors.bg.success}/10 rounded-lg`}>
                    <Users className={`${iconSizes.md} ${colors.text.success}`} />
                  </div>
                  <h3 className="font-semibold">Κοινόχρηστοι Χώροι</h3>
                </div>
                <p className={`text-sm ${colors.text.muted} mb-2`}>
                  Κοινές εστίες, διάδρομοι, υπηρεσίες
                </p>
                <div className="text-2xl font-bold">42</div>
                <p className={`text-xs ${colors.text.muted} mt-1`}>
                  Κοινόχρηστοι και υπηρεσιών
                </p>
              </div>
            </div>

            {/* Info Message */}
            <div className={`p-4 bg-muted/50 ${quick.card}`}>
              <div className="flex items-center gap-2 text-sm">
                <Layout className={iconSizes.sm} />
                <span className="font-medium">Φυσικοί Χώροι</span>
              </div>
              <p className={`text-sm ${colors.text.muted} mt-1`}>
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