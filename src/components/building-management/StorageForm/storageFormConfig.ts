import type { StorageType } from '@/types/storage';

// Translation function provided by useTranslation(''building'')
type TranslateFunction = (key: string) => string;

const floorKeys = [
  'basement2',
  'basement1',
  'basement',
  'ground',
  'floor1',
  'floor2',
  'floor3',
  'floor4',
  'floor5',
  'floor6',
  'floor7',
] as const;

const storageFeatureKeys = [
  'electricity',
  'naturalLight',
  'artificialLight',
  'airChamber',
  'security',
  'elevatorAccess',
  'plumbing',
] as const;

const parkingFeatureKeys = [
  'evCharging',
  'enclosed',
  'lighting',
  'security',
  'easyAccess',
] as const;

export const storageFormConfig = (formType: StorageType, t?: TranslateFunction) => {
  const availableFloors = t
    ? floorKeys.map((key) => t(`storage.form.floors.${key}`))
    : floorKeys.map((key) => key);

  const featureKeys = formType === 'storage' ? storageFeatureKeys : parkingFeatureKeys;
  const featurePath = formType === 'storage' ? 'storageFeatures' : 'parkingFeatures';

  const commonFeaturesForType = t
    ? featureKeys.map((key) => t(`storage.form.${featurePath}.${key}`))
    : featureKeys.map((key) => key);

  return { availableFloors, commonFeaturesForType };
};
