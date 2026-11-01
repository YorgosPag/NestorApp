/**
 * Το σχήμα της σχέσης προμήθειας (ADR-923 §5.12): η ανάγνωση από τη βάση **και** τα σώματα των πράξεων του προμηθευτή.
 *
 * 🔴 **Fail-closed στην ανάγνωση:** έγγραφο που δεν διαβάζεται ≡ καμία σχέση. Μια αλλοιωμένη κατάσταση δεν πρέπει ποτέ
 * να ανοίξει ξένη ανάγνωση (Σ4).
 * @module subapps/catalog/schema/zod/supply-relationship.schema
 */

import { z } from 'zod';

import { INVITATION_TOKEN_MAX_LENGTH, INVITATION_TOKEN_MIN_LENGTH } from '@/contracts/invitation-redeem-body';
import { ACTING_WORKSPACE_REQUEST_SCHEMA } from '@/lib/auth/acting-workspace';
import { INVITATION_STATES } from '@/types/invitation-core';

import { FOREIGN_SKU_TERM_MAX } from '../../pricing/foreign-sku-search';
import { SUPPLIER_DRIFT_BATCH } from '../../pricing/supplier-drift';
import type { SupplyInvitation } from '../../types/supply-invitation';
import {
  SUPPLY_RELATIONSHIP_ORIGINS,
  SUPPLY_RELATIONSHIP_SIDES,
  SUPPLY_RELATIONSHIP_STATES,
  type SupplyRelationship,
} from '../../types/supply-relationship';
import { entityIdSchema, expectedRevisionSchema } from './common.schema';

const CUSTOMER_REF_MAX_LENGTH = 64;

/** Κενό ⇒ `null`: «δεν έχω αριθμό» είναι νόμιμη απάντηση, όχι τιμή. */
export const customerRefSchema = z
  .string()
  .trim()
  .max(CUSTOMER_REF_MAX_LENGTH)
  .nullable()
  .transform((value) => (value === null || value === '' ? null : value));

const nullableText = z.string().min(1).nullable();

const supplyRelationshipDocSchema = z.object({
  id: z.string().min(1),
  companyId: z.string().min(1),
  buyerCompanyId: z.string().min(1),
  state: z.enum(SUPPLY_RELATIONSHIP_STATES),
  origin: z.enum(SUPPLY_RELATIONSHIP_ORIGINS),
  supplierContactId: nullableText,
  customerRef: nullableText,
  requestCount: z.number().int().min(0),
  requestedByUid: nullableText,
  requestedAt: nullableText,
  acceptedByUid: nullableText,
  acceptedAt: nullableText,
  approvedByUid: nullableText,
  approvedAt: nullableText,
  endedBySide: z.enum(SUPPLY_RELATIONSHIP_SIDES).nullable(),
  endedByUid: nullableText,
  endedAt: nullableText,
  revision: z.number().int().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  updatedBy: z.string().min(1),
});

/** Το έγγραφο στο σχήμα του, ή `null`. */
export function supplyRelationshipFromDocument(data: unknown): SupplyRelationship | null {
  const parsed = supplyRelationshipDocSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

const supplyInvitationDocSchema = z.object({
  id: z.string().min(1),
  inviteeEmail: z.string().min(1),
  invitedByUid: z.string().min(1),
  nonceHash: z.string().min(1),
  reissuedNonceHashes: z.array(z.string()).optional(),
  state: z.enum(INVITATION_STATES),
  createdAt: z.string().min(1),
  expiresAt: z.string().min(1),
  openedAt: nullableText,
  resolvedAt: nullableText,
  resolvedByUid: nullableText,
  mailboxProvenAt: nullableText,
  companyId: z.string().min(1),
  contactId: z.string().min(1),
});

/** Το έγγραφο της πρόσκλησης, ή `null` ⇒ `invitation-corrupt`, καμία σχέση από έγγραφο που δεν καταλάβαμε. */
export function supplyInvitationFromDocument(data: unknown): SupplyInvitation | null {
  const parsed = supplyInvitationDocSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/** Πόρτα α: από ποια επαφή, με ποια προέγκριση. */
export const issueSupplyInvitationBodySchema = z.object({
  contactId: entityIdSchema,
  customerGroupId: entityIdSchema.nullable(),
}).strict();

/** Το πολύ ένα αίτημα χώρου, όπως στην αποδοχή υπόθεσης: αίτημα, όχι άδεια. */
export const supplyAccessRequestBodySchema = z.object({
  token: z.string().min(INVITATION_TOKEN_MIN_LENGTH).max(INVITATION_TOKEN_MAX_LENGTH),
  customerRef: customerRefSchema,
  actingRequest: ACTING_WORKSPACE_REQUEST_SCHEMA.optional(),
}).strict();

/** Έγκριση αιτήματος: επαφή και ομάδα πελάτη είναι προαιρετικές, ο προμηθευτής δεν υποχρεώνεται να κατατάξει αμέσως. */
export const approveSupplyRequestBodySchema = z.object({
  expectedRevision: expectedRevisionSchema,
  supplierContactId: entityIdSchema.nullable(),
  customerGroupId: entityIdSchema.nullable(),
}).strict();

/** Η ξένη τιμή: ποιο SKU, πόσο. Κανένα κοινό, καμία λίστα, κανένας χώρος: αυτά τα ξέρει ο διακομιστής. */
export const foreignQuoteBodySchema = z.object({
  variantId: entityIdSchema,
  quantity: z.number().positive().finite(),
}).strict();

/** Ο όρος της αναζήτησης SKU στον ξένο κατάλογο (§5.12 τμήμα 4). */
export const foreignSkuSearchBodySchema = z.object({ term: z.string().trim().min(1).max(FOREIGN_SKU_TERM_MAX) }).strict();

/**
 * Ο πελάτης λέει ποια γραμμή και ποιο SKU (§5.12 Δ7). `acknowledged` = ό,τι διάβασε ο άνθρωπος, μόνο για σύγκριση: κανένα ποσό δεν
 * γράφεται από εδώ. `confirmFence` = ρητή επιβεβαίωση ανανέωσης πάνω από τον φράχτη (Δ9).
 */
export const boqSupplierPriceBodySchema = z.object({
  boqItemId: entityIdSchema,
  variantId: entityIdSchema,
  acknowledged: z.object({ netAmount: z.number().int().nonnegative(), quantity: z.number().positive().finite() }).strict(),
  confirmFence: z.boolean(),
}).strict();

/** Ποιες γραμμές θα ελεγχθούν (Δ9): τα υπόλοιπα τα ξέρει το στιγμιότυπο. */
export const boqSupplierDriftBodySchema = z.object({ boqItemIds: z.array(entityIdSchema).min(1).max(SUPPLIER_DRIFT_BATCH) }).strict();

/** Ο σύνδεσμος/QR: δημοσίευση (ή ανανέωση, που ακυρώνει ό,τι τυπώθηκε) · ανάκληση. */
export const supplyRequestLinkBodySchema = z.object({ action: z.enum(['publish', 'revoke']) }).strict();

/** Πράξη χωρίς σώμα: ο πόρος είναι στη διαδρομή. */
export const emptySupplyBodySchema = z.object({}).strict();

/** Απόρριψη · ανάκληση: μόνο ο CAS. */
export const supplyRelationshipActBodySchema = z.object({ expectedRevision: expectedRevisionSchema }).strict();
