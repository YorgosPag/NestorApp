import { z } from 'zod';
import { validationRules } from '@/utils/validation';

// Contact validation schemas
export const contactBaseSchema = z.object({
  name: validationRules.required().pipe(validationRules.minLength(2)),
  email: validationRules.email().optional().or(z.literal('')),
  phone: validationRules.phone().optional().or(z.literal('')),
  company: z.string().optional(),
  position: z.string().optional(),
  notes: z.string().optional(),
});

export const contactCreateSchema = contactBaseSchema.extend({
  type: validationRules.selection(['individual', 'company']),
});

export const contactEditSchema = contactBaseSchema.extend({
  id: z.string(),
});

// Company-specific contact schema
export const companyContactSchema = contactBaseSchema.extend({
  vatNumber: z.string().optional(),
  taxNumber: z.string().optional(),
  legalName: z.string().optional(),
});

// Storage unit validation schemas
export const storageUnitBaseSchema = z.object({
  code: validationRules.required(),
  area: validationRules.area(),
  price: validationRules.price().optional(),
  description: validationRules.required(),
  type: validationRules.selection(['storage', 'parking']),
  status: validationRules.selection(['available', 'reserved', 'sold', 'owner']),
  floor: z.string().optional(),
});

export const storageUnitCreateSchema = storageUnitBaseSchema.extend({
  buildingId: z.string(),
  coordinates: z.object({
    x: validationRules.number(),
    y: validationRules.number(),
  }).optional(),
});

export const storageUnitEditSchema = storageUnitBaseSchema.extend({
  id: z.string(),
});

// Financial data schemas
export const financialDataSchema = z.object({
  salePricePerSqm: validationRules.price(),
  costPerSqm: validationRules.price(),
  realizedValue: validationRules.nonNegative(),
  financing: validationRules.nonNegative(),
});

export const calculatedFinancialSchema = z.object({
  completionAmount: validationRules.number(),
});

// Building management schemas
export const buildingBaseSchema = z.object({
  name: validationRules.required().pipe(validationRules.minLength(2)),
  address: validationRules.required(),
  description: z.string().optional(),
  category: validationRules.selection(['residential', 'commercial', 'mixed', 'industrial']),
  status: validationRules.selection(['active', 'construction', 'planned', 'completed']),
});

export const buildingCreateSchema = buildingBaseSchema.extend({
  projectId: z.string().optional(),
});

export const buildingEditSchema = buildingBaseSchema.extend({
  id: z.string(),
});

// Project schemas
export const projectBaseSchema = z.object({
  name: validationRules.required().pipe(validationRules.minLength(2)),
  description: z.string().optional(),
  location: validationRules.required(),
  startDate: validationRules.date().optional(),
  endDate: validationRules.date().optional(),
  status: validationRules.selection(['planning', 'active', 'paused', 'completed', 'cancelled']),
});

export const projectCreateSchema = projectBaseSchema.extend({
  clientId: z.string().optional(),
});

export const projectEditSchema = projectBaseSchema.extend({
  id: z.string(),
});

// Authentication schemas
export const loginSchema = z.object({
  email: validationRules.email(),
  password: validationRules.required(),
  rememberMe: z.boolean().optional(),
});

