/**
 * @fileoverview **Η ΣΕΛΙΔΑ ΤΗΣ ΟΠΟΙΑΣ Η ΔΙΕΥΘΥΝΣΗ ΕΙΝΑΙ ΔΙΑΠΙΣΤΕΥΤΗΡΙΟ** — μία δήλωση για όλες.
 * @related ADR-876 · lib/tokens/signed-token (η γραμματική του συνδέσμου) · `__tests__/credential-link-page.test.ts` (η άγκυρα)
 * @module lib/tokens/credential-link-page
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΜΕΤΡΗΜΕΝΟ 2026-09-23 (ADR-876 Ε6)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Έντεκα σελίδες με `[token]` στη διεύθυνση. Κάθε μία έγραφε **μόνη της** τις δηλώσεις
 * της, και είχαν αποκλίνει:
 *
 *  · `referrer: 'no-referrer'` σε **4 από τις 11** (invite · email/preferences ·
 *    hours-question · και το `n/[id]`, που δεν έχει καν token)· **έλειπε** από vendor ·
 *    attendance · contact · mandate · card-email · showcase·
 *  · **καμία δήλωση** στα `shared/[token]` και `shared/po/[token]`: είναι `'use client'`,
 *    δηλαδή **δομικά ανίκανες** να εξάγουν metadata — ούτε καν `noindex`.
 *
 * Η ίδια ερώτηση («είναι αυτή η διεύθυνση κλειδί;») είχε έντεκα απαντήσεις γραμμένες με το
 * χέρι — το σχήμα του ADR-749.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΙ ΔΗΛΩΝΕΙ, ΚΑΙ ΓΙΑΤΙ ΤΟ ΚΑΘΕΝΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * · **`noindex, nofollow`** — ο σύνδεσμος **είναι** διαπιστευτήριο· ευρετηρίαση = διαρροή
 *   χωρίς καμία επίθεση.
 * · **`no-referrer`** — το token ζει στη διαδρομή. Το καθολικό
 *   `strict-origin-when-cross-origin` (middleware) κόβει ήδη τη διαδρομή σε **ξένο**
 *   origin, αλλά όχι στο **ίδιο**: κάθε αίτημα της σελίδας (εικόνες, scripts, API) θα
 *   κουβαλούσε το token σε `Referer`, και όποιος τρίτος πόρος φορτωθεί ποτέ θα το έπαιρνε
 *   ολόκληρο αν αλλάξει η καθολική πολιτική.
 *   ⚠️ **Τι ΔΕΝ λύνει**: όσα API δέχονται το token **στη διαδρομή τους**
 *   (`/api/vendor/quote/<token>`) το γράφουν ούτως ή άλλως σε access log. Δηλωμένο ανοιχτό
 *   στο ADR-876 (Βήμα 4: token σε σώμα/κεφαλίδα, αποθήκευση ως hash).
 *
 * ⚠️ **ΤΟ `force-dynamic` ΔΕΝ ΖΕΙ ΕΔΩ, ΚΑΙ ΔΕΝ ΜΠΟΡΕΙ**: το Next διαβάζει το `dynamic` με
 * **στατική ανάλυση** του ίδιου του αρχείου της σελίδας — μια επανεξαγωγή από εδώ θα
 * αγνοούνταν σιωπηλά. Το απαιτεί λοιπόν η **άγκυρα**, ανά σελίδα. Και φέρνει μαζί του το
 * `Cache-Control: private, no-cache, no-store` του Next για δυναμική απόδοση: καμία
 * ενδιάμεση μνήμη δεν κρατά σελίδα που ανοίγει με κλειδί.
 */

import type { Metadata } from 'next';

import { decodeRouteParam } from '@/lib/routes/route-param';

/** Οι δηλώσεις metadata κάθε σελίδας-διαπιστευτηρίου — εξάγονται αυτούσιες ή επεκτείνονται. */
export const CREDENTIAL_LINK_PAGE_METADATA = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
} as const satisfies Metadata;

/**
 * Τα props σελίδας-διαπιστευτηρίου με **προσυμπλήρωση απάντησης** από το email (`?answer=`).
 * ⚠️ Το `answer` είναι μόνο προσυμπλήρωση — η σελίδα **δεν** γράφει (Safe Links ανοίγουν πρώτοι).
 */
export interface CredentialLinkAnswerPageProps {
  readonly params: Promise<{ token: string }>;
  readonly searchParams: Promise<{ answer?: string | string[] }>;
}

/** Το αποκωδικοποιημένο token + η ωμή προσυμπλήρωση — ο ΕΝΑΣ αναγνώστης (CHECK 3.28). */
export async function readCredentialLinkAnswerPage(
  props: CredentialLinkAnswerPageProps,
): Promise<{ token: string; answer: string | string[] | undefined }> {
  const [{ token: raw }, { answer }] = await Promise.all([props.params, props.searchParams]);
  return { token: decodeRouteParam(raw), answer };
}
