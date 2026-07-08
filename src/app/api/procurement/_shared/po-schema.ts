/**
 * Zod schemas for purchase orders — SSoT shared by the list-route (POST create)
 * and the `[poId]` detail-route (PATCH ?action=update).
 *
 * `UpdatePOSchema` is `CreatePOSchema.partial()` — every top-level field optional
 * — which is byte-equivalent to the previously hand-duplicated update schema
 * (identical item shape, same `.min(1).max(100)` on `items`) and removes the
 * sibling clone between the two route files.
 *
 * @module app/api/procurement/_shared/po-schema
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import { z } from 'zod';

export const CreatePOItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unit: z.string().min(1).max(20),
  unitPrice: z.number().min(0),
  total: z.number().min(0),
  boqItemId: z.string().nullable().default(null),
  categoryCode: z.string().min(1).max(20),
});

export const CreatePOSchema = z.object({
  projectId: z.string().min(1),
  buildingId: z.string().nullable().optional(),
  supplierId: z.string().min(1),
  items: z.array(CreatePOItemSchema).min(1).max(100),
  taxRate: z.union([z.literal(24), z.literal(13), z.literal(6), z.literal(0)]),
  dateNeeded: z.string().nullable().optional(),
  deliveryAddress: z.string().max(500).nullable().optional(),
  paymentTermsDays: z.number().int().min(0).max(365).nullable().optional(),
  supplierNotes: z.string().max(2000).nullable().optional(),
  internalNotes: z.string().max(2000).nullable().optional(),
  appliedFaId: z.string().nullable().optional(),
  faDiscountPercent: z.number().min(0).max(100).nullable().optional(),
  faDiscountAmount: z.number().min(0).nullable().optional(),
  netTotal: z.number().min(0).nullable().optional(),
});

export const UpdatePOSchema = CreatePOSchema.partial();
