/**
 * Zod schemas for framework agreements — SSoT shared by the list-route (POST
 * create) and the `[agreementId]` detail-route (PATCH update).
 *
 * `UpdateFrameworkAgreementSchema` is `CreateFrameworkAgreementSchema.partial()`
 * — every field optional — byte-equivalent to the previously hand-duplicated
 * update schema, removing the sibling clone between the two route files.
 *
 * @module app/api/procurement/_shared/framework-agreement-schema
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import { z } from 'zod';
import {
  FRAMEWORK_AGREEMENT_STATUSES,
  DISCOUNT_TYPES,
} from '@/subapps/procurement/types/framework-agreement';

const VolumeBreakpointSchema = z.object({
  thresholdEur: z.number().nonnegative(),
  discountPercent: z.number().min(0).max(100),
});

export const CreateFrameworkAgreementSchema = z.object({
  agreementNumber: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  vendorContactId: z.string().min(1),
  status: z.enum(FRAMEWORK_AGREEMENT_STATUSES).optional(),
  validFrom: z.string().min(1),
  validUntil: z.string().min(1),
  applicableProjectIds: z.array(z.string().min(1)).nullable().optional(),
  applicableMaterialIds: z.array(z.string().min(1)).nullable().optional(),
  applicableAtoeCategoryCodes: z.array(z.string().min(1)).nullable().optional(),
  currency: z.string().min(2).max(8).optional(),
  totalCommitment: z.number().nonnegative().nullable().optional(),
  discountType: z.enum(DISCOUNT_TYPES),
  flatDiscountPercent: z.number().min(0).max(100).nullable().optional(),
  volumeBreakpoints: z.array(VolumeBreakpointSchema).optional(),
});

export const UpdateFrameworkAgreementSchema = CreateFrameworkAgreementSchema.partial();
