import { useForm, UseFormProps, FieldValues, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useCallback, useMemo } from 'react';

// Enhanced form hook with Zod validation and i18n
export function useFormValidation<TFieldValues extends FieldValues = FieldValues>(
  schema: z.ZodSchema<TFieldValues>,
  options?: Omit<UseFormProps<TFieldValues>, 'resolver'>
): UseFormReturn<TFieldValues> & {
  validateField: (field: keyof TFieldValues, value: unknown) => string | undefined;
  validateAll: () => boolean;
  getFieldError: (field: keyof TFieldValues) => string | undefined;
} {
  const { t } = useTranslation('forms');
  
  const form = useForm<TFieldValues>({
    ...options,
    resolver: zodResolver(schema),
    mode: options?.mode || 'onChange', // Enable real-time validation
  });

  // Single field validation
  const validateField = useCallback((field: keyof TFieldValues, value: unknown) => {
    try {
      // Get the field schema from the full schema
      const schemaWithShape = schema as z.ZodObject<Record<string, z.ZodType>>;
      const fieldSchema = schemaWithShape.shape?.[field as string];
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
  }, [schema]);

  // Validate all fields
  const validateAll = useCallback(() => {
    return form.trigger();
  }, [form]);

  // Get field error with fallback
  const getFieldError = useCallback((field: keyof TFieldValues) => {
    const error = form.formState.errors[field];
    return error?.message as string | undefined;
  }, [form.formState.errors]);

  return {
    ...form,
    validateField,
    validateAll,
    getFieldError,
  };
}

// Hook for dynamic schema creation based on form configuration
export function useDynamicFormValidation<TFieldValues extends FieldValues>(
  schemaConfig: Record<keyof TFieldValues, z.ZodType>,
  options?: Omit<UseFormProps<TFieldValues>, 'resolver'>
) {
  const schema = useMemo(() => z.object(schemaConfig), [schemaConfig]);
  return useFormValidation(schema, options);
}

// Hook for conditional validation based on form state
export function useConditionalFormValidation<TFieldValues extends FieldValues>(
  baseSchema: z.ZodSchema<TFieldValues>,
  conditionalRules: (data: Partial<TFieldValues>) => z.ZodSchema<TFieldValues>,
  options?: Omit<UseFormProps<TFieldValues>, 'resolver'>
) {
  const form = useForm<TFieldValues>({
    ...options,
    mode: options?.mode || 'onChange',
  });

  const currentSchema = useMemo(() => {
    const watchedData = form.watch();
    return conditionalRules(watchedData) || baseSchema;
  }, [form.watch(), baseSchema, conditionalRules]);

  // Override the validate method to use dynamic schema
  const customValidate = useCallback(async (data: TFieldValues) => {
    try {
      await currentSchema.parseAsync(data);
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, { message: string }> = {};
        error.errors.forEach((err) => {
          const path = err.path.join('.');
          errors[path] = { message: err.message };
        });
        Object.keys(errors).forEach(key => {
          form.setError(key as keyof TFieldValues, errors[key]);
        });
      }
      return false;
    }
  }, [currentSchema, form]);

  return {
    ...form,
    validate: customValidate,
    currentSchema,
  };
}

// Preset form configurations for common use cases
export const formPresets = {
  // Storage unit form
  storageUnit: {
    code: z.string().min(1, 'forms.validation.required'),
    area: z.number().positive('forms.validation.areaRequired'),
    price: z.number().positive('forms.validation.priceRequired').optional(),
    floor: z.number().int('forms.validation.notInteger').optional(),
    type: z.enum(['storage', 'parking'], {
      errorMap: () => ({ message: 'forms.validation.invalidSelection' })
    }),
    status: z.enum(['available', 'reserved', 'sold', 'owner'], {
      errorMap: () => ({ message: 'forms.validation.invalidSelection' })
    }),
  },

  // Contact form
  contact: {
    name: z.string().min(1, 'forms.validation.required').min(2, 'forms.validation.minLength'),
    email: z.string().email('forms.validation.invalidEmail').optional(),
    phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'forms.validation.invalidPhone').optional(),
    company: z.string().optional(),
    position: z.string().optional(),
  },

  // Financial form
  financial: {
    salePricePerSqm: z.number().positive('forms.validation.priceRequired'),
    costPerSqm: z.number().positive('forms.validation.priceRequired'),
    realizedValue: z.number().nonnegative('forms.validation.nonNegativeNumber'),
    financing: z.number().nonnegative('forms.validation.nonNegativeNumber'),
  },

  // Login form
  login: {
    email: z.string().email('forms.validation.invalidEmail'),
    password: z.string().min(1, 'forms.validation.required'),
  },

  // Building filter form
  buildingFilter: {
    status: z.array(z.string()).optional(),
    type: z.array(z.string()).optional(),
    minArea: z.number().positive().optional(),
    maxArea: z.number().positive().optional(),
    minPrice: z.number().positive().optional(),
    maxPrice: z.number().positive().optional(),
  },
};

// Helper to create typed form hooks for specific presets
export const createTypedFormHook = <T extends keyof typeof formPresets>(preset: T) => {
  return (options?: Omit<UseFormProps<z.infer<z.ZodObject<typeof formPresets[T]>>>, 'resolver'>) => {
    const schema = z.object(formPresets[preset]);
    return useFormValidation(schema, options);
  };
};

// Typed hooks for common forms
export const useStorageUnitForm = createTypedFormHook('storageUnit');
export const useContactForm = createTypedFormHook('contact');
export const useFinancialForm = createTypedFormHook('financial');
export const useLoginForm = createTypedFormHook('login');
export const useBuildingFilterForm = createTypedFormHook('buildingFilter');