'use client';

import React, { useState, useEffect } from 'react';
import '@/lib/design-system';
import { UniversalCommunicationManager } from '@/components/contacts/dynamic/UniversalCommunicationManager';
import type { ContactEntityType } from '@/components/contacts/dynamic/communication';
import { getEntityAwareCommunicationConfig } from '@/components/contacts/dynamic/communication';
import type { PhoneInfo, EmailInfo, WebsiteInfo, SocialMediaInfo } from '@/types/contacts';
import {
  phonesToCommunicationItems, emailsToCommunicationItems, websitesToCommunicationItems, socialToCommunicationItems,
  communicationItemsToPhones, communicationItemsToEmails, communicationItemsToWebsites, communicationItemsToSocial,
} from '@/components/contacts/dynamic/communication/utils/communication-item-mappers';

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
  const [_isDesktop, setIsDesktop] = useState(false);

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
    <div className="w-full space-y-2">
      {/* 📱 PHONES - UniversalCommunicationManager */}
      <UniversalCommunicationManager
        config={phoneConfig}
        items={phonesToCommunicationItems(normalizedPhones)}
        disabled={disabled}
        onChange={(items) => {
          const phones = communicationItemsToPhones(items, contactType);
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