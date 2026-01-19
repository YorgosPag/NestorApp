
'use client';

import React, { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { ContactsList } from './ContactsList';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { COMMON_FILTER_LABELS } from '@/constants/property-statuses-enterprise';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function ContactsTab() {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { quick } = useBorderTokens();
  const [filterType, setFilterType] = useState('all');
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('crm');
  
  return (
    <div className={`${colors.bg.primary} ${quick.card}`}>
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">{t('contactsTab.title')}</h2>
            <Tabs value={filterType} onValueChange={setFilterType}>
              <TabsList className="w-auto">
                {['all', 'customers', 'suppliers', 'agents'].map(type => (
                  <TabsTrigger
                    key={type}
                    value={type}
                    className={`text-xs data-[state=active]:bg-orange-500 data-[state=active]:text-white ${INTERACTIVE_PATTERNS.WARNING_HOVER}`}
                  >
                    {type === 'all' ? COMMON_FILTER_LABELS.ALL_STATUSES :
                     t(`contactsTab.filters.${type}`)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className={`${iconSizes.sm} absolute left-3 top-1/2 transform -translate-y-1/2 ${colors.text.muted}`} />
              <input
                type="text"
                placeholder={t('contactsTab.search')}
                className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button className={`px-4 py-2 bg-blue-600 text-white rounded-lg ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} flex items-center gap-2`}>
              <Plus className={iconSizes.sm} />
              {t('contactsTab.newContact')}
            </button>
          </div>
        </div>
      </div>

      <ContactsList />
    </div>
  );
}
