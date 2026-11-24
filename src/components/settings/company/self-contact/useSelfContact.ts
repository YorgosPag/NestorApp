'use client';

/**
 * @fileoverview **Η επαφή του χώρου στις Ρυθμίσεις** — φόρτωση · σύνδεση · δημιουργία · αποσύνδεση (ADR-951).
 * @module components/settings/company/self-contact/useSelfContact
 *
 * 🔑 Κάθε πράξη απαντά με την ΙΔΙΑ όψη με το `GET` — ο browser **δεν** συνθέτει κατάσταση μόνος του (ο server ξέρει
 *    αν άλλαξε και η πρόταση). Μία πράξη τη φορά (`pending`).
 * 🔑 Η σύνδεση με «χρήση της εικόνας της επαφής» αλλάζει το λογότυπο του χώρου ⇒ `onBrandLogoChanged`, ώστε η ενότητα
 *    λογοτύπου να ξαναδιαβάσει από τον server (μία πηγή, καμία τοπική αντιγραφή).
 */

import { useCallback, useEffect, useState } from 'react';

import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { ApiClientError } from '@/lib/api/api-client-types';
import type {
  SelfContactLogoChoice,
  SelfContactRefusal,
  SelfContactResponse,
} from '@/types/company-self-contact';

export type SelfContactProblem =
  | { readonly kind: 'refused'; readonly refusal: SelfContactRefusal }
  | { readonly kind: 'load-failed' | 'save-failed' };

export type SelfContactPending = 'link' | 'create' | 'unlink' | null;

interface SelfContactState {
  readonly loading: boolean;
  readonly view: SelfContactResponse | null;
  readonly pending: SelfContactPending;
  readonly problem: SelfContactProblem | null;
}

const INITIAL: SelfContactState = { loading: true, view: null, pending: null, problem: null };

const REFUSALS: ReadonlySet<unknown> = new Set<SelfContactRefusal>([
  'contact-not-found', 'not-a-company', 'contact-inactive', 'already-linked',
  'contact-image-unavailable', 'contact-image-refused', 'profile-nameless',
]);

const isSelfContactRefusal = (value: unknown): value is SelfContactRefusal => REFUSALS.has(value);

function problemOf(error: unknown): SelfContactProblem {
  if (error instanceof ApiClientError && (error.statusCode === 409 || error.statusCode === 422)) {
    const body = error.errorBody;
    const refusal = typeof body === 'object' && body !== null ? (body as { refusal?: unknown }).refusal : undefined;
    if (isSelfContactRefusal(refusal)) return { kind: 'refused', refusal };
  }
  return { kind: 'save-failed' };
}

export function useSelfContact(onBrandLogoChanged: () => void) {
  const [state, setState] = useState<SelfContactState>(INITIAL);

  useEffect(() => {
    let alive = true;
    apiClient
      .get<SelfContactResponse>(API_ROUTES.COMPANY_SELF_CONTACT)
      .then((view) => { if (alive) setState((s) => ({ ...s, loading: false, view })); })
      .catch(() => { if (alive) setState((s) => ({ ...s, loading: false, problem: { kind: 'load-failed' } })); });
    return () => { alive = false; };
  }, []);

  const run = useCallback(async (pending: Exclude<SelfContactPending, null>, send: () => Promise<SelfContactResponse>) => {
    if (state.pending !== null) return false;
    setState((s) => ({ ...s, pending, problem: null }));
    try {
      const view = await send();
      setState((s) => ({ ...s, pending: null, view }));
      return true;
    } catch (error) {
      setState((s) => ({ ...s, pending: null, problem: problemOf(error) }));
      return false;
    }
  }, [state.pending]);

  const link = useCallback(async (contactId: string, logoChoice: SelfContactLogoChoice) => {
    const done = await run('link', () =>
      apiClient.put<SelfContactResponse>(API_ROUTES.COMPANY_SELF_CONTACT, { contactId, logoChoice }));
    if (done && logoChoice === 'use-contact-image') onBrandLogoChanged();
  }, [run, onBrandLogoChanged]);

  const create = useCallback(
    () => run('create', () => apiClient.post<SelfContactResponse>(API_ROUTES.COMPANY_SELF_CONTACT, {})),
    [run],
  );

  const unlink = useCallback(
    () => run('unlink', () => apiClient.delete<SelfContactResponse>(API_ROUTES.COMPANY_SELF_CONTACT)),
    [run],
  );

  return { state, link, create, unlink };
}
