
'use client';

// 🏢 ENTERPRISE: Type for translate function (from useTranslation hook)
type TranslateFunction = (key: string) => string;

export const validateForm = (
  formData: {
    name: string;
    totalArea: number;
    builtArea: number;
    floors: number;
    units: number;
  },
  setErrors: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>,
  t?: TranslateFunction
): boolean => {
  const newErrors: { [key: string]: string } = {};

  if (!formData.name.trim()) {
    newErrors.name = t ? t('validation.nameRequired') : 'Name is required';
  }
  if (formData.totalArea <= 0) {
    newErrors.totalArea = t ? t('validation.areaPositive') : 'Area must be greater than 0';
  }
  if (formData.builtArea > formData.totalArea) {
    newErrors.builtArea = t ? t('validation.builtAreaExceeds') : 'Built area cannot exceed total area';
  }
  if (formData.floors <= 0) {
    newErrors.floors = t ? t('validation.floorsMinimum') : 'Floors must be at least 1';
  }
  if (formData.units <= 0) {
    newErrors.units = t ? t('validation.unitsMinimum') : 'Units must be at least 1';
  }

  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};

export const calculateCostPerSqm = (totalValue: number, totalArea: number): number => {
    return totalArea > 0 ? (totalValue / totalArea) : 0;
};

export const calculateBuildingRatio = (builtArea: number, totalArea: number): number => {
    return totalArea > 0 ? (builtArea / totalArea * 100) : 0;
};
