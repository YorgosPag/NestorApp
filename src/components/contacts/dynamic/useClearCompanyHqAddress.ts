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

/** Build a cleared HQ entry preserving type='headquarters'. */
function buildClearedHqEntry(): CompanyAddress {
  return {
    type: 'headquarters',
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

/** Replace (or insert) the HQ entry in a companyAddresses array. */
function withClearedHqEntry(addresses: CompanyAddress[] | undefined): CompanyAddress[] {
  const list = addresses ? [...addresses] : [];
  const hqIdx = list.findIndex(a => a.type === 'headquarters');
  const cleared = buildClearedHqEntry();
  if (hqIdx >= 0) {
    list[hqIdx] = cleared;
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

    setFormData(prev => ({
      ...prev,
      ...HQ_CLEARED_FIELDS,
      companyAddresses: withClearedHqEntry(prev.companyAddresses),
    }));

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
