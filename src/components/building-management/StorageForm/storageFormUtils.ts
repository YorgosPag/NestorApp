
import { z } from 'zod';
import type { StorageUnit, StorageType } from '@/types/storage';
import { validationRules, formatZodErrors } from '@/utils/validation';

export const generateAutoCode = (type: StorageType, floor: string): string => {
  const typePrefix = type === 'storage' ? 'A' : 'P';
  const floorPrefix = floor === 'Υπόγειο' ? 'B' :
                    floor === 'Ισόγειο' ? 'G' : 'F';
  const randomNum = Math.floor(Math.random() * 99) + 1;
  return `${typePrefix}_${floorPrefix}${randomNum.toString().padStart(2, '0')}`;
};

export const calculatePrice = (area: number, floor: string, type: StorageType): number => {
  const basePricePerSqm = type === 'storage' ? 400 : 800;
  const floorMultiplier = floor === 'Υπόγειο' ? 1.0 :
                        floor === 'Ισόγειο' ? 1.2 : 1.1;
  return Math.round(area * basePricePerSqm * floorMultiplier);
};

// Zod schema for storage unit validation
export const storageUnitSchema = z.object({
  code: validationRules.required(),
  area: validationRules.area(),
  price: validationRules.price(),
  description: validationRules.required(),
  type: validationRules.selection(['storage', 'parking']),
  status: validationRules.selection(['available', 'reserved', 'sold', 'owner']),
  floor: z.string().optional(),
  buildingId: z.string().optional(),
  coordinates: z.object({
    x: validationRules.number(),
    y: validationRules.number(),
  }).optional(),
});

// Type for the form data
export type StorageUnitFormData = z.infer<typeof storageUnitSchema>;

// Standardized validation function using Zod
export const validateForm = (formData: Partial<StorageUnit>): { isValid: boolean, errors: { [key: string]: string } } => {
  try {
    storageUnitSchema.parse(formData);
    return {
      isValid: true,
      errors: {}
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: formatZodErrors(error)
      };
    }
    return {
      isValid: false,
      errors: { general: 'Validation error occurred' }
    };
  }
};

// Partial validation for individual fields
export const validateField = (field: keyof StorageUnitFormData, value: unknown): string | undefined => {
  try {
    const schema = storageUnitSchema.shape;
    const fieldSchema = schema[field as keyof typeof schema];
    if (fieldSchema) {
      fieldSchema.parse(value);
      return undefined;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return error.errors[0]?.message;
    }
  }
  return undefined;
};
