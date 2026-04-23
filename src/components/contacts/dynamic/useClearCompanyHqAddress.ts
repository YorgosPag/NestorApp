'use client';

/**
 * useClearCompanyHqAddress — Google-level "Clear + Undo" for company HQ address
 *
 * Single optimistic click clears all 11+ HQ fields (street/number/postalCode +
 * 8-level Greek admin hierarchy) and companyAddresses[HQ] entry. Snapshot of
 * the full formData is captured before clearing; a 5s undo toast restores it
 * if the user changes their mind (Gmail pattern).
 *
 * SSoT: referenced by AddressesSectionWithFullscreen.tsx. Designed for reuse
 * by future Branch-clear action.
 *
 * @enterprise ADR-297 (Clear + Undo pattern), ADR-277 (address impact guard),
 *             ADR-280 (i18n namespace splits)
 */

import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '@/providers/NotificationProvider';
import type { ContactFormData, CompanyAddress } from '@/types/ContactFormTypes';
import { getPrimaryAddressType, type ContactAddressType } from '@/types/contacts/address-types';

const UNDO_DURATION_MS = 5000;

/** Fields of ContactFormData cleared by the HQ "Clear address" action. */
const HQ_CLEARED_FIELDS = {
  street: '',
  streetNumber: '',
  postalCode: '',
  city: '',
  settlement: '',
  settlementId: null,
  community: '',
  municipalUnit: '',
  municipality: '',
  municipalityId: null,
  regionalUnit: '',
  region: '',
  decentAdmin: '',
  majorGeo: '',
} as const satisfies Partial<ContactFormData>;

/**
 * Build a cleared HQ entry preserving the caller's semantic type (ADR-319).
 * The type is preserved so an individual stays `home`/`vacation`/...,
 * not forced back to `headquarters`.
 */
function buildClearedHqEntry(primaryType: ContactAddressType, customLabel: string | undefined): CompanyAddress {
  return {
    type: primaryType,
    customLabel: primaryType === 'other' ? customLabel : undefined,
    street: '',
    number: '',
    postalCode: '',
    city: '',
    settlementId: null,
    communityName: '',
    municipalUnitName: '',
    municipalityName: '',
    municipalityId: null,
    regionalUnitName: '',
    regionName: '',
    decentAdminName: '',
    majorGeoName: '',
  };
}

/**
 * Replace (or insert) the HQ entry in a companyAddresses array.
 * ADR-319: positional invariant — HQ is always index 0.
 */
function withClearedHqEntry(
  addresses: CompanyAddress[] | undefined,
  primaryType: ContactAddressType,
  customLabel: string | undefined,
): CompanyAddress[] {
  const list = addresses ? [...addresses] : [];
  const cleared = buildClearedHqEntry(primaryType, customLabel);
  if (list.length > 0) {
    list[0] = cleared;
  } else {
    list.unshift(cleared);
  }
  return list;
}

export interface UseClearCompanyHqAddressResult {
  /** Trigger optimistic clear + show undo toast. */
  clearHq: () => void;
  /** True when an undo window is still open. */
  hasPendingUndo: () => boolean;
}

export function useClearCompanyHqAddress(
  formData: ContactFormData,
  setFormData: React.Dispatch<React.SetStateAction<ContactFormData>> | undefined,
): UseClearCompanyHqAddressResult {
  const { t } = useTranslation(['contacts-form']);
  const { notify } = useNotifications();
  const snapshotRef = useRef<ContactFormData | null>(null);

  const clearHq = useCallback(() => {
    if (!setFormData) return;

    snapshotRef.current = formData;

    setFormData(prev => {
      const primaryType = prev.primaryAddressType ?? getPrimaryAddressType(prev.type);
      return {
        ...prev,
        ...HQ_CLEARED_FIELDS,
        companyAddresses: withClearedHqEntry(prev.companyAddresses, primaryType, prev.primaryAddressCustomLabel),
      };
    });

    notify(t('contacts-form:addressesSection.addressCleared'), {
      type: 'info',
      duration: UNDO_DURATION_MS,
      actions: [
        {
          label: t('contacts-form:addressesSection.undo'),
          onClick: () => {
            const snap = snapshotRef.current;
            if (snap) {
              setFormData(snap);
              snapshotRef.current = null;
            }
          },
        },
      ],
    });
  }, [formData, setFormData, notify, t]);

  const hasPendingUndo = useCallback(() => snapshotRef.current !== null, []);

  return { clearHq, hasPendingUndo };
}
