'use client';

import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface BuildingCardFeaturesProps {
  features?: string[];
}

// 🏢 ENTERPRISE: Reverse lookup map - Greek strings to i18n keys
// This enables translation of existing database strings
const FEATURE_GREEK_TO_KEY: Record<string, string> = {
  'Αυτόνομη Θέρμανση': 'autonomousHeating',
  'Ηλιακή Θέρμανση': 'solarHeating',
  'Θέσεις Στάθμευσης': 'parkingSpaces',
  'Ανελκυστήρας': 'elevator',
  'Μπαλκόνια με Θέα': 'balconiesWithView',
  'Ενεργειακή Κλάση Α+': 'energyClassAPlus',
  'Βιτρίνες Καταστημάτων': 'shopWindows',
  'Κλιματισμός VRV': 'vrvClimate',
  'Πυρόσβεση': 'fireSuppression',
  'Πρόσβαση ΑμεΑ': 'disabilityAccess',
  'Πρόσβαση Φορτηγών': 'loadingAccess',
  'Φόρτιση Ηλεκτρικών Οχημάτων': 'electricVehicleCharging',
  'Κάμερες Ασφαλείας 24/7': 'securityCameras247',
  'Αυτόματος Εξαερισμός': 'automaticVentilation',
  'Πλυντήριο Αυτοκινήτων': 'carWash',
  'Έλεγχος Πρόσβασης': 'accessControl',
  'Γερανογέφυρα 20 Τόνων': 'craneBridge20Tons',
  'Παροχή Ρεύματος 1000kW': 'powerSupply1000kw',
  'Συστήματα Αποκονίωσης': 'dustRemovalSystems',
  'Φυσικός Αερισμός': 'naturalVentilation',
  'Πυρόσβεση Αερίου': 'gasFireSuppression',
  'Συστήματα Αυτοματισμού': 'automationSystems',
  'Ράφια Ύψους 12μ': 'highShelving12m',
  'Συστήματα Παρακολούθησης': 'monitoringSystems',
  'Κλιματισμός Αποθήκης': 'warehouseClimate',
  'Ράμπες Φόρτωσης': 'loadingRamps',
  'Σύστημα RFID': 'rfidTracking',
  'Τηλεδιάσκεψη σε όλες τις αίθουσες': 'videoConferencingAllRooms',
  'Έξυπνος Κλιματισμός': 'smartClimate',
  'Συστήματα Ασφαλείας': 'securitySystems',
  'Υψηλής Ποιότητας Ακουστική': 'highQualityAcoustics',
  'Κυλικείο Προσωπικού': 'staffCafeteria',
  'Φυσικός Φωτισμός Atrium': 'naturalLightingAtrium',
  'Κυλιόμενες Σκάλες σε όλους τους ορόφους': 'escalatorsAllFloors',
  'Σύστημα Διαχείρισης Καταστημάτων': 'shopManagementSystem',
  'Food Court 800 θέσεων': 'foodCourt800Seats',
  'Σινεμά 8 Αιθουσών': 'cinema8Rooms',
  'Παιδότοπος 300τ.μ.': 'playground300sqm',
  'Σύστημα Καθοδήγησης Στάθμευσης': 'parkingGuidanceSystem',
  'Φόρτιση Tesla/VW': 'teslaVwCharging',
  'Πλυντήρια Αυτοκινήτων': 'carWashPlural',
  'Μηχανική Ασφάλεια': 'mechanicalSecurity',
  'Έξοδοι Κινδύνου': 'emergencyExits',
};

export function BuildingCardFeatures({ features }: BuildingCardFeaturesProps) {
  // 🏢 ENTERPRISE: i18n hook for translations with namespace readiness check
  const { t, isNamespaceReady } = useTranslation('building');

  // 🏢 ENTERPRISE: Translate feature using reverse lookup with namespace readiness
  const translateFeature = useMemo(() => {
    return (feature: string): string => {
      // Fallback to original feature when namespace not ready
      if (!isNamespaceReady) {
        return feature;
      }
      const key = FEATURE_GREEK_TO_KEY[feature];
      if (key) {
        return t(`storageForm.features.building.${key}`, { defaultValue: feature });
      }
      // Fallback: return original if no mapping found
      return feature;
    };
  }, [t, isNamespaceReady]);

  if (!features || features.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 pt-2">
      {features.slice(0, 3).map((feature, index) => (
        <Badge
          key={index}
          variant="secondary"
          className="text-xs px-2 py-0.5 rounded-full"
        >
          {translateFeature(feature)}
        </Badge>
      ))}
      {features.length > 3 && (
        <Badge
          variant="secondary"
          className="text-xs px-2 py-0.5 rounded-full"
        >
          +{features.length - 3}
        </Badge>
      )}
    </div>
  );
}