export const registerSchema = z.object({
  name: validationRules.required().pipe(validationRules.minLength(2)),
  email: validationRules.email(),
  password: validationRules.required().pipe(validationRules.minLength(8)),
  confirmPassword: validationRules.required(),
  terms: z.boolean().refine(val => val === true, {
    message: 'You must accept the terms and conditions'
  }),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const forgotPasswordSchema = z.object({
  email: validationRules.email(),
});

export const resetPasswordSchema = z.object({
  password: validationRules.required().pipe(validationRules.minLength(8)),
  confirmPassword: validationRules.required(),
  token: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// CRM schemas
export const opportunityBaseSchema = z.object({
  title: validationRules.required().pipe(validationRules.minLength(2)),
  description: z.string().optional(),
  stage: validationRules.selection([
    'initial_contact', 'qualification', 'viewing', 'proposal', 
    'negotiation', 'contract', 'closed_won', 'closed_lost'
  ]),
  value: validationRules.positiveNumber().optional(),
  probability: validationRules.number().pipe(validationRules.minValue(0)).pipe(validationRules.maxValue(100)).optional(),
  expectedCloseDate: validationRules.date().optional(),
});

export const opportunityCreateSchema = opportunityBaseSchema.extend({
  contactId: z.string(),
  propertyId: z.string().optional(),
});

export const opportunityEditSchema = opportunityBaseSchema.extend({
  id: z.string(),
});

export const taskBaseSchema = z.object({
  title: validationRules.required().pipe(validationRules.minLength(2)),
  description: z.string().optional(),
  type: validationRules.selection(['call', 'meeting', 'viewing', 'follow_up', 'email', 'document', 'other']),
  priority: validationRules.selection(['low', 'medium', 'high', 'urgent']),
  status: validationRules.selection(['pending', 'in_progress', 'completed', 'cancelled']),
  dueDate: validationRules.date().optional(),
});

export const taskCreateSchema = taskBaseSchema.extend({
  leadId: z.string().optional(),
  assignedTo: z.string().optional(),
});

export const taskEditSchema = taskBaseSchema.extend({
  id: z.string(),
});

// Filter schemas
export const buildingFiltersSchema = z.object({
  status: z.array(z.string()).optional(),
  category: z.array(z.string()).optional(),
  search: z.string().optional(),
});

export const propertyFiltersSchema = z.object({
  features: z.array(z.string()).optional(),
  minArea: validationRules.positiveNumber().optional(),
  maxArea: validationRules.positiveNumber().optional(),
  minPrice: validationRules.positiveNumber().optional(),
  maxPrice: validationRules.positiveNumber().optional(),
  status: z.array(z.string()).optional(),
  type: z.array(z.string()).optional(),
});

export const taskFiltersSchema = z.object({
  status: validationRules.selection(['all', 'pending', 'in_progress', 'completed', 'cancelled']).optional(),
  priority: validationRules.selection(['all', 'low', 'medium', 'high', 'urgent']).optional(),
  type: validationRules.selection(['all', 'call', 'meeting', 'viewing', 'follow_up', 'email', 'document', 'other']).optional(),
  timeframe: validationRules.selection(['all', 'overdue', 'today', 'tomorrow', 'week']).optional(),
  searchTerm: z.string().optional(),
});

// Export all schemas for easy access
export const schemas = {
  // Contact schemas
  contact: {
    base: contactBaseSchema,
    create: contactCreateSchema,
    edit: contactEditSchema,
    company: companyContactSchema,
  },
  
  // Storage schemas
  storage: {
    base: storageUnitBaseSchema,
    create: storageUnitCreateSchema,
    edit: storageUnitEditSchema,
  },
  
  // Financial schemas
  financial: {
    data: financialDataSchema,
    calculated: calculatedFinancialSchema,
  },
  
  // Building schemas
  building: {
    base: buildingBaseSchema,
    create: buildingCreateSchema,
    edit: buildingEditSchema,
  },
  
  // Project schemas
  project: {
    base: projectBaseSchema,
    create: projectCreateSchema,
    edit: projectEditSchema,
  },
  
  // Auth schemas
  auth: {
    login: loginSchema,
    register: registerSchema,
    forgotPassword: forgotPasswordSchema,
    resetPassword: resetPasswordSchema,
  },
  
  // CRM schemas
  crm: {
    opportunity: {
      base: opportunityBaseSchema,
      create: opportunityCreateSchema,
      edit: opportunityEditSchema,
    },
    task: {
      base: taskBaseSchema,
      create: taskCreateSchema,
      edit: taskEditSchema,
    },
  },
  
  // Filter schemas
  filters: {
    building: buildingFiltersSchema,
    property: propertyFiltersSchema,
    task: taskFiltersSchema,
  },
};

// Export types for each schema
export type ContactFormData = z.infer<typeof contactBaseSchema>;
export type ContactCreateData = z.infer<typeof contactCreateSchema>;
export type ContactEditData = z.infer<typeof contactEditSchema>;
export type CompanyContactData = z.infer<typeof companyContactSchema>;

export type StorageUnitFormData = z.infer<typeof storageUnitBaseSchema>;
export type StorageUnitCreateData = z.infer<typeof storageUnitCreateSchema>;
export type StorageUnitEditData = z.infer<typeof storageUnitEditSchema>;

export type FinancialData = z.infer<typeof financialDataSchema>;
export type CalculatedFinancialData = z.infer<typeof calculatedFinancialSchema>;

export type BuildingFormData = z.infer<typeof buildingBaseSchema>;
export type BuildingCreateData = z.infer<typeof buildingCreateSchema>;
export type BuildingEditData = z.infer<typeof buildingEditSchema>;

export type ProjectFormData = z.infer<typeof projectBaseSchema>;
export type ProjectCreateData = z.infer<typeof projectCreateSchema>;
export type ProjectEditData = z.infer<typeof projectEditSchema>;

export type LoginData = z.infer<typeof loginSchema>;
export type RegisterData = z.infer<typeof registerSchema>;
export type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordData = z.infer<typeof resetPasswordSchema>;

export type OpportunityFormData = z.infer<typeof opportunityBaseSchema>;
export type OpportunityCreateData = z.infer<typeof opportunityCreateSchema>;
export type OpportunityEditData = z.infer<typeof opportunityEditSchema>;

export type TaskFormData = z.infer<typeof taskBaseSchema>;
export type TaskCreateData = z.infer<typeof taskCreateSchema>;
export type TaskEditData = z.infer<typeof taskEditSchema>;

export type BuildingFiltersData = z.infer<typeof buildingFiltersSchema>;
export type PropertyFiltersData = z.infer<typeof propertyFiltersSchema>;
export type TaskFiltersData = z.infer<typeof taskFiltersSchema>;