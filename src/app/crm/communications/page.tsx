'use client';

/**
 * =============================================================================
 * CRM COMMUNICATIONS PAGE - EPIC Δ (REFACTORED)
 * =============================================================================
 *
 * Contacts-style master-detail layout for staff communications management.
 * Uses centralized layout components (PageContainer, ListContainer, PageHeader).
 *
 * Architecture:
 * - (1) Dashboard strip: KPIs for communications
 * - (2) Filters bar: Channel, status, search
 * - (3) List: ConversationsList (left panel)
 * - (4) Details: ThreadView + ReplyComposer (right panel)
 *
 * @module app/crm/communications/page
 * @enterprise ADR-030 - Zero Hardcoded Values
 */

import React, { useState, useCallback, useMemo } from 'react';
import { MessageSquare, Inbox, Mail, AlertCircle, RefreshCw, Filter, History } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

// 🏢 ENTERPRISE: Centralized containers and headers
import { PageContainer, ListContainer, EntityListColumn } from '@/core/containers';
import { PageHeader } from '@/core/headers';
import { GenericListHeader } from '@/components/shared/GenericListHeader';
import { ChannelQuickFilters } from '@/components/shared/TypeQuickFilters';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CompactToolbar, communicationsConfig } from '@/components/core/CompactToolbar';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { AdvancedFiltersPanel, type CommunicationsFilterState, communicationsFiltersConfig, defaultCommunicationsFilters } from '@/components/core/AdvancedFilters';

// 🏢 ENTERPRISE: Inbox components (REUSE)
import { ThreadView } from '@/components/crm/inbox/ThreadView';
import { ReplyComposer } from '@/components/crm/inbox/ReplyComposer';
import { ContactActivityTimeline } from '@/components/crm/inbox/ContactActivityTimeline';

// 🏢 ENTERPRISE: Design system hooks
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useUserRole } from '@/auth/hooks/useAuth';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn, getSpacingClass, getResponsiveClass } from '@/lib/design-system';
import { createModuleLogger } from '@/lib/telemetry';

// 🏢 ENTERPRISE: Domain card component
import { ConversationListCard } from '@/domain';

// 🏢 ENTERPRISE: API hooks
import {
  useConversations,
  useConversationMessages,
  useSendMessage,
} from '@/hooks/inbox/useInboxApi';
import type { MessageListItem } from '@/hooks/inbox/useInboxApi';

// 🏢 ENTERPRISE: Message action hooks
import { useMessageReply } from '@/hooks/inbox/useMessageReply';
import { useMessageEdit } from '@/hooks/inbox/useMessageEdit';
import { useMessagePin } from '@/hooks/inbox/useMessagePin';
import { useMessageReactions } from '@/hooks/inbox/useMessageReactions';

// 🏢 ENTERPRISE: Centralized constants
import { CONVERSATION_STATUS, type MessageAttachment } from '@/types/conversations';
import { COMMUNICATION_CHANNELS } from '@/types/communications';
import { Spinner } from '@/components/ui/spinner';
// 🏢 ADR-055: Attachment upload support
import { PhotoUploadService } from '@/services/photo-upload.service';

// ============================================================================
// COMPONENT
// ============================================================================

