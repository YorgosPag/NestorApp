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

import type { SocialMediaInfo } from '@/types/contacts/contracts';
// ============================================================================
// ENTITY-AWARE TYPE MAPS — Different types per contact entity (individual/company/service)
// SSoT: CommunicationConfigs.ts defines UI types; these maps resolve AI label→type
// ============================================================================

export type ContactEntity = 'individual' | 'company' | 'service';

// ── PHONE TYPE MAPS ──
const PHONE_INDIVIDUAL_MAP: Record<string, string> = {
  'εργασία': 'work', 'δουλειά': 'work', 'work': 'work', 'γραφείο': 'work',
  'σπίτι': 'home', 'home': 'home',
  'κινητό': 'mobile', 'mobile': 'mobile',
  'σταθερό': 'home', 'landline': 'home',
  'fax': 'fax', 'φαξ': 'fax',
};
const PHONE_COMPANY_MAP: Record<string, string> = {
  'κύριο': 'main', 'main': 'main', 'κεντρικό': 'main', 'εργασία': 'main', 'work': 'main',
  'τμήμα': 'department', 'department': 'department',
  'γραμματεία': 'secretariat', 'secretariat': 'secretariat',
  'πωλήσεις': 'sales', 'sales': 'sales',
  'υποστήριξη': 'support', 'support': 'support',
  'fax': 'fax', 'φαξ': 'fax',
};
const PHONE_SERVICE_MAP: Record<string, string> = {
  'κύριο': 'main', 'main': 'main', 'κεντρικό': 'main', 'εργασία': 'main', 'work': 'main',
  'τμήμα': 'department', 'department': 'department',
  'γραμματεία': 'secretariat', 'secretariat': 'secretariat',
  'helpdesk': 'helpdesk', 'κέντρο': 'helpdesk',
  'fax': 'fax', 'φαξ': 'fax',
};
// ── EMAIL TYPE MAPS ──
const EMAIL_INDIVIDUAL_MAP: Record<string, string> = {
  'προσωπικό': 'personal', 'personal': 'personal', 'προσωπικά': 'personal',
  'εργασία': 'work', 'δουλειά': 'work', 'work': 'work', 'γραφείο': 'work',
};
const EMAIL_COMPANY_MAP: Record<string, string> = {
  'γενικό': 'general', 'general': 'general', 'εργασία': 'general', 'work': 'general',
  'τμήμα': 'department', 'department': 'department',
  'πωλήσεις': 'sales', 'sales': 'sales',
  'υποστήριξη': 'support', 'support': 'support',
  'πληροφορίες': 'info', 'info': 'info',
};
const EMAIL_SERVICE_MAP: Record<string, string> = {
  'γενικό': 'general', 'general': 'general', 'εργασία': 'general', 'work': 'general',
  'τμήμα': 'department', 'department': 'department',
  'γραμματεία': 'secretariat', 'secretariat': 'secretariat',
  'πληροφορίες': 'info', 'info': 'info',
};
// ── WEBSITE TYPE MAPS ──
const WEBSITE_INDIVIDUAL_MAP: Record<string, string> = {
  'personal': 'personal', 'προσωπικό': 'personal', 'προσωπική': 'personal',
  'company': 'company', 'εταιρικό': 'company', 'εταιρεία': 'company',
  'portfolio': 'portfolio', 'blog': 'blog',
};
const WEBSITE_COMPANY_MAP: Record<string, string> = {
  'εταιρική': 'corporate', 'corporate': 'corporate', 'εταιρικό': 'corporate',
  'company': 'corporate', 'personal': 'corporate',
  'eshop': 'eshop', 'e-shop': 'eshop', 'κατάστημα': 'eshop',
  'blog': 'blog', 'ιστολόγιο': 'blog',
};
const WEBSITE_SERVICE_MAP: Record<string, string> = {
  'επίσημη': 'official', 'official': 'official', 'personal': 'official', 'company': 'official',
  'eservices': 'eServices', 'ηλεκτρονικές': 'eServices',
  'portal': 'portal', 'πύλη': 'portal',
};
// ── SOCIAL MEDIA PLATFORM MAP (same for all entity types) ──
export const SOCIAL_PLATFORM_MAP: Record<string, SocialMediaInfo['platform']> = {
  'facebook': 'facebook', 'fb': 'facebook',
  'twitter': 'twitter', 'x': 'twitter',
  'linkedin': 'linkedin',
  'instagram': 'instagram', 'insta': 'instagram',
  'youtube': 'youtube',
  'github': 'github',
  'tiktok': 'other',
  'whatsapp': 'other',
  'telegram': 'other',
};
// ── ENTITY-AWARE DEFAULTS ──
const PHONE_DEFAULTS: Record<ContactEntity, string> = {
  individual: 'mobile', company: 'main', service: 'main',
};
const EMAIL_DEFAULTS: Record<ContactEntity, string> = {
  individual: 'personal', company: 'general', service: 'general',
};
const WEBSITE_DEFAULTS: Record<ContactEntity, string> = {
  individual: 'personal', company: 'corporate', service: 'official',
};
// ── RESOLVER FUNCTIONS ──
export function resolvePhoneType(label: string, entity: ContactEntity, phoneNumber: string): string {
  const map = entity === 'company' ? PHONE_COMPANY_MAP
    : entity === 'service' ? PHONE_SERVICE_MAP
    : PHONE_INDIVIDUAL_MAP;
  if (map[label]) return map[label];
  // Individual: auto-detect by Greek prefix (2xx = home/landline, 69x = mobile)
  if (entity === 'individual') {
    return phoneNumber.startsWith('2') ? 'home' : 'mobile';
  }
  return PHONE_DEFAULTS[entity];
}
export function resolveEmailType(label: string, entity: ContactEntity): string {
  const map = entity === 'company' ? EMAIL_COMPANY_MAP
    : entity === 'service' ? EMAIL_SERVICE_MAP
    : EMAIL_INDIVIDUAL_MAP;
  return map[label] ?? EMAIL_DEFAULTS[entity];
}
export function resolveWebsiteType(label: string, entity: ContactEntity): string {
  const map = entity === 'company' ? WEBSITE_COMPANY_MAP
    : entity === 'service' ? WEBSITE_SERVICE_MAP
    : WEBSITE_INDIVIDUAL_MAP;
  return map[label] ?? WEBSITE_DEFAULTS[entity];
}
/** Determine entity type from Firestore contact data */
export function getContactEntity(contactData: Record<string, unknown>): ContactEntity {
  const t = String(contactData.type ?? 'individual');
  if (t === 'company') return 'company';
  if (t === 'service') return 'service';
  return 'individual';
}
/** Check if a label was resolved via an entity-aware map (to decide if label should be stored) */
export function resolvedInMap(label: string, entity: ContactEntity, commType: 'phone' | 'email' | 'website'): boolean {
  const maps: Record<string, Record<ContactEntity, Record<string, string>>> = {
    phone: { individual: PHONE_INDIVIDUAL_MAP, company: PHONE_COMPANY_MAP, service: PHONE_SERVICE_MAP },
    email: { individual: EMAIL_INDIVIDUAL_MAP, company: EMAIL_COMPANY_MAP, service: EMAIL_SERVICE_MAP },
    website: { individual: WEBSITE_INDIVIDUAL_MAP, company: WEBSITE_COMPANY_MAP, service: WEBSITE_SERVICE_MAP },
  };
  return !!maps[commType][entity][label];
}
