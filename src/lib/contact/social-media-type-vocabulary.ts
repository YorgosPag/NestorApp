/**
 * 💬 SSoT — **το λεξιλόγιο του τύπου λογαριασμού social** μιας επαφής, και **ποιο υποσύνολό του προσφέρει κάθε κάτοχος**.
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-29, ADR-327 §8.5.4 — η τελευταία της κλάσης ☎️/📧/🌐)**: οι τιμές δηλώνονταν χωριστά
 * στον τύπο `SocialMediaInfo`, στις λίστες του `CommunicationConfigs` και στους πίνακες ετικετών, και ο mapper της
 * φόρμας έκανε τυφλό `as` με προεπιλογή `personal` — τιμή που η φόρμα εταιρείας/υπηρεσίας δεν προσφέρει.
 *
 * Η **πλατφόρμα** (`facebook`, `linkedin`…) είναι άλλο λεξιλόγιο, ίδιο για κάθε κάτοχο — δεν ζει εδώ.
 *
 * @module lib/contact/social-media-type-vocabulary
 */

import type { ContactOwnerKind } from './contact-owner-kind';
import { isOfferedBy, isVocabularyMember } from './owned-type-vocabulary';

/** Όλοι οι τύποι λογαριασμού social που μπορεί να έχει αποθηκευμένη επαφή (CHECK 3.73 — ρίζα `social-media-type`). */
export const SOCIAL_MEDIA_TYPES = [
  'personal', 'professional', 'business', 'corporate', 'marketing', 'official', 'informational', 'other',
] as const;

export type SocialMediaType = (typeof SOCIAL_MEDIA_TYPES)[number];

/** Οι τύποι που **προσφέρει** κάθε κάτοχος, με τη σειρά της λίστας της φόρμας. */
export const SOCIAL_MEDIA_TYPES_BY_OWNER = {
  individual: ['personal', 'professional', 'business', 'other'],
  company: ['corporate', 'marketing', 'other'],
  service: ['official', 'informational', 'other'],
} as const satisfies Readonly<Record<ContactOwnerKind, readonly SocialMediaType[]>>;

export type OfferedSocialMediaType<O extends ContactOwnerKind> = (typeof SOCIAL_MEDIA_TYPES_BY_OWNER)[O][number];

/** Ο πίνακας ετικετών ενός κατόχου: ΥΠΟΧΡΕΩΤΙΚΑ κάθε τύπος που προσφέρει, και μόνο τιμές της ρίζας. */
export type SocialMediaTypeLabels<O extends ContactOwnerKind> =
  Record<OfferedSocialMediaType<O>, string> & Partial<Record<SocialMediaType, string>>;

/** Η προεπιλογή κάθε κατόχου — ό,τι γράφεται όταν κανείς δεν είπε κάτι άλλο. */
export const DEFAULT_SOCIAL_MEDIA_TYPE = {
  individual: 'personal',
  company: 'corporate',
  service: 'official',
} as const satisfies { readonly [O in ContactOwnerKind]: OfferedSocialMediaType<O> };

export function isSocialMediaType(value: unknown): value is SocialMediaType {
  return isVocabularyMember(SOCIAL_MEDIA_TYPES, value);
}

export function isSocialMediaTypeOfferedFor(type: unknown, owner: ContactOwnerKind): type is SocialMediaType {
  return isOfferedBy<SocialMediaType>(SOCIAL_MEDIA_TYPES_BY_OWNER, owner, type);
}

/**
 * Οι **πλατφόρμες** — άλλος άξονας από τον τύπο, ίδιος για κάθε κάτοχο (CHECK 3.73 — ρίζα `social-platform`).
 * Ζούσαν σε τρία σημεία που διαφωνούσαν: ο τύπος `SocialMediaInfo` και η φόρμα ήξεραν `tiktok/whatsapp/telegram`, ο
 * χάρτης του AI τα έγραφε `other`, και ο mapper της φόρμας έκανε τυφλό `as`.
 */
export const SOCIAL_PLATFORMS = [
  'linkedin', 'facebook', 'instagram', 'twitter', 'youtube', 'github', 'tiktok', 'whatsapp', 'telegram', 'other',
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export function isSocialPlatform(value: unknown): value is SocialPlatform {
  return isVocabularyMember(SOCIAL_PLATFORMS, value);
}
