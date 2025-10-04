import { z } from 'zod';
import i18n from '@/i18n/config';

// Helper function to get validation message with i18n
export const getValidationMessage = (key: string, params?: Record<string, any>) => {
  return i18n.t(`forms.validation.${key}`, { ...params, ns: 'forms' });
};

// Common validation rules with i18n messages
export const validationRules = {
  // String validations
  required: (message?: string) => 
    z.string().min(1, message || getValidationMessage('required')),
  
  minLength: (min: number, message?: string) =>
    z.string().min(min, message || getValidationMessage('minLength', { min })),
  
  maxLength: (max: number, message?: string) =>
    z.string().max(max, message || getValidationMessage('maxLength', { max })),
  
  exactLength: (length: number, message?: string) =>
    z.string().length(length, message || getValidationMessage('exactLength', { length })),

  // Email validation
  email: (message?: string) =>
    z.string().email(message || getValidationMessage('invalidEmail')),

  // Phone validation (international format)
  phone: (message?: string) =>
    z.string().regex(/^\+?[1-9]\d{1,14}$/, message || getValidationMessage('invalidPhone')),

  // URL validation
  url: (message?: string) =>
    z.string().url(message || getValidationMessage('invalidUrl')),

  // Number validations
  number: (message?: string) =>
    z.number({ invalid_type_error: message || getValidationMessage('invalidNumber') }),

  integer: (message?: string) =>
    z.number().int(message || getValidationMessage('notInteger')),

  positiveNumber: (message?: string) =>
    z.number().positive(message || getValidationMessage('positiveNumber')),

  nonNegative: (message?: string) =>
    z.number().nonnegative(message || getValidationMessage('nonNegativeNumber')),

  minValue: (min: number, message?: string) =>
    z.number().min(min, message || getValidationMessage('minValue', { min })),

  maxValue: (max: number, message?: string) =>
    z.number().max(max, message || getValidationMessage('maxValue', { max })),

  greaterThan: (value: number, message?: string) =>
    z.number().gt(value, message || getValidationMessage('greaterThan', { value })),

  lessThan: (value: number, message?: string) =>
    z.number().lt(value, message || getValidationMessage('lessThan', { value })),

  // Date validations
  date: (message?: string) =>
    z.date({ invalid_type_error: message || getValidationMessage('invalidDate') }),

  pastDate: (message?: string) =>
    z.date().refine(date => date < new Date(), {
      message: message || getValidationMessage('pastDate')
    }),

  futureDate: (message?: string) =>
    z.date().refine(date => date > new Date(), {
      message: message || getValidationMessage('futureDate')
    }),

  // Selection validation
  selection: (options: string[], message?: string) =>
    z.enum(options as [string, ...string[]], {
      errorMap: () => ({ message: message || getValidationMessage('invalidSelection') })
    }),

  // Custom business logic validations
  area: (message?: string) =>
    z.number().positive(message || getValidationMessage('areaRequired')),

  price: (message?: string) =>
    z.number().positive(message || getValidationMessage('priceRequired')),

  code: (message?: string) =>
    z.string().min(1, message || getValidationMessage('invalidCode')),
};

// Common validation schemas
export const commonSchemas = {
  // Contact information
  email: validationRules.email(),
  phone: validationRules.phone(),
  
  // Property information
  area: validationRules.area(),
  price: validationRules.price(),
  
  // Financial fields
  salePricePerSqm: validationRules.price(),
  costPerSqm: validationRules.price(),
  realizedValue: validationRules.nonNegative(),
  financing: validationRules.nonNegative(),
  
  // Basic fields
  name: validationRules.required().pipe(validationRules.minLength(2)),
  description: validationRules.maxLength(1000),
  code: validationRules.required().pipe(validationRules.minLength(1)),
  
  // Numbers
  floor: validationRules.integer(),
  percentage: validationRules.number().pipe(validationRules.minValue(0)).pipe(validationRules.maxValue(100)),
};

// Password validation
export const passwordSchema = {
  password: validationRules.required().pipe(validationRules.minLength(8)),
  confirmPassword: validationRules.required(),
};

// Password confirmation validation
export const createPasswordConfirmSchema = () => 
  z.object(passwordSchema).refine(
    (data) => data.password === data.confirmPassword,
    {
      message: getValidationMessage('confirmPassword'),
      path: ['confirmPassword'],
    }
  );

// Utility to create form schema from field definitions
export const createFormSchema = (fields: Record<string, z.ZodType>) => {
  return z.object(fields);
};

// Utility to convert Zod errors to form-friendly format
export const formatZodErrors = (error: z.ZodError) => {
  const formattedErrors: Record<string, string> = {};
  
  error.errors.forEach((err) => {
    const path = err.path.join('.');
    formattedErrors[path] = err.message;
  });
  
  return formattedErrors;
};

// Form validation hook for React Hook Form integration
export const createValidationResolver = (schema: z.ZodSchema) => {
  return (values: any) => {
    try {
      schema.parse(values);
      return { values, errors: {} };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          values: {},
          errors: formatZodErrors(error)
        };
      }
      throw error;
    }
  };
};

// Export common field validations
export const fieldValidations = {
  // Storage/Property fields
  storageUnit: {
    code: commonSchemas.code,
    area: commonSchemas.area,
    price: commonSchemas.price,
    floor: commonSchemas.floor,
  },
  
  // Contact fields
  contact: {
    name: commonSchemas.name,
    email: commonSchemas.email,
    phone: commonSchemas.phone,
  },
  
  // Financial fields
  financial: {
    salePricePerSqm: commonSchemas.salePricePerSqm,
    costPerSqm: commonSchemas.costPerSqm,
    realizedValue: commonSchemas.realizedValue,
    financing: commonSchemas.financing,
  },
};