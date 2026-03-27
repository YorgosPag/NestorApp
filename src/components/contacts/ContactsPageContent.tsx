/* eslint-disable design-system/prefer-design-system-imports */
'use client';

import React from 'react';
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { Contact } from '@/types/contacts';
import { getContactDisplayName } from '@/types/contacts';
import { toggleSelect } from '@/lib/toggle-select';
import { Users, Trash2 } from 'lucide-react';
import { ContactsHeader } from './page/ContactsHeader';
import { ContactFilterIndicator } from './page/ContactFilterIndicator';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import { ContactsList } from './list/ContactsList';
import { ContactGridCard } from '@/domain';
import { ContactDetails } from './details/ContactDetails';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { ContactTypeSelector, InlineContactCreation } from './creation';
import dynamic from 'next/dynamic';
import { contactFiltersConfig, AdvancedFiltersPanel } from '@/components/core/AdvancedFilters';
import { ListContainer, PageContainer } from '@/core/containers';
import { PageLoadingState, PageErrorState } from '@/core/states';
import { useIconSizes } from '@/hooks/useIconSizes';
import { ContactsService } from '@/services/contacts.service';
import { useContactsPageState } from './page/useContactsPageState';

const DeleteContactDialog = dynamic(
  () => import('./dialogs/DeleteContactDialog').then(mod => ({ default: mod.DeleteContactDialog })),
  { ssr: false },
);
const ArchiveContactDialog = dynamic(
  () => import('./dialogs/ArchiveContactDialog').then(mod => ({ default: mod.ArchiveContactDialog })),
  { ssr: false },
);

