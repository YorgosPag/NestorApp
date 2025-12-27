'use client';

import React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  CheckCircle,
  DollarSign,
  Calendar,
  TrendingUp,
  Home,
  Package,
  Car,
  BarChart3,
  Users,
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// Placeholder stats for Sold Properties
const soldStats: DashboardStat[] = [
  {
    title: 'Συνολικές Πωλήσεις',
    value: '568',
    description: 'Ολοκληρωμένες πωλήσεις',
    icon: CheckCircle,
    color: 'green',
    trend: { value: 18, label: 'Αύξηση' }
  },
  {
    title: 'Συνολικά Έσοδα',
    value: '€18.4M',
    description: 'Συνολική αξία πωλήσεων',
    icon: DollarSign,
    color: 'blue',
    trend: { value: 22, label: 'Αύξηση' }
  },
  {
    title: 'Μέσος Χρόνος Πώλησης',
    value: '4.8 μήνες',
    description: 'Μέσος όρος στην αγορά',
    icon: Calendar,
    color: 'orange',
    trend: { value: -8, label: 'Βελτίωση' }
  },
  {
    title: 'Πωλήσεις 2024',
    value: '89',
    description: 'Φέτος μέχρι σήμερα',
    icon: TrendingUp,
    color: 'purple',
    trend: { value: 15, label: 'Αύξηση' }
  }
];

export default function SoldPropertiesPage() {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background">
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center px-4">
              <div className="flex items-center gap-2">
                <CheckCircle className={`${iconSizes.md} text-muted-foreground`} />
                <h1 className="text-lg font-semibold">Πωλημένα Ακίνητα</h1>
              </div>
              <div className="ml-auto text-sm text-muted-foreground">
                Ολοκληρωμένες πωλήσεις - Ιστορικό & στατιστικά
              </div>
            </div>
          </div>

          {/* Dashboard Stats */}
          <div className="p-6 space-y-6">
            <UnifiedDashboard
              title="Πωλημένα Ακίνητα - Επισκόπηση"
              stats={soldStats}
              variant="modern"
            />

            {/* Sales Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Διαμερίσματα */}
              <div className={`p-6 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 ${colors.bg.success}/10 rounded-lg`}>
                    <Home className={`${iconSizes.md} ${colors.text.success}`} />
                  </div>
                  <h3 className="font-semibold">Διαμερίσματα</h3>
                </div>
                <div className="text-3xl font-bold mb-2">344</div>
                <p className="text-sm text-muted-foreground mb-3">
                  Πωλημένα διαμερίσματα & μεζονέτες
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Συνολικά έσοδα</span>
                    <span className="font-semibold ${colors.text.success}">€12.8M</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Μέση τιμή</span>
                    <span className="font-medium">€372K</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Μέσος χρόνος</span>
                    <span className="font-medium">4.2 μήνες</span>
                  </div>
                </div>
              </div>

              {/* Αποθήκες */}
              <div className={`p-6 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 ${colors.bg.warning}/10 rounded-lg`}>
                    <Package className={`${iconSizes.md} ${colors.text.warning}`} />
                  </div>
                  <h3 className="font-semibold">Αποθήκες</h3>
                </div>
                <div className="text-3xl font-bold mb-2">235</div>
                <p className="text-sm text-muted-foreground mb-3">
                  Πωλημένες αποθήκες & κελάρια
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Συνολικά έσοδα</span>
                    <span className="font-semibold ${colors.text.success}">€3.2M</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Μέση τιμή</span>
                    <span className="font-medium">€36K</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Μέσος χρόνος</span>
                    <span className="font-medium">6.1 μήνες</span>
                  </div>
                </div>
              </div>

              {/* Parking */}
              <div className={`p-6 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 ${colors.bg.info}/10 rounded-lg`}>
                    <Car className={`${iconSizes.md} ${colors.text.info}`} />
                  </div>
                  <h3 className="font-semibold">Θέσεις Στάθμευσης</h3>
                </div>
                <div className="text-3xl font-bold mb-2">189</div>
                <p className="text-sm text-muted-foreground mb-3">
                  Πωλημένες θέσεις parking
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Συνολικά έσοδα</span>
                    <span className="font-semibold ${colors.text.success}">€2.4M</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Μέση τιμή</span>
                    <span className="font-medium">€21K</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Μέσος χρόνος</span>
                    <span className="font-medium">3.8 μήνες</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance & Trends */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Απόδοση ανά Έτος */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className={iconSizes.md} />
                  Απόδοση ανά Έτος
                </h2>

                <div className="space-y-3">
                  <div className={`p-4 bg-card ${quick.card}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">2024 (μέχρι σήμερα)</span>
                      <span className={`${colors.bg.success}/20 ${colors.text.success} px-2 py-1 rounded text-sm font-medium`}>
                        89 πωλήσεις
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Έσοδα</span>
                        <span className="${colors.text.success} font-medium">€3.2M</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Μέση τιμή</span>
                        <span>€395K</span>
                      </div>
                    </div>
                  </div>

                  <div className={`p-4 bg-card ${quick.card}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">2023</span>
                      <span className={`${colors.bg.info}/20 ${colors.text.info} px-2 py-1 rounded text-sm font-medium`}>
                        156 πωλήσεις
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Έσοδα</span>
                        <span className="${colors.text.success} font-medium">€5.8M</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Μέση τιμή</span>
                        <span>€372K</span>
                      </div>
                    </div>
                  </div>

                  <div className={`p-4 bg-card ${quick.card}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">2022</span>
                      <span className={`${colors.bg.warning}/20 ${colors.text.warning} px-2 py-1 rounded text-sm font-medium`}>
                        198 πωλήσεις
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Έσοδα</span>
                        <span className="${colors.text.success} font-medium">€6.8M</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Μέση τιμή</span>
                        <span>€344K</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Buyers & Market Insights */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Users className={iconSizes.md} />
                  Market Insights
                </h2>

                <div className={`p-6 bg-card ${quick.card}`}>
                  <h3 className="font-semibold mb-4">Top Κατηγορίες Αγοραστών</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Ιδιώτες επενδυτές</span>
                      <div className="text-right">
                        <div className="font-medium">234 πωλήσεις</div>
                        <div className="text-xs text-muted-foreground">41% του συνόλου</div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Εταιρείες ανάπτυξης</span>
                      <div className="text-right">
                        <div className="font-medium">189 πωλήσεις</div>
                        <div className="text-xs text-muted-foreground">33% του συνόλου</div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Οικογένειες (owner-occupied)</span>
                      <div className="text-right">
                        <div className="font-medium">145 πωλήσεις</div>
                        <div className="text-xs text-muted-foreground">26% του συνόλου</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`p-6 bg-card ${quick.card}`}>
                  <h3 className="font-semibold mb-4">Performance Metrics</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Success Rate (λιστάρισμα → πώληση)</span>
                      <span className="font-medium ${colors.text.success}">78%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Μέσο discount από αρχική τιμή</span>
                      <span className="font-medium ${colors.text.warning}">-3.2%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Ταχύτερη πώληση</span>
                      <span className="font-medium ${colors.text.info}">8 ημέρες</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Αργότερη πώληση</span>
                      <span className="font-medium ${colors.text.error}">18 μήνες</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Message */}
            <div className={`p-4 bg-muted/50 ${quick.card}`}>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className={iconSizes.sm} />
                <span className="font-medium">Πωλημένα Ακίνητα</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Εδώ βλέπετε όλες τις ολοκληρωμένες πωλήσεις ακινήτων.
                Περιλαμβάνονται στατιστικά πωλήσεων, έσοδα, buyer profiles και performance metrics.
              </p>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}