import { z } from 'zod';
import { validationRules } from '@/utils/validation';
import { PROJECT_STATUSES as CENTRALIZED_PROJECT_STATUSES, BUILDING_STATUSES as CENTRALIZED_BUILDING_STATUSES } from '@/core/status/StatusConstants';
import type { ProjectAddressType, BlockSideDirection } from '@/types/project/addresses';

// 🏢 ENTERPRISE: Use centralized status constants (NO MORE DUPLICATES)
const PROJECT_STATUSES = Object.keys(CENTRALIZED_PROJECT_STATUSES);
const BUILDING_STATUSES = Object.keys(CENTRALIZED_BUILDING_STATUSES);

// 🏢 ENTERPRISE: Configurable business constants (NO MORE HARDCODED VALUES)
export const BUILDING_CATEGORIES = (process.env.NEXT_PUBLIC_BUILDING_CATEGORIES || 'residential,commercial,mixed,industrial').split(',').map(c => c.trim());
export const TASK_TYPES = (process.env.NEXT_PUBLIC_TASK_TYPES || 'call,meeting,viewing,follow_up,email,document,other').split(',').map(t => t.trim());
export const PRIORITY_LEVELS = (process.env.NEXT_PUBLIC_PRIORITY_LEVELS || 'low,medium,high,urgent').split(',').map(p => p.trim());
export const CRM_STAGES = (process.env.NEXT_PUBLIC_CRM_STAGES || 'initial_contact,qualification,viewing,proposal,negotiation,contract,closed_won,closed_lost').split(',').map(s => s.trim());
export const TASK_STATUSES = (process.env.NEXT_PUBLIC_TASK_STATUSES || 'pending,in_progress,completed,cancelled').split(',').map(s => s.trim());

// 🏷️ ENTERPRISE: Export the centralized status arrays for validation
export { PROJECT_STATUSES, BUILDING_STATUSES };

// 🔍 ENTERPRISE: Configurable filter options
export const FILTER_TIMEFRAMES = (process.env.NEXT_PUBLIC_FILTER_TIMEFRAMES || 'all,overdue,today,tomorrow,week').split(',').map(t => t.trim());
export const ALL_TASK_STATUSES = ['all', ...TASK_STATUSES];
export const ALL_PRIORITY_LEVELS = ['all', ...PRIORITY_LEVELS];
export const ALL_TASK_TYPES = ['all', ...TASK_TYPES];

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

// 🏢 ENTERPRISE: Project Address Schemas (ADR-167) - MUST be defined BEFORE buildingBaseSchema
const PROJECT_ADDRESS_TYPES: ProjectAddressType[] = [
  'site', 'entrance', 'delivery', 'legal', 'postal', 'billing', 'correspondence', 'other'
];

const BLOCK_SIDE_DIRECTIONS: BlockSideDirection[] = [
  'north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest', 'corner', 'internal'
];

// BASE SCHEMA: Persisted type - allows empty strings for legacy migration compatibility
export const projectAddressSchema = z.object({
  id: z.string(),
  street: z.string(), // Allows empty string for legacy migration
  number: z.string().optional(),
  city: z.string(), // Allows empty string for legacy migration
  postalCode: z.string(), // Allows empty string for legacy migration
  region: z.string().optional(),
  country: z.string(), // Allows empty string for legacy migration
  type: z.enum(PROJECT_ADDRESS_TYPES as [ProjectAddressType, ...ProjectAddressType[]]),
  isPrimary: z.boolean(),
  label: z.string().optional(),
  blockSide: z.enum(BLOCK_SIDE_DIRECTIONS as [BlockSideDirection, ...BlockSideDirection[]]).optional(),
  blockSideDescription: z.string().optional(),
  cadastralCode: z.string().optional(),
  municipality: z.string().optional(),
  neighborhood: z.string().optional(),
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
  sortOrder: z.number().optional(),
});

// CREATE/EDIT SCHEMA: Enforces non-empty strings for user input
export const projectAddressCreateSchema = projectAddressSchema.extend({
  street: validationRules.required(), // MUST be non-empty when creating
  city: validationRules.required(),   // MUST be non-empty when creating
  postalCode: validationRules.required(), // MUST be non-empty when creating
  country: validationRules.required(), // MUST be non-empty when creating
});

// Building address reference schema with invariants
export const buildingAddressReferenceSchema = z.object({
  inheritFromProject: z.boolean(),
  projectAddressId: z.string().optional(),
  override: z.object({
    label: z.string().optional(),
    coordinates: z.object({
      lat: z.number(),
      lng: z.number(),
    }).optional(),
    blockSideDescription: z.string().optional(),
  }).partial().optional(),
}).refine(
  (data) => {
    // INVARIANT: If inheritFromProject=true, projectAddressId is REQUIRED
    if (data.inheritFromProject && !data.projectAddressId) {
      return false;
    }
    return true;
  },
  {
    message: 'projectAddressId is required when inheritFromProject is true',
    path: ['projectAddressId'],
  }
);

// Project address array schema with invariants (PERSISTED - allows empty strings)
export const projectAddressesSchema = z.array(projectAddressSchema).refine(
  (addresses) => {
    // INVARIANT: Exactly ONE isPrimary=true per project
    const primaryCount = addresses.filter((addr) => addr.isPrimary).length;
    return primaryCount === 1;
  },
  {
    message: 'Exactly one address must be marked as primary',
  }
).refine(
  (addresses) => {
    // INVARIANT: No duplicate IDs
    const ids = addresses.map((addr) => addr.id);
    const uniqueIds = new Set(ids);
    return ids.length === uniqueIds.size;
  },
  {
    message: 'Address IDs must be unique',
  }
);

