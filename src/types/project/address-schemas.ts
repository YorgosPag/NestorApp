import { z } from 'zod';
import { PROJECT_ADDRESS_TYPES, BLOCK_SIDE_DIRECTIONS } from '@/types/project/addresses';

export const projectAddressSchema = z.object({
  id: z.string(),
  street: z.string(),
  number: z.string().optional(),
  city: z.string(),
  postalCode: z.string(),
  region: z.string().optional(),
  regionalUnit: z.string().optional(),
  country: z.string(),
  type: z.enum(PROJECT_ADDRESS_TYPES),
  isPrimary: z.boolean(),
  label: z.string().optional(),
  blockSide: z.enum(BLOCK_SIDE_DIRECTIONS).optional(),
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

export const projectAddressCreateSchema = projectAddressSchema.extend({
  street: z.string().min(1),
  city: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().min(1),
});

export const projectAddressesSchema = z.array(projectAddressSchema)
  .refine(
    (addresses) => addresses.filter((addr) => addr.isPrimary).length === 1,
    { message: 'Exactly one address must be marked as primary' }
  )
  .refine(
    (addresses) => {
      const ids = addresses.map((addr) => addr.id);
      return ids.length === new Set(ids).size;
    },
    { message: 'Address IDs must be unique' }
  );

export const projectAddressesCreateSchema = z.array(projectAddressCreateSchema)
  .refine(
    (addresses) => addresses.filter((addr) => addr.isPrimary).length === 1,
    { message: 'Exactly one address must be marked as primary' }
  )
  .refine(
    (addresses) => {
      const ids = addresses.map((addr) => addr.id);
      return ids.length === new Set(ids).size;
    },
    { message: 'Address IDs must be unique' }
  );
