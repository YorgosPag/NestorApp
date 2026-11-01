/**
 * @fileoverview **Η σχέση προμήθειας από τον πελάτη** (ADR-923 §5.12): όψεις · πράξεις των δύο πλευρών · οι απαντήσεις των
 *   σελίδων-πυλών, που **ποτέ** δεν πετούν: κάθε αποτυχία είναι ονομασμένη.
 * @module services/catalog/supply-api.client
 */

import type { ActingWorkspaceRequest } from '@/lib/auth/acting-workspace';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { invitationLinkRefusalOf } from '@/lib/invitations/invitation-link-refusal';
import { CATALOG_API, SUPPLY_PUBLIC_API } from '@/subapps/catalog/catalog-routes';
import type { ForeignQuote } from '@/subapps/catalog/pricing/foreign-quote';
import type { ForeignSkuSearch } from '@/subapps/catalog/pricing/foreign-sku-search';
import { SUPPLIER_DRIFT_BATCH } from '@/subapps/catalog/pricing/supplier-drift';
import { SUPPLY_BUYER_REFUSALS, type SupplyBuyerRefusal } from '@/subapps/catalog/types/supply-invitation';
import type { BoqSupplierDriftReview, BoqSupplierDriftRow, BoqSupplierPriceOutcome } from '@/subapps/catalog/types/supply-boq';
import type { BuyerSupplyView, SupplierSupplyView, SupplyRequestLinkWire } from '@/subapps/catalog/types/supply-views';
import { CORE_INVITATION_REFUSALS, type InvitationCoreRefusal } from '@/types/invitation-core';

const SUPPLY = CATALOG_API.supplyRelationships;

export const fetchSupplierSupplyView = (): Promise<SupplierSupplyView> => apiClient.get<SupplierSupplyView>(SUPPLY.collection);
export const fetchBuyerSupplyView = (): Promise<BuyerSupplyView> => apiClient.get<BuyerSupplyView>(CATALOG_API.suppliers.collection);

export interface SupplyApprovalInput {
  readonly expectedRevision: number;
  readonly supplierContactId: string | null;
  readonly customerGroupId: string | null;
}

export const approveSupplyRequest = (id: string, input: SupplyApprovalInput): Promise<unknown> => apiClient.post(SUPPLY.approve(id), input);
export const declineSupplyRequest = (id: string, expectedRevision: number): Promise<unknown> => apiClient.post(SUPPLY.decline(id), { expectedRevision });
export const endRelationshipAsSupplier = (id: string, expectedRevision: number): Promise<unknown> => apiClient.post(SUPPLY.revoke(id), { expectedRevision });
export const endRelationshipAsBuyer = (id: string, expectedRevision: number): Promise<unknown> => apiClient.post(CATALOG_API.suppliers.revoke(id), { expectedRevision });

export const searchForeignSkus = (relationshipId: string, term: string): Promise<ForeignSkuSearch> =>
  apiClient.post<ForeignSkuSearch>(CATALOG_API.suppliers.search(relationshipId), { term });

export const quoteForeignSku = (relationshipId: string, variantId: string, quantity: number): Promise<ForeignQuote> =>
  apiClient.post<ForeignQuote>(CATALOG_API.suppliers.quote(relationshipId), { variantId, quantity });

export interface SupplierPriceApplication {
  readonly boqItemId: string;
  readonly variantId: string;
  readonly acknowledged: { readonly netAmount: number; readonly quantity: number };
  readonly confirmFence: boolean;
}

export const applySupplierPriceToLine = (relationshipId: string, application: SupplierPriceApplication): Promise<BoqSupplierPriceOutcome> =>
  apiClient.post<BoqSupplierPriceOutcome>(CATALOG_API.suppliers.boqPrice(relationshipId), application);

/** Ο έλεγχος σε δέσμες: ένα μεγάλο κτίριο δεν κρατά ένα αίτημα ανοιχτό. */
export async function reviewSupplierLines(boqItemIds: readonly string[]): Promise<readonly BoqSupplierDriftRow[]> {
  const rows: BoqSupplierDriftRow[] = [];
  for (let start = 0; start < boqItemIds.length; start += SUPPLIER_DRIFT_BATCH) {
    const batch = boqItemIds.slice(start, start + SUPPLIER_DRIFT_BATCH);
    rows.push(...(await apiClient.post<BoqSupplierDriftReview>(CATALOG_API.suppliers.boqDrift, { boqItemIds: batch })).rows);
  }
  return rows;
}

/** Έκβαση email ονομασμένη: «δέχτηκε ο πάροχος» δεν σημαίνει «παραδόθηκε», και η αποτυχία δεν ακυρώνει την πρόσκληση. */
export interface IssuedSupplyInvitationWire {
  readonly invitationId: string;
  readonly delivery: 'accepted' | 'unaddressable' | 'failed';
}

export const inviteSupplyCustomer = (contactId: string, customerGroupId: string | null): Promise<IssuedSupplyInvitationWire> =>
  apiClient.post<IssuedSupplyInvitationWire>(SUPPLY.invitations, { contactId, customerGroupId });

export const revokeSupplyInvitation = (id: string): Promise<unknown> => apiClient.post(SUPPLY.invitationRevoke(id), {});

export const changeSupplyRequestLink = (action: 'publish' | 'revoke'): Promise<SupplyRequestLinkWire> =>
  apiClient.post<SupplyRequestLinkWire>(SUPPLY.link, { action });

export type SupplyAccessRefusal = InvitationCoreRefusal | SupplyBuyerRefusal;

const REFUSALS: readonly SupplyAccessRefusal[] = [...CORE_INVITATION_REFUSALS, ...SUPPLY_BUYER_REFUSALS];

export type SupplyAccessResult =
  | { readonly kind: 'done'; readonly status: 'accepted' | 'declined' | 'requested' }
  | { readonly kind: 'refused'; readonly reason: SupplyAccessRefusal }
  | { readonly kind: 'failed' };

async function answer(route: string, body: Record<string, unknown>): Promise<SupplyAccessResult> {
  try {
    return { kind: 'done', status: (await apiClient.post<{ readonly status: 'accepted' | 'declined' | 'requested' }>(route, body)).status };
  } catch (cause: unknown) {
    const reason = invitationLinkRefusalOf(cause, REFUSALS);
    return reason !== null ? { kind: 'refused', reason } : { kind: 'failed' };
  }
}

type ActingAnswer = { readonly actingRequest?: ActingWorkspaceRequest };

/** Πόρτα α: απάντηση από τη σελίδα της πρόσκλησης. */
export const redeemSupplyInvitationFromScreen = (token: string, action: 'accept' | 'decline', acting: ActingAnswer): Promise<SupplyAccessResult> =>
  answer(SUPPLY_PUBLIC_API.invitationRedeem, { token, action, ...acting });

/** Πόρτα β: αίτημα από τον σύνδεσμο/QR. */
export const requestSupplyAccessFromScreen = (token: string, customerRef: string, acting: ActingAnswer): Promise<SupplyAccessResult> =>
  answer(SUPPLY_PUBLIC_API.accessRequest, { token, customerRef, ...acting });
