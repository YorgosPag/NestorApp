import { z } from 'zod';

export const CreateFloorSchema = z.object({
  number: z.number().int(),
  name: z.string().min(1).max(200),
  buildingId: z.string().min(1).max(128),
  buildingName: z.string().max(200).optional(),
  projectId: z.string().max(128).optional(),
  projectName: z.string().max(200).optional(),
  units: z.number().int().min(0).max(9999).optional(),
  elevation: z.number().min(-999).max(9999).optional(),
});

export const UpdateFloorSchema = z.object({
  floorId: z.string().min(1).max(128),
  number: z.number().int().optional(),
  name: z.string().max(200).optional(),
  elevation: z.number().min(-999).max(9999).optional(),
  _v: z.number().int().optional(),
}).passthrough();
