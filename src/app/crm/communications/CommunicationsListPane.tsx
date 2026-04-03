'use client';

import { AlertCircle, Inbox, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GenericListHeader } from '@/components/shared/GenericListHeader';
import { ChannelQuickFilters } from '@/components/shared/TypeQuickFilters';
import { CompactToolbar, communicationsConfig } from '@/components/core/CompactToolbar';
import { PageLoadingState } from '@/core/states';
import { EntityListColumn } from '@/core/containers';
import { ConversationListCard } from '@/domain';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn, getResponsiveClass, getSpacingClass } from '@/lib/design-system';
import type { ConversationListItem } from '@/hooks/inbox/useInboxApi';

interface CommunicationsListPaneProps {
  t: (key: string) => string;
  authReady: boolean;
  isAuthenticated: boolean;
  hasStaffAccess: boolean;
  filteredConversations: ConversationListItem[];
  selectedConversationId: string | null;
  conversationsLoading: boolean;
  conversationsError: string | null;
  hasMore: boolean;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  showToolbar: boolean;
  setShowToolbar: (value: boolean) => void;
  selectedItems: string[];
  setSelectedItems: (value: string[]) => void;
  activeFilters: string[];
  setActiveFilters: (value: string[]) => void;
  sortBy: 'name' | 'date' | 'status';
  setSortBy: (value: 'name' | 'date' | 'status') => void;
  selectedChannels: string[];
  setSelectedChannels: (value: string[]) => void;
  handleRefreshAll: () => Promise<void>;
  handleSelectConversation: (conversationId: string) => void;
  loadMoreConversations: () => Promise<void>;
}

export function CommunicationsListPane(props: CommunicationsListPaneProps) {
  const {
    t,
    authReady,
    isAuthenticated,
    hasStaffAccess,
    filteredConversations,
    selectedConversationId,
    conversationsLoading,
    conversationsError,
    hasMore,
    searchTerm,
    setSearchTerm,
    showToolbar,
    setShowToolbar,
    selectedItems,
    setSelectedItems,
    activeFilters,
    setActiveFilters,
    sortBy,
    setSortBy,
    selectedChannels,
    setSelectedChannels,
    handleRefreshAll,
    handleSelectConversation,
    loadMoreConversations,
  } = props;

  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();
  const listPadding = getSpacingClass('m', 'md', 'b');

  return (
    <EntityListColumn hasBorder aria-label={t('inbox.tabs.conversations')}>
      <GenericListHeader
        icon={MessageSquare}
        entityName={t('inbox.tabs.conversations')}
        itemCount={filteredConversations.length}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={t('inbox.search')}
        showToolbar={showToolbar}
        onToolbarToggle={setShowToolbar}
        hideSearch
      />

      <div className={cn('hidden', getResponsiveClass('md', 'block'))}>
        <CompactToolbar
          config={communicationsConfig}
          selectedItems={selectedItems}
          onSelectionChange={setSelectedItems}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          activeFilters={activeFilters}
          onFiltersChange={setActiveFilters}
          sortBy={sortBy}
          onSortChange={(newSortBy) => setSortBy(newSortBy as 'name' | 'date' | 'status')}
          hasSelectedContact={selectedConversationId !== null}
          onRefresh={handleRefreshAll}
          onExport={() => undefined}
        />
      </div>

      {showToolbar && (
        <div className={getResponsiveClass('md', 'hidden')}>
          <CompactToolbar
            config={communicationsConfig}
            selectedItems={selectedItems}
            onSelectionChange={setSelectedItems}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            activeFilters={activeFilters}
            onFiltersChange={setActiveFilters}
            sortBy={sortBy}
            onSortChange={(newSortBy) => setSortBy(newSortBy as 'name' | 'date' | 'status')}
            hasSelectedContact={selectedConversationId !== null}
            onRefresh={handleRefreshAll}
          />
        </div>
      )}

      <ChannelQuickFilters
        selectedTypes={selectedChannels}
        onTypeChange={setSelectedChannels}
        compact
      />

      <ScrollArea className="flex-1">
        <div className={cn(spacing.padding.sm, spacing.spaceBetween.sm, listPadding)}>
          {!authReady ? (
            <PageLoadingState icon={Inbox} message={t('inbox.loading')} layout="contained" />
          ) : !isAuthenticated ? (
            <div className="text-center py-8">
              <AlertCircle className={`${iconSizes.xl} ${colors.text.warning} mx-auto mb-2`} />
              <p className="font-semibold mb-1">{t('inbox.errors.notAuthenticated')}</p>
              <p className={`text-sm ${colors.text.muted}`}>{t('errors.staffAccessRequired')}</p>
            </div>
          ) : !hasStaffAccess ? (
            <div className="text-center py-8">
              <AlertCircle className={`${iconSizes.xl} ${colors.text.warning} mx-auto mb-2`} />
              <p className="font-semibold mb-1">{t('inbox.errors.notAuthenticated')}</p>
              <p className={`text-sm ${colors.text.muted}`}>{t('errors.staffAccessRequired')}</p>
            </div>
          ) : conversationsLoading && filteredConversations.length === 0 ? (
            <PageLoadingState icon={Inbox} message={t('inbox.loadingConversations')} layout="contained" />
          ) : conversationsError ? (
            <div className={`p-3 rounded ${colors.bg.errorSubtle} ${colors.text.error}`} role="alert">
              <AlertCircle className={`${iconSizes.sm} inline mr-2`} />
              {conversationsError}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className={`${iconSizes.xl} ${colors.text.muted} mx-auto mb-2 opacity-30`} />
              <p className={colors.text.muted}>{t('inbox.noConversations')}</p>
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <ConversationListCard
                key={conversation.id}
                conversation={conversation}
                isSelected={conversation.id === selectedConversationId}
                onSelect={() => handleSelectConversation(conversation.id)}
              />
            ))
          )}

          {hasMore && (
            <nav className="flex justify-center mt-4" aria-label="Pagination">
              <Button
                variant="outline"
                size="sm"
                onClick={loadMoreConversations}
                disabled={conversationsLoading}
              >
                {t('inbox.pagination.loadMore')}
              </Button>
            </nav>
          )}
        </div>
      </ScrollArea>
    </EntityListColumn>
  );
}
