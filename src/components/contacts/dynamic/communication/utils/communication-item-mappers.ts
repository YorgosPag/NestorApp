// ============================================================================
// 🔄 COMMUNICATION ITEM MAPPERS — ΕΝΑ σύνορο ανάμεσα στα πεδία επαφής και στο `CommunicationItem` της φόρμας
// ============================================================================
//
// Ήταν αντιγραμμένα αυτούσια σε `DynamicContactArrays.tsx` και `RelationshipFormFields.tsx` (jscpd: 2 κλώνοι,
// 2026-10-29) — με `item.type as PhoneInfo['type']`, ένα τυφλό cast που έκρυβε ότι η φόρμα εταιρείας γράφει
// `main/department/…`, τιμές που ο τύπος `PhoneInfo` δεν δήλωνε καν (ADR-327 §8.5.4).
//
// ============================================================================

import type { CommunicationItem } from '../types/CommunicationTypes';
import type { EmailInfo, PhoneInfo, SocialMediaInfo, WebsiteInfo } from '@/types/contacts';
import { DEFAULT_PHONE_TYPE, isPhoneType, phoneOwnerKindOf } from '@/lib/contact/phone-type-vocabulary';
import { contactOwnerKindOf } from '@/lib/contact/contact-owner-kind';
import { DEFAULT_EMAIL_TYPE, isEmailType } from '@/lib/contact/email-type-vocabulary';
import { DEFAULT_WEBSITE_TYPE, isWebsiteType } from '@/lib/contact/website-type-vocabulary';
import { DEFAULT_SOCIAL_MEDIA_TYPE, isSocialMediaType, isSocialPlatform } from '@/lib/contact/social-media-type-vocabulary';

export const phonesToCommunicationItems = (phones: PhoneInfo[]): CommunicationItem[] =>
  Array.isArray(phones) ? phones.map(phone => ({
    type: phone.type,
    label: phone.label,
    isPrimary: phone.isPrimary,
    number: phone.number,
    countryCode: phone.countryCode,
    extension: phone.extension
  })) : [];

export const emailsToCommunicationItems = (emails: EmailInfo[]): CommunicationItem[] =>
  Array.isArray(emails) ? emails.map(email => ({
    type: email.type,
    label: email.label,
    isPrimary: email.isPrimary,
    email: email.email
  })) : [];

export const websitesToCommunicationItems = (websites: WebsiteInfo[]): CommunicationItem[] =>
  Array.isArray(websites) ? websites.map(website => ({
    type: website.type,
    label: website.label,
    url: website.url
  })) : [];

export const socialToCommunicationItems = (
  socialMedia: SocialMediaInfo[],
  defaultType: string = 'personal'
): CommunicationItem[] =>
  Array.isArray(socialMedia) ? socialMedia.map(social => ({
    type: social.type || defaultType,
    label: social.label,
    username: social.username,
    url: social.url,
    platform: social.platform
  })) : [];

/**
 * Γραμμές φόρμας → `PhoneInfo[]`. Ο τύπος περνά από τη ρίζα `PhoneType`: έγκυρη τιμή **διατηρείται** (ποτέ σιωπηλή
 * αλλαγή αποθηκευμένου τύπου)· ό,τι δεν ανήκει στη ρίζα ⇒ η προεπιλογή του **κατόχου** (`contactType`).
 */
export const communicationItemsToPhones = (items: CommunicationItem[], contactType: unknown): PhoneInfo[] => {
  const fallback = DEFAULT_PHONE_TYPE[phoneOwnerKindOf(contactType)];
  return Array.isArray(items) ? items.map(item => {
    const ext = (item.extension as string | undefined)?.trim();
    return {
      number: item.number || '',
      type: isPhoneType(item.type) ? item.type : fallback,
      isPrimary: item.isPrimary || false,
      label: item.label || '',
      countryCode: item.countryCode || '+30',
      ...(ext ? { extension: ext } : {})
    };
  }) : [];
};

/** Ίδιο σύνορο με τα τηλέφωνα (ADR-327 §8.5.4): έγκυρος τύπος διατηρείται, άγνωστος ⇒ η προεπιλογή του κατόχου. */
export const communicationItemsToEmails = (items: CommunicationItem[], contactType: unknown): EmailInfo[] => {
  const fallback = DEFAULT_EMAIL_TYPE[contactOwnerKindOf(contactType)];
  return Array.isArray(items) ? items.map(item => ({
    email: item.email || '',
    type: isEmailType(item.type) ? item.type : fallback,
    isPrimary: item.isPrimary || false,
    label: item.label || ''
  })) : [];
};

export const communicationItemsToWebsites = (items: CommunicationItem[], contactType: unknown): WebsiteInfo[] => {
  const fallback = DEFAULT_WEBSITE_TYPE[contactOwnerKindOf(contactType)];
  return Array.isArray(items) ? items.map(item => ({
    url: item.url || '',
    type: isWebsiteType(item.type) ? item.type : fallback,
    label: item.label || ''
  })) : [];
};

export const communicationItemsToSocial = (items: CommunicationItem[], contactType: unknown): SocialMediaInfo[] => {
  const fallback = DEFAULT_SOCIAL_MEDIA_TYPE[contactOwnerKindOf(contactType)];
  return Array.isArray(items) ? items.map(item => ({
    platform: isSocialPlatform(item.platform) ? item.platform : 'other',
    username: item.username || '',
    url: item.url || '',
    type: isSocialMediaType(item.type) ? item.type : fallback,
    label: item.label || ''
  })) : [];
};
