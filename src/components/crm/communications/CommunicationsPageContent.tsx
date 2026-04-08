'use client';

/**
 * CRM Communications Page Content
 * @lazy ADR-294 — Extracted from page.tsx for dynamic import
 */

import { Filter, Inbox, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdvancedFiltersPanel, communicationsFiltersConfig } from '@/components/core/AdvancedFilters';
import { ListContainer, PageContainer } from '@/core/containers';
import { PageHeader } from '@/core/headers';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn, getResponsiveClass, getSpacingClass } from '@/lib/design-system';
import { CommunicationsListPane } from './CommunicationsListPane';
import { CommunicationsDetailPane } from './CommunicationsDetailPane';
import { useCommunicationsPageController } from './useCommunicationsPageController';

export function CommunicationsPageContent() {
  const iconSizes = useIconSizes();
  const spacing = useSpacingTokens();
  const listPadding = getSpacingClass('m', 'md', 'b');

  const state = useCommunicationsPageController();

  return (
    <PageContainer ariaLabel={state.t('inbox.title')}>
      <PageHeader
        variant="sticky-rounded"
        layout="compact"
        spacing="compact"
        breadcrumb={<ModuleBreadcrumb />}
        title={{
          icon: Inbox,
          title: state.t('inbox.title'),
          subtitle: state.t('inbox.tabs.conversations'),
        }}
        actions={{
          showDashboard: state.showDashboard,
          onDashboardToggle: () => state.setShowDashboard(!state.showDashboard),
          customActions: [
            <Button
              key="mobile-filters"
              variant="outline"
              size="sm"
              onClick={() => state.setShowMobileFilters(!state.showMobileFilters)}
              aria-label={state.t('inbox.filters.title')}
              className={getResponsiveClass('md', 'hidden')}
            >
              <Filter className={iconSizes.sm} />
            </Button>,
            <Button
              key="refresh"
              variant="outline"
              size="sm"
              onClick={state.handleRefreshAll}
              disabled={state.conversationsLoading}
              aria-label={state.t('leads.refresh')}
            >
              <RefreshCw className={`${iconSizes.sm} ${state.conversationsLoading ? 'animate-spin' : ''}`} />
            </Button>,
          ],
        }}
      />

      {state.showDashboard && (
        <section className="w-full overflow-hidden" role="region" aria-label="Dashboard">
          <UnifiedDashboard
            stats={state.dashboardStats}
            columns={4}
            className="px-1 py-4 sm:px-4 sm:py-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 overflow-hidden"
          />
        </section>
      )}

      <aside className={cn('hidden', getResponsiveClass('md', 'block'))} role="complementary" aria-label={state.t('inbox.filters.channel')}>
        <AdvancedFiltersPanel
          config={communicationsFiltersConfig}
          filters={state.filters}
          onFiltersChange={state.setFilters}
        />
      </aside>

      {state.showMobileFilters && (
        <aside className={cn('block', getResponsiveClass('md', 'hidden'))} role="complementary" aria-label={state.t('inbox.filters.channel')}>
          <AdvancedFiltersPanel
            config={communicationsFiltersConfig}
            filters={state.filters}
            onFiltersChange={state.setFilters}
            defaultOpen
          />
        </aside>
      )}

      <ListContainer>
        <CommunicationsListPane
          t={state.t}
          authReady={state.authReady}
          isAuthenticated={state.isAuthenticated}
          hasStaffAccess={state.hasStaffAccess}
          filteredConversations={state.filteredConversations}
          selectedConversationId={state.selectedConversationId}
          conversationsLoading={state.conversationsLoading}
          conversationsError={state.conversationsError}
          hasMore={state.hasMore}
          searchTerm={state.searchTerm}
          setSearchTerm={state.setSearchTerm}
          showToolbar={state.showToolbar}
          setShowToolbar={state.setShowToolbar}
          selectedItems={state.selectedItems}
          setSelectedItems={state.setSelectedItems}
          activeFilters={state.activeFilters}
          setActiveFilters={state.setActiveFilters}
          sortBy={state.sortBy}
          setSortBy={state.setSortBy}
          selectedChannels={state.selectedChannels}
          setSelectedChannels={state.setSelectedChannels}
          handleRefreshAll={state.handleRefreshAll}
          handleSelectConversation={state.handleSelectConversation}
          loadMoreConversations={state.loadMoreConversations}
        />

        <CommunicationsDetailPane
          t={state.t}
          selectedConversationId={state.selectedConversationId}
          selectedConversation={state.selectedConversation}
          messages={state.messages}
          messagesLoading={state.messagesLoading}
          messagesError={state.messagesError}
          hasMoreMessages={state.hasMoreMessages}
          loadMoreMessages={state.loadMoreMessages}
          refreshMessages={state.refreshMessages}
          handleReply={state.handleReply}
          handleForward={state.handleForward}
          handleEdit={state.handleEdit}
          isPinned={state.isPinned}
          handleTogglePin={state.handleTogglePin}
          getReactionsFn={state.getReactionsFn}
          handleToggleReaction={state.handleToggleReaction}
          sending={state.sending}
          sendError={state.sendError}
          clearSendError={state.clearSendError}
          handleSendWithReply={state.handleSendWithReply}
          replyMode={state.replyMode}
          quotedMessage={state.quotedMessage}
          cancelReply={state.cancelReply}
          editingMessage={state.editingMessage}
          updateEditText={state.updateEditText}
          cancelEdit={state.cancelEdit}
          saveEdit={state.saveEdit}
          isSaving={state.isSaving}
          handleUploadAttachment={state.handleUploadAttachment}
        />
      </ListContainer>
    </PageContainer>
  );
}

export default CommunicationsPageContent;
