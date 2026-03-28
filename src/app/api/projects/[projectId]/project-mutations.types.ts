/**
 * Project Mutations — Shared types and schemas
 */

import { z } from 'zod';

export const ProjectUpdateSchema = z.object({
  name: z.string().max(500).optional(),
  title: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  status: z.string().max(50).optional(),
  companyId: z.string().max(128).nullable().optional(),
  company: z.string().max(200).nullable().optional(),
  linkedCompanyId: z.string().max(128).nullable().optional(),
  linkedCompanyName: z.string().max(200).nullable().optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(200).optional(),
  addresses: z.array(z.record(z.unknown())).optional(),
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
