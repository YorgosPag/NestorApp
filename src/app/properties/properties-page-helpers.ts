// 🏢 ENTERPRISE: Translation key type for OPERATIONAL status labels (Physical Truth - No Sales!)
export type OperationalStatusKey = 'ready' | 'underConstruction' | 'inspection' | 'maintenance' | 'draft';
// 🏢 ENTERPRISE: Translation key type for type labels
export type TypeKey = 'apartment' | 'studio' | 'maisonette' | 'shop' | 'office' | 'storage';

// ✅ ENTERPRISE: Factory function that creates an OPERATIONAL status label getter
// 🎯 DOMAIN SEPARATION: Units = Physical Truth, NO sales statuses!
export const createStatusLabelGetter = (t: (key: string) => string) => (status: string): string => {
  const operationalStatuses: OperationalStatusKey[] = ['ready', 'underConstruction', 'inspection', 'maintenance', 'draft'];
  if (operationalStatuses.includes(status as OperationalStatusKey)) {
    return t(`operationalStatus.${status}`);
  }
  return status;
};

// ✅ ENTERPRISE: Factory function that creates a type label getter with translation support
export const createTypeLabelGetter = (t: (key: string) => string) => (type: string): string => {
  const knownTypes: TypeKey[] = ['apartment', 'studio', 'maisonette', 'shop', 'office', 'storage'];
  if (knownTypes.includes(type as TypeKey)) {
    return t(`page.typeLabels.${type}`);
  }
  return type;
};
