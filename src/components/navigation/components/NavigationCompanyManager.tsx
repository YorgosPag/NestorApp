'use client';

/**
 * Navigation Company Manager Component
 * Handles company selection from contacts and navigation company management
 */

import React, { useState, useEffect } from 'react';
import { SelectCompanyContactModal } from '../dialogs/SelectCompanyContactModal';
import type { Contact } from '@/types/contacts';
import { addCompanyToNavigation, getNavigationCompanyIds } from '@/services/navigation-companies.service';

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

      // Ενημέρωση local state αντί για full refresh
      setNavigationCompanyIds(prev => [...prev, contact.id!]);

      // Απλά κλείνουμε το modal - το context θα ανανεωθεί αυτόματα
      // όταν χρησιμοποιηθεί το getNavigationCompanyIds στο companies.service
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

      {/* Modal για επιλογή εταιρείας από επαφές */}
      <SelectCompanyContactModal
        open={isContactsModalOpen}
        onOpenChange={setIsContactsModalOpen}
        onCompanySelected={handleCompanySelected}
      />
    </>
  );
}

export default NavigationCompanyManager;