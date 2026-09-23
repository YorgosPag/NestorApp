/**
 * @fileoverview **«Ποια διαδρομή ζήτησε ο άνθρωπος;»** — για όποιον ΔΕΝ τη βλέπει.
 * @module lib/http/request-path
 * @see ADR-848 §9 #3 · ADR-875 §14 (Φ2.2)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ένα **layout** του App Router δεν λαμβάνει τη διαδρομή του αιτήματος — δηλωμένο
 * όριο του Next.js (τα layouts μοιράζονται ανάμεσα σε διαδρομές). Γι' αυτό ο φρουρός
 * ταυτότητας του `/o/[workspace]` έστελνε τον ανώνυμο σε **σκέτο** `/login`, ενώ το
 * δίχτυ `[...unprefixed]` —που ξέρει τη δική του διαδρομή— έδινε `loginHref(path)`.
 * Ο σελιδοδείκτης `/o/<γραφείο>/projects/<έργο>` κατέληγε, μετά τη σύνδεση, στο ταμπλό.
 *
 * 🔑 Η λύση είναι η **τεκμηριωμένη** μεταφορά του Next.js: το middleware —που **βλέπει**
 * τη διαδρομή— την προωθεί ως **κεφαλίδα αιτήματος** (`NextResponse.next({ request:
 * { headers } })`), και ο Server Component τη διαβάζει με `headers()`. Είναι το ίδιο
 * σχήμα με το `X-NEXT-INTL-LOCALE` του next-intl.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΘΕΣΗ ΕΜΠΙΣΤΟΣΥΝΗΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Το middleware **γράφει πάνω** σε ό,τι έστειλε ο πελάτης (`set`, όχι `append`) —
 *    μια πλαστή κεφαλίδα από έξω δεν επιβιώνει ως τον Server Component.
 * 2. Η τιμή **δεν** αποφασίζει τίποτα: περνά **μόνο** στο `loginHref`, του οποίου ο
 *    φρουρός `safeReturnPath` δέχεται αποκλειστικά διαδρομή του ίδιου origin (ADR-848 §4).
 *    Απούσα ή άκυρη ⇒ σκέτο `/login`: χάνεται η ευκολία, ποτέ η ασφάλεια.
 *
 * ⚠️ **Το εσωτερικό `_rsc` ΔΕΝ φτάνει εδώ**: ο προσαρμογέας του Next (15.5, `adapter.js`
 *    → `stripInternalSearchParams`) το αφαιρεί **πριν** το middleware. Άρα το `search`
 *    είναι ό,τι έγραψε ο άνθρωπος — και ένα αίτημα RSC δίνει την ίδια τιμή με το HTML.
 *
 * ⛔ **Edge-safe**: καμία εισαγωγή πέρα από τύπους. Τη διαβάζει ο
 *    `server/auth/login-return.ts` — ποτέ ωμό `headers().get(...)` σε σελίδα.
 */

import type { NextRequest } from 'next/server';

/** Η κεφαλίδα — **μία**, για τον συγγραφέα (middleware) και τον αναγνώστη (server). */
export const REQUEST_PATH_HEADER = 'x-nestor-request-path' as const;

/** `pathname + search` — ό,τι ζήτησε ο άνθρωπος, χωρίς origin (ο κριτής του είναι το `safeReturnPath`). */
export function requestPathOf(request: Pick<NextRequest, 'nextUrl'>): string {
  return `${request.nextUrl.pathname}${request.nextUrl.search}`;
}

/**
 * Οι κεφαλίδες του αιτήματος **με** τη διαδρομή του — για `NextResponse.next({ request: { headers } })`.
 * Αντίγραφο, ποτέ μετάλλαξη του `request.headers`.
 */
export function withRequestPath(request: Pick<NextRequest, 'nextUrl' | 'headers'>): Headers {
  const headers = new Headers(request.headers);
  headers.set(REQUEST_PATH_HEADER, requestPathOf(request));
  return headers;
}
