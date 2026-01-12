
import type { StorageType } from '@/types/storage';

// 🏢 ENTERPRISE: Type for translate function (from useTranslation hook)
type TranslateFunction = (key: string) => string;

// 🏢 ENTERPRISE: Floor keys for i18n mapping
const floorKeys = [
    'basement2', 'basement1', 'basement', 'ground',
    'floor1', 'floor2', 'floor3', 'floor4', 'floor5', 'floor6', 'floor7'
];

// 🏢 ENTERPRISE: Feature keys for i18n mapping
const storageFeatureKeys = [
    'electricity', 'naturalLight', 'artificialLight', 'ventilation',
    'security', 'elevatorAccess', 'plumbing'
];

const parkingFeatureKeys = [
    'evCharging', 'covered', 'lighting', 'security', 'easyAccess'
];

// 🏢 ENTERPRISE: i18n-enabled config getter
export const storageFormConfig = (formType: StorageType, t?: TranslateFunction) => {
    // Get translated floors
    const availableFloors = t
        ? floorKeys.map(key => t(`storageForm.floors.${key}`))
        : floorKeys; // Fallback to keys

    // Get translated features
    const featureKeys = formType === 'storage' ? storageFeatureKeys : parkingFeatureKeys;
    const commonFeaturesForType = t
        ? featureKeys.map(key => t(`storageForm.features.${formType}.${key}`))
        : featureKeys; // Fallback to keys

    return { availableFloors, commonFeaturesForType };
};
