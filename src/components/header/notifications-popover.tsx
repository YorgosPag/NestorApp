"use client"

import * as React from "react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { CommonBadge } from "@/core/badges"
import { Bell } from "lucide-react"
import { useIconSizes } from '@/hooks/useIconSizes'
import { getNotifications } from "@/constants/header"
import { NotificationItem } from "@/components/header/notification-item"
import type { Notification } from "@/types/header"
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { createModuleLogger } from '@/lib/telemetry'

const logger = createModuleLogger('NotificationsPopover')

export function NotificationsPopover() {
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('common');
  const [notifications, setNotifications] = React.useState<Notification[]>([])

  React.useEffect(() => {
    const loadNotifications = async () => {
      try {
        const data = await getNotifications()
        setNotifications(data)
      } catch (error) {
        logger.error('Error loading notifications', { error })
        setNotifications([])
      }
    }

    loadNotifications()
  }, [])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className={iconSizes.sm} />
          {notifications.length > 0 && (
            <CommonBadge
              status="company"
              customLabel={notifications.length.toString()}
              variant="destructive"
              className={`absolute -top-1 -right-1 ${iconSizes.md} p-0 flex items-center justify-center text-xs`}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold">{t('header.notifications.title')}</h4>
          <Button variant="ghost" size="sm">
            {t('header.notifications.clearAll')}
          </Button>
        </div>
        <div className="space-y-2">
          {notifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
