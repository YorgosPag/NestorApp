'use client';

/**
 * =============================================================================
 * useCommercialDraft — η κατάσταση ΕΝΟΣ επεξεργαστή διάθεσης
 * =============================================================================
 *
 * Το πρόχειρο (κατάσταση + ποσά ως κείμενο) ενός χώρου ή ακινήτου, με τις δύο πράξεις που
 * κάνει ο άνθρωπος και **ένα** δρόμο προς το σώμα του PATCH (`commercialPatchOf`). Το
 * χρησιμοποιούν η κάρτα «Εμπορικά» των θέσεων/αποθηκών και η γρήγορη επεξεργασία της
 * καρτέλας κτιρίου (ADR-777 §8.60.18) — **μία** κατάσταση, όχι δύο αντίγραφα `useState`.
 *
 * @module components/shared/commercial/useCommercialDraft
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CommercialStatus } from '@/constants/commercial-statuses';
import {
  commercialDraftOf,
  commercialPatchOf,
  type CommercialDraft,
  type CommercialPatch,
  type CommercialPriceField,
  type CommercialSource,
} from '@/lib/properties/commercial-draft';

export interface CommercialDraftState {
  readonly draft: CommercialDraft;
  readonly setStatus: (status: CommercialStatus) => void;
  readonly setPrice: (field: CommercialPriceField, raw: string) => void;
  /** Ξαναγεμίζει το πρόχειρο από ένα αποθηκευμένο έγγραφο (νέα επιλογή · έναρξη επεξεργασίας). */
  readonly reset: (source: CommercialSource) => void;
  /** Το σώμα του PATCH απέναντι στο αποθηκευμένο — **μόνο** ό,τι άλλαξε. */
  readonly patchAgainst: (source: CommercialSource) => CommercialPatch;
}

export function useCommercialDraft(initial: CommercialSource = {}): CommercialDraftState {
  const [draft, setDraft] = useState<CommercialDraft>(() => commercialDraftOf(initial));

  const setStatus = useCallback((commercialStatus: CommercialStatus) => {
    setDraft((prev) => ({ ...prev, commercialStatus }));
  }, []);

  const setPrice = useCallback((field: CommercialPriceField, raw: string) => {
    setDraft((prev) => ({ ...prev, [field]: raw }));
  }, []);

  const reset = useCallback((source: CommercialSource) => {
    setDraft(commercialDraftOf(source));
  }, []);

  const patchAgainst = useCallback(
    (source: CommercialSource) => commercialPatchOf(draft, source),
    [draft],
  );

  return useMemo(
    () => ({ draft, setStatus, setPrice, reset, patchAgainst }),
    [draft, setStatus, setPrice, reset, patchAgainst],
  );
}

/**
 * Το πρόχειρο ενός **χώρου** σε σελίδα λεπτομερειών: ξαναγεμίζει όταν επιλεγεί **άλλος** χώρος
 * (όχι σε κάθε ανανέωση του ίδιου — η επεξεργασία του ανθρώπου δεν σβήνεται από ένα refetch).
 * Ίδιος κανόνας με τη φόρμα της Γενικής καρτέλας, γραμμένος **μία** φορά για θέσεις και αποθήκες.
 */
export function useSpaceCommercial(entity: CommercialSource & { readonly id: string }): CommercialDraftState {
  const commercial = useCommercialDraft(entity);
  const { reset } = commercial;
  const latest = useRef(entity);
  latest.current = entity;

  useEffect(() => {
    reset(latest.current);
  }, [entity.id, reset]);

  return commercial;
}
