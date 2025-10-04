'use client';

import React, { useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Contact } from '@/types/contacts';
import { ContactsHeader } from './page/ContactsHeader';
import { ContactsDashboard } from './page/ContactsDashboard';
import { ContactsList } from './list/ContactsList';
import { ContactDetails } from './details/ContactDetails';

const contactsData: Contact[] = [
  {
    id: '1',
    type: 'individual',
    firstName: 'Γιώργος',
    lastName: 'Παπαδόπουλος',
    emails: [{ email: 'g.papadopoulos@example.com', type: 'work', isPrimary: true }],
    phones: [{ number: '6971234567', type: 'mobile', isPrimary: true }],
    isFavorite: true,
    createdAt: new Date('2023-10-26'),
    updatedAt: new Date('2024-07-28'),
    status: 'active',
  },
  {
    id: 'pagonis',
    type: 'company',
    companyName: 'Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.',
    emails: [{ email: 'info@pagonis.gr', type: 'work', isPrimary: true }],
    phones: [{ number: '2109876543', type: 'work', isPrimary: true }],
    isFavorite: false,
    createdAt: new Date('2022-01-15'),
    updatedAt: new Date('2024-07-25'),
    status: 'active',
    vatNumber: '987654321'
  },
  {
    id: '2',
    type: 'company',
    companyName: 'TechCorp Α.Ε.',
    emails: [{ email: 'info@techcorp.gr', type: 'work', isPrimary: true }],
    phones: [{ number: '2101234567', type: 'work', isPrimary: true }],
    isFavorite: false,
    createdAt: new Date('2023-10-25'),
    updatedAt: new Date('2024-07-27'),
    status: 'active',
    vatNumber: '123456789'
  },
  {
    id: '3',
    type: 'service',
    serviceName: "ΔΟΥ Α' Θεσσαλονίκης",
    emails: [{ email: 'doy.a.thess@aade.gr', type: 'work', isPrimary: true }],
    phones: [{ number: '2310555111', type: 'work', isPrimary: true }],
    isFavorite: false,
    createdAt: new Date('2023-09-15'),
    updatedAt: new Date('2024-06-15'),
    status: 'active',
    serviceType: 'tax_office'
  },
  {
    id: '4',
    type: 'individual',
    firstName: 'Μαρία',
    lastName: 'Ιωάννου',
    emails: [{ email: 'm.ioannou@example.com', type: 'personal', isPrimary: true }],
    phones: [{ number: '6987654321', type: 'mobile', isPrimary: true }],
    isFavorite: false,
    createdAt: new Date('2023-10-22'),
    updatedAt: new Date('2024-05-20'),
    status: 'inactive',
  },
] as any;

export function ContactsPageContent() {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(contactsData[1]);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showDashboard, setShowDashboard] = useState(true);
  
  // Add missing search/filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'individual' | 'company' | 'service'>('all');
  const [showOnlyOwners, setShowOnlyOwners] = useState(false);
  const [unitsCountFilter, setUnitsCountFilter] = useState<'all' | '1-2' | '3-5' | '6+'>('all');
  const [areaFilter, setAreaFilter] = useState<'all' | '0-100' | '101-300' | '301+'>('all');

  const stats = {
    totalContacts: contactsData.length,
    individuals: contactsData.filter(c => c.type === 'individual').length,
    companies: contactsData.filter(c => c.type === 'company').length,
    services: contactsData.filter(c => c.type === 'service').length,
    active: contactsData.filter((c: any) => c.status === 'active').length,
    newThisMonth: contactsData.filter(c => c.createdAt > new Date(new Date().setMonth(new Date().getMonth() - 1))).length,
  };
  
  return (
    <TooltipProvider>
      <div className="h-full flex flex-col bg-background">
        <ContactsHeader
          viewMode={viewMode}
          setViewMode={setViewMode}
          showDashboard={showDashboard}
          setShowDashboard={setShowDashboard}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filterType={filterType}
          setFilterType={setFilterType}
          showOnlyOwners={showOnlyOwners}
          onShowOnlyOwnersChange={setShowOnlyOwners}
          unitsCountFilter={unitsCountFilter}
          setUnitsCountFilter={setUnitsCountFilter}
          areaFilter={areaFilter}
          setAreaFilter={setAreaFilter}
        />

        {showDashboard && <ContactsDashboard stats={stats} />}

        <div className="flex-1 flex overflow-hidden p-4 gap-4">
          {viewMode === 'list' ? (
            <>
              <ContactsList
                contacts={contactsData}
                selectedContact={selectedContact}
                onSelectContact={setSelectedContact}
              />
              <ContactDetails contact={selectedContact} />
            </>
          ) : (
            <div className="w-full text-center p-8 bg-card rounded-lg border">
                Προβολή πλέγματος (Grid View) θα υλοποιηθεί σύντομα.
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
