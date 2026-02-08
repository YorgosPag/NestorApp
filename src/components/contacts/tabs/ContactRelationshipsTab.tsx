'use client';

import React from 'react';
import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { ContactRelationshipManager } from '@/components/contacts/relationships/ContactRelationshipManager';
import { RelationshipsSummary } from '@/components/contacts/relationships/RelationshipsSummary';
import { RelationshipProvider } from '@/components/contacts/relationships/context/RelationshipProvider';

interface ContactRelationshipsTabProps {
  data: Contact;
  additionalData?: {
    formData?: ContactFormData;
    disabled?: boolean;
    relationshipsMode?: 'summary' | 'full';
  };
}

/**
 * 🏢 ENTERPRISE: Contact Relationships Tab
 *
 * Centralized tab για διαχείριση σχέσεων επαφής.
 * Χρησιμοποιεί το existing relationship management system.
 */
export function ContactRelationshipsTab({
  data,
  additionalData,
}: ContactRelationshipsTabProps) {
  // Extract data from additionalData prop (UniversalTabsRenderer pattern)
  const {
    disabled = true,
    relationshipsMode = 'full',
  } = additionalData || {};
  return (
    <div className="space-y-6">
      <RelationshipProvider contactId={data.id!} contactType={data.type}>
        {relationshipsMode === 'summary' ? (
          <RelationshipsSummary
            contactId={data.id!}
            contactType={data.type}
            readonly={disabled}
          />
        ) : (
          <ContactRelationshipManager
            contactId={data.id!}
            contactType={data.type}
            readonly={disabled}
          />
        )}
      </RelationshipProvider>
    </div>
  );
}
