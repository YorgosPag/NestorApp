'use client';

import React, { useState, useEffect } from 'react';
import { UniversalCommunicationManager } from '@/components/contacts/dynamic/UniversalCommunicationManager';
import type { CommunicationItem, ContactEntityType } from '@/components/contacts/dynamic/communication';
import { COMMUNICATION_CONFIGS, getEntityAwareCommunicationConfig } from '@/components/contacts/dynamic/communication';
import type { PhoneInfo, EmailInfo, WebsiteInfo, SocialMediaInfo } from '@/types/contacts';

// ============================================================================
// 🏢 ENTERPRISE DYNAMIC CONTACT ARRAYS - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΗ ΕΚΔΟΣΗ
// ============================================================================

/**
 * ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ ΟΛΟΚΛΗΡΩΘΗΚΕ!
 *
 * Αντικατέστησε τα 4 ξεχωριστά managers:
 * - PhoneManager ❌ → UniversalCommunicationManager ✅
 * - EmailManager ❌ → UniversalCommunicationManager ✅
 * - WebsiteManager ❌ → UniversalCommunicationManager ✅
 * - SocialMediaManager ❌ → UniversalCommunicationManager ✅
 *
 * SINGLE SOURCE OF TRUTH για όλη την επικοινωνία!
 */

export interface DynamicContactArraysProps {
  phones?: PhoneInfo[];
  emails?: EmailInfo[];
  websites?: WebsiteInfo[];
  socialMedia?: SocialMediaInfo[];
  disabled?: boolean;
  /** Entity type — determines which communication type labels to show */
  contactType?: ContactEntityType;
  onPhonesChange?: (phones: PhoneInfo[]) => void;
  onEmailsChange?: (emails: EmailInfo[]) => void;
  onWebsitesChange?: (websites: WebsiteInfo[]) => void;
  onSocialMediaChange?: (socialMedia: SocialMediaInfo[]) => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * 🔄 MAPPER FUNCTIONS - Μετατρέπουν τα legacy types σε CommunicationItem format
 */

const phonesToCommunicationItems = (phones: PhoneInfo[]): CommunicationItem[] =>
  Array.isArray(phones) ? phones.map(phone => ({
    type: phone.type,
    label: phone.label,
    isPrimary: phone.isPrimary,
    number: phone.number,
    countryCode: phone.countryCode
  })) : [];

const emailsToCommunicationItems = (emails: EmailInfo[]): CommunicationItem[] =>
  Array.isArray(emails) ? emails.map(email => ({
    type: email.type,
    label: email.label,
    isPrimary: email.isPrimary,
    email: email.email
  })) : [];

const websitesToCommunicationItems = (websites: WebsiteInfo[]): CommunicationItem[] =>
  Array.isArray(websites) ? websites.map(website => ({
    type: website.type,
    label: website.label,
    url: website.url
  })) : [];

const socialToCommunicationItems = (
  socialMedia: SocialMediaInfo[],
  defaultType: string = 'personal'
): CommunicationItem[] =>
  Array.isArray(socialMedia) ? socialMedia.map(social => ({
    type: defaultType,
    label: social.label,
    username: social.username,
    url: social.url,
    platform: social.platform
  })) : [];

const communicationItemsToPhones = (items: CommunicationItem[]): PhoneInfo[] =>
  Array.isArray(items) ? items.map(item => ({
    number: item.number || '',
    type: item.type as PhoneInfo['type'],
    isPrimary: item.isPrimary || false,
    label: item.label || '',
    countryCode: item.countryCode || '+30'
  })) : [];

const communicationItemsToEmails = (items: CommunicationItem[]): EmailInfo[] =>
  Array.isArray(items) ? items.map(item => ({
    email: item.email || '',
    type: item.type as EmailInfo['type'],
    isPrimary: item.isPrimary || false,
    label: item.label || ''
  })) : [];

const communicationItemsToWebsites = (items: CommunicationItem[]): WebsiteInfo[] =>
  Array.isArray(items) ? items.map(item => ({
    url: item.url || '',
    type: item.type as WebsiteInfo['type'],
    label: item.label || ''
  })) : [];

const communicationItemsToSocial = (items: CommunicationItem[]): SocialMediaInfo[] =>
  Array.isArray(items) ? items.map(item => ({
    platform: (item.platform || item.type) as SocialMediaInfo['platform'],
    username: item.username || '',
    url: item.url || '',
    label: item.label || ''
  })) : [];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function DynamicContactArrays({
  phones = [],
  emails = [],
  websites = [],
  socialMedia = [],
  disabled = false,
  contactType = 'individual',
  onPhonesChange,
  onEmailsChange,
  onWebsitesChange,
  onSocialMediaChange
}: DynamicContactArraysProps) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkIsDesktop = () => setIsDesktop(window.innerWidth >= 768);
    checkIsDesktop();
    window.addEventListener('resize', checkIsDesktop);
    return () => window.removeEventListener('resize', checkIsDesktop);
  }, []);

  // 🔄 NORMALIZE DATA - Pass actual data without forcing defaults
  // The UniversalCommunicationManager will handle empty states properly
  const normalizedPhones = Array.isArray(phones) ? phones : [];
  const normalizedEmails = Array.isArray(emails) ? emails : [];

  // Entity-aware configs: show appropriate type labels per contact type
  const phoneConfig = getEntityAwareCommunicationConfig('phone', contactType);
  const emailConfig = getEntityAwareCommunicationConfig('email', contactType);
  const websiteConfig = getEntityAwareCommunicationConfig('website', contactType);
  const socialConfig = getEntityAwareCommunicationConfig('social', contactType);

  return (
    <div className="w-full space-y-8">
      {/* 📱 PHONES - UniversalCommunicationManager */}
      <UniversalCommunicationManager
        config={phoneConfig}
        items={phonesToCommunicationItems(normalizedPhones)}
        disabled={disabled}
        onChange={(items) => {
          const phones = communicationItemsToPhones(items);
          onPhonesChange?.(phones);
        }}
      />

      {/* 📧 EMAILS - UniversalCommunicationManager */}
      <UniversalCommunicationManager
        config={emailConfig}
        items={emailsToCommunicationItems(normalizedEmails)}
        disabled={disabled}
        onChange={(items) => {
          const emails = communicationItemsToEmails(items);
          onEmailsChange?.(emails);
        }}
      />

      {/* 🌐 WEBSITES - UniversalCommunicationManager */}
      <UniversalCommunicationManager
        config={websiteConfig}
        items={websitesToCommunicationItems(websites)}
        disabled={disabled}
        onChange={(items) => {
          const websites = communicationItemsToWebsites(items);
          onWebsitesChange?.(websites);
        }}
      />

      {/* 📱 SOCIAL MEDIA - UniversalCommunicationManager */}
      <UniversalCommunicationManager
        config={socialConfig}
        items={socialToCommunicationItems(socialMedia, socialConfig.defaultType)}
        disabled={disabled}
        onChange={(items) => {
          const social = communicationItemsToSocial(items);
          onSocialMediaChange?.(social);
        }}
      />
    </div>
  );
}

export default DynamicContactArrays;