// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import { useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, CheckCheck, Filter, Loader2, AlertCircle, Inbox, FlaskConical, Trash2 } from 'lucide-react';
import { useNotifications } from './useNotifications';
import { NotificationCard } from './NotificationCard';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useAuth } from '@/auth/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';

export default function CrmNotificationsPage() {
  const { t } = useTranslation('crm');
  const iconSizes = useIconSizes();
  const { user } = useAuth();
  const [testNotificationId, setTestNotificationId] = useState<string | null>(null);
  const [isCreatingTest, setIsCreatingTest] = useState(false);
  const {
    notifications,
    loading,
    error,
    unreadCount,
    markAllAsRead,
  } = useNotifications();

  // 🧪 Create test notification (for development testing)
  const createTestNotification = useCallback(async () => {
    if (!user?.uid) return;

    setIsCreatingTest(true);
    try {
      const docRef = await addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        tenantId: 'default',
        title: '🧪 Test: Νέο Lead από Website',
        body: 'Ο Γιάννης Παπαδόπουλος έδειξε ενδιαφέρον για το έργο Κέντρο. (Αυτή είναι δοκιμαστική ειδοποίηση)',
        severity: 'info',
        channel: 'inapp',
        delivery: { state: 'delivered', attempts: 1 },
        source: { service: 'test', feature: 'lead', env: 'dev' },
        createdAt: Timestamp.now()
      });
      setTestNotificationId(docRef.id);
      console.log('✅ Test notification created:', docRef.id);
    } catch (err) {
      console.error('Failed to create test notification:', err);
    } finally {
      setIsCreatingTest(false);
    }
  }, [user?.uid]);

  // 🗑️ Delete test notification
  const deleteTestNotification = useCallback(async () => {
    if (!testNotificationId) return;

    try {
      await deleteDoc(doc(db, 'notifications', testNotificationId));
      setTestNotificationId(null);
      console.log('🗑️ Test notification deleted');
    } catch (err) {
      console.error('Failed to delete test notification:', err);
    }
  }, [testNotificationId]);

  return (
    <div className="p-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className={iconSizes.lg} />
                {t('notifications.title')}
                {unreadCount > 0 && (
                  <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                    {unreadCount}
                  </span>
                )}
              </CardTitle>
              <CardDescription>{t('notifications.description')}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* 🧪 Test Buttons - Development Only */}
              {process.env.NODE_ENV === 'development' && (
                <>
                  {!testNotificationId ? (
                    <Button
                      variant="outline"
                      onClick={() => void createTestNotification()}
                      disabled={isCreatingTest || !user}
                      className="border-dashed"
                    >
                      <FlaskConical className={`${iconSizes.sm} mr-2`} />
                      {isCreatingTest ? t('notifications.creating') : '🧪 Test'}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => void deleteTestNotification()}
                      className="border-dashed text-destructive hover:text-destructive"
                    >
                      <Trash2 className={`${iconSizes.sm} mr-2`} />
                      {t('notifications.deleteTest')}
                    </Button>
                  )}
                </>
              )}
              <Button variant="outline">
                <Filter className={`${iconSizes.sm} mr-2`} />
                {t('notifications.filters')}
              </Button>
              <Button
                onClick={() => void markAllAsRead()}
                disabled={unreadCount === 0 || loading}
              >
                <CheckCheck className={`${iconSizes.sm} mr-2`} />
                {t('notifications.markAllRead')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">{t('notifications.loading')}</span>
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="flex items-center justify-center gap-3 rounded-lg border border-destructive/20 bg-destructive/10 py-8 text-destructive">
              <AlertCircle className="h-6 w-6" />
              <span>{error}</span>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Inbox className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">{t('notifications.empty')}</p>
              <p className="text-sm">{t('notifications.emptyDescription')}</p>
            </div>
          )}

          {/* Notifications List */}
          {!loading && !error && notifications.length > 0 && (
            <div className="space-y-4">
              {notifications.map((n) => (
                <NotificationCard key={n.id} notification={n} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
