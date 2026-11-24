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
import { isContactType } from '@/constants/contact-types';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { ApiClientError } from '@/lib/api/api-client-types';
import type {
  CreateSelfContactRequest,
  SelfContactLogoChoice,
  SelfContactRefusal,
  SelfContactResponse,
  SelfContactTaxIdHolder,
} from '@/types/company-self-contact';

export type SelfContactProblem =
  | { readonly kind: 'refused'; readonly refusal: Exclude<SelfContactRefusal, 'tax-id-taken'> }
  /** Η δημιουργία αρνήθηκε: άλλες επαφές έχουν ήδη το ΑΦΜ — η οθόνη τις δείχνει και ζητά ρητή επιβεβαίωση. */
  | { readonly kind: 'tax-id-taken'; readonly holders: readonly SelfContactTaxIdHolder[] }
  | { readonly kind: 'load-failed' | 'save-failed' };

export type SelfContactPending = 'link' | 'create' | 'unlink' | null;

interface SelfContactState {
  readonly loading: boolean;
  readonly view: SelfContactResponse | null;
  readonly pending: SelfContactPending;
  readonly problem: SelfContactProblem | null;
}

const INITIAL: SelfContactState = { loading: true, view: null, pending: null, problem: null };

type PlainRefusal = Exclude<SelfContactRefusal, 'tax-id-taken'>;

const REFUSALS: ReadonlySet<unknown> = new Set<PlainRefusal>([
  'contact-not-found', 'not-a-company', 'contact-inactive', 'already-linked',
  'contact-image-unavailable', 'contact-image-refused', 'profile-nameless',
]);

const isPlainRefusal = (value: unknown): value is PlainRefusal => REFUSALS.has(value);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** Ο server είναι αξιόπιστος, αλλά η απάντηση είναι δίκτυο: κάθε κάτοχος ελέγχεται πριν φτάσει στην οθόνη. */
function isTaxIdHolder(value: unknown): value is SelfContactTaxIdHolder {
  return isRecord(value) && typeof value.contactId === 'string' && typeof value.displayName === 'string'
    && isContactType(value.type) && typeof value.archived === 'boolean';
}

function problemOf(error: unknown): SelfContactProblem {
  if (error instanceof ApiClientError && (error.statusCode === 409 || error.statusCode === 422)) {
    const body = isRecord(error.errorBody) ? error.errorBody : {};
    if (body.refusal === 'tax-id-taken' && Array.isArray(body.holders)) {
      return { kind: 'tax-id-taken', holders: body.holders.filter(isTaxIdHolder) };
    }
    if (isPlainRefusal(body.refusal)) return { kind: 'refused', refusal: body.refusal };
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

  /** `confirmDuplicateTaxId`: μόνο αφού ο άνθρωπος είδε τους κατόχους του ίδιου ΑΦΜ (`tax-id-taken`). */
  const create = useCallback((confirmDuplicateTaxId = false) => {
    const body: CreateSelfContactRequest = confirmDuplicateTaxId ? { confirmDuplicateTaxId } : {};
    return run('create', () => apiClient.post<SelfContactResponse>(API_ROUTES.COMPANY_SELF_CONTACT, body));
  }, [run]);

  /** «Άκυρο» στην επιβεβαίωση — τίποτα δεν γράφτηκε, απλώς κλείνει. */
  const dismissProblem = useCallback(() => setState((s) => ({ ...s, problem: null })), []);

  const unlink = useCallback(
    () => run('unlink', () => apiClient.delete<SelfContactResponse>(API_ROUTES.COMPANY_SELF_CONTACT)),
    [run],
  );

  return { state, link, create, unlink, dismissProblem };
}
