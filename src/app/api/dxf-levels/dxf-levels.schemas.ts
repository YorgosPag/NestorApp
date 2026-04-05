import { z } from 'zod';

export const CreateDxfLevelSchema = z.object({
  name: z.string().min(1).max(200),
  order: z.number().int().min(0).max(9999),
  isDefault: z.boolean().optional(),
  visible: z.boolean().optional(),
  floorId: z.string().min(1).max(128).optional(),
  sceneFileId: z.string().min(1).max(128).optional(),
  sceneFileName: z.string().max(300).optional(),
});

export const UpdateDxfLevelSchema = z.object({
  levelId: z.string().min(1).max(128),
  name: z.string().min(1).max(200).optional(),
  order: z.number().int().min(0).max(9999).optional(),
  isDefault: z.boolean().optional(),
  visible: z.boolean().optional(),
  floorId: z.string().min(1).max(128).nullable().optional(),
  sceneFileId: z.string().min(1).max(128).nullable().optional(),
  sceneFileName: z.string().max(300).nullable().optional(),
  _v: z.number().int().optional(),
}).passthrough();
