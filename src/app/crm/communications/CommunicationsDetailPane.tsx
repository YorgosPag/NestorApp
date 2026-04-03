'use client';

import { History, MessageSquare } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThreadView } from '@/components/crm/inbox/ThreadView';
import { ReplyComposer } from '@/components/crm/inbox/ReplyComposer';
import { ContactActivityTimeline } from '@/components/crm/inbox/ContactActivityTimeline';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { ConversationListItem, MessageListItem } from '@/hooks/inbox/useInboxApi';
import type { MessageReactionsState } from '@/hooks/inbox/useMessageReactions';
import type { ReplyComposerProps } from '@/components/crm/inbox/reply-composer-types';
import type { MessageAttachment } from '@/types/conversations';

interface CommunicationsDetailPaneProps {
  t: (key: string) => string;
  selectedConversationId: string | null;
  selectedConversation: ConversationListItem | null;
  messages: MessageListItem[];
  messagesLoading: boolean;
  messagesError: string | null;
  hasMoreMessages: boolean;
  loadMoreMessages: () => Promise<void>;
  refreshMessages: () => Promise<void>;
  handleReply: (message: MessageListItem) => void;
  handleForward: (message: MessageListItem) => void;
  handleEdit: (message: MessageListItem) => void;
  isPinned: (messageId: string) => boolean;
  handleTogglePin: (messageId: string, shouldPin: boolean) => Promise<void>;
  getReactionsFn: (messageId: string) => Pick<MessageReactionsState, 'reactions' | 'userReactions'>;
  handleToggleReaction: (messageId: string, emoji: string) => Promise<void>;
  sending: boolean;
  sendError: string | null;
  clearSendError: () => void;
  handleSendWithReply: ReplyComposerProps['onSend'];
  replyMode: NonNullable<ReplyComposerProps['replyMode']>;
  quotedMessage: Exclude<ReplyComposerProps['quotedMessage'], undefined>;
  cancelReply: () => void;
  editingMessage: Exclude<ReplyComposerProps['editingMessage'], undefined>;
  updateEditText: NonNullable<ReplyComposerProps['onUpdateEditText']>;
  cancelEdit: NonNullable<ReplyComposerProps['onCancelEdit']>;
  saveEdit: NonNullable<ReplyComposerProps['onSaveEdit']>;
  isSaving: boolean;
  handleUploadAttachment: (file: File, onProgress: (progress: number) => void) => Promise<{ url: string; thumbnailUrl?: string } | null>;
}

export function CommunicationsDetailPane(props: CommunicationsDetailPaneProps) {
  const {
    t,
    selectedConversationId,
    selectedConversation,
    messages,
    messagesLoading,
    messagesError,
    hasMoreMessages,
    loadMoreMessages,
    refreshMessages,
    handleReply,
    handleForward,
    handleEdit,
    isPinned,
    handleTogglePin,
    getReactionsFn,
    handleToggleReaction,
    sending,
    sendError,
    clearSendError,
    handleSendWithReply,
    replyMode,
    quotedMessage,
    cancelReply,
    editingMessage,
    updateEditText,
    cancelEdit,
    saveEdit,
    isSaving,
    handleUploadAttachment,
  } = props;

  const iconSizes = useIconSizes();

  return (
    <section
      className="hidden md:flex flex-1 flex-col min-h-0 overflow-hidden"
      role="region"
      aria-label={t('inbox.thread.title')}
    >
      <Tabs defaultValue="conversation" className="flex flex-col flex-1 min-h-0">
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

        <TabsContent value="conversation" className="flex-1 flex flex-col min-h-0">
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

        <TabsContent value="history" className="flex-1 overflow-auto">
          <ContactActivityTimeline
            conversation={selectedConversation}
            messages={messages}
            loading={messagesLoading}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
