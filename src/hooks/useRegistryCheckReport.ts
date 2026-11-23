'use client';

/**
 * @fileoverview **Η ΜΙΑ αρχή του «Έλεγχος στο μητρώο»** στην οθόνη — ανάγνωση της κρίσης + η πράξη.
 * @module hooks/useRegistryCheckReport
 *
 * Καταναλωτές: άδεια επαγγελματία (ADR-915 §40.7 Φ2 · `useLicenceRegistryCheck`) και επαφή-εταιρεία στο ΓΕΜΗ
 * (ADR-948 §8 Βήμα 7). Πριν υπήρχε ΜΟΝΟ ο πρώτος· ο δεύτερος θα ήταν σχεδόν πιστό αντίγραφο (N.0.2) ⇒ ένα hook.
 *
 * 🔑 Η ανάγνωση (GET) **δεν** ρωτά το μητρώο — κρίνει τα αποθηκευμένα· μόνο το πάτημα (POST) ρωτά.
 * 🔑 Ξαναδιαβάζει όταν αλλάξει το `reloadKey` (π.χ. ο **αποθηκευμένος** αριθμός): η κρίση εξαρτάται από αυτόν.
 * 🔑 Η απάντηση αντικαθιστά την αναφορά **ολόκληρη** — καμία συγχώνευση με παλιά κατάσταση.
 * 🔑 Ένα πάτημα τη φορά (`useInFlightAction`): το δεύτερο αγνοείται, δεν γίνεται δεύτερη κλήση έξω.
 *
 * 🔴 **Δύο αποτυχίες, δύο κατοικίες** (ADR-948 §8.7 — εύρημα 503 της ζωντανής επαλήθευσης, 2026-11-23):
 *    - η **ανάγνωση** απέτυχε ⇒ `state: failed` — δεν έχουμε τίποτα να δείξουμε·
 *    - η **πράξη** απέτυχε ⇒ `actionFailure` — η τελευταία γνωστή αναφορά **μένει** στην οθόνη. Πριν, η αποτυχία
 *      του POST έσβηνε όλη την αναφορά και έδειχνε το μήνυμα της **ανάγνωσης** (λάθος λόγια), και στην άδεια
 *      χανόταν και το κουμπί. Πρακτική Gmail/Stripe Dashboard: τα δεδομένα μένουν, η πράξη λέει γιατί δεν έγινε.
 * 🔑 Κάθε αποτυχία πάει στο `reportApiFailure` (ADR-327 §7.5): λέει **ποιος** απάντησε (server μας ή proxy) —
 *    ακριβώς η ερώτηση που έμεινε αναπάντητη στο 503 της 2026-11-23.
 * ⚠️ Οι επαναλήψεις 5xx γίνονται **ήδη** στον `apiClient` (POST με `Idempotency-Key`, backoff, `Retry-After`) —
 *    εδώ φτάνει μόνο ό,τι αστόχησε και μετά από αυτές. Μην προσθέσεις δεύτερο βρόχο.
 */

import { useCallback, useEffect, useState } from 'react';

import { useInFlightAction } from '@/hooks/useInFlightAction';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { reportApiFailure, type ApiFailureClassification } from '@/lib/telemetry/api-failure-report';

export type RegistryCheckReportState<R> =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'ready'; readonly report: R };

/**
 * **Γιατί δεν έγινε η πράξη** — ό,τι χρειάζεται ο άνθρωπος για να αποφασίσει τι κάνει μετά.
 * - `unavailable`: δεν απάντησε κανείς ή απάντησε «όχι τώρα» (δίκτυο · 502/503/504) ⇒ ξανά σε λίγο.
 *   ⚠️ **Δεν** υπόσχεται «τίποτα δεν άλλαξε»: σε 504 / κομμένη σύνδεση ο handler μπορεί να έγραψε (ADR-853 Ε3).
 * - `rate-limited`: 429 — πολλοί έλεγχοι σε λίγο χρόνο ⇒ ξανά σε ένα λεπτό (το φρένο αρνείται **πριν** τον handler).
 * - `forbidden`: 403 — ο ρόλος δεν επιτρέπει την πράξη ⇒ η επανάληψη δεν βοηθά.
 * - `failed`: ό,τι άλλο (500 · απρόσμενο).
 */
export type RegistryCheckActionFailure = 'unavailable' | 'rate-limited' | 'forbidden' | 'failed';

const UNAVAILABLE_STATUSES: ReadonlySet<number> = new Set([502, 503, 504]);

/** Η μετάφραση της ΜΙΑΣ ταξινόμησης (`classifyApiFailure`) σε λόγο προς τον άνθρωπο. Καθαρή συνάρτηση. */
export function registryCheckActionFailureOf(failure: ApiFailureClassification): RegistryCheckActionFailure {
  if (failure.kind === 'network') return 'unavailable';
  if (failure.kind !== 'http' || failure.status === undefined) return 'failed';
  if (UNAVAILABLE_STATUSES.has(failure.status)) return 'unavailable';
  if (failure.status === 429) return 'rate-limited';
  if (failure.status === 403) return 'forbidden';
  return 'failed';
}

export interface RegistryCheckReportHandle<R> {
  readonly state: RegistryCheckReportState<R>;
  /** `true` όσο τρέχει η πράξη — δέσε το σε `disabled` **και** σε `aria-busy`. */
  readonly checking: boolean;
  /** Γιατί απέτυχε το **τελευταίο** πάτημα — `null` αν πέτυχε ή δεν έγινε. Η αναφορά στο `state` μένει. */
  readonly actionFailure: RegistryCheckActionFailure | null;
  /** Η πράξη (POST). Αποτυχία ⇒ `actionFailure`· ποτέ σιωπή, ποτέ σβήσιμο της τελευταίας γνωστής αναφοράς. */
  readonly check: () => Promise<void>;
}

/**
 * @param operation σταθερό όνομα της πράξης για τη διάγνωση (π.χ. `contact-gemi-registry-check`) — ετικέτα Sentry.
 */
export function useRegistryCheckReport<R>(url: string, reloadKey: string, operation: string): RegistryCheckReportHandle<R> {
  const [state, setState] = useState<RegistryCheckReportState<R>>({ kind: 'loading' });
  const [actionFailure, setActionFailure] = useState<RegistryCheckActionFailure | null>(null);
  const { isRunning, run } = useInFlightAction();

  useEffect(() => {
    let alive = true;
    setState({ kind: 'loading' });
    setActionFailure(null);
    apiClient
      .get<R>(url)
      .then((report) => { if (alive) setState({ kind: 'ready', report }); })
      .catch((cause: unknown) => {
        reportApiFailure(`${operation}-read`, cause);
        if (alive) setState({ kind: 'failed' });
      });
    return () => { alive = false; };
  }, [url, reloadKey, operation]);

  const check = useCallback(
    () =>
      run(async () => {
        setActionFailure(null);
        try {
          setState({ kind: 'ready', report: await apiClient.post<R>(url) });
        } catch (cause) {
          setActionFailure(registryCheckActionFailureOf(reportApiFailure(operation, cause)));
        }
      }),
    [run, url, operation],
  );

  return { state, checking: isRunning, actionFailure, check };
}