export function ContactsPageContent() {
  const state = useContactsPageState();
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  const {
    authLoading,
    filteredContacts,
    isLoading,
    error,
    selectedContact,
    setSelectedContact,
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard,
    showFilters,
    setShowFilters,
    creationMode,
    handleNewContact,
    handleContactAdded,
    handleCancelCreation,
    handleSelectContactType,
    handleBackToTypeSelection,
    showDeleteContactDialog,
    setShowDeleteContactDialog,
    showArchiveContactDialog,
    setShowArchiveContactDialog,
    selectedContactIds,
    handleDeleteContacts,
    handleContactsDeleted,
    handleArchiveContacts,
    handleContactsArchived,
    filters,
    setFilters,
    searchParams,
    handleClearURLFilter,
    dashboardStats,
    handleCardClick,
    refreshContacts,
    handleContactUpdatedInPlace,
    t,
  } = state;

  // Page-level loading state (ADR-229)
  if (authLoading || isLoading) {
    return (
      <PageContainer ariaLabel={t('page.pageLabel')}>
        <PageLoadingState icon={Users} message={t('page.loadingMessage', { defaultValue: 'Φόρτωση επαφών...' })} layout="contained" />
      </PageContainer>
    );
  }

  const filterParam = searchParams.get('filter');
  const contactIdParam = searchParams.get('contactId');

  return (
    <PageContainer ariaLabel={t('page.pageLabel')}>
      <ContactsHeader
        viewMode={viewMode}
        setViewMode={setViewMode}
        showDashboard={showDashboard}
        setShowDashboard={setShowDashboard}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        breadcrumb={<ModuleBreadcrumb />}
      />

      <ContactFilterIndicator
        filterParam={filterParam}
        contactIdParam={contactIdParam}
        contactName={selectedContact ? getContactDisplayName(selectedContact) : null}
        filteredCount={filteredContacts.length}
        onClear={handleClearURLFilter}
      />

      {showDashboard && (
        <section className="w-full overflow-hidden" role="region" aria-label={t('page.dashboard.label')}>
          <UnifiedDashboard
            stats={dashboardStats}
            columns={4}
            onCardClick={handleCardClick}
            className="px-1 py-4 sm:px-4 sm:py-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 overflow-hidden"
          />
        </section>
      )}

      {/* Advanced Filters Panel — Desktop */}
      <aside className="hidden md:block" role="complementary" aria-label={t('page.filters.desktop')}>
        <AdvancedFiltersPanel
          config={contactFiltersConfig}
          filters={filters}
          onFiltersChange={setFilters}
        />
      </aside>

      {/* Advanced Filters Panel — Mobile */}
      {showFilters && (
        <aside className="md:hidden" role="complementary" aria-label={t('page.filters.mobile')}>
          <AdvancedFiltersPanel
            config={contactFiltersConfig}
            filters={filters}
            onFiltersChange={setFilters}
            defaultOpen
          />
        </aside>
      )}

      <ListContainer>
        {error ? (
          <PageErrorState
            title={error}
            onRetry={refreshContacts}
            retryLabel={t('page.error.retry')}
            layout="contained"
          />
        ) : viewMode === 'list' ? (
          <>
            {/* Desktop split layout */}
            <section className="hidden md:flex flex-1 gap-2 min-h-0 min-w-0 overflow-hidden" role="region" aria-label={t('page.views.desktopView')}>
              <ContactsList
                contacts={filteredContacts}
                selectedContact={selectedContact}
                onSelectContact={c => setSelectedContact(toggleSelect(selectedContact, c))}
                isLoading={isLoading}
                onNewContact={handleNewContact}
                onDeleteContact={handleDeleteContacts}
                onArchiveContact={handleArchiveContacts}
                onContactUpdated={handleContactUpdatedInPlace}
              />
              {creationMode === 'selecting' ? (
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-card border rounded-lg shadow-sm">
                  <ContactTypeSelector onSelect={handleSelectContactType} onCancel={handleCancelCreation} />
                </div>
              ) : creationMode ? (
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-card border rounded-lg shadow-sm">
                  <InlineContactCreation
                    contactType={creationMode}
                    onContactAdded={handleContactAdded}
                    onCancel={handleCancelCreation}
                    onBack={handleBackToTypeSelection}
                  />
                </div>
              ) : (
                <ContactDetails
                  contact={selectedContact}
                  onDeleteContact={() => handleDeleteContacts()}
                  onContactUpdated={handleContactUpdatedInPlace}
                  onNewContact={handleNewContact}
                />
              )}
            </section>

            {/* Mobile list */}
            <section className={`md:hidden w-full ${selectedContact ? 'hidden' : 'block'}`} role="region" aria-label={t('page.views.mobileList')}>
              <ContactsList
                contacts={filteredContacts}
                selectedContact={selectedContact}
                onSelectContact={c => setSelectedContact(toggleSelect(selectedContact, c))}
                isLoading={isLoading}
                onNewContact={handleNewContact}
                onDeleteContact={handleDeleteContacts}
                onArchiveContact={handleArchiveContacts}
                onContactUpdated={handleContactUpdatedInPlace}
              />
            </section>

            {/* Mobile slide-in */}
            <MobileDetailsSlideIn
              isOpen={!!selectedContact || creationMode !== null}
              onClose={() => { setSelectedContact(null); handleCancelCreation(); }}
              title={
                creationMode
                  ? t('form.addTitle')
                  : selectedContact ? getContactDisplayName(selectedContact) : t('page.details.title')
              }
              actionButtons={
                creationMode ? undefined : (
                  <button
                    onClick={() => handleDeleteContacts()}
                    className={`p-2 rounded-md border ${colors.bg.primary} border-border text-destructive ${INTERACTIVE_PATTERNS.BUTTON_DESTRUCTIVE_GHOST} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
                    aria-label={t('page.details.deleteContact')}
                  >
                    <Trash2 className={iconSizes.sm} />
                  </button>
                )
              }
            >
              {creationMode === 'selecting' ? (
                <ContactTypeSelector onSelect={handleSelectContactType} onCancel={handleCancelCreation} />
              ) : creationMode ? (
                <InlineContactCreation
                  contactType={creationMode}
                  onContactAdded={handleContactAdded}
                  onCancel={handleCancelCreation}
                  onBack={handleBackToTypeSelection}
                />
              ) : selectedContact ? (
                <ContactDetails
                  contact={selectedContact}
                  onDeleteContact={() => handleDeleteContacts()}
                  onContactUpdated={handleContactUpdatedInPlace}
                  onNewContact={handleNewContact}
                />
              ) : null}
            </MobileDetailsSlideIn>
          </>
        ) : (
          <>
            {/* Grid view */}
            <section
              className="w-full p-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 overflow-y-auto"
              role="region"
              aria-label={t('page.views.gridView')}
            >
              {filteredContacts.map((contact: Contact) => (
                <ContactGridCard
                  key={contact.id}
                  contact={contact}
                  isSelected={selectedContact?.id === contact.id}
                  isFavorite={contact.isFavorite}
                  onSelect={() => setSelectedContact(toggleSelect(selectedContact, contact))}
                  onToggleFavorite={async () => {
                    await ContactsService.updateContact(contact.id!, { isFavorite: !contact.isFavorite });
                    refreshContacts();
                  }}
                />
              ))}
            </section>

            {/* Mobile slide-in for grid view */}
            <MobileDetailsSlideIn
              isOpen={!!selectedContact}
              onClose={() => setSelectedContact(null)}
              title={selectedContact ? getContactDisplayName(selectedContact) : t('page.details.title')}
              actionButtons={
                <button
                  onClick={() => handleDeleteContacts()}
                  className={`p-2 rounded-md border ${colors.bg.primary} border-border text-destructive ${INTERACTIVE_PATTERNS.BUTTON_DESTRUCTIVE_GHOST} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
                  aria-label={t('page.details.deleteContact')}
                >
                  <Trash2 className={iconSizes.sm} />
                </button>
              }
            >
              {selectedContact && (
                <ContactDetails
                  contact={selectedContact}
                  onDeleteContact={() => handleDeleteContacts()}
                  onContactUpdated={handleContactUpdatedInPlace}
                  onNewContact={handleNewContact}
                />
              )}
            </MobileDetailsSlideIn>
          </>
        )}
      </ListContainer>

      <DeleteContactDialog
        open={showDeleteContactDialog}
        onOpenChange={setShowDeleteContactDialog}
        contact={selectedContact}
        selectedContactIds={selectedContactIds}
        onContactsDeleted={handleContactsDeleted}
      />

      <ArchiveContactDialog
        open={showArchiveContactDialog}
        onOpenChange={setShowArchiveContactDialog}
        contact={selectedContact}
        selectedContactIds={selectedContactIds}
        onContactsArchived={handleContactsArchived}
      />
    </PageContainer>
  );
}

export default ContactsPageContent;
