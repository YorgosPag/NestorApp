'use client';

/**
 * @fileoverview Shared mutation payload builders for sales action dialogs
 * @description SSoT για τα payloads που στέλνουν ReserveDialog/SellDialog:
 *              commercial update, accounting event base, appurtenance sync.
 *              Πριν από αυτό τα δύο dialogs έχτιζαν τα ίδια αντικείμενα
 *              δύο φορές (CHECK 3.28 / ADR-584 token clones).
 * @see ADR-197 §2.9 — Sales action dialogs
 * @see ADR-244 — Multi-buyer ownership
 */

import type { Property, PropertyCommercialData } from '@/types/property';
import type { PropertyOwnerEntry } from '@/types/ownership-table';
import type { SalesAccountingEventBase } from '@/services/sales-accounting/types';
import {
  syncSalesAppurtenancesWithPolicy,
  type SalesAppurtenanceSyncSpace,
} from '@/services/sales-mutation-gateway';
import { buildOwnerFields } from '@/lib/ownership/owner-utils';
import { resolveSalesUnitProjectId } from './sales-dialog-utils';

// =============================================================================
// COMMERCIAL UPDATE
// =============================================================================

/**
 * Ημερομηνιακό πεδίο του `commercial`: το Firestore επιστρέφει `Timestamp`,
 * ο client γράφει ISO string μέσω `nowISO()`.
 */
type CommercialDate = PropertyCommercialData['saleDate'] | string;

/** Το υποσύνολο του `commercial` που γράφουν τα sales action dialogs. */
export interface SalesCommercialUpdate {
  askingPrice: number | null;
  finalPrice: number | null;
  reservationDeposit: number | null;
  owners: PropertyOwnerEntry[] | null;
  ownerContactIds: string[] | null;
  reservationDate: CommercialDate;
  saleDate: CommercialDate;
  cancellationDate: CommercialDate;
  listedDate: CommercialDate;
  transactionChainId: string | null;
}

/**
 * Μεταφέρει ΟΛΑ τα υπάρχοντα `commercial` πεδία και εφαρμόζει από πάνω το delta.
 *
 * Ο κανόνας: ένα sales action αλλάζει 2-3 πεδία — τα υπόλοιπα ΠΡΕΠΕΙ να
 * μεταφερθούν αυτούσια, αλλιώς το update τα μηδενίζει σιωπηλά.
 */
export function buildSalesCommercialUpdate(
  unit: Property,
  owners: PropertyOwnerEntry[],
  changes: Partial<SalesCommercialUpdate>,
): SalesCommercialUpdate {
  const existing = unit.commercial;

  return {
    askingPrice: existing?.askingPrice ?? null,
    finalPrice: existing?.finalPrice ?? null,
    reservationDeposit: existing?.reservationDeposit ?? null,
    reservationDate: existing?.reservationDate ?? null,
    saleDate: existing?.saleDate ?? null,
    cancellationDate: existing?.cancellationDate ?? null,
    listedDate: existing?.listedDate ?? null,
    transactionChainId: existing?.transactionChainId ?? null,
    ...buildOwnerFields(owners),
    ...changes,
  };
}

// =============================================================================
// ACCOUNTING EVENT BASE
// =============================================================================

/** Στοιχεία αγοραστή που δεν προκύπτουν από το `unit`. */
export interface SalesEventBuyerContext {
  propertyName: string;
  buyerContactId: string | null;
  buyerName: string | null;
}

/**
 * Τα κοινά πεδία κάθε sales accounting event.
 *
 * Τα `null` πεδία (projectName / permitTitle / companyName / buildingName /
 * projectAddress) τα συμπληρώνει ο server από το project — ο client δεν τα ξέρει.
 */
export function buildSalesAccountingEventBase(
  unit: Property,
  buyer: SalesEventBuyerContext,
): SalesAccountingEventBase {
  return {
    propertyId: unit.id,
    propertyName: buyer.propertyName,
    projectId: resolveSalesUnitProjectId(unit) ?? null,
    buyerContactId: buyer.buyerContactId,
    buyerName: buyer.buyerName,
    projectName: null,
    permitTitle: null,
    companyName: null,
    buildingName: null,
    unitFloor: unit.floor ?? null,
    projectAddress: null,
    paymentMethod: 'bank_transfer',
    notes: null,
  };
}

// =============================================================================
// APPURTENANCE SYNC
// =============================================================================

/**
 * Συγχρονισμός παρακολουθημάτων (θέσεις στάθμευσης / αποθήκες).
 *
 * Fire-and-forget με ρητό error handler: το ακίνητο έχει ήδη γραφτεί επιτυχώς,
 * οπότε αστοχία εδώ δεν πρέπει να μπλοκάρει ή να αναιρέσει το κύριο mutation.
 */
export function syncAppurtenancesForSale(
  unitId: string,
  action: 'reserve' | 'sell',
  spaces: SalesAppurtenanceSyncSpace[],
  owners: PropertyOwnerEntry[],
  onError: (error: unknown) => void,
): void {
  syncSalesAppurtenancesWithPolicy(unitId, {
    action,
    spaces,
    ...buildOwnerFields(owners),
  }).catch(onError);
}
