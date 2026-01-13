'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, CheckCheck, Filter, Loader2, AlertCircle, Inbox } from 'lucide-react';
import { useNotifications } from './useNotifications';
import { NotificationCard } from './NotificationCard';
import { useIconSizes } from '@/hooks/useIconSizes';

export default function CrmNotificationsPage() {
  const iconSizes = useIconSizes();
  const {
    notifications,
    loading,
    error,
    unreadCount,
    markAllAsRead,
  } = useNotifications();

  return (
    <div className="p-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className={iconSizes.lg} />
                Κέντρο Ειδοποιήσεων
                {unreadCount > 0 && (
                  <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                    {unreadCount}
                  </span>
                )}
              </CardTitle>
              <CardDescription>Όλες οι ενημερώσεις σας σε ένα μέρος.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline">
                <Filter className={`${iconSizes.sm} mr-2`} />
                Φίλτρα
              </Button>
              <Button
                onClick={() => void markAllAsRead()}
                disabled={unreadCount === 0 || loading}
              >
                <CheckCheck className={`${iconSizes.sm} mr-2`} />
                Όλες ως διαβασμένες
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Φόρτωση ειδοποιήσεων...</span>
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
              <p className="text-lg font-medium">Δεν υπάρχουν ειδοποιήσεις</p>
              <p className="text-sm">Θα εμφανιστούν εδώ όταν έχετε νέες ενημερώσεις.</p>
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
