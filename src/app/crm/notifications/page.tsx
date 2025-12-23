'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, CheckCheck, Filter } from 'lucide-react';
import { useNotifications } from './useNotifications';
import { NotificationCard } from './NotificationCard';
import { useIconSizes } from '@/hooks/useIconSizes';

export default function CrmNotificationsPage() {
  const iconSizes = useIconSizes();
  const notifications = useNotifications();

  return (
    <div className="p-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className={iconSizes.lg} />
                Κέντρο Ειδοποιήσεων
              </CardTitle>
              <CardDescription>Όλες οι ενημερώσεις σας σε ένα μέρος.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline">
                    <Filter className={`${iconSizes.sm} mr-2`}/>
                    Φίλτρα
                </Button>
                 <Button>
                    <CheckCheck className={`${iconSizes.sm} mr-2`}/>
                    Όλες ως διαβασμένες
                </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {notifications.map((n) => (
              <NotificationCard key={n.id} notification={n} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
