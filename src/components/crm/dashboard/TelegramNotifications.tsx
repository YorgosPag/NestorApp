/* eslint-disable custom/no-hardcoded-strings */
'use client';

import { useEffect, useState } from 'react';
import { where, orderBy } from 'firebase/firestore';
import { Bell, MessageCircle, User, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { HOVER_TEXT_EFFECTS, HOVER_BACKGROUND_EFFECTS, INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { useCompanyId } from '@/hooks/useCompanyId';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { truncateText } from '@/lib/text-utils';
import { formatFlexibleTimeOnly } from '@/lib/intl-utils';
import '@/lib/design-system';

/** Firestore Timestamp type */
interface FirestoreTimestamp {
  toDate: () => Date;
}

interface TelegramMessage {
  id: string;
  content: string;
  from: string;
  direction: 'inbound' | 'outbound';
  createdAt: FirestoreTimestamp | Date | string | null;
  status: string;
}

export function TelegramNotifications() {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('communications');
  const companyId = useCompanyId()?.companyId;
  const [newMessages, setNewMessages] = useState<TelegramMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    // 🏢 ADR-214 (C.5.33): subscribe via firestoreQueryService SSoT.
    // companyId auto-injected via buildTenantConstraints.
    // 🔄 2026-01-17: Changed from COMMUNICATIONS to MESSAGES (COMMUNICATIONS collection deprecated)
    const unsubscribe = firestoreQueryService.subscribe<Record<string, unknown> & { id: string }>(
      'MESSAGES',
      (result) => {
        const messages: TelegramMessage[] = result.documents.map((data) => ({
          id: data.id,
          content: data.content as string,
          from: data.from as string,
          direction: data.direction as TelegramMessage['direction'],
          createdAt: data.createdAt as TelegramMessage['createdAt'],
          status: data.status as string,
        }));

        setNewMessages(messages);
        setUnreadCount(messages.filter(m => m.status === 'received').length);

        // Browser notification για νέα μηνύματα
        if (messages.length > 0 && messages[0].status === 'received') {
          showBrowserNotification(messages[0]);
        }
      },
      () => { /* silent fail */ },
      {
        constraints: [
          where('type', '==', 'telegram'),
          where('direction', '==', 'inbound'),
          orderBy('createdAt', 'desc'),
        ],
        maxResults: 10,
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  const showBrowserNotification = (message: TelegramMessage) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(t('telegram.newMessage'), {
        body: truncateText(message.content, 100),
        icon: '/telegram-icon.png',
        tag: 'telegram-message'
      });
    }
  };

  const requestNotificationPermission = () => {
    if ('Notification' in window) {
      Notification.requestPermission();
    }
  };

  // 🏢 ENTERPRISE: Centralized time formatting (ADR-208)
  const formatTime = formatFlexibleTimeOnly;

  return (
    <div className="relative">
      {/* Notification Bell */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className={`relative p-2 ${colors.text.muted} ${HOVER_TEXT_EFFECTS.BLUE} ${HOVER_BACKGROUND_EFFECTS.BLUE_LIGHT} rounded-lg transition-colors`}
          >
            <MessageCircle className={iconSizes.lg} />
            {unreadCount > 0 && (
              <span className={`absolute -top-1 -right-1 ${colors.bg.danger} ${colors.text.inverted} text-xs rounded-full ${iconSizes.md} flex items-center justify-center`}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>{t('telegram.title')}</TooltipContent>
      </Tooltip>

      {/* Notifications Panel */}
      {showNotifications && (
        <div className={`absolute right-0 top-12 w-80 ${colors.bg.primary} rounded-lg shadow-lg ${quick.card} z-50`}>
          <div className={`p-4 ${quick.borderB}`}>
            <div className="flex items-center justify-between">
              <h3 className={`font-semibold ${colors.text.primary} flex items-center`}>
                <MessageCircle className={`${iconSizes.sm} mr-2`} />
                {t('telegram.title')}
              </h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={requestNotificationPermission}
                    className={`text-xs ${colors.text.info} ${HOVER_TEXT_EFFECTS.BLUE_DARK}`}
                  >
                    <Bell className={iconSizes.sm} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Enable Browser Notifications</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {newMessages.length === 0 ? (
              <div className={`p-4 text-center ${colors.text.muted}`}>
                <MessageCircle className={`${iconSizes.xl} mx-auto mb-2 ${colors.text.disabled}`} />
                <p>{t('telegram.noMessages')}</p>
              </div>
            ) : (
              newMessages.map((message) => (
                <div 
                  key={message.id}
                  className={`p-3 ${quick.borderB} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} cursor-pointer transition-colors ${
                    message.status === 'received' ? colors.bg.infoSubtle : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <User className={`${iconSizes.xl} ${colors.text.secondary} ${colors.bg.secondary} rounded-full p-1`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-medium ${colors.text.primary} truncate`}>
                          User {message.from.slice(-6)}
                        </p>
                        <div className={`flex items-center text-xs ${colors.text.muted}`}>
                          <Clock className={`${iconSizes.xs} mr-1`} />
                          {formatTime(message.createdAt)}
                        </div>
                      </div>
                      <p className={`text-sm ${colors.text.secondary} mt-1 line-clamp-2`}>
                        {message.content}
                      </p>
                      {message.status === 'received' && (
                        <span className={`inline-block mt-1 px-2 py-1 text-xs font-medium ${colors.bg.infoSubtle} ${colors.text.info} rounded-full`}>
                          {t('telegram.newBadge')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className={`p-3 ${quick.borderT}`}>
            <a
              href="/crm/communications"
              className={`block w-full text-center text-sm ${colors.text.info} ${HOVER_TEXT_EFFECTS.BLUE_DARK} font-medium`}
            >
              {t('telegram.viewAll')} →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}