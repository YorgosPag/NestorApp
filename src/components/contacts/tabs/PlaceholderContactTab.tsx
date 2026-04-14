'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/design-system';
import type { Contact } from '@/types/contacts';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

interface PlaceholderContactTabProps {
  data: Contact;
  tabName: string;
  description?: string;
}

/**
 * 🏢 ENTERPRISE: Placeholder Contact Tab
 *
 * Professional placeholder για contact tabs που δεν έχουν ακόμη implementation.
 * Consistent με τα άλλα placeholder tabs στην εφαρμογή.
 */
export function PlaceholderContactTab({
  data,
  tabName,
  description,
}: PlaceholderContactTabProps) {
  const { t } = useTranslation(['contacts', 'contacts-banking', 'contacts-core', 'contacts-form', 'contacts-lifecycle', 'contacts-relationships']);
  const colors = useSemanticColors();
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-2 mb-2">
        📦
      </div>
      <h3 className="text-lg font-semibold mb-2">
        {tabName}{t('placeholderTab.comingSoon')}
      </h3>
      <p className={cn("max-w-md", colors.text.muted)}>
        {description || `Η καρτέλα "${tabName}" είναι υπό ανάπτυξη.`}
      </p>
      <div className={cn("mt-2 text-xs", colors.text.muted)}>
        {t('placeholderTab.contactIdLabel')} {data.id} {t('placeholderTab.typeLabel')} {data.type}
      </div>
    </div>
  );
}