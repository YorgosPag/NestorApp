/**
 * =============================================================================
 * THREAD VIEW COMPONENT TESTS - ENTERPRISE
 * =============================================================================
 *
 * Component tests for ThreadView message rendering:
 * - HTML formatting with <pre> and <code> tags
 * - CSS class application (.ds-messageContent)
 * - XSS protection in rendered output
 * - Semantic HTML structure
 *
 * @module components/crm/inbox/__tests__/ThreadView
 * @enterprise RTL + accessibility testing
 * @see src/components/crm/inbox/ThreadView.tsx
 * @see local_5_TELEGRAM.txt - Test requirements
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
// 🏢 ENTERPRISE: Import jest-dom matchers for toBeInTheDocument, toHaveClass, etc.
import '@testing-library/jest-dom';
import { ThreadView } from '../ThreadView';
import type { MessageListItem, ConversationListItem } from '@/hooks/inbox/useInboxApi';
import { MESSAGE_DIRECTION, DELIVERY_STATUS } from '@/types/conversations';

// Mock scrollIntoView (not available in jsdom)
beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

// Mock hooks
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      // Mock translation function
      if (key === 'inbox.thread.selectConversation') return 'Select a conversation';
      if (key === 'inbox.loading') return 'Loading...';
      if (key === 'leads.retry') return 'Retry';
      if (key === 'common.retry') return 'Retry';
      if (key === 'common.tryAgain') return 'Retry';
      if (key === 'inbox.thread.participants') return 'Participants';
      if (key === 'inbox.thread.unread') return `${params?.count} unread`;
      if (key === 'inbox.thread.loadEarlier') return 'Load earlier';
      if (key === 'inbox.thread.noMessages') return 'No messages';
      if (key === 'inbox.message.attachments') return `${params?.count} attachments`;
      if (key.startsWith('inbox.status.')) return key.split('.').pop();
      return key;
    },
  }),
}));

jest.mock('@/hooks/useIconSizes', () => ({
  useIconSizes: () => ({
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8',
    xl2: 'w-12 h-12',
  }),
}));

jest.mock('@/ui-adapters/react/useSemanticColors', () => ({
  useSemanticColors: () => ({
    text: {
      foreground: 'text-foreground',
      muted: 'text-muted',
      success: 'text-success',
      error: 'text-error',
    },
    bg: {
      primary: 'bg-primary',
      secondary: 'bg-secondary',
      infoSubtle: 'bg-info-subtle',
    },
  }),
}));

describe('ThreadView', () => {
  // ===========================================================================
  // TEST DATA
  // ===========================================================================

  // 🏢 ENTERPRISE: Updated test data to match ConversationListItem interface
  const mockConversation: ConversationListItem = {
    id: 'conv-123',
    channel: 'telegram',
    status: 'active',
    messageCount: 10,
    unreadCount: 0,
    lastMessage: {
      content: 'Last message',
      direction: MESSAGE_DIRECTION.INBOUND,
      timestamp: new Date().toISOString(),
    },
    participants: [
      {
        displayName: 'Test User',
        role: 'customer',
        isInternal: false,
      },
    ],
    tags: [],
    assignedTo: null,
    audit: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };

  // 🏢 ENTERPRISE: Updated test data to match MessageListItem interface
  const createMockMessage = (overrides?: Partial<MessageListItem>): MessageListItem => ({
    id: 'msg-123',
    conversationId: 'conv-123',
    direction: MESSAGE_DIRECTION.INBOUND,
    channel: 'telegram',
    senderId: 'user-1',
    senderType: 'customer',
    senderName: 'Test User',
    content: {
      text: 'Test message',
    },
    providerMessageId: 'provider-msg-123',
    deliveryStatus: DELIVERY_STATUS.DELIVERED,
    providerMetadata: {
      platform: 'telegram',
      chatId: 'chat-123',
      userName: 'test_user',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  // ===========================================================================
  // CORE REQUIREMENT TESTS (from local_5_TELEGRAM.txt)
  // ===========================================================================

  describe('HTML formatting with <pre> tags', () => {
    /**
     * 🧪 TEST REQUIREMENT FROM local_5_TELEGRAM.txt:
     * "Πρόσθεσε ένα component test (RTL) που ελέγχει ότι το rendered DOM
     *  έχει <pre> μέσα σε element με .ds-messageContent"
     */
    it('should render <pre> tags inside .ds-messageContent element', () => {
      const messageWithPre = createMockMessage({
        content: {
          text: '<pre>\n📊 Στατιστικά Ακινήτων\n\n🏠 Σύνολο ακινήτων: 6\n</pre>',
        },
      });

      const { container } = render(
        <ThreadView
          conversation={mockConversation}
          messages={[messageWithPre]}
          loading={false}
          error={null}
          hasMore={false}
          onLoadMore={jest.fn()}
          onRefresh={jest.fn()}
        />
      );

      // ✅ CORE ASSERTION 1: .ds-messageContent element exists
      const messageContent = container.querySelector('.ds-messageContent');
      expect(messageContent).toBeInTheDocument();

      // ✅ CORE ASSERTION 2: <pre> tag exists inside .ds-messageContent
      const preElement = messageContent?.querySelector('pre');
      expect(preElement).toBeInTheDocument();
      expect(preElement?.textContent).toContain('📊 Στατιστικά Ακινήτων');
      expect(preElement?.textContent).toContain('🏠 Σύνολο ακινήτων: 6');
    });

    it('should render <code> tags inside .ds-messageContent element', () => {
      const messageWithCode = createMockMessage({
        content: {
          text: 'Use <code>npm install</code> to install packages',
        },
      });

      const { container } = render(
        <ThreadView
          conversation={mockConversation}
          messages={[messageWithCode]}
          loading={false}
          error={null}
          hasMore={false}
          onLoadMore={jest.fn()}
          onRefresh={jest.fn()}
        />
      );

      const messageContent = container.querySelector('.ds-messageContent');
      const codeElement = messageContent?.querySelector('code');

      expect(codeElement).toBeInTheDocument();
      expect(codeElement?.textContent).toBe('npm install');
    });

    it('should apply .ds-messageContent class to message content', () => {
      const message = createMockMessage({
        content: { text: '<b>Bold text</b>' },
      });

      const { container } = render(
        <ThreadView
          conversation={mockConversation}
          messages={[message]}
          loading={false}
          error={null}
          hasMore={false}
          onLoadMore={jest.fn()}
          onRefresh={jest.fn()}
        />
      );

      // ✅ Verify .ds-messageContent class is applied
      const messageContent = container.querySelector('.ds-messageContent');
      expect(messageContent).toBeInTheDocument();
      expect(messageContent).toHaveClass('ds-messageContent');
    });
  });

  // ===========================================================================
  // XSS PROTECTION TESTS
  // ===========================================================================

  describe('XSS protection', () => {
    it('should sanitize dangerous scripts in message content', () => {
      const maliciousMessage = createMockMessage({
        content: {
          text: '<b>Safe</b><script>alert("XSS")</script>',
        },
      });

      const { container } = render(
        <ThreadView
          conversation={mockConversation}
          messages={[maliciousMessage]}
          loading={false}
          error={null}
          hasMore={false}
          onLoadMore={jest.fn()}
          onRefresh={jest.fn()}
        />
      );

      const messageContent = container.querySelector('.ds-messageContent');

      // ✅ Safe content should be present
      expect(messageContent?.innerHTML).toContain('<b>Safe</b>');

      // ✅ Script tags should be removed
      expect(messageContent?.innerHTML).not.toContain('<script>');
      expect(messageContent?.innerHTML).not.toContain('alert');
    });

    it('should remove onclick handlers from links', () => {
      const messageWithOnclick = createMockMessage({
        content: {
          text: '<a href="#" onclick="alert(\'XSS\')">Link</a>',
        },
      });

      const { container } = render(
        <ThreadView
          conversation={mockConversation}
          messages={[messageWithOnclick]}
          loading={false}
          error={null}
          hasMore={false}
          onLoadMore={jest.fn()}
          onRefresh={jest.fn()}
        />
      );

      const messageContent = container.querySelector('.ds-messageContent');

      // ✅ Link should be present but onclick removed
      expect(messageContent?.innerHTML).toContain('<a');
      expect(messageContent?.innerHTML).not.toContain('onclick');
    });
  });

  // ===========================================================================
  // SEMANTIC HTML STRUCTURE TESTS
  // ===========================================================================

  describe('semantic HTML structure', () => {
    it('should use <article> for each message', () => {
      const message = createMockMessage();

      const { container } = render(
        <ThreadView
          conversation={mockConversation}
          messages={[message]}
          loading={false}
          error={null}
          hasMore={false}
          onLoadMore={jest.fn()}
          onRefresh={jest.fn()}
        />
      );

      const article = container.querySelector('article');
      expect(article).toBeInTheDocument();
    });

    it('should use <header> for message metadata', () => {
      const message = createMockMessage();

      const { container } = render(
        <ThreadView
          conversation={mockConversation}
          messages={[message]}
          loading={false}
          error={null}
          hasMore={false}
          onLoadMore={jest.fn()}
          onRefresh={jest.fn()}
        />
      );

      const header = container.querySelector('article header');
      expect(header).toBeInTheDocument();
    });

    it('should use <time> element with dateTime attribute', () => {
      const message = createMockMessage({
        createdAt: '2026-01-15T19:00:00Z',
      });

      const { container } = render(
        <ThreadView
          conversation={mockConversation}
          messages={[message]}
          loading={false}
          error={null}
          hasMore={false}
          onLoadMore={jest.fn()}
          onRefresh={jest.fn()}
        />
      );

      const timeElement = container.querySelector('time');
      expect(timeElement).toBeInTheDocument();
      expect(timeElement).toHaveAttribute('dateTime', '2026-01-15T19:00:00Z');
    });
  });

  // ===========================================================================
  // EMPTY STATES & EDGE CASES
  // ===========================================================================

  describe('empty states', () => {
    it('should show "select conversation" message when no conversation selected', () => {
      render(
        <ThreadView
          conversation={null}
          messages={[]}
          loading={false}
          error={null}
          hasMore={false}
          onLoadMore={jest.fn()}
          onRefresh={jest.fn()}
        />
      );

      // Match partial text (actual is "Select a conversation to view messages")
      expect(screen.getByText(/select a conversation/i)).toBeInTheDocument();
    });

    it('should show loading state', () => {
      render(
        <ThreadView
          conversation={mockConversation}
          messages={[]}
          loading
          error={null}
          hasMore={false}
          onLoadMore={jest.fn()}
          onRefresh={jest.fn()}
        />
      );

      // Match partial text (actual is "Loading messages...")
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should show error state with retry button', () => {
      const mockRefresh = jest.fn();

      render(
        <ThreadView
          conversation={mockConversation}
          messages={[]}
          loading={false}
          error="Network error"
          hasMore={false}
          onLoadMore={jest.fn()}
          onRefresh={mockRefresh}
        />
      );

      expect(screen.getByText('Network error')).toBeInTheDocument();
      // Find retry button by role instead of text (translation-independent)
      const retryButton = screen.getByRole('button', { name: /retry|try again/i });
      expect(retryButton).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // MULTIPLE MESSAGES TESTS
  // ===========================================================================

  describe('multiple messages rendering', () => {
    it('should render multiple messages with different HTML formatting', () => {
      const messages = [
        createMockMessage({
          id: 'msg-1',
          content: { text: '<b>Bold message</b>' },
        }),
        createMockMessage({
          id: 'msg-2',
          content: { text: '<pre>Code block</pre>' },
        }),
        createMockMessage({
          id: 'msg-3',
          content: { text: '<i>Italic message</i>' },
        }),
      ];

      const { container } = render(
        <ThreadView
          conversation={mockConversation}
          messages={messages}
          loading={false}
          error={null}
          hasMore={false}
          onLoadMore={jest.fn()}
          onRefresh={jest.fn()}
        />
      );

      // ✅ All messages should have .ds-messageContent class
      const messageContents = container.querySelectorAll('.ds-messageContent');
      expect(messageContents).toHaveLength(3);

      // ✅ Each message should have correct formatting
      expect(messageContents[0].innerHTML).toContain('<b>Bold message</b>');
      expect(messageContents[1].querySelector('pre')).toBeInTheDocument();
      expect(messageContents[2].innerHTML).toContain('<i>Italic message</i>');
    });
  });
});
