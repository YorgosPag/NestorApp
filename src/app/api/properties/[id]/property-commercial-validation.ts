/**
 * Commercial transaction validation for property reserve/sell operations.
 *
 * Validates the full hierarchy chain (Property → Floor → Building → Project → Company)
 * and buyer contact eligibility before a property can be reserved or sold.
 *
 * @module api/properties/[id]/property-commercial-validation
 * @see ADR-232 (Entity Hierarchy)
 * @see ADR-244 (owners[] SSoT)
 * @see ADR-249 (Field Locking)
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { validateContactForSale, isServiceContact } from '@/types/contacts/helpers';
import type { Contact } from '@/types/contacts/contracts';
import type { CommercialTransactionType } from '@/types/contacts/helpers';

// ============================================================================
// validateCommercialTransaction
// ============================================================================

/**
 * Validates all preconditions for reserving or selling a property.
 *
 * Checks performed (in order):
 *  1. Building link exists
 *  2. Floor link exists (ADR-232: floorId is the canonical reference)
 *  3. Building is linked to a project
 *  4. Project is linked to a company (linkedCompanyId)
 *  5. Property has an asking price > 0
 *  5b. Property has area (net or gross) > 0
 *  6. owners[] contains at least one buyer contactId
 *  7. Buyer contact exists, is not a service contact, and passes readiness check
 *
 * @throws {ApiError} with a human-readable message on any validation failure
 */
export async function validateCommercialTransaction(
  adminDb: FirebaseFirestore.Firestore,
  existing: Record<string, unknown>,
  commercialPayload: Record<string, unknown> | undefined,
  incomingCommercialStatus: 'reserved' | 'sold',
): Promise<void> {
  const buildingId = (existing.buildingId as string) ?? null;
  const floorId = (existing.floorId as string) ?? null;
  // 🔒 ADR-232: Only floorId (document reference) counts as valid floor link
  const hasFloor = !!floorId;

  // 1. Building check
  if (!buildingId) {
    throw new ApiError(400, 'Property is not linked to a building');
  }

  // 2. Floor check
  if (!hasFloor) {
    throw new ApiError(400, 'Property is not linked to a floor');
  }

  // 3. Project check (building → project)
  const buildingDoc = await adminDb.collection(COLLECTIONS.BUILDINGS).doc(buildingId).get();
  const projectId = buildingDoc.exists
    ? (buildingDoc.data()?.projectId as string) ?? null
    : null;

  if (!projectId) {
    throw new ApiError(400, 'Building is not linked to a project');
  }

  // 4. Company check (project → linkedCompanyId — ADR-232 business link)
  const projectDoc = await adminDb.collection(COLLECTIONS.PROJECTS).doc(projectId).get();
  const linkedCompanyId = projectDoc.exists
    ? (projectDoc.data()?.linkedCompanyId as string) ?? null
    : null;

  if (!linkedCompanyId) {
    throw new ApiError(400, 'Project is not linked to a company');
  }

  // 5. Asking price check — cannot reserve/sell without a price
  const askingPrice =
    (commercialPayload?.askingPrice as number | undefined)
    ?? ((existing.commercial as Record<string, unknown> | undefined)?.askingPrice as number | undefined)
    ?? null;

  if (!askingPrice || askingPrice <= 0) {
    throw new ApiError(400, 'Property must have an asking price before reservation or sale');
  }

  // 5b. Area check — property must have net or gross area
  const propertyArea = (existing.area as number) ?? 0;
  const propertyGrossArea = (existing.areas as Record<string, number> | undefined)?.gross ?? 0;
  if (propertyArea <= 0 && propertyGrossArea <= 0) {
    throw new ApiError(400, 'Property must have area (sqm) before reservation or sale');
  }

  // 6. Buyer contact validation (enterprise-grade) — ADR-244: owners[] SSoT
  const ownersPayload = commercialPayload?.owners as
    ReadonlyArray<{ contactId: string }> | null ?? null;
  const buyerContactId = ownersPayload?.[0]?.contactId ?? null;

  if (!buyerContactId) {
    throw new ApiError(400, 'Buyer contact is required (owners[] must have at least one entry)');
  }

  const buyerDoc = await adminDb.collection(COLLECTIONS.CONTACTS).doc(buyerContactId).get();
  if (!buyerDoc.exists) {
    throw new ApiError(400, 'Buyer contact not found');
  }

  const buyerData = buyerDoc.data() as Contact;

  if (isServiceContact(buyerData)) {
    throw new ApiError(400, 'Service contacts cannot be buyers');
  }

  // 7. Readiness check — depends on transaction type (passed by caller)
  const transactionType: CommercialTransactionType =
    incomingCommercialStatus === 'reserved' ? 'reserve' : 'sell';
  const readiness = validateContactForSale(buyerData, transactionType);

  if (!readiness.valid) {
    throw new ApiError(400, `Buyer missing required fields: ${readiness.missingFields.join(', ')}`);
  }
}
