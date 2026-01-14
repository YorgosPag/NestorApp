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
import { MessageSquare, Inbox, Mail, AlertCircle, RefreshCw, Filter, History, User } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { CommonBadge } from '@/core/badges';

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

// 🏢 ENTERPRISE: Design system hooks
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useUserRole } from '@/auth/hooks/useAuth';
import { HOVER_BACKGROUND_EFFECTS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { truncateText } from '@/lib/obligations-utils';

// 🏢 ENTERPRISE: API hooks
import {
  useConversations,
  useConversationMessages,
  useSendMessage,
} from '@/hooks/inbox/useInboxApi';

// 🏢 ENTERPRISE: Centralized constants
import { MESSAGE_PREVIEW_LENGTH } from '@/config/domain-constants';
import { CONVERSATION_STATUS } from '@/types/conversations';
import { COMMUNICATION_CHANNELS } from '@/types/communications';
import { formatDateTime } from '@/lib/intl-utils';
import { Spinner } from '@/components/ui/spinner';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get channel icon component
 */
function getChannelIcon(channel: string, iconSizes: ReturnType<typeof useIconSizes>) {
  switch (channel) {
    case COMMUNICATION_CHANNELS.EMAIL:
      return <Mail className={iconSizes.sm} />;
    default:
      return <MessageSquare className={iconSizes.sm} />;
  }
}

/**
 * Get channel color classes
 */
function getChannelColorClasses(channel: string, colors: ReturnType<typeof useSemanticColors>) {
  switch (channel) {
    case COMMUNICATION_CHANNELS.EMAIL:
      return `${colors.bg.infoSubtle} ${colors.text.info}`;
    case COMMUNICATION_CHANNELS.TELEGRAM:
      return `${colors.bg.infoSubtle} ${colors.text.info}`;
    case COMMUNICATION_CHANNELS.WHATSAPP:
      return `${colors.bg.successSubtle} ${colors.text.success}`;
    default:
      return `${colors.bg.muted} ${colors.text.muted}`;
  }
}

/**
 * Format relative time
 */
function getRelativeTime(
  timestamp: string,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffHours < 1) return t('inbox.time.now');
  if (diffHours < 24) return t('inbox.time.hoursAgo', { hours: Math.floor(diffHours) });
  if (diffHours < 48) return t('inbox.time.yesterday');

  return formatDateTime(date);
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function CrmCommunicationsPage() {
  const { t } = useTranslation('crm');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

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
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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
    // 🔐 ENTERPRISE: Only poll when authorized - prevents flicker
    polling: authReady && hasStaffAccess,
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
    // 🔐 ENTERPRISE: Only poll when authorized and conversation selected
    polling: authReady && hasStaffAccess && !!selectedConversationId,
  });

  const {
    send,
    sending,
    error: sendError,
    clearError: clearSendError,
  } = useSendMessage(selectedConversationId);

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

  const handleSendMessage = useCallback(
    async (text: string): Promise<boolean> => {
      const result = await send({ text });
      if (result?.success) {
        await refreshMessages();
        return true;
      }
      return false;
    },
    [send, refreshMessages]
  );

  const handleRefreshAll = useCallback(async () => {
    await refreshConversations();
    if (selectedConversationId) {
      await refreshMessages();
    }
  }, [refreshConversations, refreshMessages, selectedConversationId]);

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
                className="md:hidden"
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
        <aside className="hidden md:block" role="complementary" aria-label={t('inbox.filters.channel')}>
          <AdvancedFiltersPanel
            config={communicationsFiltersConfig}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </aside>

        {/* Mobile Filters Toggle */}
        {showMobileFilters && (
          <aside className="block md:hidden" role="complementary" aria-label={t('inbox.filters.channel')}>
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
              hideSearch={true}
            />

            {/* 🏢 ENTERPRISE: CompactToolbar - Same pattern as Contacts */}
            <div className="hidden md:block">
              <CompactToolbar
                config={communicationsConfig}
                selectedItems={selectedItems}
                onSelectionChange={setSelectedItems}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                activeFilters={activeFilters}
                onFiltersChange={setActiveFilters}
                sortBy={sortBy}
                onSortChange={(newSortBy, newSortOrder) => {
                  setSortBy(newSortBy as 'name' | 'date' | 'status');
                  setSortOrder(newSortOrder);
                }}
                hasSelectedContact={selectedConversationId !== null}
                onRefresh={handleRefreshAll}
                onExport={() => {/* TODO: Export conversations */}}
              />
            </div>

            {/* CompactToolbar - Mobile (toggleable) */}
            {showToolbar && (
              <div className="md:hidden">
                <CompactToolbar
                  config={communicationsConfig}
                  selectedItems={selectedItems}
                  onSelectionChange={setSelectedItems}
                  searchTerm={searchTerm}
                  onSearchChange={setSearchTerm}
                  activeFilters={activeFilters}
                  onFiltersChange={setActiveFilters}
                  sortBy={sortBy}
                  onSortChange={(newSortBy, newSortOrder) => {
                    setSortBy(newSortBy as 'name' | 'date' | 'status');
                    setSortOrder(newSortOrder);
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
              compact={true}
            />

            {/* List Content - States rendered INSIDE the panel */}
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
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
                      filteredConversations.map((conversation) => {
                        const isSelected = conversation.id === selectedConversationId;
                        const externalParticipant = conversation.participants.find((p) => !p.isInternal);
                        const relativeTime = getRelativeTime(conversation.audit.updatedAt, t);

                        return (
                          <button
                            key={conversation.id}
                            onClick={() => handleSelectConversation(conversation.id)}
                            className={`
                              w-full text-left p-3 rounded-lg
                              ${TRANSITION_PRESETS.STANDARD_COLORS}
                              ${isSelected
                                ? `${colors.bg.accent} ring-2 ring-ring`
                                : HOVER_BACKGROUND_EFFECTS.LIGHT
                              }
                            `}
                            role="option"
                            aria-selected={isSelected}
                          >
                            <article className="flex items-start gap-3">
                              {/* Channel icon */}
                              <figure
                                className={`p-2 rounded-full flex-shrink-0 ${getChannelColorClasses(conversation.channel, colors)}`}
                              >
                                {getChannelIcon(conversation.channel, iconSizes)}
                              </figure>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <header className="flex items-center justify-between mb-1">
                                  <span className="font-medium truncate">
                                    {externalParticipant?.displayName || t('inbox.thread.participants')}
                                  </span>
                                  <time className={`text-xs ${colors.text.muted} flex-shrink-0`}>
                                    {relativeTime}
                                  </time>
                                </header>

                                <p className={`text-sm ${colors.text.muted} truncate`}>
                                  {conversation.lastMessage
                                    ? truncateText(conversation.lastMessage.content, MESSAGE_PREVIEW_LENGTH)
                                    : t('inbox.thread.noMessages')}
                                </p>

                                <footer className="flex items-center gap-2 mt-1">
                                  <CommonBadge
                                    status="company"
                                    customLabel={conversation.channel.toUpperCase()}
                                    variant="outline"
                                    className="text-xs"
                                  />
                                  {conversation.unreadCount > 0 && (
                                    <CommonBadge
                                      status="company"
                                      customLabel={String(conversation.unreadCount)}
                                      variant="destructive"
                                      className="text-xs"
                                    />
                                  )}
                                </footer>
                              </div>
                            </article>
                          </button>
                        );
                      })
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
                  <TabsContent value="conversation" className="flex-1 flex flex-col min-h-0 mt-0">
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
                      />
                    </div>

                    {/* Reply Composer - ONLY in Conversation tab */}
                    <ReplyComposer
                      disabled={!selectedConversationId}
                      sending={sending}
                      error={sendError}
                      onSend={handleSendMessage}
                      onClearError={clearSendError}
                    />
                  </TabsContent>

                  {/* Tab 2: Ιστορικό Επαφής (Activity Timeline) */}
                  <TabsContent value="history" className="flex-1 overflow-auto p-4">
                    {selectedConversation ? (
                      <div className="space-y-4">
                        {/* Contact Info Header */}
                        <div className={`p-4 rounded-lg ${colors.bg.secondary} flex items-center gap-3`}>
                          <div className={`w-10 h-10 rounded-full ${colors.bg.accent} flex items-center justify-center`}>
                            <User className={`${iconSizes.md} ${colors.text.accent}`} />
                          </div>
                          <div>
                            <p className="font-medium">
                              {selectedConversation.participants.find(p => !p.isInternal)?.displayName || t('inbox.thread.participants')}
                            </p>
                            <p className={`text-sm ${colors.text.muted}`}>
                              {selectedConversation.channel.toUpperCase()}
                            </p>
                          </div>
                        </div>

                        {/* Activity Timeline Placeholder */}
                        <div className={`p-6 rounded-lg border ${colors.border.default} text-center`}>
                          <History className={`${iconSizes.xl} ${colors.text.muted} mx-auto mb-3 opacity-50`} />
                          <p className={`font-medium ${colors.text.foreground}`}>
                            {t('inbox.historyTitle')}
                          </p>
                          <p className={`text-sm ${colors.text.muted} mt-1`}>
                            {t('inbox.tabs.contactHistory')}
                          </p>
                          {/* TODO: Replace with ContactActivityTimeline component */}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full">
                        <History className={`${iconSizes.xl2} ${colors.text.muted} mb-4 opacity-30`} />
                        <p className={colors.text.muted}>{t('inbox.thread.selectConversation')}</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </section>
        </ListContainer>
      </PageContainer>
    </TooltipProvider>
  );
}
