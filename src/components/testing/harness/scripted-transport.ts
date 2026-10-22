/**
 * @fileoverview **Ο ΕΝΑΣ ψεύτικος μεταφορέας των γκαλερί καταστάσεων** — αρχιτεκτονική MSW, χωρίς νέα εξάρτηση.
 * @related ADR-844 §11 (η πρώτη γκαλερί) · ADR-916 Φ-Β2 (η δεύτερη — εξήχθη τότε, N.0.2) ·
 *          `components/contact/testing/FirstContactProofHarness.tsx` · `components/handover-invite/testing/HandoverInviteHarness.tsx`
 * @module components/testing/harness/scripted-transport
 *
 * 🏆 Το πρότυπο των μεγάλων για «γκαλερί χωρίς backend» είναι το **MSW**: **ΕΝΑΣ** handler που **δρομολογεί πάνω στο
 * αίτημα**. Το σχήμα το κρατάμε ακέραιο· την υλοποίηση **όχι** — η ραφή υπάρχει ήδη (μπάλωμα του `apiClient.post` σε
 * `useEffect`, με επαναφορά): μηδέν νέο πακέτο, μηδέν service worker στο `public/`.
 *
 * ⛔ **ΕΝΑ μπάλωμα ανά σελίδα, ποτέ ανά πάνελ**: το `apiClient` είναι singleton· δώδεκα πάνελ που μπαλώνουν το ίδιο
 * `post` πατούν το ένα το άλλο. Ο **δρομολογητής** αποφασίζει ανά αίτημα (ταυτότητα σεναρίου στο σώμα).
 * 🔴 **ΔΡΟΜΟΛΟΓΕΙ, ΔΕΝ ΚΑΤΑΠΙΝΕΙ**: ό,τι δεν αναγνωρίζει πάει στον **αληθινό** μεταφορέα — αλλιώς θα έσπαγε το κέλυφος
 * γύρω από τη γκαλερί (ειδοποιήσεις, ταυτότητα) και θα κατηγορούσαμε την οθόνη.
 * 🔴 **Το σενάριο είναι ΩΜΗ απάντηση διακομιστή** (κωδικός + σώμα), ποτέ έτοιμη έκβαση: έτσι η οθόνη την περνά από
 * τον **πραγματικό** αποκωδικοποιητή της — γκαλερί που τον παρακάμπτει δείχνει πράσινες οθόνες για σπασμένο σύστημα.
 *
 * **Layering**: dev-only. Καμία γνώση τομέα.
 */

import React from 'react';

import { ApiClientError, apiClient, type ApiRequestConfig } from '@/lib/api/enterprise-api-client';

/** Η απάντηση που «στέλνει» η διαδρομή: `status < 400` ⇒ επιτυχία με αυτό το σώμα· αλλιώς άρνηση. */
export interface ScriptedReply {
  readonly status: number;
  readonly body: Record<string, unknown>;
}

/** `undefined` ⇒ «δεν είναι δικό μου» — το αίτημα πάει στον αληθινό μεταφορέα. */
export type ScriptedRoute = (url: string, body: unknown) => ScriptedReply | undefined;

/** Τα query params ενός `GET`, όπως τα δίνει ο καλών στο `config.params`. */
export type ScriptedParams = Readonly<Record<string, string | number | boolean>>;

/**
 * Ο δρομολογητής του `GET` (ADR-916 §5.13 — η λήψη αρχείου). `Blob` ⇒ τα bytes που «στέλνει» ο διακομιστής·
 * `ScriptedReply` ⇒ ωμή απάντηση (άρνηση με τον κωδικό της)· `undefined` ⇒ στον αληθινό μεταφορέα.
 */
export type ScriptedGetRoute = (url: string, params: ScriptedParams) => ScriptedReply | Blob | undefined;

/**
 * **Το σφάλμα που θα είχε πετάξει ο μεταφορέας**, ταυτόσημο σε σχήμα.
 * ⛔ **ΠΟΤΕ σκέτο `new Error(...)`**: ο `apiErrorBodyOf` απαιτεί `ApiClientError` και διαβάζει **μόνο** το `errorBody`·
 * ένα απλό `Error` θα έκανε **κάθε** σενάριο `failed` — η γκαλερί θα έδειχνε την ίδια οθόνη με δώδεκα ονόματα.
 */
