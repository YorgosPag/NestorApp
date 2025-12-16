'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { Bell, MessageCircle, User, Clock } from 'lucide-react';
import { HOVER_TEXT_EFFECTS, HOVER_BACKGROUND_EFFECTS, INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { COLLECTIONS } from '@/config/firestore-collections';

interface TelegramMessage {
  id: string;
  content: string;
  from: string;
  direction: 'inbound' | 'outbound';
  createdAt: any;
  status: string;
}

export function TelegramNotifications() {
  const [newMessages, setNewMessages] = useState<TelegramMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    // Real-time listener για νέα Telegram μηνύματα
    const q = query(
      collection(db, COLLECTIONS.COMMUNICATIONS),
      where('type', '==', 'telegram'),
      where('direction', '==', 'inbound'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages: TelegramMessage[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        messages.push({
          id: doc.id,
          content: data.content,
          from: data.from,
          direction: data.direction,
          createdAt: data.createdAt,
          status: data.status
        });
      });

      setNewMessages(messages);
      setUnreadCount(messages.filter(m => m.status === 'received').length);

      // Browser notification για νέα μηνύματα
      if (messages.length > 0 && messages[0].status === 'received') {
        showBrowserNotification(messages[0]);
      }
    });

    return () => unsubscribe();
  }, []);

  const showBrowserNotification = (message: TelegramMessage) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Νέο Telegram μήνυμα', {
        body: message.content.substring(0, 100) + '...',
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

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('el-GR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button 
        onClick={() => setShowNotifications(!showNotifications)}
        className={`relative p-2 text-gray-600 ${HOVER_TEXT_EFFECTS.BLUE} ${HOVER_BACKGROUND_EFFECTS.BLUE_LIGHT} rounded-lg transition-colors`}
        title="Telegram Messages"
      >
        <MessageCircle className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Panel */}
      {showNotifications && (
        <div className="absolute right-0 top-12 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 flex items-center">
                <MessageCircle className="w-4 h-4 mr-2" />
                Telegram Messages
              </h3>
              <button
                onClick={requestNotificationPermission}
                className={`text-xs text-blue-600 ${HOVER_TEXT_EFFECTS.BLUE_DARK}`}
                title="Enable Browser Notifications"
              >
                <Bell className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {newMessages.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>Δεν υπάρχουν νέα μηνύματα</p>
              </div>
            ) : (
              newMessages.map((message) => (
                <div 
                  key={message.id}
                  className={`p-3 border-b border-gray-100 ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} cursor-pointer transition-colors ${
                    message.status === 'received' ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <User className="w-8 h-8 text-gray-400 bg-gray-100 rounded-full p-1" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          User {message.from.slice(-6)}
                        </p>
                        <div className="flex items-center text-xs text-gray-500">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatTime(message.createdAt)}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {message.content}
                      </p>
                      {message.status === 'received' && (
                        <span className="inline-block mt-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                          Νέο
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-3 border-t border-gray-200">
            <a 
              href="/crm/communications"
              className={`block w-full text-center text-sm text-blue-600 ${HOVER_TEXT_EFFECTS.BLUE_DARK} font-medium`}
            >
              Δείτε όλα τα μηνύματα →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}