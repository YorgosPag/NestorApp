'use client';

/**
 * Navigation Company Manager Component
 * Handles company selection from contacts and navigation company management
 */

import React, { useState, useEffect } from 'react';
import { SelectCompanyContactModal } from '../dialogs/SelectCompanyContactModal';
import type { Contact } from '@/types/contacts';
import { addCompanyToNavigation, getNavigationCompanyIds } from '@/services/navigation-companies.service';
import { NavigationApiService } from '../core/services/navigationApi';
import { useNavigation } from '../core/NavigationContext';

interface NavigationCompanyManagerProps {
  companies: any[];
  children: (props: NavigationCompanyManagerRenderProps) => React.ReactNode;
}

interface NavigationCompanyManagerRenderProps {
  isContactsModalOpen: boolean;
  setIsContactsModalOpen: (open: boolean) => void;
  handleCompanySelected: (contact: Contact) => void;
  navigationCompanyIds: string[];
}

export function NavigationCompanyManager({ companies, children }: NavigationCompanyManagerProps) {
  // Navigation context για cache refresh
  const { loadCompanies } = useNavigation();

  // Modal state για επαφές
  const [isContactsModalOpen, setIsContactsModalOpen] = useState(false);

  // State για να κρατούμε ποιες εταιρείες είναι navigation companies
  const [navigationCompanyIds, setNavigationCompanyIds] = useState<string[]>([]);

  // Φορτώνουμε τα navigation company IDs όταν φορτώνουν οι εταιρείες
  useEffect(() => {
    const loadNavigationIds = async () => {
      try {
        const ids = await getNavigationCompanyIds();
        setNavigationCompanyIds(ids);
        // Navigation company IDs loaded
      } catch (error) {
        // Error loading navigation company IDs
      }
    };

    if (companies.length > 0) {
      loadNavigationIds();
    }
  }, [companies]);

  // Handler για επιλογή εταιρείας από επαφές
  const handleCompanySelected = async (contact: Contact) => {
    if (!contact.id) {
      return;
    }

    try {
      // Προσθήκη εταιρείας στην πλοήγηση
      await addCompanyToNavigation(contact.id);

      // 🚀 ENTERPRISE CACHE INVALIDATION: Καθαρισμός cache για άμεση εμφάνιση
      NavigationApiService.clearCompaniesCache();

      // 🔄 ΕΠΑΓΓΕΛΜΑΤΙΚΟ REFRESH: Ανανέωση companies από context
      await loadCompanies();

      // Ενημέρωση local state για το modal filtering
      setNavigationCompanyIds(prev => [...prev, contact.id!]);

      // Κλείσιμο modal
      setIsContactsModalOpen(false);

      // Company added to navigation successfully
    } catch (error) {
      // Error adding company to navigation - fallback to page refresh
      window.location.reload();
    }
  };

  return (
    <>
      {children({
        isContactsModalOpen,
        setIsContactsModalOpen,
        handleCompanySelected,
        navigationCompanyIds
      })}

      {/* 🏢 ENTERPRISE Modal με intelligent duplicate filtering */}
      <SelectCompanyContactModal
        open={isContactsModalOpen}
        onOpenChange={setIsContactsModalOpen}
        onCompanySelected={handleCompanySelected}
        existingCompanyIds={navigationCompanyIds}  // 🚫 ENTERPRISE: Exclude existing companies
      />
    </>
  );
}

export default NavigationCompanyManager;