export function scriptedApiRejection(label: string, reply: ScriptedReply): ApiClientError {
  const code = typeof reply.body.error === 'string' ? reply.body.error : undefined;
  return new ApiClientError(`harness: scripted ${label}`, reply.status, code, undefined, undefined, undefined, reply.body);
}

/** Ο φρουρός του σώματος — έρχεται ως `unknown` και **οφείλει** να ελεγχθεί. */
export function scriptedBodyField(body: unknown, field: string): string {
  if (body === null || typeof body !== 'object') return '';
  const candidate = (body as Record<string, unknown>)[field];
  return typeof candidate === 'string' ? candidate : '';
}

/**
 * **Εγκαθίσταται μία φορά, επαναφέρεται πάντα.** Επιστρέφει `armed`.
 *
 * 🔴 **ΤΟ `armed` ΕΙΝΑΙ Η ΣΕΙΡΑ, ΟΧΙ ΔΙΑΚΟΣΜΗΣΗ**: στον React τα effects των **παιδιών** τρέχουν **πριν** του γονιού —
 * χωρίς αυτό κάθε πάνελ θα υπέβαλλε πριν σταθεί ο μεταφορέας (αληθινές κλήσεις στη δημόσια διαδρομή). ⛔ Όχι
 * `requestAnimationFrame` / `setTimeout`: θα ήταν στοίχημα στον χρόνο.
 * ⚠️ Το `bind` πριν την αντικατάσταση: το `apiClient` είναι στιγμιότυπο κλάσης και η μέθοδος θέλει το `this` της.
 * ⚠️ Ο δρομολογητής πρέπει να είναι **σταθερός** (σε εμβέλεια module): νέα συνάρτηση ανά απόδοση θα ξαναμπάλωνε.
 */
export function useScriptedPost(route: ScriptedRoute): boolean {
  return useScriptedTransport(route);
}

type RequestConfig = Omit<ApiRequestConfig, 'method' | 'body'>;

/**
 * 🔴 Επαναφορά = ΑΚΡΙΒΩΣ ό,τι υπήρχε. Η μέθοδος ζει στο πρωτότυπο της κλάσης· η παλιά επαναφορά έγραφε πίσω τη
 *    **δεμένη** εκδοχή ως ιδιοκτησία του στιγμιοτύπου — ξένη σκιά στο singleton μετά από κάθε γκαλερί (άγκυρα Γ1).
 */
function restorerOf(method: 'get' | 'post'): () => void {
  const ownBefore = Object.getOwnPropertyDescriptor(apiClient, method);
  return () => {
    if (ownBefore === undefined) Reflect.deleteProperty(apiClient, method);
    else Object.defineProperty(apiClient, method, ownBefore);
  };
}

function patchPost(route: ScriptedRoute): () => void {
  const restore = restorerOf('post');
  const originalPost = apiClient.post.bind(apiClient);
  apiClient.post = async <T = unknown>(url: string, body?: Record<string, unknown> | unknown, config?: RequestConfig): Promise<T> => {
    const reply = route(url, body);
    if (reply === undefined) return originalPost<T>(url, body, config);
    if (reply.status >= 400) throw scriptedApiRejection(url, reply);
    return reply.body as T;
  };
  return restore;
}

function patchGet(route: ScriptedGetRoute): () => void {
  const restore = restorerOf('get');
  const originalGet = apiClient.get.bind(apiClient);
  apiClient.get = async <T = unknown>(url: string, config?: RequestConfig): Promise<T> => {
    const reply = route(url, config?.params ?? {});
    if (reply === undefined) return originalGet<T>(url, config);
    if (reply instanceof Blob) return reply as T;
    if (reply.status >= 400) throw scriptedApiRejection(url, reply);
    return reply.body as T;
  };
  return restore;
}

/**
 * **ΕΝΑ μπάλωμα ανά σελίδα** για `post` και — όταν δοθεί — `get`. Ίδιοι κανόνες με το `useScriptedPost`: `armed` = η
 * σειρά, οι δρομολογητές **σταθεροί** (σε εμβέλεια module), επαναφορά πάντα.
 */
export function useScriptedTransport(route: ScriptedRoute, getRoute?: ScriptedGetRoute): boolean {
  const [armed, setArmed] = React.useState(false);

  React.useEffect(() => {
    const restorePost = patchPost(route);
    const restoreGet = getRoute === undefined ? () => undefined : patchGet(getRoute);
    setArmed(true);

    return () => {
      restoreGet();
      restorePost();
      setArmed(false);
    };
  }, [route, getRoute]);

  return armed;
}
