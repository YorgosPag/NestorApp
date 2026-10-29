/**
 * CONTACT COMMUNICATION TYPE MAPS — entity-aware label→type resolution for the AI contact handler.
 *
 * Extracted from contact-handler.ts: the maps are data, the resolvers are the only
 * readers of that data, and keeping the pair together is what stops a new entity
 * being added to one half and forgotten in the other.
 *
 * SSoT: CommunicationConfigs.ts defines the UI types; these maps resolve AI label→type.
 *
 * @module services/ai-pipeline/tools/handlers/contact-communication-types
 */

import { inferPhoneType } from '@/server/lib/phone-line-type';
import { phoneOwnerKindOf, type PhoneOwnerKind, type PhoneType } from '@/lib/contact/phone-type-vocabulary';
import { DEFAULT_EMAIL_TYPE, type EmailType } from '@/lib/contact/email-type-vocabulary';
import { DEFAULT_WEBSITE_TYPE, type WebsiteType } from '@/lib/contact/website-type-vocabulary';
import type { SocialPlatform } from '@/lib/contact/social-media-type-vocabulary';
// ============================================================================
// ENTITY-AWARE TYPE MAPS — Different types per contact entity (individual/company/service)
// SSoT: CommunicationConfigs.ts defines UI types; these maps resolve AI label→type
// ============================================================================

/** Ο κάτοχος — ΕΝΑΣ ορισμός με το λεξιλόγιο τύπου τηλεφώνου (`lib/contact/phone-type-vocabulary.ts`). */
export type ContactEntity = PhoneOwnerKind;

