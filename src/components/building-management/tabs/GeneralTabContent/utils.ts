
'use client';

export const validateForm = (
  formData: { 
    name: string; 
    totalArea: number; 
    builtArea: number; 
    floors: number; 
    units: number; 
  },
  setErrors: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>
): boolean => {
  const newErrors: { [key: string]: string } = {};
  
  if (!formData.name.trim()) {
    newErrors.name = 'Το όνομα είναι υποχρεωτικό';
  }
  if (formData.totalArea <= 0) {
    newErrors.totalArea = 'Η επιφάνεια πρέπει να είναι μεγαλύτερη από 0';
  }
  if (formData.builtArea > formData.totalArea) {
    newErrors.builtArea = 'Η δομημένη επιφάνεια δεν μπορεί να υπερβαίνει τη συνολική';
  }
  if (formData.floors <= 0) {
    newErrors.floors = 'Οι όροφοι πρέπει να είναι τουλάχιστον 1';
  }
  if (formData.units <= 0) {
    newErrors.units = 'Οι μονάδες πρέπει να είναι τουλάχιστον 1';
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
