/**
 * Zod schemas for the material catalog — SSoT shared by the list-route (POST
 * create) and the `[materialId]` detail-route (PATCH update).
 *
 * `UpdateMaterialSchema` is `CreateMaterialSchema.partial()` — every field
 * optional — which is byte-equivalent to the previously hand-duplicated update
 * schema and removes the sibling clone between the two route files.
 *
 * @module app/api/procurement/_shared/material-schema
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import { z } from 'zod';
import { MAX_PREFERRED_SUPPLIERS } from '@/subapps/procurement/types/material';

const BOQ_UNITS = [
  'm', 'm2', 'm3', 'kg', 'ton', 'pcs', 'lt', 'set', 'hr', 'day', 'lump',
] as const;

/** ADR-923 §5.8 — ο πελάτης ονομάζει τη σχέση του και το SKU. Το `catalogRef` δεν υπάρχει στο σχήμα, άρα δεν γράφεται από το σώμα. */
const CatalogLinkSchema = z.object({
  relationshipId: z.string().min(1).max(128),
  variantId: z.string().min(1).max(128),
});

export const CreateMaterialSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  unit: z.enum(BOQ_UNITS),
  atoeCategoryCode: z.string().min(1).max(20),
  description: z.string().max(2000).nullable().optional(),
  preferredSupplierContactIds: z
    .array(z.string().min(1))
    .max(MAX_PREFERRED_SUPPLIERS)
    .optional(),
  avgPrice: z.number().nonnegative().nullable().optional(),
  lastPrice: z.number().nonnegative().nullable().optional(),
  lastPurchaseDate: z.string().nullable().optional(),
  catalogLink: CatalogLinkSchema.nullable().optional(),
});

export const UpdateMaterialSchema = CreateMaterialSchema.partial();
