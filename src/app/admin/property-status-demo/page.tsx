/**
 * 🏢 ENTERPRISE PROPERTY STATUS SYSTEM - DEMO PAGE
 *
 * Live demonstration του νέου Enterprise Property Status System
 * Δείχνει όλες τις δυνατότητες και τη χρήση των components
 *
 * @created 2025-12-14
 * @author Claude AI Assistant
 * @version 1.0.0
 * @demo Property Status System capabilities
 */

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// Enterprise Property Status System imports
import {
  ENHANCED_STATUS_LABELS,
  getAllEnhancedStatuses,
  getEnhancedStatusLabel,
  getEnhancedStatusColor,
  getStatusCategory,
  isPropertyAvailable,
  isPropertyCommitted,
  isPropertyOffMarket,
  hasPropertyIssues,
  STATUS_CATEGORIES
} from '@/constants/property-statuses-enterprise';

import type { EnhancedPropertyStatus } from '@/constants/property-statuses-enterprise';
import type { PropertyStatus } from '@/core/types/BadgeTypes';

// Centralized Badge System imports
import { PropertyBadge } from '@/core/badges/UnifiedBadgeSystem';

// Icons
import { Home, Building, Info, Zap, BarChart3, Settings, CheckCircle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

// ============================================================================
// DEMO PROPERTY DATA
// ============================================================================

interface DemoProperty {
  id: string;
  name: string;
  type: string;
  status: EnhancedPropertyStatus;
  price: number;
  area: number;
  location: string;
}

const DEMO_PROPERTIES: DemoProperty[] = [
  {
    id: '1',
    name: 'Διαμέρισμα A1',
    type: 'Διαμέρισμα 2Δ',
    status: 'for-sale',
    price: 180000,
    area: 75,
    location: 'Θεσσαλονίκη'
  },
  {
    id: '2',
    name: 'Στούντιο B5',
    type: 'Στούντιο',
    status: 'rental-only',
    price: 450,
    area: 35,
    location: 'Αθήνα'
  },
  {
    id: '3',
    name: 'Μεζονέτα C2',
    type: 'Μεζονέτα',
    status: 'reserved-pending',
    price: 320000,
    area: 120,
    location: 'Πάτρα'
  },
  {
    id: '4',
    name: 'Κατάστημα D1',
    type: 'Κατάστημα',
    status: 'under-renovation',
    price: 150000,
    area: 50,
    location: 'Λάρισα'
  },
  {
    id: '5',
    name: 'Γραφείο E3',
    type: 'Γραφείο',
    status: 'company-owned',
    price: 0,
    area: 85,
    location: 'Θεσσαλονίκη'
  },
  {
    id: '6',
    name: 'Αποθήκη F1',
    type: 'Αποθήκη',
    status: 'urgent-sale',
    price: 75000,
    area: 200,
    location: 'Βόλος'
  }
];

// ============================================================================
// DEMO PAGE COMPONENT
// ============================================================================

export default function PropertyStatusDemoPage() {
  const iconSizes = useIconSizes();
  const [selectedStatus, setSelectedStatus] = useState<EnhancedPropertyStatus | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<DemoProperty | null>(null);

  // ========================================================================
  // STATUS STATISTICS
  // ========================================================================

  const allStatuses = getAllEnhancedStatuses();
  const categorizedStatuses = {
    available: allStatuses.filter(status => isPropertyAvailable(status)),
    committed: allStatuses.filter(status => isPropertyCommitted(status)),
    offMarket: allStatuses.filter(status => isPropertyOffMarket(status)),
    issues: allStatuses.filter(status => hasPropertyIssues(status))
  };

  // ========================================================================
  // STATUS BADGE COMPONENT - USING CENTRALIZED SYSTEM
  // ========================================================================

  const StatusBadge = ({ status, interactive = false }: {
    status: EnhancedPropertyStatus;
    interactive?: boolean;
  }) => {
    // Χρησιμοποιούμε το κεντρικοποιημένο UnifiedBadgeSystem μέσω PropertyBadge
    return (
      <PropertyBadge
        status={status as PropertyStatus}
        variant="outline"
        size="default"
        className={cn(
          'transition-all duration-200',
          interactive ? 'cursor-pointer hover:scale-105' : 'cursor-default'
        )}
        onClick={interactive ? () => setSelectedStatus(status) : undefined}
      />
    );
  };

  // ========================================================================
  // PROPERTY CARD COMPONENT
  // ========================================================================

  const PropertyCard = ({ property }: { property: DemoProperty }) => {
    const statusLabel = getEnhancedStatusLabel(property.status);
    const statusColor = getEnhancedStatusColor(property.status);
    const category = getStatusCategory(property.status);

    return (
      <Card
        className="cursor-pointer hover:shadow-lg transition-all duration-200 border"
        onClick={() => setSelectedProperty(property)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{property.name}</CardTitle>
            <PropertyBadge
              status={property.status as PropertyStatus}
              variant="solid"
              size="sm"
              className="text-xs"
            />
          </div>
          <p className="text-sm text-muted-foreground">{property.type}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Τιμή:</span>
              <span className="font-medium">
                {property.price > 0 ? `€${property.price.toLocaleString()}` : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Εμβαδόν:</span>
              <span className="font-medium">{property.area} m²</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Τοποθεσία:</span>
              <span className="font-medium">{property.location}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Κατηγορία:</span>
              <span className="text-xs bg-muted px-2 py-1 rounded">
                {category}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Building className={`${iconSizes.xl} text-blue-600`} />
          Enterprise Property Status System
        </h1>
        <p className="text-muted-foreground">
          Live demonstration του νέου κεντρικοποιημένου συστήματος διαχείρισης καταστάσεων ακινήτων
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-green-600">
          <CheckCircle className={iconSizes.sm} />
          <span>Enterprise-class • Production Ready • Fully Typed</span>
        </div>
      </div>

      <Separator />

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="text-center">
            <Zap className={`${iconSizes.xl} mx-auto text-green-500`} />
            <CardTitle className="text-sm">Διαθέσιμα</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold">{categorizedStatuses.available.length}</div>
            <p className="text-xs text-muted-foreground">Status options</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <Settings className={`${iconSizes.xl} mx-auto text-orange-500`} />
            <CardTitle className="text-sm">Δεσμευμένα</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold">{categorizedStatuses.committed.length}</div>
            <p className="text-xs text-muted-foreground">Status options</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <Home className={`${iconSizes.xl} mx-auto text-gray-500`} />
            <CardTitle className="text-sm">Εκτός Αγοράς</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold">{categorizedStatuses.offMarket.length}</div>
            <p className="text-xs text-muted-foreground">Status options</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <BarChart3 className={`${iconSizes.xl} mx-auto text-blue-500`} />
            <CardTitle className="text-sm">Συνολικά Status</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold">{allStatuses.length}</div>
            <p className="text-xs text-muted-foreground">Enhanced statuses</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Categories */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className={iconSizes.md} />
            Κατηγορίες Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(STATUS_CATEGORIES).map(([categoryKey, statuses]) => (
            <div key={categoryKey} className="space-y-2">
              <h4 className="font-medium text-sm">
                {categoryKey === 'AVAILABLE' && '🟢 Διαθέσιμα'}
                {categoryKey === 'COMMITTED' && '🔒 Δεσμευμένα'}
                {categoryKey === 'OFF_MARKET' && '⚪ Εκτός Αγοράς'}
                {categoryKey === 'IN_PROCESS' && '🔧 Υπό Επεξεργασία'}
                {' '}({statuses.length})
              </h4>
              <div className="flex flex-wrap gap-1">
                {statuses.map(status => (
                  <StatusBadge key={status} status={status} interactive />
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Demo Properties */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className={iconSizes.md} />
            Demo Ακίνητα
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Παραδείγματα ακινήτων με διαφορετικές καταστάσεις
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DEMO_PROPERTIES.map(property => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Selected Status Details */}
      {selectedStatus && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-800">
              Status Details: {getEnhancedStatusLabel(selectedStatus)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Label:</span>
                <p>{getEnhancedStatusLabel(selectedStatus)}</p>
              </div>
              <div>
                <span className="font-medium">Category:</span>
                <p>{getStatusCategory(selectedStatus)}</p>
              </div>
              <div>
                <span className="font-medium">Available:</span>
                <p>{isPropertyAvailable(selectedStatus) ? 'Ναι' : 'Όχι'}</p>
              </div>
              <div>
                <span className="font-medium">Color:</span>
                <PropertyBadge
                  status={selectedStatus as PropertyStatus}
                  variant="solid"
                  size="sm"
                  className={`${iconSizes.lg} rounded border`}
                />
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedStatus(null)}
            >
              Close
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Selected Property Details */}
      {selectedProperty && (
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="text-green-800">
              Property Details: {selectedProperty.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Type:</span>
                <p>{selectedProperty.type}</p>
              </div>
              <div>
                <span className="font-medium">Status:</span>
                <StatusBadge status={selectedProperty.status} />
              </div>
              <div>
                <span className="font-medium">Price:</span>
                <p>{selectedProperty.price > 0 ? `€${selectedProperty.price.toLocaleString()}` : 'N/A'}</p>
              </div>
              <div>
                <span className="font-medium">Area:</span>
                <p>{selectedProperty.area} m²</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedProperty(null)}
            >
              Close
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>💡 Οδηγίες Χρήσης</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>• <strong>Κλικ στα status badges</strong> για να δεις λεπτομέρειες</p>
          <p>• <strong>Κλικ σε ακίνητο</strong> για να δεις τις πληροφορίες του</p>
          <p>• <strong>Το σύστημα υποστηρίζει {allStatuses.length} διαφορετικές καταστάσεις</strong></p>
          <p>• <strong>Πλήρης TypeScript support</strong> με type safety</p>
          <p>• <strong>Κεντρικοποιημένη διαχείριση</strong> με business rules</p>
        </CardContent>
      </Card>
    </div>
  );
}