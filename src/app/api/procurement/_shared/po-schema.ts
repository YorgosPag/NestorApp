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
import { poLineGrossMinor } from '@/lib/procurement/po-totals';
import { PO_PRICING_MODES } from '@/lib/procurement/po-pricing-carry';

/**
 * `materialId` ΠΡΕΠΕΙ να είναι εδώ: χωρίς αυτό το zod το πετούσε σιωπηλά (ADR-923 §5.11 «3γ», Α5) ⇒
 * ούτε η σύμβαση ανά υλικό ούτε το `materialPriceSyncOnPODelivery` (ADR-330 Phase 4.5) έβρισκαν υλικό.
 * Το `total` γραμμής το ξαναϋπολογίζει ο server· η τιμή του πελάτη δεν αποθηκεύεται.
 */
export const CreatePOItemSchema = z
  .object({
    description: z.string().min(1).max(500),
    quantity: z.number().positive(),
    unit: z.string().min(1).max(20),
    unitPrice: z.number().min(0),
    total: z.number().min(0),
    boqItemId: z.string().nullable().default(null),
    categoryCode: z.string().min(1).max(20),
    materialId: z.string().min(1).nullable().default(null),
  })
  .refine((item) => poLineGrossMinor(item) !== null, {
    message: 'quantity or unitPrice has more decimals than a purchase order line can carry',
    path: ['quantity'],
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
});

export const UpdatePOSchema = CreatePOSchema.partial();

/**
 * Το σώμα του `PATCH ?action=update`: τα πεδία της PO + η πρόθεση τιμολόγησης (ADR-923 «3γ», Α9).
 * Χωρίς `pricingMode` ⇒ `carry`: η επεξεργασία ΠΟΤΕ δεν ξανατιμολογεί σιωπηλά.
 */
export const UpdatePORequestSchema = UpdatePOSchema.extend({
  pricingMode: z.enum(PO_PRICING_MODES).default('carry'),
  expectedTotal: z.number().min(0).optional(),
});