// ── PHONE TYPE MAPS ── (τιμές δεμένες στη ρίζα `PhoneType`· ότι ανήκουν στο υποσύνολο του κατόχου το φυλάει άγκυρα)
const PHONE_INDIVIDUAL_MAP: Record<string, PhoneType> = {
  'εργασία': 'work', 'δουλειά': 'work', 'work': 'work', 'γραφείο': 'work',
  'σπίτι': 'home', 'home': 'home',
  'κινητό': 'mobile', 'mobile': 'mobile',
  'σταθερό': 'home', 'landline': 'home',
  'fax': 'fax', 'φαξ': 'fax',
};
const PHONE_COMPANY_MAP: Record<string, PhoneType> = {
  'κύριο': 'main', 'main': 'main', 'κεντρικό': 'main', 'εργασία': 'main', 'work': 'main',
  'τμήμα': 'department', 'department': 'department',
  'γραμματεία': 'secretariat', 'secretariat': 'secretariat',
  'πωλήσεις': 'sales', 'sales': 'sales',
  'υποστήριξη': 'support', 'support': 'support',
  'fax': 'fax', 'φαξ': 'fax',
};
const PHONE_SERVICE_MAP: Record<string, PhoneType> = {
  'κύριο': 'main', 'main': 'main', 'κεντρικό': 'main', 'εργασία': 'main', 'work': 'main',
  'τμήμα': 'department', 'department': 'department',
  'γραμματεία': 'secretariat', 'secretariat': 'secretariat',
  'helpdesk': 'helpdesk', 'κέντρο': 'helpdesk',
  'fax': 'fax', 'φαξ': 'fax',
};
// ── EMAIL TYPE MAPS ── (δεμένοι στη ρίζα `EmailType`· υποσύνολο κατόχου = άγκυρα, ADR-327 §8.5.4)
const EMAIL_INDIVIDUAL_MAP: Record<string, EmailType> = {
  'προσωπικό': 'personal', 'personal': 'personal', 'προσωπικά': 'personal',
  'εργασία': 'work', 'δουλειά': 'work', 'work': 'work', 'γραφείο': 'work',
};
const EMAIL_COMPANY_MAP: Record<string, EmailType> = {
  'γενικό': 'general', 'general': 'general', 'εργασία': 'general', 'work': 'general',
  'τμήμα': 'department', 'department': 'department',
  'πωλήσεις': 'sales', 'sales': 'sales',
  'υποστήριξη': 'support', 'support': 'support',
  'πληροφορίες': 'info', 'info': 'info',
};
const EMAIL_SERVICE_MAP: Record<string, EmailType> = {
  'γενικό': 'general', 'general': 'general', 'εργασία': 'general', 'work': 'general',
  'τμήμα': 'department', 'department': 'department',
  'γραμματεία': 'secretariat', 'secretariat': 'secretariat',
  'πληροφορίες': 'info', 'info': 'info',
};
// ── WEBSITE TYPE MAPS ── (δεμένοι στη ρίζα `WebsiteType`)
const WEBSITE_INDIVIDUAL_MAP: Record<string, WebsiteType> = {
  'personal': 'personal', 'προσωπικό': 'personal', 'προσωπική': 'personal',
  'company': 'company', 'εταιρικό': 'company', 'εταιρεία': 'company',
  'portfolio': 'portfolio', 'blog': 'blog',
};
const WEBSITE_COMPANY_MAP: Record<string, WebsiteType> = {
  'εταιρική': 'corporate', 'corporate': 'corporate', 'εταιρικό': 'corporate',
  'company': 'corporate', 'personal': 'corporate',
  'eshop': 'eshop', 'e-shop': 'eshop', 'κατάστημα': 'eshop',
  'blog': 'blog', 'ιστολόγιο': 'blog',
};
const WEBSITE_SERVICE_MAP: Record<string, WebsiteType> = {
  'επίσημη': 'official', 'official': 'official', 'personal': 'official', 'company': 'official',
  'eservices': 'eServices', 'ηλεκτρονικές': 'eServices',
  'portal': 'portal', 'πύλη': 'portal',
};
// ── SOCIAL MEDIA PLATFORM MAP (same for all entity types) ──
const SOCIAL_PLATFORM_MAP: Record<string, SocialPlatform> = {
  'facebook': 'facebook', 'fb': 'facebook',
  'twitter': 'twitter', 'x': 'twitter',
  'linkedin': 'linkedin',
  'instagram': 'instagram', 'insta': 'instagram',
  'youtube': 'youtube',
  'github': 'github',
  'tiktok': 'tiktok',
  'whatsapp': 'whatsapp',
  'telegram': 'telegram',
};
// ── ENTITY-AWARE DEFAULTS ── ζουν στις ρίζες (`DEFAULT_EMAIL_TYPE` / `DEFAULT_WEBSITE_TYPE`), όχι εδώ.
/** Οι χάρτες ετικέτας→τύπου ανά κάτοχο — εκτίθενται για την άγκυρα «κάθε τιμή ∈ υποσύνολο του κατόχου». */
export const PHONE_LABEL_MAPS: Readonly<Record<ContactEntity, Readonly<Record<string, PhoneType>>>> = {
  individual: PHONE_INDIVIDUAL_MAP, company: PHONE_COMPANY_MAP, service: PHONE_SERVICE_MAP,
};
export const EMAIL_LABEL_MAPS: Readonly<Record<ContactEntity, Readonly<Record<string, EmailType>>>> = {
  individual: EMAIL_INDIVIDUAL_MAP, company: EMAIL_COMPANY_MAP, service: EMAIL_SERVICE_MAP,
};
export const WEBSITE_LABEL_MAPS: Readonly<Record<ContactEntity, Readonly<Record<string, WebsiteType>>>> = {
  individual: WEBSITE_INDIVIDUAL_MAP, company: WEBSITE_COMPANY_MAP, service: WEBSITE_SERVICE_MAP,
};
/** ΕΝΑΣ τρόπος ανάγνωσης χάρτη: μόνο ΔΙΚΑ του κλειδιά (`'constructor'` δεν είναι ετικέτα — `map[label]` θα έδινε συνάρτηση). */
function lookupOwn<T extends string>(map: Readonly<Record<string, T>>, label: string): T | undefined {
  return Object.hasOwn(map, label) ? map[label] : undefined;
}
// ── RESOLVER FUNCTIONS ──
export function resolvePhoneType(label: string, entity: ContactEntity, phoneNumber: string): PhoneType {
  // Χωρίς γνωστή ετικέτα ⇒ το SSoT συναγωγής (πρόσωπο: από τον αριθμό· εταιρεία/υπηρεσία: η προεπιλογή του κατόχου).
  return lookupOwn(PHONE_LABEL_MAPS[entity], label) ?? inferPhoneType(phoneNumber, entity);
}
export function resolveEmailType(label: string, entity: ContactEntity): EmailType {
  return lookupOwn(EMAIL_LABEL_MAPS[entity], label) ?? DEFAULT_EMAIL_TYPE[entity];
}
export function resolveWebsiteType(label: string, entity: ContactEntity): WebsiteType {
  return lookupOwn(WEBSITE_LABEL_MAPS[entity], label) ?? DEFAULT_WEBSITE_TYPE[entity];
}
/** Η πλατφόρμα μιας ετικέτας — `undefined` όταν δεν είναι γνωστή (τότε η ετικέτα αποθηκεύεται ως `label`). */
export function resolveSocialPlatform(label: string): SocialPlatform | undefined {
  return lookupOwn(SOCIAL_PLATFORM_MAP, label);
}
/** Determine entity type from Firestore contact data */
export function getContactEntity(contactData: Record<string, unknown>): ContactEntity {
  return phoneOwnerKindOf(contactData.type);
}
/** Check if a label was resolved via an entity-aware map (to decide if label should be stored) */
export function resolvedInMap(label: string, entity: ContactEntity, commType: 'phone' | 'email' | 'website'): boolean {
  const maps = { phone: PHONE_LABEL_MAPS, email: EMAIL_LABEL_MAPS, website: WEBSITE_LABEL_MAPS } as const;
  return lookupOwn<string>(maps[commType][entity], label) !== undefined;
}
