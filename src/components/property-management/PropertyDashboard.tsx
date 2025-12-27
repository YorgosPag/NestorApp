'use client';

import React from 'react';
import { Home, TrendingUp, CheckCircle, Euro, Ruler, BarChart3, Activity, Building, Package, MapPin } from 'lucide-react';
import type { PropertyStats } from '@/types/property';
import { StatsCard } from './dashboard/StatsCard';
import { StatusCard } from './dashboard/StatusCard';
import { DetailsCard } from './dashboard/DetailsCard';
import { UNIFIED_STATUS_FILTER_LABELS } from '@/constants/property-statuses-enterprise';

const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `€${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `€${(amount / 1000).toFixed(0)}K`;
    }
    return `€${amount.toLocaleString('el-GR')}`;
};

const getStatusLabel = (status: string) => {
    switch (status) {
      case 'sold': return 'Πουλημένες';
      case 'available': return 'Διαθέσιμες';
      case 'reserved': return 'Κρατημένες';
      case 'owner': return 'Οικοπεδούχου';
      default: return status;
    }
};

const getTypeLabel = (type: string) => {
    switch (type) {
      case 'apartment': return 'Διαμερίσματα';
      case 'studio': return 'Στούντιο';
      case 'maisonette': return 'Μεζονέτες';
      case 'shop': return 'Καταστήματα';
      case 'office': return 'Γραφεία';
      case 'storage': return 'Αποθήκες';
      default: return type;
    }
};

const statsCardsData = (stats: PropertyStats) => [
    { title: "Συνολικές Μονάδες", value: stats.totalProperties, icon: Home, color: "blue" },
    { title: UNIFIED_STATUS_FILTER_LABELS.AVAILABLE, value: stats.availableProperties, icon: TrendingUp, color: "gray" },
    { title: "Συνολική Αξία", value: formatCurrency(stats.totalValue), icon: Euro, color: "green" },
    { title: "Συνολικό Εμβαδόν", value: `${Math.round(stats.totalArea)} m²`, icon: Ruler, color: "purple" },
    { title: UNIFIED_STATUS_FILTER_LABELS.SOLD, value: stats.soldProperties, icon: CheckCircle, color: "red" },
    { title: "Μέση Τιμή", value: formatCurrency(stats.averagePrice), icon: Euro, color: "orange" },
];

interface PropertyDashboardProps {
  stats: PropertyStats;
}

export function PropertyDashboard({ stats }: PropertyDashboardProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {statsCardsData(stats).map(card => (
                <StatsCard key={card.title} {...card} />
            ))}
            <StatusCard statsByStatus={stats.propertiesByStatus} getStatusLabel={getStatusLabel} />
            <DetailsCard title="Τύποι Μονάδων" icon={Building} data={stats.propertiesByType} labelFormatter={getTypeLabel} />
            <DetailsCard title="Κατανομή ανά Όροφο" icon={MapPin} data={stats.propertiesByFloor} isFloorData={true} />
            <DetailsCard 
                title="Αποθήκες" 
                icon={Package} 
                data={{
                    'Σύνολο': stats.totalStorageUnits,
                    'Διαθέσιμες': stats.availableStorageUnits,
                    'Πουλημένες': stats.soldStorageUnits,
                }} 
                isThreeColumnGrid={true}
            />
        </div>
    );
}
