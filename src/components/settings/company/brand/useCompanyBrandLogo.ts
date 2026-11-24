'use client';

/**
 * @fileoverview **Το λογότυπο του χώρου στην οθόνη ρυθμίσεων** — φόρτωση · ανέβασμα · αφαίρεση (ADR-ACC-018 §17).
 * @module components/settings/company/brand/useCompanyBrandLogo
 *
 * 🔑 **Αισιόδοξο**: η τοπική προεπισκόπηση φαίνεται αμέσως, και αντικαθίσταται από το αποθηκευμένο μόλις απαντήσει ο
 *    server· σε αποτυχία επιστρέφει το προηγούμενο, με κατονομασμένο λόγο.
 * 🔑 **Έγκαιρη κρίση στον browser** με την ΙΔΙΑ πολιτική του server (`judgeBrandLogoInput`) — μόνο για γρήγορο,
 *    κατανοητό μήνυμα. Ο φρουρός είναι ο server.
 * 🔑 Μία πράξη τη φορά (`pending`): δεύτερο κλικ όσο τρέχει η πρώτη δεν στέλνει τίποτα.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { ApiClientError } from '@/lib/api/api-client-types';
import { BRAND_LOGO_FORM_FIELD, isBrandLogoRefusal, judgeBrandLogoInput, type BrandLogoRefusal } from '@/lib/company/brand-logo-policy';
import { CONTENT_SIGNATURE_HEAD_BYTES } from '@/lib/files/content-signature';
import type { CompanyBrandLogo, CompanyBrandLogoResponse } from '@/types/company-brand';

export type BrandLogoProblem = { readonly kind: 'refused'; readonly refusal: BrandLogoRefusal } | { readonly kind: 'load-failed' | 'save-failed' };

interface CompanyBrandLogoState {
  readonly loading: boolean;
  readonly brandLogo: CompanyBrandLogo | null;
  /** Τοπική προεπισκόπηση όσο ανεβαίνει ένα νέο αρχείο (`blob:` URL). */
  readonly optimisticPreview: string | null;
  readonly pending: 'upload' | 'remove' | null;
  readonly problem: BrandLogoProblem | null;
}

const INITIAL: CompanyBrandLogoState = { loading: true, brandLogo: null, optimisticPreview: null, pending: null, problem: null };

/** Η κατονομασμένη άρνηση του server, ή «δεν αποθηκεύτηκε». */
function problemOf(error: unknown): BrandLogoProblem {
  if (error instanceof ApiClientError && error.statusCode === 422) {
    const body = error.errorBody;
    const refusal = typeof body === 'object' && body !== null ? (body as { refusal?: unknown }).refusal : undefined;
    if (isBrandLogoRefusal(refusal)) return { kind: 'refused', refusal };
  }
  return { kind: 'save-failed' };
}

export function useCompanyBrandLogo() {
  const [state, setState] = useState<CompanyBrandLogoState>(INITIAL);
  const previewRef = useRef<string | null>(null);

  const releasePreview = useCallback(() => {
    if (previewRef.current !== null) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
  }, []);

  useEffect(() => {
    let alive = true;
    apiClient
      .get<CompanyBrandLogoResponse>(API_ROUTES.COMPANY_BRAND_LOGO)
      .then((data) => { if (alive) setState((s) => ({ ...s, loading: false, brandLogo: data.brandLogo })); })
      .catch(() => { if (alive) setState((s) => ({ ...s, loading: false, problem: { kind: 'load-failed' } })); });
    return () => { alive = false; releasePreview(); };
  }, [releasePreview]);

  const upload = useCallback(async (file: File) => {
    if (state.pending !== null) return;
    const head = new Uint8Array(await file.slice(0, CONTENT_SIGNATURE_HEAD_BYTES).arrayBuffer());
    const early = judgeBrandLogoInput(head, file.size);
    if (early !== null) {
      setState((s) => ({ ...s, problem: { kind: 'refused', refusal: early } }));
      return;
    }
    releasePreview();
    previewRef.current = URL.createObjectURL(file);
    setState((s) => ({ ...s, pending: 'upload', problem: null, optimisticPreview: previewRef.current }));
    const form = new FormData();
    form.append(BRAND_LOGO_FORM_FIELD, file);
    try {
      const data = await apiClient.put<CompanyBrandLogoResponse>(API_ROUTES.COMPANY_BRAND_LOGO, form);
      setState((s) => ({ ...s, pending: null, optimisticPreview: null, brandLogo: data.brandLogo }));
    } catch (error) {
      setState((s) => ({ ...s, pending: null, optimisticPreview: null, problem: problemOf(error) }));
    } finally {
      releasePreview();
    }
  }, [state.pending, releasePreview]);

  const remove = useCallback(async () => {
    if (state.pending !== null || state.brandLogo === null) return;
    const previous = state.brandLogo;
    setState((s) => ({ ...s, pending: 'remove', problem: null, brandLogo: null }));
    try {
      await apiClient.delete<CompanyBrandLogoResponse>(API_ROUTES.COMPANY_BRAND_LOGO);
      setState((s) => ({ ...s, pending: null }));
    } catch {
      setState((s) => ({ ...s, pending: null, brandLogo: previous, problem: { kind: 'save-failed' } }));
    }
  }, [state.pending, state.brandLogo]);

  return { state, upload, remove };
}
