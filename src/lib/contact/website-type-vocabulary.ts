/**
 * 🌐 SSoT — **το λεξιλόγιο του τύπου ιστοσελίδας** μιας επαφής, και **ποιο υποσύνολό του προσφέρει κάθε κάτοχος**.
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-29, ADR-327 §8.5.4 — ίδια κλάση με το ☎️)**: ο τύπος `WebsiteInfo` δήλωνε
 * `personal|company|portfolio|blog|other`, ενώ η φόρμα εταιρείας γράφει `corporate/eshop` και της υπηρεσίας
 * `official/eServices/portal`. Και ο `EnterpriseContactSaver` έγραφε `company` σε εταιρεία **και** υπηρεσία — τιμή που
 * καμία από τις δύο φόρμες δεν προσφέρει ⇒ κενή λίστα «Τύπος».
 *
 * 🔑 **ΕΝΑ σύνολο, υποσύνολα ανά κάτοχο** — όπως το Google People API (`Url.type`: home/work/blog/profile/homePage…
 * + ελεύθερο κείμενο) και το vCard RFC 6350 `URL;TYPE`. Η ρίζα είναι η ΕΝΩΣΗ· το ελεύθερο κείμενο ζει στο `label`.
 *
 * @module lib/contact/website-type-vocabulary
 */

import type { ContactOwnerKind } from './contact-owner-kind';
import { isOfferedBy, isVocabularyMember } from './owned-type-vocabulary';

/** Όλοι οι τύποι ιστοσελίδας που μπορεί να έχει αποθηκευμένη επαφή (CHECK 3.73 — ρίζα `website-type`). */
export const WEBSITE_TYPES = [
  'personal', 'company', 'portfolio', 'blog', 'corporate', 'eshop', 'official', 'eServices', 'portal', 'other',
] as const;

export type WebsiteType = (typeof WEBSITE_TYPES)[number];

/** Οι τύποι που **προσφέρει** κάθε κάτοχος, με τη σειρά της λίστας της φόρμας. */
export const WEBSITE_TYPES_BY_OWNER = {
  individual: ['personal', 'company', 'portfolio', 'blog', 'other'],
  company: ['corporate', 'eshop', 'blog', 'other'],
  service: ['official', 'eServices', 'portal', 'other'],
} as const satisfies Readonly<Record<ContactOwnerKind, readonly WebsiteType[]>>;

export type OfferedWebsiteType<O extends ContactOwnerKind> = (typeof WEBSITE_TYPES_BY_OWNER)[O][number];

/** Ο πίνακας ετικετών ενός κατόχου: ΥΠΟΧΡΕΩΤΙΚΑ κάθε τύπος που προσφέρει, και μόνο τιμές της ρίζας. */
export type WebsiteTypeLabels<O extends ContactOwnerKind> = Record<OfferedWebsiteType<O>, string> & Partial<Record<WebsiteType, string>>;

/** Η προεπιλογή κάθε κατόχου — ό,τι γράφεται όταν κανείς δεν είπε κάτι άλλο. */
export const DEFAULT_WEBSITE_TYPE = {
  individual: 'personal',
  company: 'corporate',
  service: 'official',
} as const satisfies { readonly [O in ContactOwnerKind]: OfferedWebsiteType<O> };

export function isWebsiteType(value: unknown): value is WebsiteType {
  return isVocabularyMember(WEBSITE_TYPES, value);
}

export function isWebsiteTypeOfferedFor(type: unknown, owner: ContactOwnerKind): type is WebsiteType {
  return isOfferedBy<WebsiteType>(WEBSITE_TYPES_BY_OWNER, owner, type);
}
