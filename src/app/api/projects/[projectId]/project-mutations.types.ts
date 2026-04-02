/**
 * Project Mutations — Shared types and schemas
 */

import { z } from 'zod';
import { PROJECT_STATUS_LABELS } from '@/types/project';
import type { ProjectStatus } from '@/types/project';
import { projectAddressesSchema } from '@/types/project/address-schemas';

export const ProjectUpdateSchema = z.object({
  name: z.string().max(500).optional(),
  title: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  status: z.custom<ProjectStatus>((value): value is ProjectStatus => typeof value === 'string' && value in PROJECT_STATUS_LABELS).optional(),
  companyId: z.string().max(128).nullable().optional(),
  company: z.string().max(200).nullable().optional(),
  linkedCompanyId: z.string().max(128).nullable().optional(),
  linkedCompanyName: z.string().max(200).nullable().optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(200).optional(),
  addresses: projectAddressesSchema.optional(),
  progress: z.number().min(0).max(100).optional(),
  totalValue: z.number().min(0).max(999_999_999).optional(),
  totalArea: z.number().min(0).max(999_999_999).optional(),
  startDate: z.string().max(30).nullable().optional(),
  completionDate: z.string().max(30).nullable().optional(),
  _v: z.number().int().optional(),
}).passthrough();

export const CACHE_KEY_PREFIX = 'api:projects:list';

export interface ProjectUpdateResponse {
  projectId: string;
  updated: boolean;
  _v?: number;
}

export interface ProjectDeleteResponse {
  projectId: string;
  deleted: boolean;
}