// CREATE/EDIT array schema (enforces non-empty strings)
export const projectAddressesCreateSchema = z.array(projectAddressCreateSchema).refine(
  (addresses) => {
    // INVARIANT: Exactly ONE isPrimary=true per project
    const primaryCount = addresses.filter((addr) => addr.isPrimary).length;
    return primaryCount === 1;
  },
  {
    message: 'Exactly one address must be marked as primary',
  }
).refine(
  (addresses) => {
    // INVARIANT: No duplicate IDs
    const ids = addresses.map((addr) => addr.id);
    const uniqueIds = new Set(ids);
    return ids.length === uniqueIds.size;
  },
  {
    message: 'Address IDs must be unique',
  }
);

// Building address configs schema with invariants
export const buildingAddressConfigsSchema = z.array(buildingAddressReferenceSchema).refine(
  (configs) => {
    // INVARIANT: No duplicate projectAddressId references
    const refs = configs
      .filter((c) => c.inheritFromProject && c.projectAddressId)
      .map((c) => c.projectAddressId);
    const uniqueRefs = new Set(refs);
    return refs.length === uniqueRefs.size;
  },
  {
    message: 'Duplicate address references are not allowed',
  }
);

// Building management schemas (uses buildingAddressConfigsSchema from above)
// Raw schema without refine (for .extend() compatibility)
const buildingBaseSchemaRaw = z.object({
  name: validationRules.required().pipe(validationRules.minLength(2)),
  address: validationRules.required(), // Legacy - kept for backward compatibility
  description: z.string().optional(),
  category: validationRules.selection(BUILDING_CATEGORIES),
  status: validationRules.selection(BUILDING_STATUSES),
  // 🏢 ENTERPRISE: Address inheritance (ADR-167)
  addressConfigs: buildingAddressConfigsSchema.optional(),
  /**
   * Primary project address ID
   *
   * 🏢 ENTERPRISE INVARIANT (runtime validation):
   * If specified, MUST correspond to an existing ProjectAddress.id in the parent project.
   *
   * Validation is performed at runtime by resolveBuildingPrimaryAddress() helper,
   * not at schema level (schema doesn't have access to project addresses).
   *
   * @see src/types/project/address-helpers.ts - resolveBuildingPrimaryAddress()
   */
  primaryProjectAddressId: z.string().optional(),
});

// Building base schema with invariants
export const buildingBaseSchema = buildingBaseSchemaRaw.refine(
  (data) => {
    // INVARIANT: If primaryProjectAddressId is set, addressConfigs must also exist
    if (data.primaryProjectAddressId && (!data.addressConfigs || data.addressConfigs.length === 0)) {
      return false;
    }
    return true;
  },
  {
    message: 'primaryProjectAddressId requires addressConfigs to be set',
    path: ['primaryProjectAddressId'],
  }
);

export const buildingCreateSchema = buildingBaseSchemaRaw.extend({
  projectId: z.string().optional(),
}).refine(
  (data) => {
    // Apply same invariant for create schema
    if (data.primaryProjectAddressId && (!data.addressConfigs || data.addressConfigs.length === 0)) {
      return false;
    }
    return true;
  },
  {
    message: 'primaryProjectAddressId requires addressConfigs to be set',
    path: ['primaryProjectAddressId'],
  }
);

export const buildingEditSchema = buildingBaseSchemaRaw.extend({
  id: z.string(),
}).refine(
  (data) => {
    // Apply same invariant for edit schema
    if (data.primaryProjectAddressId && (!data.addressConfigs || data.addressConfigs.length === 0)) {
      return false;
    }
    return true;
  },
  {
    message: 'primaryProjectAddressId requires addressConfigs to be set',
    path: ['primaryProjectAddressId'],
  }
);

// Project schemas
export const projectBaseSchema = z.object({
  name: validationRules.required().pipe(validationRules.minLength(2)),
  description: z.string().optional(),
  location: validationRules.required(),
  startDate: validationRules.date().optional(),
  endDate: validationRules.date().optional(),
  status: validationRules.selection(PROJECT_STATUSES),
  // 🏢 ENTERPRISE: Multi-address support (ADR-167) - PERSISTED (allows empty strings)
  addresses: projectAddressesSchema.optional(),
});

export const projectCreateSchema = projectBaseSchema.extend({
  clientId: z.string().optional(),
  // 🏢 ENTERPRISE: Override addresses with strict validation (NO empty strings!)
  addresses: projectAddressesCreateSchema.optional(),
});

export const projectEditSchema = projectBaseSchema.extend({
  id: z.string(),
  // 🏢 ENTERPRISE: Override addresses with strict validation (NO empty strings!)
  addresses: projectAddressesCreateSchema.optional(),
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
  stage: validationRules.selection(CRM_STAGES),
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
  type: validationRules.selection(TASK_TYPES),
  priority: validationRules.selection(PRIORITY_LEVELS),
  status: validationRules.selection(TASK_STATUSES),
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
  status: validationRules.selection(ALL_TASK_STATUSES).optional(),
  priority: validationRules.selection(ALL_PRIORITY_LEVELS).optional(),
  type: validationRules.selection(ALL_TASK_TYPES).optional(),
  timeframe: validationRules.selection(FILTER_TIMEFRAMES).optional(),
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