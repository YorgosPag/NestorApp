import { useForm, UseFormProps, UseFormReturn, type Path, type Resolver, type FieldErrors, type FieldError } from 'react-hook-form';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useCallback, useMemo } from 'react';

const zodResolver = <TSchema extends z.ZodTypeAny>(
  schema: TSchema
): Resolver<z.infer<TSchema>> => async (values) => {
  const result = await schema.safeParseAsync(values);

  if (result.success) {
    return { values: result.data, errors: {} };
  }

  const errors: FieldErrors<z.infer<TSchema>> = {};
  const mutableErrors = errors as Record<string, FieldError>;
  const flattened = result.error.flatten().fieldErrors;

  Object.entries(flattened).forEach(([key, messages]) => {
    const message = messages?.[0];
    if (!message) {
      return;
    }
    mutableErrors[key] = {
      type: 'validation',
      message
    };
  });

  return { values: {}, errors };
};

// Enhanced form hook with Zod validation and i18n
export function useFormValidation<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  options?: Omit<UseFormProps<z.infer<TSchema>>, 'resolver'>
): UseFormReturn<z.infer<TSchema>> & {
  validateField: (field: keyof z.infer<TSchema>, value: unknown) => string | undefined;
  validateAll: () => Promise<boolean>;
  getFieldError: (field: keyof z.infer<TSchema>) => string | undefined;
} {
  const { t } = useTranslation('forms');

  const form = useForm<z.infer<TSchema>>({
    ...options,
    resolver: zodResolver(schema),
    mode: options?.mode || 'onChange', // Enable real-time validation
  });

  // Single field validation
  const validateField = useCallback((field: keyof z.infer<TSchema>, value: unknown) => {
    try {
      // Get the field schema from the full schema
      if (!(schema instanceof z.ZodObject)) {
        return undefined;
      }
      const schemaWithShape = schema as z.ZodObject<Record<string, z.ZodTypeAny>>;
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
  const validateAll = useCallback(() => form.trigger(), [form]);

  // Get field error with fallback
  const getFieldError = useCallback((field: keyof z.infer<TSchema>) => {
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
export function useDynamicFormValidation<TSchema extends z.ZodRawShape>(
  schemaConfig: TSchema,
  options?: Omit<UseFormProps<z.infer<z.ZodObject<TSchema>>>, 'resolver'>
): UseFormReturn<z.infer<z.ZodObject<TSchema>>> & {
  validateField: (field: keyof z.infer<z.ZodObject<TSchema>>, value: unknown) => string | undefined;
  validateAll: () => Promise<boolean>;
  getFieldError: (field: keyof z.infer<z.ZodObject<TSchema>>) => string | undefined;
} {
  const schema = useMemo(() => z.object(schemaConfig), [schemaConfig]);
  return useFormValidation(schema, options);
}

// Hook for conditional validation based on form state
export function useConditionalFormValidation<TSchema extends z.ZodTypeAny>(
  baseSchema: TSchema,
  conditionalRules: (data: Partial<z.infer<TSchema>>) => TSchema,
  options?: Omit<UseFormProps<z.infer<TSchema>>, 'resolver'>
) {
  const form = useForm<z.infer<TSchema>>({
    ...options,
    mode: options?.mode || 'onChange',
  });

  const currentSchema = useMemo(() => {
    const watchedData = form.watch();
    return conditionalRules(watchedData) || baseSchema;
  }, [form.watch(), baseSchema, conditionalRules]);

  // Override the validate method to use dynamic schema
  const customValidate = useCallback(async (data: z.infer<TSchema>) => {
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
          form.setError(key as Path<z.infer<TSchema>>, errors[key]);
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
