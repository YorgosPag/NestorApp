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

export const communicationItemsToEmails = (items: CommunicationItem[]): EmailInfo[] =>
  Array.isArray(items) ? items.map(item => ({
    email: item.email || '',
    type: item.type as EmailInfo['type'],
    isPrimary: item.isPrimary || false,
    label: item.label || ''
  })) : [];

export const communicationItemsToWebsites = (items: CommunicationItem[]): WebsiteInfo[] =>
  Array.isArray(items) ? items.map(item => ({
    url: item.url || '',
    type: item.type as WebsiteInfo['type'],
    label: item.label || ''
  })) : [];

export const communicationItemsToSocial = (items: CommunicationItem[]): SocialMediaInfo[] =>
  Array.isArray(items) ? items.map(item => ({
    platform: (item.platform || 'other') as SocialMediaInfo['platform'],
    username: item.username || '',
    url: item.url || '',
    type: (item.type || 'personal') as SocialMediaInfo['type'],
    label: item.label || ''
  })) : [];
