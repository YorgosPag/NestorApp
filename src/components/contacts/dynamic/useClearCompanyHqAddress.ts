'use client';

/**
 * useClearCompanyHqAddress — Google-level "Clear + Undo" for company HQ address
 *
 * Single optimistic click clears the HQ entry (`companyAddresses[0]`, ADR-319) — street/number/
 * postalCode, the 8-level Greek admin hierarchy and the pin. ADR-332 §D30 Φάση 2: the HQ lives in
 * ONE container, so there are no flat form fields to clear alongside it. Snapshot of
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
import type { ContactAddressType } from '@/types/contacts/address-types';
import { COMPANY_ADDRESS_HIERARCHY_CLEARED } from './addresses-section-form-mapping';
import { commitHq } from './contact-hq-state';

const UNDO_DURATION_MS = 5000;

/**
 * Build a cleared HQ entry preserving the caller's semantic type (ADR-319).
 * The type is preserved so an individual stays `home`/`vacation`/...,
 * not forced back to `headquarters`.
 */
function buildClearedHqEntry(primaryType: ContactAddressType, customLabel: string | undefined): CompanyAddress {
  // ADR-332 D27 Β-ΙΙ: **νέα** εγγραφή — χωρίς `id` και χωρίς θέση. Ο «Καθαρισμός» σβήνει και
  // την πινέζα· αλλιώς μια θέση χωρίς κείμενο θα μετρούσε ως περιεχόμενο (D20) και θα επιβίωνε.
  return {
    type: primaryType,
    customLabel: primaryType === 'other' ? customLabel : undefined,
    street: '',
    number: '',
    postalCode: '',
    city: '',
    ...COMPANY_ADDRESS_HIERARCHY_CLEARED,
  };
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

    // Ο τύπος της έδρας (ADR-319) επιβιώνει: ένα φυσικό πρόσωπο μένει `home`/`vacation`/…
    setFormData(prev => commitHq(prev, (hq) => buildClearedHqEntry(hq.type, hq.customLabel)));

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
