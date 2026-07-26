'use client';

/**
 * @fileoverview Shared mutation lifecycle for sales action dialogs
 * @description Κάθε sales action (κράτηση / πώληση) ακολουθεί ΤΟΝ ΙΔΙΟ κύκλο:
 *              γράψε το ακίνητο → ειδοποίησε → κλείσε → στείλε λογιστικά events
 *              → συγχρόνισε παρακολουθήματα → χειρίσου το σφάλμα.
 *              Μόνο τα events διαφέρουν ανά action.
 *
 *              Πριν από αυτό ο κύκλος ήταν αντιγραμμένος σε ReserveDialog και
 *              SellDialog (CHECK 3.28 / ADR-584 token clones).
 * @see ADR-197 §2.9 — Sales action dialogs
 */

import { useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Property } from '@/types/property';
import type { PropertyOwnerEntry } from '@/types/ownership-table';
import type { SaleLineItem } from '@/services/sales-accounting/types';
import type { UseLinkedSpacesForSaleResult } from '@/hooks/sales/useLinkedSpacesForSale';
import { useGuardedPropertyMutation } from '@/hooks/useGuardedPropertyMutation';
import { createModuleLogger } from '@/lib/telemetry';
import { resolveSalesDialogError } from './sales-dialog-utils';
import {
  buildSalesCommercialUpdate,
  syncAppurtenancesForSale,
  type SalesCommercialUpdate,
} from './sales-dialog-payloads';

const logger = createModuleLogger('SalesActionMutation');

// =============================================================================
// TYPES
// =============================================================================

/** Τι ξέρει το dialog τη στιγμή που το ακίνητο έχει ήδη γραφτεί επιτυχώς. */
export interface SalesActionCommitContext {
  /** Ανθρώπινο όνομα ακινήτου */
  propertyName: string;
  /** Γραμμές τιμολογίου (μονάδα + παρακολουθήματα) — `undefined` αν δεν επιλέχθηκαν χώροι */
  lineItems: SaleLineItem[] | undefined;
}

/** Η περιγραφή ενός sales action — ό,τι διαφέρει μεταξύ κράτησης και πώλησης. */
export interface SalesActionRequest {
  /** Νέα εμπορική κατάσταση του ακινήτου */
  commercialStatus: 'reserved' | 'sold';
  /** Delta πάνω στα υπάρχοντα `commercial` πεδία */
  commercialChanges: Partial<SalesCommercialUpdate>;
  /** Ποσό που τιμολογείται — τροφοδοτεί τα line items */
  invoicedAmount: number;
  /** Λογιστικά events, fire-and-forget, αφού γραφτεί το ακίνητο */
  dispatchEvents: (context: SalesActionCommitContext) => void;
}

export interface UseSalesActionMutationOptions {
  unit: Property;
  owners: PropertyOwnerEntry[];
  linkedSpaces: UseLinkedSpacesForSaleResult;
  /** `reserve` ή `sell` — καθορίζει τον συγχρονισμό παρακολουθημάτων */
  action: 'reserve' | 'sell';
  /** i18n key όταν ο server δεν στείλει μήνυμα σφάλματος */
  unknownErrorI18nKey: string;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /** Μετάφραση + ειδοποιήσεις — έρχονται από το `useSalesDialogChrome()` */
  t: (key: string, opts?: Record<string, string>) => string;
  notifySuccess: (message: string) => void;
  notifyError: (message: string) => void;
}

export interface UseSalesActionMutationResult {
  /** Το mutation τρέχει τώρα */
  saving: boolean;
  /** Ο guard υπολογίζει τις επιπτώσεις — απενεργοποιεί το κουμπί */
  checking: boolean;
  /** Μεταφρασμένο σφάλμα αποθήκευσης ('' όταν δεν υπάρχει) */
  saveError: string;
  /** Το dialog επιπτώσεων του guard — αποδίδεται από τον caller */
  impactDialog: ReactNode;
  /** Εκτελεί το action */
  runAction: (request: SalesActionRequest) => Promise<void>;
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Ο κοινός κύκλος ζωής ενός sales action mutation.
 *
 * Ο caller περιγράφει ΜΟΝΟ τι αλλάζει (`SalesActionRequest`) — η σειρά των
 * βημάτων, ο χειρισμός σφάλματος και ο συγχρονισμός παρακολουθημάτων ζουν εδώ.
 */
export function useSalesActionMutation(
  options: UseSalesActionMutationOptions,
): UseSalesActionMutationResult {
  const {
    unit, owners, linkedSpaces, action, unknownErrorI18nKey,
    onOpenChange, onSuccess, t, notifySuccess, notifyError,
  } = options;

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>('');
  const { checking, runExistingPropertyUpdate, ImpactDialog } = useGuardedPropertyMutation(unit);

  /** Βήματα που τρέχουν ΜΟΝΟ όταν το ακίνητο έχει γραφτεί επιτυχώς. */
  const onCommitted = useCallback((request: SalesActionRequest) => {
    notifySuccess(t('viewer.messages.updateSuccess', { ns: 'properties' }));
    onOpenChange(false);
    onSuccess?.();

    const propertyName = unit.name ?? unit.propertyName ?? '';
    const selectedSpaces = linkedSpaces.getSelectedSpaces();
    const lineItems = selectedSpaces.length > 0
      ? linkedSpaces.buildLineItems(request.invoicedAmount, propertyName)
      : undefined;

    request.dispatchEvents({ propertyName, lineItems });

    if (selectedSpaces.length > 0) {
      syncAppurtenancesForSale(
        unit.id,
        action,
        linkedSpaces.buildSyncPayload(action),
        owners,
        (err: unknown) => logger.warn('Appurtenance sync failed', { error: err, action }),
      );
    }
  }, [action, linkedSpaces, notifySuccess, onOpenChange, onSuccess, owners, t, unit]);

  const runAction = useCallback(async (request: SalesActionRequest) => {
    setSaving(true);
    setSaveError('');
    try {
      const updates = {
        commercialStatus: request.commercialStatus,
        commercial: buildSalesCommercialUpdate(unit, owners, request.commercialChanges),
      };

      await runExistingPropertyUpdate(
        unit,
        updates as Record<string, unknown>,
        async () => onCommitted(request),
      );
    } catch (err: unknown) {
      const { message, rawMessage } = resolveSalesDialogError(err, t, unknownErrorI18nKey);
      setSaveError(message);
      notifyError(message);
      logger.warn('Sales action failed', { error: rawMessage, action });
    } finally {
      setSaving(false);
    }
  }, [action, notifyError, onCommitted, owners, runExistingPropertyUpdate, t, unknownErrorI18nKey, unit]);

  return { saving, checking, saveError, impactDialog: ImpactDialog, runAction };
}
