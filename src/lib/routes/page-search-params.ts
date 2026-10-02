/**
 * @fileoverview **Το `searchParams` μιας σελίδας του App Router → `URLSearchParams`** — μία φορά.
 * @related ADR-900 §3.7 · app/(light)/offers/new/page.tsx · app/(me)/interest-check/page.tsx
 * @module lib/routes/page-search-params
 *
 * 🔑 Οι parsers του έργου (`parseProspectQuery` · `prospectAddressOf`) μιλούν `URLSearchParams` — το ίδιο
 * σχήμα που βλέπει η διαδρομή API (`request.nextUrl.searchParams`). Η σελίδα παίρνει όμως **αντικείμενο**
 * (Next.js 15: `Promise<Record<…>>`). Η μετάφραση γράφεται **εδώ**, όχι ένα αντίγραφο ανά σελίδα.
 *
 * ⚠️ **Πίνακας ⇒ παραλείπεται** (`?type=a&type=b`): δύο τιμές για ένα πεδίο δεν είναι τιμή — ίδια
 * απόφαση με το `safeReturnPath`. Ο catch-all `[...unprefixed]` **ξαναχτίζει** το ερώτημα (κρατά πίνακες)
 * και άρα έχει άλλη σημασιολογία· δεν περνά από εδώ, επίτηδες.
 *
 * **Layering**: leaf — καθαρή συνάρτηση.
 */

/** Το σχήμα του `searchParams` μιας σελίδας, αφού λυθεί η υπόσχεση. */
export type PageSearchParams = Readonly<Record<string, string | string[] | undefined>>;

/** **Αντικείμενο σελίδας → `URLSearchParams`**, μόνο με τις μονές τιμές. */
export function urlSearchParamsOf(raw: PageSearchParams): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') params.set(key, value);
  }
  return params;
}