export default function CrmCommunicationsPage() {
  const logger = createModuleLogger('crm/communications');
  const { t } = useTranslation('crm');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: Centralized spacing tokens
  const spacing = useSpacingTokens();
  const listPadding = getSpacingClass('m', 'md', 'b');

  // 🔐 ENTERPRISE: Auth state - stable, no flicker
  const { isLoading: authLoading, isAuthenticated, isAdmin } = useUserRole();
  const authReady = !authLoading;
  const hasStaffAccess = isAuthenticated && isAdmin;

  // UI State
  const [showDashboard, setShowDashboard] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [showToolbar, setShowToolbar] = useState(false);

  // CompactToolbar state
  // 🏢 ENTERPRISE: Using string[] for Firebase-compatible IDs
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'status'>('date');

  // Filters state
  const [filters, setFilters] = useState<CommunicationsFilterState>(defaultCommunicationsFilters);

  // 🏢 ENTERPRISE: API hooks (NO FIRESTORE DIRECT)
  const {
    conversations,
    loading: conversationsLoading,
    error: conversationsError,
    totalCount,
    hasMore,
    refresh: refreshConversations,
    loadMore: loadMoreConversations,
  } = useConversations({
    status: filters.status !== 'all' ? (filters.status as typeof CONVERSATION_STATUS[keyof typeof CONVERSATION_STATUS]) : undefined,
    channel: filters.channel !== 'all' ? (filters.channel as typeof COMMUNICATION_CHANNELS[keyof typeof COMMUNICATION_CHANNELS]) : undefined,
    // 🔐 ENTERPRISE: Disable auto-polling to prevent infinite refresh
    // User can manually refresh with the refresh button
    polling: false,
  });

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );

  const {
    messages,
    loading: messagesLoading,
    error: messagesError,
    hasMore: hasMoreMessages,
    refresh: refreshMessages,
    loadMore: loadMoreMessages,
  } = useConversationMessages(selectedConversationId, {
    // 🔥 ENTERPRISE: Realtime updates από Firestore (αντί για polling)
    // Τα νέα μηνύματα εμφανίζονται αυτόματα χωρίς refresh
    realtime: true,
    polling: false,
  });

  const {
    send,
    sending,
    error: sendError,
    clearError: clearSendError,
  } = useSendMessage(selectedConversationId);

  // 🏢 ENTERPRISE: Reply/Forward state
  const {
    mode: replyMode,
    quotedMessage,
    startReply,
    startForward,
    cancelReply,
    clearAfterSend,
  } = useMessageReply();

  // 🏢 ENTERPRISE: Edit state
  const {
    editingMessage,
    startEdit,
    updateEditText,
    cancelEdit,
    saveEdit,
    isSaving,
  } = useMessageEdit();

  // 🏢 ENTERPRISE: Pin state
  const {
    isPinned,
    togglePin,
  } = useMessagePin();

  // 🏢 ENTERPRISE: Reactions state (Telegram-style)
  const {
    getReactions,
    toggleReaction,
  } = useMessageReactions({
    realtime: true,
    conversationId: selectedConversationId,
  });

  // Filter conversations by search term and channel (client-side)
  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      // Channel filter (from quick filters)
      if (selectedChannels.length > 0 && !selectedChannels.includes(conv.channel)) {
        return false;
      }

      // Search term filter (from GenericListHeader)
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const participantMatch = conv.participants.some((p) =>
          p.displayName.toLowerCase().includes(searchLower)
        );
        const lastMessageMatch = conv.lastMessage?.content.toLowerCase().includes(searchLower);
        if (!participantMatch && !lastMessageMatch) {
          return false;
        }
      }

      return true;
    });
  }, [conversations, searchTerm, selectedChannels]);

  // Handlers
  const handleSelectConversation = useCallback((conversationId: string) => {
    setSelectedConversationId(conversationId);
  }, []);

  const handleRefreshAll = useCallback(async () => {
    await refreshConversations();
    if (selectedConversationId) {
      await refreshMessages();
    }
  }, [refreshConversations, refreshMessages, selectedConversationId]);

  // 🏢 ENTERPRISE: Reply handler
  const handleReply = useCallback((message: MessageListItem) => {
    logger.info('Reply action', { messageId: message.id });
    startReply(message);
  }, [startReply]);

  // 🏢 ENTERPRISE: Forward handler
  const handleForward = useCallback((message: MessageListItem) => {
    logger.info('Forward action', { messageId: message.id });
    startForward(message);
  }, [startForward]);

  // 🏢 ENTERPRISE: Edit handler
  const handleEdit = useCallback((message: MessageListItem) => {
    logger.info('Edit action', { messageId: message.id });
    startEdit(message);
  }, [startEdit]);

  // 🏢 ENTERPRISE: Pin handler
  const handleTogglePin = useCallback(async (messageId: string, shouldPin: boolean) => {
    logger.info('Toggle pin', { messageId, shouldPin });
    const message = messages.find(m => m.id === messageId);
    if (message) {
      await togglePin(messageId, message.content.text || '', message.senderName);
    }
  }, [messages, togglePin]);

  // 🏢 ENTERPRISE: Reaction handler (Telegram-style)
  const handleToggleReaction = useCallback(async (messageId: string, emoji: string) => {
    logger.info('Toggle reaction', { messageId, emoji });
    await toggleReaction(messageId, emoji);
  }, [toggleReaction]);

  // 🏢 ENTERPRISE: Get reactions for a message
  const getReactionsFn = useCallback((messageId: string) => {
    const state = getReactions(messageId);
    return {
      reactions: state.reactions,
      userReactions: state.userReactions,
    };
  }, [getReactions]);

  // 🏢 ADR-055: Attachment upload handler for ReplyComposer
  const handleUploadAttachment = useCallback(async (
    file: File,
    onProgress: (progress: number) => void
  ): Promise<{ url: string; thumbnailUrl?: string } | null> => {
    try {
      logger.info('Uploading attachment', { name: file.name, type: file.type });

      // Use legacy path that's allowed by Storage Rules
      const folderPath = file.type.startsWith('image/')
        ? 'contacts/photos'  // Allowed for authenticated + images
        : 'contacts/photos'; // Same path works for all authenticated uploads

      const result = await PhotoUploadService.uploadPhoto(file, {
        folderPath,
        onProgress: (progress) => {
          const percent = progress.phase === 'complete' ? 100 : progress.progress;
          onProgress(percent);
        },
        enableCompression: file.type.startsWith('image/'),
        compressionUsage: 'document-scan',
      });

      logger.info('Attachment uploaded', { url: result.url });
      return { url: result.url };
    } catch (error) {
      logger.error('[Communications] Attachment upload failed', { error });
      return null;
    }
  }, []);

  // 🏢 ENTERPRISE: Enhanced send with reply support + attachments (ADR-055)
  const handleSendWithReply = useCallback(async (
    text: string,
    attachments?: MessageAttachment[]
  ): Promise<boolean> => {
    const messageData = quotedMessage && replyMode === 'reply'
      ? { text, replyTo: quotedMessage.id, attachments }
      : { text, attachments };

    const result = await send(messageData);
    if (result?.success) {
      clearAfterSend();
      await refreshMessages();
      return true;
    }
    return false;
  }, [send, quotedMessage, replyMode, clearAfterSend, refreshMessages]);

  // Dashboard Stats
  const dashboardStats: DashboardStat[] = [
    {
      title: t('inbox.dashboard.total'),
      value: totalCount,
      icon: Inbox,
      color: 'blue',
    },
    {
      title: t('inbox.dashboard.active'),
      value: conversations.filter((c) => c.status === CONVERSATION_STATUS.ACTIVE).length,
      icon: MessageSquare,
      color: 'green',
    },
    {
      title: t('inbox.dashboard.unread'),
      value: conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
      icon: Mail,
      color: 'orange',
    },
  ];

  // Dynamic header title with count
  const headerTitle = t('inbox.title') + ` (${totalCount})`;

  return (
    <TooltipProvider>
      <PageContainer ariaLabel={t('inbox.title')}>
        {/* (1) Header - Using PageHeader directly */}
        <PageHeader
          variant="sticky-rounded"
          layout="compact"
          spacing="compact"
          title={{
            icon: Inbox,
            title: headerTitle,
            subtitle: t('inbox.tabs.conversations'),
          }}
          actions={{
            showDashboard,
            onDashboardToggle: () => setShowDashboard(!showDashboard),
            customActions: [
              <Button
                key="mobile-filters"
                variant="outline"
                size="sm"
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                aria-label={t('inbox.filters.title')}
                className={getResponsiveClass('md', 'hidden')}
              >
                <Filter className={iconSizes.sm} />
              </Button>,
              <Button
                key="refresh"
                variant="outline"
                size="sm"
                onClick={handleRefreshAll}
                disabled={conversationsLoading}
                aria-label={t('leads.refresh')}
              >
                <RefreshCw className={`${iconSizes.sm} ${conversationsLoading ? 'animate-spin' : ''}`} />
              </Button>,
            ],
          }}
        />

        {/* (1) Dashboard KPIs */}
        {showDashboard && (
          <section className="w-full overflow-hidden" role="region" aria-label="Dashboard">
            <UnifiedDashboard
              stats={dashboardStats}
              columns={4}
              className="px-1 py-4 sm:px-4 sm:py-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 overflow-hidden"
            />
          </section>
        )}

        {/* (2) Filters */}
        <aside className={cn('hidden', getResponsiveClass('md', 'block'))} role="complementary" aria-label={t('inbox.filters.channel')}>
          <AdvancedFiltersPanel
            config={communicationsFiltersConfig}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </aside>

        {/* Mobile Filters Toggle */}
        {showMobileFilters && (
          <aside className={cn('block', getResponsiveClass('md', 'hidden'))} role="complementary" aria-label={t('inbox.filters.channel')}>
            <AdvancedFiltersPanel
              config={communicationsFiltersConfig}
              filters={filters}
              onFiltersChange={setFilters}
              defaultOpen
            />
          </aside>
        )}

        {/* (3+4) ListContainer with split view - ALWAYS STABLE */}
        <ListContainer>
          {/* (3) Left Panel: Conversations List - ALWAYS RENDERED */}
          <EntityListColumn hasBorder aria-label={t('inbox.tabs.conversations')}>
            {/* 🏢 ENTERPRISE: GenericListHeader - Same pattern as Contacts */}
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

            {/* 🏢 ENTERPRISE: CompactToolbar - Same pattern as Contacts */}
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
                onSortChange={(newSortBy) => {
                  setSortBy(newSortBy as 'name' | 'date' | 'status');
                }}
                hasSelectedContact={selectedConversationId !== null}
                onRefresh={handleRefreshAll}
                onExport={() => {/* TODO: Export conversations */}}
              />
            </div>

            {/* CompactToolbar - Mobile (toggleable) */}
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
                  onSortChange={(newSortBy) => {
                    setSortBy(newSortBy as 'name' | 'date' | 'status');
                  }}
                  hasSelectedContact={selectedConversationId !== null}
                  onRefresh={handleRefreshAll}
                />
              </div>
            )}

            {/* 🏢 ENTERPRISE: ChannelQuickFilters - Quick filter chips for channels */}
            <ChannelQuickFilters
              selectedTypes={selectedChannels}
              onTypeChange={setSelectedChannels}
              compact
            />

            {/* List Content - States rendered INSIDE the panel */}
            <ScrollArea className="flex-1">
              {/* 🏢 ENTERPRISE: Centralized spacing tokens (same as UnitsList) */}
              <div className={cn(spacing.padding.sm, spacing.spaceBetween.sm, listPadding)}>
                {/* 🔐 State 1: Auth loading */}
                {!authReady ? (
                  <div className="flex items-center justify-center p-8">
                    <Spinner size="medium" className="mr-2" />
                    <span>{t('inbox.loading')}</span>
                  </div>
                ) : /* 🔐 State 2: Not authenticated */
                !isAuthenticated ? (
                  <div className="text-center py-8">
                    <AlertCircle className={`${iconSizes.xl} ${colors.text.warning} mx-auto mb-2`} />
                    <p className="font-semibold mb-1">{t('inbox.errors.notAuthenticated')}</p>
                    <p className={`text-sm ${colors.text.muted}`}>{t('errors.staffAccessRequired')}</p>
                  </div>
                ) : /* 🔐 State 3: No staff access */
                !hasStaffAccess ? (
                  <div className="text-center py-8">
                    <AlertCircle className={`${iconSizes.xl} ${colors.text.warning} mx-auto mb-2`} />
                    <p className="font-semibold mb-1">{t('inbox.errors.notAuthenticated')}</p>
                    <p className={`text-sm ${colors.text.muted}`}>{t('errors.staffAccessRequired')}</p>
                  </div>
                ) : /* 🔄 State 4: Loading conversations */
                conversationsLoading && conversations.length === 0 ? (
                  <div className="flex items-center justify-center p-8">
                    <Spinner size="medium" className="mr-2" />
                    <span>{t('inbox.loadingConversations')}</span>
                  </div>
                ) : /* ❌ State 5: API error */
                conversationsError ? (
                  <div className={`p-3 rounded ${colors.bg.errorSubtle} ${colors.text.error}`} role="alert">
                    <AlertCircle className={`${iconSizes.sm} inline mr-2`} />
                    {conversationsError}
                  </div>
                ) : /* 📭 State 6: Empty */
                filteredConversations.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className={`${iconSizes.xl} ${colors.text.muted} mx-auto mb-2 opacity-30`} />
                    <p className={colors.text.muted}>{t('inbox.noConversations')}</p>
                  </div>
                ) : (
                  /* 🏢 ENTERPRISE: Using ConversationListCard (same pattern as UnitListCard) */
                  filteredConversations.map((conversation) => (
                    <ConversationListCard
                      key={conversation.id}
                      conversation={conversation}
                      isSelected={conversation.id === selectedConversationId}
                      onSelect={() => handleSelectConversation(conversation.id)}
                    />
                  ))
                )}

                    {/* Load more button */}
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

              {/* (4) Right Panel: Tabs (Συνομιλία / Ιστορικό Επαφής) */}
              <section
                className="hidden md:flex flex-1 flex-col min-h-0 overflow-hidden"
                role="region"
                aria-label={t('inbox.thread.title')}
              >
                <Tabs defaultValue="conversation" className="flex flex-col flex-1 min-h-0">
                  {/* Tab Navigation */}
                  <TabsList className="mx-4 mt-2 w-auto flex-shrink-0">
                    <TabsTrigger value="conversation" className="flex items-center gap-2">
                      <MessageSquare className={iconSizes.sm} />
                      <span>{t('inbox.tabs.conversations')}</span>
                    </TabsTrigger>
                    <TabsTrigger value="history" className="flex items-center gap-2">
                      <History className={iconSizes.sm} />
                      <span>{t('inbox.tabs.contactHistory')}</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* Tab 1: Συνομιλία (Thread + Composer) */}
                  <TabsContent value="conversation" className="flex-1 flex flex-col min-h-0">
                    {/* Thread View */}
                    <div className="flex-1 overflow-hidden">
                      <ThreadView
                        conversation={selectedConversation}
                        messages={messages}
                        loading={messagesLoading}
                        error={messagesError}
                        hasMore={hasMoreMessages}
                        onLoadMore={loadMoreMessages}
                        onRefresh={refreshMessages}
                        onReply={handleReply}
                        onForward={handleForward}
                        onEdit={handleEdit}
                        isPinnedFn={isPinned}
                        onTogglePin={handleTogglePin}
                        getReactionsFn={getReactionsFn}
                        onToggleReaction={handleToggleReaction}
                      />
                    </div>

                    {/* Reply Composer - ONLY in Conversation tab */}
                    <ReplyComposer
                      disabled={!selectedConversationId}
                      sending={sending}
                      error={sendError}
                      onSend={handleSendWithReply}
                      onClearError={clearSendError}
                      replyMode={replyMode}
                      quotedMessage={quotedMessage}
                      onCancelReply={cancelReply}
                      editingMessage={editingMessage}
                      onUpdateEditText={updateEditText}
                      onCancelEdit={cancelEdit}
                      onSaveEdit={saveEdit}
                      isSavingEdit={isSaving}
                      onUploadAttachment={handleUploadAttachment}
                    />
                  </TabsContent>

                  {/* Tab 2: Ιστορικό Επαφής (Activity Timeline) */}
                  <TabsContent value="history" className="flex-1 overflow-auto">
                    <ContactActivityTimeline
                      conversation={selectedConversation}
                      messages={messages}
                      loading={messagesLoading}
                    />
                  </TabsContent>
                </Tabs>
              </section>
        </ListContainer>
      </PageContainer>
    </TooltipProvider>
  );
}
